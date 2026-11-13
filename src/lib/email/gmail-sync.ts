import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyGmailReply, DESK_MAILBOX, identifyGmailMessage, readGmailContent, type GmailMessage } from "./gmail-intake";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

class GmailError extends Error {
  constructor(readonly status: number) { super("Gmail request failed"); }
}

function credentials() {
  const clientId = process.env.DESK_GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.DESK_GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.DESK_GMAIL_REFRESH_TOKEN?.trim();
  return clientId && clientSecret && refreshToken ? { clientId, clientSecret, refreshToken } : null;
}

export function deskGmailConfiguration() {
  if (process.env.DESK_GMAIL_ENABLED !== "true") return "disabled";
  return credentials() ? "configured" : "unconfigured";
}

async function token(signal: AbortSignal) {
  const config = credentials();
  if (!config) throw new Error("Missing Gmail configuration");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    body: new URLSearchParams({
      grant_type: "refresh_token", client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken,
    }),
    signal,
  });
  if (!response.ok) throw new GmailError(response.status);
  const { access_token: accessToken } = await response.json();
  if (typeof accessToken !== "string" || !accessToken) throw new Error("Missing access token");
  return accessToken;
}

async function connectDeskGmail(signal: AbortSignal) {
  const accessToken = await token(signal);
  async function get<T>(path: string): Promise<T> {
    const response = await fetch(API + path, {
      headers: { Authorization: "Bearer " + accessToken }, cache: "no-store", signal,
    });
    if (!response.ok) throw new GmailError(response.status);
    return response.json() as Promise<T>;
  }
  const profile = await get<{ emailAddress: string; historyId: string }>("/profile");
  if (profile.emailAddress?.toLowerCase() !== DESK_MAILBOX) throw new Error("Unexpected Gmail account");
  return { get, profile };
}

/** Recherche en lecture seule dans la boîte partagée. L'appelant vérifie les droits. */
export async function searchDeskGmail(terms: string, days: number, requestSignal?: AbortSignal) {
  const timeout = AbortSignal.timeout(10_000);
  const signal = requestSignal ? AbortSignal.any([requestSignal, timeout]) : timeout;
  const { get } = await connectDeskGmail(signal);
  const query = new URLSearchParams({
    q: ["newer_than:" + days + "d", "-in:sent", "-in:drafts", terms].filter(Boolean).join(" "),
    maxResults: "8",
    includeSpamTrash: "false",
  });
  const result = await get<{ messages?: { id: string }[]; nextPageToken?: string }>("/messages?" + query);
  const ids = (result.messages ?? []).slice(0, 8).map(({ id }) => id).filter(id => /^[a-f0-9]+$/i.test(id));
  const messages = await Promise.all(ids.map(async id => {
    try {
      return await get<GmailMessage>("/messages/" + id + "?format=full");
    } catch (error) {
      if (error instanceof GmailError && error.status === 404) return null;
      throw error;
    }
  }));
  return { messages: messages.filter(message => message !== null), more: Boolean(result.nextPageToken) };
}

type History = {
  historyId: string;
  nextPageToken?: string;
  history?: { id: string; messagesAdded?: { message: { id: string } }[] }[];
};

export function gmailHistoryBatch(page: History) {
  const entries = page.history ?? [];
  const checkpoint = page.nextPageToken ? entries.at(-1)?.id : page.historyId;
  if (!checkpoint || !/^\d+$/.test(checkpoint)) throw new Error("Missing Gmail history checkpoint");
  const ids = [...new Set(entries.flatMap((entry) => (entry.messagesAdded ?? []).map(({ message }) => message.id)))];
  if (ids.some((id) => !/^[a-f0-9]+$/i.test(id))) throw new Error("Invalid Gmail message id");
  return { checkpoint, ids };
}

export async function syncDeskGmail(db: SupabaseClient) {
  const signal = AbortSignal.timeout(42_000);
  const { data: state, error } = await db.from("desk_gmail_sync").select("history_id").eq("id", true).maybeSingle();
  if (error) throw new Error("Could not read Gmail sync state");
  const cursor = state?.history_id as string | undefined;
  let expired = false;
  try {
    const { get, profile } = await connectDeskGmail(signal);

    if (!cursor) {
      const { error: initializeError } = await db.from("desk_gmail_sync")
        .upsert({ id: true, history_id: profile.historyId }, { onConflict: "id", ignoreDuplicates: true });
      if (initializeError) throw new Error("Could not initialize Gmail sync");
      return { initialized: true, imported: 0 };
    }

    const query = new URLSearchParams({ startHistoryId: cursor, historyTypes: "messageAdded", maxResults: "8" });
    const history = await get<History>("/history?" + query).catch((cause: unknown) => {
      expired = cause instanceof GmailError && cause.status === 404;
      throw cause;
    });
    const { checkpoint, ids } = gmailHistoryBatch(history);
    if (BigInt(checkpoint) < BigInt(cursor) || (history.nextPageToken && checkpoint === cursor)) {
      throw new Error("Gmail history did not advance");
    }
    const metadata = new URLSearchParams({ format: "metadata" });
    for (const name of ["From", "Subject", "Auto-Submitted"]) metadata.append("metadataHeaders", name);
    async function message(id: string, query: string) {
      return get<GmailMessage>("/messages/" + id + "?" + query).catch((cause: unknown) => {
        if (cause instanceof GmailError && cause.status === 404) return null;
        throw cause;
      });
    }

    let imported = 0;
    for (const id of ids) {
      const envelope = await message(id, metadata.toString());
      const incoming = envelope && identifyGmailMessage(envelope);
      if (!incoming) continue;
      const { data: match, error: matchError } = await db.rpc("match_desk_gmail_reply", {
        p_reference: incoming.reference, p_sender: incoming.sender, p_received_at: incoming.receivedAt,
      }).maybeSingle<{ lead_id: string; correspondent: "agency" | "traveler" }>();
      if (matchError) throw new Error("Could not match Gmail reply");
      if (!match) continue;
      const source = await message(id, "format=full");
      if (!source || identifyGmailMessage(source)?.sender !== incoming.sender) continue;
      const content = readGmailContent(source);
      const { data: saved, error: saveError } = await db.from("desk_gmail_messages").upsert({
        gmail_id: id, gmail_thread_id: incoming.threadId, lead_id: match.lead_id, sender: incoming.sender,
        subject: incoming.subject.replace(/\0/g, ""), received_at: incoming.receivedAt,
        kind: classifyGmailReply(match.correspondent, content), ...content,
      }, { onConflict: "gmail_id", ignoreDuplicates: true }).select("gmail_id");
      if (saveError) throw new Error("Could not store Gmail reply");
      imported += saved?.length ?? 0;
    }
    const { error: advanceError } = await db.from("desk_gmail_sync")
      .update({ history_id: checkpoint, synced_at: new Date().toISOString(), last_error: null })
      .eq("id", true).eq("history_id", cursor);
    if (advanceError) throw new Error("Could not save Gmail sync checkpoint");
    return { imported, more: Boolean(history.nextPageToken) };
  } catch (cause) {
    if (cursor) {
      await db.from("desk_gmail_sync").update({ last_error: expired ? "history_expired" : "sync_failed" })
        .eq("id", true).eq("history_id", cursor);
    }
    throw cause;
  }
}
