"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { askClaude, claudeConfigured, extractClaudeQualification, testClaudeConnection } from "@/lib/assistant/claude";
import { assistantLeadContext } from "@/lib/assistant/lead-context";
import { isAssistantDraftKind, parseAssistantEdit, type AssistantDraft, type AssistantDraftKind, type AssistantEdit, type AssistantEditPreview, type AssistantStatus, type AssistantTurn } from "@/lib/assistant/types";
import { anonymizeAgencyText, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";
import { isUuid } from "@/lib/is-uuid";
import { getLeadEmailWorkspace, saveLeadEmailDraft } from "@/app/(dashboard)/leads/email-actions";
import { parseQualificationImport, type QualificationPreview } from "@/lib/assistant/qualification";
import { buildAssistantBudgetPatch, buildQualificationPatch, qualificationChanges } from "@/lib/assistant/qualification-patch";
import { isDeskScope, isDeskTab, projectDeskLink, type DeskProjectTab, type DeskScope } from "@/lib/assistant/scope";
import { isTokenExpired, TOKEN_TTL_DAYS } from "@/lib/traveler-requalification";

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

function canEditLead(auth: Pick<ActiveSession, "admin" | "userId">, lead: { referent_id?: unknown; closed_at?: unknown; status?: unknown }) {
  return !lead.closed_at && lead.status !== "won" && lead.status !== "lost" &&
    Boolean(lead.referent_id && (auth.admin || lead.referent_id === auth.userId));
}

async function saveConfirmedPatch(auth: Pick<ActiveSession, "db">, leadId: string, updatedAt: string, patch: Record<string, unknown>) {
  const result = await auth.db.from("leads").update(patch).eq("id", leadId)
    .eq("updated_at", updatedAt).is("deleted_at", null).is("closed_at", null).select("id").maybeSingle();
  if (result.error) return { ok: false as const, error: "Le dossier n’a pas pu être enregistré." };
  if (!result.data) return stale;
  for (const path of [`/leads/${leadId}`, "/leads", "/inbox", "/dashboard"]) revalidatePath(path);
  return { ok: true as const };
}

async function saveConfirmedAssistantEdit(auth: ActiveSession, leadId: string, updatedAt: string, action: AssistantEdit["kind"] | "qualification", patch: Record<string, unknown>) {
  const result = await auth.db.rpc("apply_desk_assistant_edit", {
    p_lead_id: leadId, p_expected_updated_at: updatedAt, p_action: action, p_changes: patch,
  });
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

export async function chatWithAssistant(leadId: string, turns: AssistantTurn[], tab?: DeskProjectTab) {
  if (typeof leadId !== "string" || !isUuid(leadId) || !validTurns(turns) || (tab !== undefined && !isDeskTab(tab))) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data, error } = await auth.db.from("leads").select("*").eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (error || !data) return { ok: false as const, error: "Ce dossier n’est plus accessible." };
  const lead = data as LeadEmailTemplateInput;
  try {
    const safeTurns = turns.map(({ role, content }) => ({
      role, content: anonymizeAgencyText(content, lead).trim() || "(message vide)",
    }));
    let parcours;
    if (tab) {
      const { loadProjectForAssistant } = await import("@/lib/assistant/desk-data");
      const { projectPrompt } = await import("@/lib/assistant/project-readout");
      const project = await loadProjectForAssistant({
        supabase: auth.db, userId: auth.userId, role: auth.admin ? "admin" : "lead_referent", nom: "", apercu: false,
      }, leadId, lead);
      if (project) parcours = projectPrompt(project);
    }
    const context = assistantLeadContext(lead);
    const { edit, ...answer } = await askClaude(safeTurns, { ...context, onglet: tab, parcours });
    if (edit && (!canEditLead(auth, data) || typeof data.updated_at !== "string")) {
      return { ok: true as const, answer, editPreview: null, editError: editDenied.error };
    }
    const previousBudget = context.confirmed.find(({ id }) => id === "budget")?.value || data.budget || null;
    const editPreview: AssistantEditPreview | null = edit ? {
      leadId, updatedAt: data.updated_at, edit,
      previous: edit.kind === "priority" ? data.priority ?? "normal" : edit.kind === "budget" ? previousBudget : null,
    } : null;
    return { ok: true as const, answer, editPreview };
  } catch {
    return { ok: false as const, error: "Claude est momentanément indisponible. Vous pouvez poursuivre dans le dossier." };
  }
}

export async function getAssistantDeskView(scope: DeskScope, question = "") {
  if (!isDeskScope(scope) || typeof question !== "string" || question.length > 1600) return invalid;
  try {
    const { readDeskData } = await import("@/lib/assistant/desk-data");
    const desk = await readDeskData(scope, question);
    return desk ? { ok: true as const, view: desk.view } : denied;
  } catch {
    return { ok: false as const, error: "Les données du Desk sont momentanément indisponibles." };
  }
}

export async function chatOnDeskScope(scope: DeskScope, turns: AssistantTurn[]) {
  if (!isDeskScope(scope) || !validTurns(turns)) return invalid;
  try {
    const { cleanDeskText, readDeskData } = await import("@/lib/assistant/desk-data");
    const desk = await readDeskData(scope, turns.at(-1)!.content);
    if (!desk) return denied;
    const { view } = desk;
    const contextOnly = !desk.model || view.choices || Boolean(view.inbound) || view.items.some(item => item.draft);
    if (contextOnly) return { ok: true as const, reply: view.summary, view };
    const auth = await activeSession();
    if (!auth.ok) return { ok: true as const, reply: view.summary, view };
    const safeTurns = turns.map(({ role, content }) => ({ role, content: cleanDeskText(content, desk.projets).trim() || "(message vide)" }));
    try {
      const answer = await askClaude(safeTurns, { lectureSeule: true, ...desk.model });
      return { ok: true as const, reply: answer.reply, view };
    } catch {
      return { ok: true as const, reply: view.summary, view };
    }
  } catch {
    return { ok: false as const, error: "Les données du Desk sont momentanément indisponibles." };
  }
}

async function deskActionTarget(leadId: string, kind: "claim" | "brief" | "link") {
  if (!isUuid(leadId) || !["claim", "brief", "link"].includes(kind)) return invalid;
  const auth = await session();
  if (!auth) return denied;
  const { data: lead } = await auth.db.from("leads").select("id,reference,updated_at,referent_id,closed_at,status,generated_brief,public_token,public_token_expires_at,traveler_responses_submitted_at")
    .eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (!lead || lead.closed_at || ["won", "lost"].includes(lead.status)) return denied;
  if (kind === "claim" && lead.referent_id) return { ok: false as const, error: "Ce dossier a déjà un référent. Consulte la fiche pour voir son attribution." };
  if (kind !== "claim" && !canEditLead(auth, lead)) return editDenied;
  const { chargerProjets } = await import("@/lib/bo3/load");
  const [project] = kind === "claim" ? [] : await chargerProjets({
    supabase: auth.db, userId: auth.userId, role: auth.admin ? "admin" : "lead_referent", nom: "", apercu: false,
  }, { id: leadId });
  if (kind !== "claim" && (!project || project.updatedAt !== lead.updated_at)) return stale;
  if (kind === "brief" && (lead.generated_brief || project?.statut === "envoye")) return {
    ok: false as const, error: "Le dossier a déjà un brief ou un envoi déclaré. Ouvre Brief & agences pour poursuivre.",
  };
  if (kind === "brief" && (!project?.trame || project.manque.length)) return {
    ok: false as const, error: "Le brief attend une trame complète. À préciser dans la trame · " + (project?.manque.join(", ") || "parcours du voyage"),
  };
  if (kind === "link" && !project?.manque.length) return { ok: false as const, error: "La trame contient déjà les informations requises pour poursuivre." };
  const existingLink = kind === "link" && typeof lead.public_token === "string" && isUuid(lead.public_token) &&
    !lead.traveler_responses_submitted_at && !isTokenExpired(lead.public_token_expires_at) ? lead.public_token : null;
  return { ok: true as const, auth, project, existingLink, preview: {
    leadId, kind, version: lead.updated_at as string, reference: lead.reference || "DA-" + leadId.slice(0, 8).toUpperCase(),
  } };
}

export async function previewAssistantDeskAction(leadId: string, kind: "claim" | "brief" | "link") {
  const result = await deskActionTarget(leadId, kind);
  return result.ok ? { ok: true as const, preview: result.preview } : result;
}

export async function confirmAssistantDeskAction(preview: { leadId: string; kind: "claim" | "brief" | "link"; version: string }) {
  if (!preview || typeof preview.version !== "string") return invalid;
  const current = await deskActionTarget(preview.leadId, preview.kind);
  if (!current.ok) return current;
  if (current.preview.version !== preview.version) return stale;
  const { leadId, kind } = current.preview;
  const { auth, project, existingLink } = current;
  const now = new Date().toISOString();
  const save = (patch: Record<string, unknown>) => saveConfirmedPatch(auth, leadId, preview.version, patch);
  if (kind === "claim") {
    const saved = await save({ referent_id: auth.userId, referent_assigned_at: now });
    return saved.ok ? { ok: true as const, message: "Dossier pris en charge.", href: projectDeskLink(leadId) } : saved;
  }
  if (!project) return denied;
  if (kind === "brief") {
    const { briefToMarkdown, buildBrief } = await import("@/lib/bo3/projet");
    const saved = await save({ generated_brief: briefToMarkdown(buildBrief(project)), brief_generated_at: now, brief_edited_at: now });
    return saved.ok ? { ok: true as const, message: "Brief préparé depuis la trame. Il est prêt à relire.", href: projectDeskLink(leadId, "agences") } : saved;
  }
  const token = existingLink ?? crypto.randomUUID();
  if (!existingLink) {
    const saved = await save({ public_token: token, public_token_expires_at: new Date(Date.now() + TOKEN_TTL_DAYS * 86400000).toISOString(),
      traveler_responses_submitted_at: null });
    if (!saved.ok) return saved;
  }
  const base = (process.env.NEXT_PUBLIC_TRAVELER_BASE_URL || "https://app.directionlalgerie.com").replace(/\/$/, "");
  const url = `${base}/q/${token}?champs=${project.manque.join(",")}`;
  return { ok: true as const, message: "Lien de qualification prêt à copier.", url, href: projectDeskLink(leadId, "voyageur") };
}

export async function confirmAssistantEdit(preview: AssistantEditPreview) {
  if (!preview || typeof preview.leadId !== "string" || !isUuid(preview.leadId) ||
      typeof preview.updatedAt !== "string" || !Number.isFinite(Date.parse(preview.updatedAt))) return invalid;
  const edit = parseAssistantEdit(preview.edit?.kind, preview.edit?.value);
  if (!edit) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data, error } = await auth.db.from("leads").select("internal_notes,priority,intake_payload,ai_qualification_payload,trip_summary,updated_at,referent_id,closed_at,status")
    .eq("id", preview.leadId).is("deleted_at", null).maybeSingle();
  if (error || !data || !canEditLead(auth, data)) return editDenied;
  if (data.updated_at !== preview.updatedAt) return stale;
  if (edit.kind === "priority" && (data.priority ?? "normal") !== preview.previous) return stale;
  if (edit.kind === "note") return saveConfirmedAssistantEdit(auth, preview.leadId, preview.updatedAt, "note", { internal_notes: edit.value });
  if (edit.kind === "priority") return saveConfirmedAssistantEdit(auth, preview.leadId, preview.updatedAt, "priority", { priority: edit.value });
  return saveConfirmedAssistantEdit(auth, preview.leadId, preview.updatedAt, "budget", buildAssistantBudgetPatch(data, edit.value, {
    confirmedBy: auth.userId, confirmedAt: new Date().toISOString(),
  }));
}

