"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { askClaude, claudeConfigured, extractClaudeQualification, testClaudeConnection } from "@/lib/assistant/claude";
import { assistantLeadContext } from "@/lib/assistant/lead-context";
import { isAssistantDraftKind, parseAssistantEdit, type AssistantDraft, type AssistantDraftKind, type AssistantEditPreview, type AssistantStatus, type AssistantTurn } from "@/lib/assistant/types";
import { anonymizeAgencyText, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";
import { isUuid } from "@/lib/is-uuid";
import { getLeadEmailWorkspace, saveLeadEmailDraft } from "@/app/(dashboard)/leads/email-actions";
import { parseQualificationImport, type QualificationPreview } from "@/lib/assistant/qualification";
import { buildQualificationPatch } from "@/lib/assistant/qualification-patch";

const denied = { ok: false, error: "Cette action n’est pas accessible avec votre compte." } as const;
const inactive = { ok: false, error: "Activez Claude pour utiliser l’assistant." } as const;
const invalid = { ok: false, error: "La demande de l’assistant est invalide." } as const;

async function session() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "admin" || data?.role === "lead_referent" ? { db, userId: user.id, admin: data.role === "admin" } : null;
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
  return { ok: true as const, ...auth };
}

type ActiveSession = Extract<Awaited<ReturnType<typeof activeSession>>, { ok: true }>;
const stale = { ok: false, error: "Le dossier a changé. Demandez une nouvelle proposition à Claude." } as const;
const editDenied = { ok: false, error: "Prenez d’abord ce dossier dans le Desk. Seul le référent ou un administrateur peut modifier un dossier ouvert." } as const;

function canEditLead(auth: ActiveSession, lead: { referent_id?: unknown; closed_at?: unknown; status?: unknown }) {
  return !lead.closed_at && lead.status !== "won" && lead.status !== "lost" &&
    Boolean(lead.referent_id && (auth.admin || lead.referent_id === auth.userId));
}

async function saveConfirmedPatch(auth: ActiveSession, leadId: string, updatedAt: string, patch: Record<string, unknown>) {
  const result = await auth.db.from("leads").update(patch).eq("id", leadId)
    .eq("updated_at", updatedAt).is("deleted_at", null).is("closed_at", null).select("id").maybeSingle();
  if (result.error) return { ok: false as const, error: "Le dossier n’a pas pu être enregistré." };
  if (!result.data) return stale;
  for (const path of [`/leads/${leadId}`, "/leads", "/inbox", "/dashboard"]) revalidatePath(path);
  return { ok: true as const };
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
    const { edit, ...answer } = await askClaude(safeTurns, assistantLeadContext(lead));
    if (edit && (!canEditLead(auth, data) || typeof data.updated_at !== "string")) {
      return { ok: true as const, answer, editPreview: null, editError: editDenied.error };
    }
    const editPreview: AssistantEditPreview | null = edit ? {
      leadId, updatedAt: data.updated_at, edit,
      previous: edit.kind === "priority" ? data.priority ?? "normal" : null,
    } : null;
    return { ok: true as const, answer, editPreview };
  } catch {
    return { ok: false as const, error: "Claude est momentanément indisponible. Vous pouvez poursuivre dans le dossier." };
  }
}

export async function confirmAssistantEdit(preview: AssistantEditPreview) {
  if (!preview || typeof preview.leadId !== "string" || !isUuid(preview.leadId) ||
      typeof preview.updatedAt !== "string" || !Number.isFinite(Date.parse(preview.updatedAt))) return invalid;
  const edit = parseAssistantEdit(preview.edit?.kind, preview.edit?.value);
  if (!edit) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data, error } = await auth.db.from("leads").select("internal_notes,priority,updated_at,referent_id,closed_at,status")
    .eq("id", preview.leadId).is("deleted_at", null).maybeSingle();
  if (error || !data || !canEditLead(auth, data)) return editDenied;
  if (data.updated_at !== preview.updatedAt) return stale;
  if (edit.kind === "priority" && (data.priority ?? "normal") !== preview.previous) return stale;
  const patch = edit.kind === "note"
    ? { internal_notes: [data.internal_notes?.trimEnd(), edit.value].filter(Boolean).join("\n\n") }
    : { priority: edit.value };
  return saveConfirmedPatch(auth, preview.leadId, preview.updatedAt, patch);
}

export async function previewAssistantQualification(leadId: string, notes: string) {
  if (typeof leadId !== "string" || !isUuid(leadId) || typeof notes !== "string" || !notes.trim() || notes.length > 6000) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data, error } = await auth.db.from("leads").select("traveler_name,email,phone,updated_at,referent_id,closed_at,status")
    .eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (error || !data || !canEditLead(auth, data)) return editDenied;
  try {
    const qualification = await extractClaudeQualification(anonymizeAgencyText(notes, data));
    if (!qualification) return { ok: false as const, error: "DA Sales n’a pas trouvé de champs à renseigner. Précisez les informations données par le voyageur." };
    const preview: QualificationPreview = { leadId, updatedAt: data.updated_at, qualification };
    return { ok: true as const, preview };
  } catch {
    return { ok: false as const, error: "DA Sales n’a pas pu analyser ces notes. Réessayez dans un instant." };
  }
}

export async function confirmAssistantQualification(preview: QualificationPreview) {
  if (!preview || typeof preview.leadId !== "string" || !isUuid(preview.leadId) ||
      typeof preview.updatedAt !== "string" || !Number.isFinite(Date.parse(preview.updatedAt))) return invalid;
  const qualification = parseQualificationImport(preview.qualification);
  if (!qualification) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data, error } = await auth.db.from("leads").select("intake_payload,ai_qualification_payload,trip_summary,updated_at,referent_id,closed_at,status")
    .eq("id", preview.leadId).is("deleted_at", null).maybeSingle();
  if (error || !data || !canEditLead(auth, data)) return editDenied;
  if (data.updated_at !== preview.updatedAt) return stale;
  return saveConfirmedPatch(auth, preview.leadId, preview.updatedAt, buildQualificationPatch(data, qualification));
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
