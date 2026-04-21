"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import type { AgencyConsultationStatus, LeadStatus } from "@/lib/mock-leads";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { LEAD_PIPELINE } from "@/lib/mock-leads";
import { parseCrmConversionBand, parseCrmFollowUpStrategy } from "@/lib/crm-fields";
import { buildLeadInsertFromIntake } from "@/lib/intake-lead-insert";
import { computeScoreFromWeights } from "@/lib/lead-score";
import { normalizeLeadStatusForUi } from "@/lib/lead-status-coerce";
import {
  getBriefGateBlockMessage,
  type LeadBriefGateRow,
} from "@/lib/lead-brief-gate";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type AssignReferentResult = ActionResult;

function fdStr(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function assignLeadReferent(
  leadId: string,
  formData: FormData,
): Promise<AssignReferentResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const raw = formData.get("referent_id");
  const referentId =
    typeof raw !== "string" || raw === "" || raw === "__none__"
      ? null
      : raw;

  if (referentId !== null) {
    if (!isUuid(referentId)) {
      return { ok: false, error: "Référent invalide." };
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", referentId)
      .maybeSingle();

    if (profileError || !profile) {
      return { ok: false, error: "Ce référent n'existe pas." };
    }
  }

  const { data: prevRow, error: prevErr } = await supabase
    .from("leads")
    .select("id, referent_id")
    .eq("id", leadId)
    .maybeSingle();

  if (prevErr || !prevRow) {
    return { ok: false, error: "Lead introuvable." };
  }

  const prevReferentId =
    prevRow.referent_id != null ? String(prevRow.referent_id) : null;
  const nextReferentId = referentId;

  const patch: Record<string, unknown> = { referent_id: referentId };
  if (referentId !== null) {
    patch.referent_assigned_at = new Date().toISOString();
  } else {
    patch.referent_assigned_at = null;
  }

  if (prevReferentId !== nextReferentId) {
    Object.assign(patch, clearedWorkflowSessionPatch());
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type ClaimLeadResult = ActionResult;

export async function claimLead(leadId: string): Promise<ClaimLeadResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: prevRow, error: prevErr } = await supabase
    .from("leads")
    .select("referent_id")
    .eq("id", leadId)
    .maybeSingle();

  if (prevErr || !prevRow) {
    return { ok: false, error: "Lead introuvable." };
  }

  if (prevRow.referent_id !== null) {
    return { ok: false, error: "Ce lead est déjà assigné." };
  }

  const { error } = await supabase
    .from("leads")
    .update({
      referent_id: user.id,
      referent_assigned_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .is("referent_id", null);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${leadId}/workflow`);
  return { ok: true };
}

export type AssignPartnerAgencyResult = ActionResult;

export async function assignLeadPartnerAgency(
  leadId: string,
  formData: FormData,
): Promise<AssignPartnerAgencyResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const raw = formData.get("agency_id");
  const agencyId =
    typeof raw !== "string" || raw === "" || raw === "__none__" ? null : raw;

  if (agencyId !== null) {
    if (!isUuid(agencyId)) {
      return { ok: false, error: "Agence invalide." };
    }
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id")
      .eq("id", agencyId)
      .maybeSingle();

    if (agencyError || !agency) {
      return { ok: false, error: "Cette agence n'existe pas." };
    }
  }

  const { error } = await supabase
    .from("leads")
    .update({ retained_agency_id: agencyId })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function setLeadRetainedAgency(
  leadId: string,
  agencyId: string | null,
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }
  if (agencyId !== null && !isUuid(agencyId)) {
    return { ok: false, error: "Agence invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  if (agencyId !== null) {
    const { data: agency, error: agencyError } = await supabase
      .from("agencies")
      .select("id")
      .eq("id", agencyId)
      .maybeSingle();
    if (agencyError || !agency) {
      return { ok: false, error: "Cette agence n'existe pas." };
    }
  }

  const { error } = await supabase
    .from("leads")
    .update({ retained_agency_id: agencyId })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateLeadDetails(
  leadId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const travelerName = fdStr(formData, "traveler_name");
  if (!travelerName) {
    return { ok: false, error: "Le nom du voyageur est obligatoire." };
  }

  const priorityRaw = fdStr(formData, "priority");
  const priority = priorityRaw === "high" ? "high" : "normal";

  const intakeRaw = fdStr(formData, "intake_channel");
  const intakeChannel =
    intakeRaw === "manual" ||
    intakeRaw === "whatsapp" ||
    intakeRaw === "web_form" ||
    intakeRaw === "email"
      ? intakeRaw
      : null;

  const wa = fdStr(formData, "whatsapp_phone_number");

  const patch: Record<string, unknown> = {
    traveler_name: travelerName,
    email: fdStr(formData, "email"),
    phone: fdStr(formData, "phone"),
    trip_summary: fdStr(formData, "trip_summary"),
    travel_style: fdStr(formData, "travel_style"),
    travelers: fdStr(formData, "travelers"),
    budget: fdStr(formData, "budget"),
    trip_dates: fdStr(formData, "trip_dates"),
    qualification_summary: fdStr(formData, "qualification_summary"),
    internal_notes: fdStr(formData, "internal_notes"),
    quote_status: fdStr(formData, "quote_status"),
    source: fdStr(formData, "source"),
    priority,
    whatsapp_phone_number: wa.length ? wa : null,
  };
  if (intakeChannel) {
    patch.intake_channel = intakeChannel;
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}

export async function updateLeadCommercialCrm(
  leadId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const c = parseCrmConversionBand(fdStr(formData, "crm_conversion_band"));
  const r = parseCrmFollowUpStrategy(fdStr(formData, "crm_follow_up_strategy"));

  if (!c || !r) {
    return { ok: false, error: "Valeurs CRM invalides." };
  }

  const { error } = await supabase
    .from("leads")
    .update({
      crm_conversion_band: c,
      crm_follow_up_strategy: r,
    })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}

function pipelineIndex(status: LeadStatus): number {
  return LEAD_PIPELINE.indexOf(status);
}


/** Réinitialise les champs de session workflow voyageur (sans toucher au transcript ni à la validation). */
function clearedWorkflowSessionPatch(): Record<string, unknown> {
  return {
    workflow_launched_at: null,
    workflow_launched_by: null,
    workflow_mode: null,
    workflow_run_ref: null,
    manual_takeover: false,
  };
}

function shouldClearWorkflowSessionLeavingQualification(
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
): boolean {
  return currentStatus === "qualification" && nextStatus !== "qualification";
}

async function loadUserIsAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return profile?.role === "admin";
}

function assertAdjacentPipelineStepChange(
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
  isAdmin: boolean,
): ActionResult | null {
  if (isAdmin) return null;
  if (currentStatus === nextStatus) return null;
  const fromIdx = pipelineIndex(currentStatus);
  const toIdx = pipelineIndex(nextStatus);
  if (fromIdx < 0 || toIdx < 0) {
    return { ok: false, error: "Statut du lead inconnu." };
  }
  if (Math.abs(toIdx - fromIdx) === 1) return null;
  if (currentStatus === "negotiation" && nextStatus === "lost") return null;
  return {
    ok: false,
    error:
      "Les non-administrateurs ne peuvent avancer ou reculer le pipeline que d'une étape à la fois. Utilisez « Précédent » / « Suivant » dans la barre du bas, ou demandez à un administrateur pour corriger une étape en avance.",
  };
}

function assertLeadStatusTransition(
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
  referentId: string | null,
  retainedAgencyId: string | null,
): ActionResult | null {
  if (nextStatus !== "new" && !referentId) {
    return {
      ok: false,
      error:
        "Allouez d'abord un opérateur travel desk (étape « Nouveau ») avant de faire avancer le dossier.",
    };
  }

  const fromIdx = pipelineIndex(currentStatus);
  const toIdx = pipelineIndex(nextStatus);
  if (fromIdx < 0 || toIdx < 0) {
    return { ok: false, error: "Statut du lead inconnu." };
  }

  const assignIdx = pipelineIndex("agency_assignment");
  if (
    currentStatus === "agency_assignment" &&
    toIdx > assignIdx &&
    !retainedAgencyId
  ) {
    return {
      ok: false,
      error:
        "Choisissez une agence partenaire (bloc Assignation) avant de passer à l'étape suivante.",
    };
  }

  return null;
}

async function assertBriefExploitableBeforeAgencyAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
): Promise<ActionResult | null> {
  if (currentStatus !== "qualification" || nextStatus !== "agency_assignment") {
    return null;
  }
  const { data, error } = await supabase
    .from("leads")
    .select(
      [
        "traveler_name",
        "email",
        "phone",
        "whatsapp_phone_number",
        "trip_dates",
        "travelers",
        "budget",
        "trip_summary",
        "travel_style",
        "qualification_validation_status",
        "workflow_mode",
        "qualification_blocks",
      ].join(", "),
    )
    .eq("id", leadId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: "Impossible de vérifier les champs du brief avant l’assignation.",
    };
  }
  const msg = getBriefGateBlockMessage(data as unknown as LeadBriefGateRow);
  if (msg) return { ok: false, error: msg };
  return null;
}

export async function updateLeadStatus(
  leadId: string,
  nextStatus: LeadStatus,
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }
  if (!LEAD_PIPELINE.includes(nextStatus)) {
    return { ok: false, error: "Statut invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: row, error: fetchError } = await supabase
    .from("leads")
    .select("referent_id, retained_agency_id, status")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: "Lead introuvable." };
  }

  const currentStatus = normalizeLeadStatusForUi(String(row.status ?? "new"));
  if (nextStatus === currentStatus) {
    return { ok: true };
  }

  const blocked = assertLeadStatusTransition(
    currentStatus,
    nextStatus,
    row.referent_id as string | null,
    row.retained_agency_id as string | null,
  );
  if (blocked) return blocked;

  const isAdmin = await loadUserIsAdmin(supabase, user.id);
  const jumpBlocked = assertAdjacentPipelineStepChange(
    currentStatus,
    nextStatus,
    isAdmin,
  );
  if (jumpBlocked) return jumpBlocked;

  const briefBlock = await assertBriefExploitableBeforeAgencyAssignment(
    supabase,
    leadId,
    currentStatus,
    nextStatus,
  );
  if (briefBlock) return briefBlock;

  const coBlock = await assertCoConstructionApprovedIfLeaving(
    supabase,
    leadId,
    currentStatus,
    nextStatus,
  );
  if (coBlock) return coBlock;

  const patch: Record<string, unknown> = { status: nextStatus };
  if (shouldClearWorkflowSessionLeavingQualification(currentStatus, nextStatus)) {
    Object.assign(patch, clearedWorkflowSessionPatch());
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}

async function assertCoConstructionApprovedIfLeaving(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  currentStatus: LeadStatus,
  nextStatus: LeadStatus,
): Promise<ActionResult | null> {
  const coIdx = pipelineIndex("co_construction");
  const toIdx = pipelineIndex(nextStatus);
  if (currentStatus === "co_construction" && toIdx > coIdx) {
    const { data: linkedProposal } = await supabase
      .from("lead_circuit_proposals")
      .select("id")
      .eq("lead_id", leadId)
      .eq("status", "approved")
      .not("converted_quote_id", "is", null)
      .limit(1)
      .maybeSingle();

    const { data: anyQuote } = await supabase
      .from("quotes")
      .select("id")
      .eq("lead_id", leadId)
      .limit(1)
      .maybeSingle();

    if (!linkedProposal && !anyQuote) {
      return {
        ok: false,
        error:
          "Générez le devis depuis une proposition validée (co-construction), ou créez un devis lié au dossier, avant d’aller à l’étape Devis.",
      };
    }
  }
  return null;
}

export async function moveLeadPipelineStep(
  leadId: string,
  direction: "next" | "prev",
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: row, error: fetchError } = await supabase
    .from("leads")
    .select("referent_id, retained_agency_id, status")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: "Lead introuvable." };
  }

  const currentStatus = normalizeLeadStatusForUi(String(row.status ?? "new"));
  const idx = pipelineIndex(currentStatus);
  if (idx < 0) {
    return { ok: false, error: "Statut du lead inconnu." };
  }

  let nextStatus: LeadStatus;
  if (direction === "next") {
    if (currentStatus === "won" || currentStatus === "lost") {
      return {
        ok: false,
        error: "Le dossier est déjà à une étape terminale.",
      };
    }
    if (idx >= LEAD_PIPELINE.length - 1) {
      return { ok: false, error: "Dernière étape atteinte." };
    }
    nextStatus = LEAD_PIPELINE[idx + 1]!;
  } else {
    if (idx <= 0) {
      return { ok: false, error: "Le dossier est déjà à la première étape." };
    }
    nextStatus = LEAD_PIPELINE[idx - 1]!;
  }

  const blocked = assertLeadStatusTransition(
    currentStatus,
    nextStatus,
    row.referent_id as string | null,
    row.retained_agency_id as string | null,
  );
  if (blocked) return blocked;

  const briefBlock = await assertBriefExploitableBeforeAgencyAssignment(
    supabase,
    leadId,
    currentStatus,
    nextStatus,
  );
  if (briefBlock) return briefBlock;

  const coBlock = await assertCoConstructionApprovedIfLeaving(
    supabase,
    leadId,
    currentStatus,
    nextStatus,
  );
  if (coBlock) return coBlock;

  const patch: Record<string, unknown> = { status: nextStatus };
  if (shouldClearWorkflowSessionLeavingQualification(currentStatus, nextStatus)) {
    Object.assign(patch, clearedWorkflowSessionPatch());
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return {
      ok: false,
      error: "Seuls les administrateurs peuvent supprimer un lead.",
    };
  }

  const { error } = await supabase.from("leads").delete().eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath("/metrics");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  return { ok: true };
}

async function assertLeadAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ActionResult | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false, error: "Action réservée aux administrateurs." };
  }
  return null;
}

export async function computeLeadScore(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: row, error: fetchError } = await supabase
    .from("leads")
    .select(
      "budget, trip_dates, travelers, status, conversation_transcript, ai_qualification_payload, ai_qualification_confidence, scoring_weights",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: "Lead introuvable." };
  }

  const score = computeScoreFromWeights(row as unknown as SupabaseLeadRow);

  const { error } = await supabase
    .from("leads")
    .update({
      lead_score: score,
      lead_score_computed_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function recalculateLeadScoreAfterOverrideClear(
  leadId: string,
): Promise<ActionResult> {
  const clear = await overrideLeadScore(leadId, null);
  if (!clear.ok) return clear;
  return computeLeadScore(leadId);
}

export async function overrideLeadScore(
  leadId: string,
  value: number | null,
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
    return { ok: false, error: "Score entre 0 et 100." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { error } = await supabase
    .from("leads")
    .update({ lead_score_override: value })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateLeadScoringWeights(
  leadId: string,
  weightsJson: string,
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const denied = await assertLeadAdmin(supabase, user.id);
  if (denied) return denied;

  let parsed: unknown;
  try {
    parsed = JSON.parse(weightsJson) as unknown;
  } catch {
    return { ok: false, error: "JSON invalide." };
  }

  const { error } = await supabase
    .from("leads")
    .update({ scoring_weights: parsed })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  return { ok: true };
}

export async function toggleLeadStarred(
  leadId: string,
  starred: boolean,
): Promise<ActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { error } = await supabase
    .from("leads")
    .update({ starred })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/leads");
  return { ok: true };
}

/** Champs alignés sur le payload `buildEmailPayload` du formulaire site (da-voyage). */
export async function createLeadFromIntake(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const first = fdStr(formData, "first");
  const last = fdStr(formData, "last");
  const email = fdStr(formData, "email");
  if (!email) {
    return { ok: false, error: "L'email du voyageur est obligatoire." };
  }

  const travelerName = `${first} ${last}`.trim() || email;

  const flexPeriod = [
    fdStr(formData, "flex_month"),
    fdStr(formData, "flex_duration"),
  ]
    .filter(Boolean)
    .join(" · ");

  const intake: Record<string, unknown> = {
    full_name: travelerName,
    email,
    phone: fdStr(formData, "phone"),
    follow_prefs: fdStr(formData, "follow_prefs"),
    planning_stage: fdStr(formData, "planning_stage"),
    group_type: fdStr(formData, "group_type"),
    travellers_count: fdStr(formData, "travellers_count"),
    dates_mode: fdStr(formData, "dates_mode"),
    date_start: fdStr(formData, "date_start"),
    date_end: fdStr(formData, "date_end"),
    flex_month: fdStr(formData, "flex_month"),
    flex_duration: fdStr(formData, "flex_duration"),
    flex_period: flexPeriod,
    hebergements: fdStr(formData, "hebergements"),
    vision: fdStr(formData, "vision"),
    currency: fdStr(formData, "currency") || "EUR",
    budget_ideal: fdStr(formData, "budget_ideal"),
    budget_max: fdStr(formData, "budget_max"),
    notes_longues: fdStr(formData, "notes_longues"),
    project_notes_short: fdStr(formData, "notes_longues").slice(0, 200),
    submission_id: fdStr(formData, "submission_id") || crypto.randomUUID(),
    page_origin: fdStr(formData, "page_origin"),
    submitted_at: new Date().toISOString(),
  };

  const priority = fdStr(formData, "priority") === "high" ? "high" : "normal";

  const row = buildLeadInsertFromIntake(intake, {
    sourceFallback: "Formulaire site DA",
    priority,
  });

  const { error } = await supabase.from("leads").insert(row);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/metrics");
  return { ok: true };
}

export async function createConsultationForLead(
  leadId: string,
  agencyId: string,
): Promise<ActionResult> {
  if (!isUuid(leadId) || !isUuid(agencyId)) {
    return { ok: false, error: "Identifiants invalides." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { error } = await supabase.from("consultations").insert({
    lead_id: leadId,
    agency_id: agencyId,
    status: "invited",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Cette agence est déjà associée à ce dossier." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateConsultationStatusForLead(
  consultationId: string,
  leadId: string,
  status: AgencyConsultationStatus,
): Promise<ActionResult> {
  if (!isUuid(consultationId) || !isUuid(leadId)) {
    return { ok: false, error: "Identifiants invalides." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { error } = await supabase
    .from("consultations")
    .update({ status })
    .eq("id", consultationId)
    .eq("lead_id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateConsultationQuoteForLead(
  consultationId: string,
  leadId: string,
  quoteSummary: string,
): Promise<ActionResult> {
  if (!isUuid(consultationId) || !isUuid(leadId)) {
    return { ok: false, error: "Identifiants invalides." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { error } = await supabase
    .from("consultations")
    .update({
      quote_summary: quoteSummary.trim(),
      status: "quote_received",
    })
    .eq("id", consultationId)
    .eq("lead_id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}
