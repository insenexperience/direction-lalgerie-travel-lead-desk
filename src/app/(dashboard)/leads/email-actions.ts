"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { isResendOutboundConfigured } from "@/lib/email/workflow-email-config";
import { sendTransactionalHtmlEmail } from "@/lib/email/resend-client";
import { anonymizeAgencyText, buildLeadEmailTemplate, LEAD_EMAIL_TEMPLATE_VERSION, type LeadEmailKind, type LeadEmailLanguage, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";

export type LeadEmailMessage = {
  id: string;
  lead_id: string;
  kind: LeadEmailKind;
  agency_id: string | null;
  proposal_id: string | null;
  recipient: string;
  subject: string;
  body_text: string;
  html: string;
  language: LeadEmailLanguage;
  status: "draft" | "sending" | "sent" | "failed" | "external";
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  error: string | null;
};
export type LeadEmailDraftInput = {
  leadId: string;
  kind: LeadEmailKind;
  agencyId?: string | null;
  proposalId?: string | null;
  draftId?: string | null;
  expectedUpdatedAt?: string | null;
  subject: string;
  bodyText: string;
  language: LeadEmailLanguage;
};

type Failure = { ok: false; error: string };
const KINDS: LeadEmailKind[] = ["welcome", "qualification", "agency_brief"];
const UNRESOLVED_DELIVERY = "Un email de ce type est encore en cours de transmission ou sans confirmation. Vérifiez son état auprès du prestataire avant tout nouvel envoi ou déclaration d’envoi externe.";

function migrationError(message: string): string {
  return /lead_email_messages|finalize_lead_email_message|schema cache/i.test(message)
    ? "Le module mailing nécessite la migration 20261005140000_lead_email_messages.sql. Appliquez les migrations Supabase avant d’enregistrer ou d’envoyer."
    : message;
}

async function getContext(leadId: string, requireAssignment: boolean) {
  if (!isUuid(leadId)) return { ok: false as const, error: "Identifiant de dossier invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Non authentifié." };
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (error || !lead) return { ok: false as const, error: "Dossier introuvable ou non accessible." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const admin = profile?.role === "admin";
  const canEdit = Boolean(lead.referent_id && (lead.referent_id === user.id || admin));
  if (requireAssignment && !canEdit) return { ok: false as const, error: "Allouez le dossier à un opérateur. Seul le référent assigné ou un administrateur peut préparer et envoyer ses emails." };
  return { ok: true as const, supabase, user, lead: lead as LeadEmailTemplateInput & { status: string; deleted_at: string | null; referent_id: string | null }, canEdit };
}

async function resolveRecipient(context: Extract<Awaited<ReturnType<typeof getContext>>, { ok: true }>, kind: LeadEmailKind, agencyId?: string | null, proposalId?: string | null) {
  if (kind !== "agency_brief") {
    if (agencyId || proposalId) return { ok: false as const, error: "Le mail client ne peut pas être lié à une agence." };
    const recipient = context.lead.email?.trim() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return { ok: false as const, error: "Renseignez une adresse email voyageur valide dans le dossier." };
    return { ok: true as const, recipient, agencyName: null, agencyId: null, proposalId: null, agencyFollowup: false };
  }
  if (!agencyId || !isUuid(agencyId)) return { ok: false as const, error: "Choisissez l’agence destinataire du brief." };
  const { data: agency, error } = await context.supabase.from("agencies").select("id,legal_name,trade_name,email,status").eq("id", agencyId).maybeSingle();
  if (error || !agency) return { ok: false as const, error: "Agence introuvable ou non accessible." };
  if (agency.status === "suspended") return { ok: false as const, error: "Cette agence est suspendue." };
  const recipient = String(agency.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return { ok: false as const, error: "Renseignez une adresse email valide pour l’agence." };
  let resolvedProposalId = proposalId ?? null;
  let agencyFollowup = false;
  if (resolvedProposalId) {
    if (!isUuid(resolvedProposalId)) return { ok: false as const, error: "Consultation agence invalide." };
    const { data: proposal } = await context.supabase.from("lead_circuit_proposals").select("id,status,brief_sent_at,proposal_received_at,proposal_declined_at").eq("id", resolvedProposalId).eq("lead_id", context.lead.id!).eq("agency_id", agencyId).maybeSingle();
    if (!proposal) return { ok: false as const, error: "La consultation sélectionnée ne correspond pas à cette agence et ce dossier." };
    if (proposal.status === "declined" || proposal.proposal_declined_at) return { ok: false as const, error: "Cette consultation a été refusée. Aucun nouvel email de brief ne peut lui être adressé." };
    agencyFollowup = Boolean(proposal.brief_sent_at || proposal.proposal_received_at);
  } else {
    const { data: proposals } = await context.supabase.from("lead_circuit_proposals").select("id").eq("lead_id", context.lead.id!).eq("agency_id", agencyId).eq("status", "pending_send").order("created_at", { ascending: false }).limit(1);
    resolvedProposalId = proposals?.[0]?.id ?? null;
    if (!resolvedProposalId) return { ok: false as const, error: "Assignez d’abord cette agence au dossier pour créer sa consultation." };
  }
  return { ok: true as const, recipient, agencyName: String(agency.trade_name || agency.legal_name), agencyId, proposalId: resolvedProposalId, agencyFollowup };
}

function refreshLead(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
}

export async function getLeadEmailWorkspace(leadId: string, kind: LeadEmailKind, agencyId?: string | null, proposalId?: string | null) {
  if (!KINDS.includes(kind)) return { ok: false as const, error: "Modèle email invalide." };
  const context = await getContext(leadId, false);
  if (!context.ok) return context;
  const template = buildLeadEmailTemplate(context.lead, kind);
  const recipient = await resolveRecipient(context, kind, agencyId, proposalId);
  let query = context.supabase.from("lead_email_messages").select("*").eq("lead_id", leadId).eq("kind", kind).order("created_at", { ascending: false }).limit(20);
  query = kind === "agency_brief" && agencyId ? query.eq("agency_id", agencyId) : query.is("agency_id", null);
  // Do not use the bounded history to decide whether a previous delivery is
  // unresolved: an older sending message must block a new UUID too.
  let unresolved = context.supabase.from("lead_email_messages").select("id").eq("lead_id", leadId).eq("kind", kind).eq("status", "sending").limit(1);
  unresolved = kind === "agency_brief" && agencyId ? unresolved.eq("agency_id", agencyId) : unresolved.is("agency_id", null);
  const [{ data, error }, { data: unresolvedMessages, error: unresolvedError }] = await Promise.all([query, unresolved]);
  const history = (data ?? []) as LeadEmailMessage[];
  const storageError = error ?? unresolvedError;
  return { ok: true as const, template, recipient: recipient.ok ? recipient.recipient : "", recipientError: recipient.ok ? null : recipient.error,
    agencyName: recipient.ok ? recipient.agencyName : null, proposalId: recipient.ok ? recipient.proposalId : proposalId ?? null,
    agencyFollowup: recipient.ok ? recipient.agencyFollowup : false,
    unresolvedSending: Boolean(unresolvedMessages?.length), unresolvedSendingMessage: UNRESOLVED_DELIVERY,
    canEdit: context.canEdit, resendReady: isResendOutboundConfigured(), deliveryReady: isResendOutboundConfigured(),
    deliveryMessage: isResendOutboundConfigured() ? null : "Resend n’est pas configuré : copiez le message dans votre messagerie puis indiquez un envoi externe.",
    storageReady: !storageError, storageError: storageError ? migrationError(storageError.message) : null,
    draft: history.find((message) => message.status === "draft" && (kind !== "agency_brief" || message.proposal_id === (recipient.ok ? recipient.proposalId : proposalId))) ?? null, history };
}

export async function saveLeadEmailDraft(input: LeadEmailDraftInput): Promise<{ ok: true; draft: LeadEmailMessage } | Failure> {
  if (!KINDS.includes(input.kind) || !["fr", "en"].includes(input.language)) return { ok: false, error: "Modèle ou langue invalide." };
  const subject = input.subject.trim();
  const bodyText = input.bodyText.trim().replace(/\r\n/g, "\n");
  if (!subject || subject.length > 250 || /[\r\n]/.test(subject)) return { ok: false, error: "L’objet doit contenir de 1 à 250 caractères sur une seule ligne." };
  if (!bodyText || bodyText.length > 40_000) return { ok: false, error: "Le contenu du message doit contenir de 1 à 40 000 caractères." };
  const context = await getContext(input.leadId, true);
  if (!context.ok) return context;
  if (context.lead.deleted_at) return { ok: false, error: "Ce dossier est archivé." };
  const recipient = await resolveRecipient(context, input.kind, input.agencyId, input.proposalId);
  if (!recipient.ok) return recipient;
  if (input.kind === "agency_brief" && (anonymizeAgencyText(bodyText, context.lead) !== bodyText || anonymizeAgencyText(subject, context.lead) !== subject)) return { ok: false, error: "Le brief agence contient un nom ou des coordonnées du voyageur. Retirez ces données personnelles avant de l’enregistrer." };
  const template = buildLeadEmailTemplate(context.lead, input.kind, { language: input.language, bodyText });
  const patch = { lead_id: input.leadId, kind: input.kind, agency_id: recipient.agencyId, proposal_id: recipient.proposalId,
    recipient: recipient.recipient, subject, body_text: bodyText, html: template.html, language: template.language,
    template_version: LEAD_EMAIL_TEMPLATE_VERSION, missing_information: template.questions, updated_at: new Date().toISOString() };
  let draft: LeadEmailMessage | null = null;
  if (input.draftId) {
    if (!isUuid(input.draftId)) return { ok: false, error: "Brouillon invalide." };
    let update = context.supabase.from("lead_email_messages").update(patch).eq("id", input.draftId).eq("lead_id", input.leadId).eq("kind", input.kind).eq("status", "draft");
    if (input.expectedUpdatedAt) update = update.eq("updated_at", input.expectedUpdatedAt);
    const { data, error } = await update.select("*").maybeSingle();
    if (error) return { ok: false, error: migrationError(error.message) };
    if (!data) return { ok: false, error: "Le brouillon a été modifié ou traité entre-temps. Rechargez-le avant de réessayer." };
    draft = data as LeadEmailMessage;
  } else {
    const { data, error } = await context.supabase.from("lead_email_messages").insert({ ...patch, created_by: context.user.id, status: "draft" }).select("*").single();
    if (error) return { ok: false, error: migrationError(error.message) };
    draft = data as LeadEmailMessage;
  }
  refreshLead(input.leadId);
  return { ok: true, draft };
}

async function checkedDraft(draftId: string) {
  if (!isUuid(draftId)) return { ok: false as const, error: "Brouillon invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Non authentifié." };
  const { data, error } = await supabase.from("lead_email_messages").select("*").eq("id", draftId).maybeSingle();
  if (error) return { ok: false as const, error: migrationError(error.message) };
  if (!data) return { ok: false as const, error: "Brouillon introuvable." };
  const draft = data as LeadEmailMessage;
  const context = await getContext(draft.lead_id, true);
  if (!context.ok) return context;
  if (context.lead.deleted_at) return { ok: false as const, error: "Ce dossier est archivé." };
  if (draft.status !== "draft") return { ok: false as const, error: "Ce message a déjà été traité. Créez un nouveau brouillon pour un nouvel envoi." };
  const recipient = await resolveRecipient(context, draft.kind, draft.agency_id, draft.proposal_id);
  if (!recipient.ok) return recipient;
  if (recipient.recipient !== draft.recipient) return { ok: false as const, error: "L’adresse destinataire a changé. Enregistrez à nouveau le brouillon avant l’envoi." };
  let unresolved = context.supabase.from("lead_email_messages").select("id").eq("lead_id", draft.lead_id).eq("kind", draft.kind).eq("status", "sending").neq("id", draft.id).limit(1);
  unresolved = draft.agency_id ? unresolved.eq("agency_id", draft.agency_id) : unresolved.is("agency_id", null);
  const { data: unresolvedMessages, error: unresolvedError } = await unresolved;
  if (unresolvedError) return { ok: false as const, error: migrationError(unresolvedError.message) };
  if (unresolvedMessages?.length) return { ok: false as const, error: UNRESOLVED_DELIVERY };
  if (draft.kind === "agency_brief") {
    if (anonymizeAgencyText(draft.body_text, context.lead) !== draft.body_text || anonymizeAgencyText(draft.subject, context.lead) !== draft.subject) return { ok: false as const, error: "Le brief contient des données personnelles du voyageur." };
    const analysis = buildLeadEmailTemplate(context.lead, draft.kind).analysis;
    if (!analysis.readyForAgencyBrief) return { ok: false as const, error: "Complétez les informations indispensables à la préparation du brief agence avant de l’envoyer." };
  }
  return { ok: true as const, context, draft };
}

/** Only this explicit operator action calls the outbound provider. */
export async function sendLeadEmailDraft(draftId: string): Promise<{ ok: true } | Failure> {
  if (!isResendOutboundConfigured()) return { ok: false, error: "Resend n’est pas configuré. Copiez le message dans votre messagerie puis indiquez un envoi externe." };
  const checked = await checkedDraft(draftId);
  if (!checked.ok) return checked;
  const { context, draft } = checked;
  // Claim atomically: two clicks/tabs cannot both dispatch the same draft.
  const { data: claimed, error: claimError } = await context.supabase.from("lead_email_messages").update({ status: "sending", error: null, updated_at: new Date().toISOString() }).eq("id", draft.id).eq("status", "draft").eq("updated_at", draft.updated_at).select("id,updated_at").maybeSingle();
  if (claimError) return { ok: false, error: claimError.code === "23505" ? UNRESOLVED_DELIVERY : migrationError(claimError.message) };
  if (!claimed) return { ok: false, error: "Ce brouillon a été modifié ou traité entre-temps. Rechargez-le avant tout envoi." };
  const result = await sendTransactionalHtmlEmail({ to: draft.recipient, subject: draft.subject, html: draft.html, text: draft.body_text, idempotencyKey: `lead-email-${draft.id}` });
  if (!result.ok) {
    await context.supabase.from("lead_email_messages").update({ status: result.deliveryUnknown ? "sending" : "failed", error: result.error, updated_at: new Date().toISOString() }).eq("id", draft.id).eq("status", "sending");
    refreshLead(draft.lead_id);
    return result;
  }
  const { error } = await context.supabase.rpc("finalize_lead_email_message", { message_id: draft.id, delivery: "sent", provider_message_id: result.providerId ?? null, expected_updated_at: claimed.updated_at });
  refreshLead(draft.lead_id);
  if (error) return { ok: false, error: "L’email a été transmis au prestataire, mais son historique n’a pas pu être finalisé. Ne le renvoyez pas ; vérifiez son état auprès du prestataire." };
  return { ok: true };
}

/** Manual statement is preserved separately from a provider-confirmed dispatch. */
export async function markLeadEmailSentExternally(draftId: string): Promise<{ ok: true } | Failure> {
  const checked = await checkedDraft(draftId);
  if (!checked.ok) return checked;
  const { error } = await checked.context.supabase.rpc("finalize_lead_email_message", { message_id: draftId, delivery: "external", provider_message_id: null, expected_updated_at: checked.draft.updated_at });
  if (error) return { ok: false, error: migrationError(error.message) };
  refreshLead(checked.draft.lead_id);
  return { ok: true };
}