export async function previewAssistantQualification(leadId: string, notes: string) {
  if (typeof leadId !== "string" || !isUuid(leadId) || typeof notes !== "string" || !notes.trim() || notes.length > 6000) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data, error } = await auth.db.from("leads").select("traveler_name,email,phone,updated_at,referent_id,closed_at,status,intake_payload,ai_qualification_payload,trip_summary,travel_period,travel_start_date,travel_end_date,budget,travelers_adults,travelers_children")
    .eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (error || !data || !canEditLead(auth, data)) return editDenied;
  try {
    const qualification = await extractClaudeQualification(anonymizeAgencyText(notes, data));
    if (!qualification) return { ok: false as const, error: "DA Sales n’a pas trouvé de champs à renseigner. Précisez les informations données par le voyageur." };
    const preview: QualificationPreview = { leadId, updatedAt: data.updated_at, qualification, changes: qualificationChanges(data, qualification) };
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
  return saveConfirmedAssistantEdit(auth, preview.leadId, preview.updatedAt, "qualification", buildQualificationPatch(data, qualification, {
    confirmedBy: auth.userId, confirmedAt: new Date().toISOString(),
  }));
}

async function draftPreview(leadId: string, kind: AssistantDraftKind, agencyId: string | null) {
  const agencyKind = kind === "agency_brief" || kind === "agency_feasibility";
  if (typeof leadId !== "string" || !isUuid(leadId) || !isAssistantDraftKind(kind) ||
      (agencyKind ? typeof agencyId !== "string" || !isUuid(agencyId) : agencyId !== null)) return invalid;
  const auth = await activeSession();
  if (!auth.ok) return auth;
  const { data: lead, error } = await auth.db.from("leads").select("id").eq("id", leadId).is("deleted_at", null).maybeSingle();
  if (error || !lead) return { ok: false as const, error: "Ce dossier n’est plus accessible." };
  const workspace = await getLeadEmailWorkspace(leadId, kind, agencyId);
  if (!workspace.ok) return workspace;
  if (kind === "agency_feasibility" && !workspace.feasibilityReady) return { ok: false as const, error: workspace.feasibilityMessage };
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
