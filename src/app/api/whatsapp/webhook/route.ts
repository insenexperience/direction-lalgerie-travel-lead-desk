import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  findLeadIdByWhatsAppPhone,
  processTravelerWhatsAppMessage,
} from "@/lib/leads-whatsapp-inbound";

export const runtime = "nodejs";

/** Si `WHATSAPP_APP_SECRET` est défini, impose une signature `X-Hub-Signature-256` valide. */
function verifyMetaSignature(body: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return true;
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
  try {
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && token && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const from = extractWhatsAppFrom(body);
  const text = extractWhatsAppText(body);
  if (!from || !text) {
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = createServiceRoleClient();
    let leadId = await findLeadIdByWhatsAppPhone(supabase, from);
    if (!leadId) {
      const { data: created, error: insErr } = await supabase
        .from("leads")
        .insert({
          traveler_name: `WhatsApp ${from}`,
          email: "",
          phone: from,
          whatsapp_phone_number: from,
          intake_channel: "whatsapp",
          status: "new",
          source: "WhatsApp",
          trip_summary: "Lead créé depuis WhatsApp — à qualifier.",
          travel_style: "—",
          travelers: "—",
          budget: "—",
          trip_dates: "—",
          qualification_summary: "—",
          internal_notes: "",
          quote_status: "Nouveau",
          starred: false,
          priority: "normal",
          referent_id: null,
        })
        .select("id")
        .single();
      if (insErr || !created) {
        return NextResponse.json({ error: insErr?.message ?? "insert" }, { status: 500 });
      }
      leadId = String(created.id);
    }

    const res = await processTravelerWhatsAppMessage(supabase, leadId, text);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function extractWhatsAppFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const entry = (body as Record<string, unknown>).entry;
  if (!Array.isArray(entry) || !entry[0]) return null;
  const e0 = entry[0] as Record<string, unknown>;
  const changes = e0.changes;
  if (!Array.isArray(changes) || !changes[0]) return null;
  const ch = changes[0] as Record<string, unknown>;
  const value = ch.value as Record<string, unknown> | undefined;
  const messages = value?.messages;
  if (!Array.isArray(messages) || !messages[0]) return null;
  const m0 = messages[0] as Record<string, unknown>;
  const from = m0.from;
  return typeof from === "string" ? from : null;
}

function extractWhatsAppText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const entry = (body as Record<string, unknown>).entry;
  if (!Array.isArray(entry) || !entry[0]) return null;
  const e0 = entry[0] as Record<string, unknown>;
  const changes = e0.changes;
  if (!Array.isArray(changes) || !changes[0]) return null;
  const ch = changes[0] as Record<string, unknown>;
  const value = ch.value as Record<string, unknown> | undefined;
  const messages = value?.messages;
  if (!Array.isArray(messages) || !messages[0]) return null;
  const m0 = messages[0] as Record<string, unknown>;
  const text = m0.text as Record<string, unknown> | undefined;
  const bodyText = text?.body;
  return typeof bodyText === "string" ? bodyText : null;
}
