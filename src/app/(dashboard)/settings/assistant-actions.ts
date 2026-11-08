"use server";

import { createClient } from "@/lib/supabase/server";
import { askClaude, claudeConfigured, testClaudeConnection } from "@/lib/assistant/claude";
import { assistantLeadContext } from "@/lib/assistant/lead-context";
import { isAssistantDraftKind, type AssistantDraft, type AssistantDraftKind, type AssistantStatus, type AssistantTurn } from "@/lib/assistant/types";
import { anonymizeAgencyText, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";
import { isUuid } from "@/lib/is-uuid";
import { getLeadEmailWorkspace, saveLeadEmailDraft } from "@/app/(dashboard)/leads/email-actions";

const denied = { ok: false, error: "Cette action n’est pas accessible avec votre compte." } as const;
const inactive = { ok: false, error: "Activez Claude pour utiliser l’assistant." } as const;
const invalid = { ok: false, error: "La demande de l’assistant est invalide." } as const;

async function session() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "admin" || data?.role === "lead_referent" ? { db, admin: data.role === "admin" } : null;
}

async function status(db: NonNullable<Awaited<ReturnType<typeof session>>>["db"]): Promise<AssistantStatus> {
  const { data, error } = await db.from("desk_assistant_settings").select("enabled,tested_at").eq("id", true)
    .abortSignal(AbortSignal.timeout(4000)).maybeSingle();
  const enabled = data?.enabled === true;
  const testedAt = typeof data?.tested_at === "string" ? data.tested_at : null;
  const state = !claudeConfigured() ? "unconfigured" : error || !data ? "unavailable" : enabled ? "connected" : "disabled";
  return { state, enabled, testedAt };
}

export async function getAssistantStatus() {
  const auth = await session();
  return auth ? { ok: true as const, status: await status(auth.db), admin: auth.admin } : denied;
}

export async function setAssistantEnabled(enabled: boolean) {
  if (typeof enabled !== "boolean") return invalid;
  const auth = await session();
  if (!auth?.admin) return denied;
  const current = await status(auth.db);
  if (current.state === "unavailable") {
    return { ok: false as const, error: "Les réglages de l’assistant sont indisponibles. Vérifiez les migrations du Desk." };
  }
  if (enabled) {
    if (!claudeConfigured()) return { ok: false as const, error: "Configurez ANTHROPIC_API_KEY côté serveur." };
    try {
      await testClaudeConnection();
    } catch {
      return { ok: false as const, error: "La connexion à Claude a échoué. Vérifiez la clé et le modèle configurés." };
    }
  }
  const { error, data } = await auth.db.from("desk_assistant_settings").update(
    enabled ? { enabled, tested_at: new Date().toISOString() } : { enabled },
  ).eq("id", true).select("id").maybeSingle();
  return error || !data
    ? { ok: false as const, error: "Impossible d’enregistrer le réglage Claude." }
    : { ok: true as const, status: await status(auth.db), admin: auth.admin };
}

async function activeSession() {
  const auth = await session();
  if (!auth) return denied;
  if ((await status(auth.db)).state !== "connected") return inactive;
  return { ok: true as const, db: auth.db };
}

function validTurns(turns: unknown): turns is AssistantTurn[] {
  return Array.isArray(turns) && turns.length > 0 && turns.length <= 9 && turns.length % 2 === 1 &&
    turns.every((turn, i) => turn && turn.role === (i % 2 === 0 ? "user" : "assistant") &&
      typeof turn.content === "string" && Boolean(turn.content.trim()) && turn.content.length <= (i % 2 === 0 ? 1600 : 4000));
}

export async function chatWithAssistant(leadId: string, turns: AssistantTurn[]) {
  if (typeof leadId !== "string" || !isUuid(leadId) || !validTurns(turns)) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data, error } = await auth.db.from("leads").select("*").eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (error || !data) return { ok: false as const, error: "Ce dossier n’est plus accessible." };
  const lead = data as LeadEmailTemplateInput;
  try {
    const safeTurns = turns.map(({ role, content }) => ({
      role, content: anonymizeAgencyText(content, lead).trim() || "(message vide)",
    }));
    return { ok: true as const, answer: await askClaude(safeTurns, assistantLeadContext(lead)) };
  } catch {
    return { ok: false as const, error: "Claude est momentanément indisponible. Vous pouvez poursuivre dans le dossier." };
  }
}

async function draftPreview(leadId: string, kind: AssistantDraftKind, agencyId: string | null) {
  if (typeof leadId !== "string" || !isUuid(leadId) || !isAssistantDraftKind(kind) ||
      (kind === "agency_brief" ? typeof agencyId !== "string" || !isUuid(agencyId) : agencyId !== null)) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data: lead, error } = await auth.db.from("leads").select("id").eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (error || !lead) return { ok: false as const, error: "Ce dossier n’est plus accessible." };
  const workspace = await getLeadEmailWorkspace(leadId, kind, agencyId);
  if (!workspace.ok) return workspace;
  if (kind === "agency_brief" && !workspace.template.analysis.readyForAgencyBrief) {
    return { ok: false as const, error: "Terminez la qualification du dossier avant de préparer le brief pour chiffrage." };
  }
  if (!workspace.canEdit) return { ok: false as const, error: "Prenez d’abord ce dossier dans le Desk pour y enregistrer des brouillons." };
  if (!workspace.storageReady || workspace.recipientError || !workspace.recipient) {
    return { ok: false as const, error: workspace.storageError || workspace.recipientError || "Destinataire indisponible." };
  }
  const { draft, template } = workspace;
  const preview: AssistantDraft = {
    leadId, kind, agencyId, proposalId: workspace.proposalId,
    draftId: draft?.id ?? null, updatedAt: draft?.updated_at ?? null, recipient: workspace.recipient,
    subject: draft?.subject ?? template.subject, bodyText: draft?.body_text ?? template.bodyText,
    language: draft?.language ?? template.language,
  };
  return { ok: true as const, preview };
}

export async function prepareAssistantDraft(leadId: string, kind: AssistantDraftKind, agencyId: string | null) {
  return draftPreview(leadId, kind, agencyId);
}

export async function confirmAssistantDraft(preview: AssistantDraft) {
  if (!preview || typeof preview !== "object") return invalid;
  const current = await draftPreview(preview.leadId, preview.kind, preview.agencyId);
  if (!current.ok) return current;
  const next = current.preview;
  if (next.draftId !== preview.draftId || next.updatedAt !== preview.updatedAt || next.recipient !== preview.recipient ||
      next.proposalId !== preview.proposalId || next.subject !== preview.subject || next.bodyText !== preview.bodyText ||
      next.language !== preview.language) {
    return { ok: false as const, error: "Le dossier ou son brouillon a changé. Rouvrez l’aperçu avant de valider." };
  }
  if (next.draftId) return { ok: true as const, draftId: next.draftId };
  const saved = await saveLeadEmailDraft({ ...next, expectedRecipient: next.recipient });
  return saved.ok ? { ok: true as const, draftId: saved.draft.id } : saved;
}
