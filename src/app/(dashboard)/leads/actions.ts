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
import { generateBrief } from "@/lib/brief/generate-brief";

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

  // ── New site-aligned fields ────────────────────────────────────────────────
  const groupe        = fdStr(formData, "groupe");         // Seul(e) / En couple / En famille / Entre amis / groupe
  const peopleRaw     = fdStr(formData, "people");         // total voyageurs
  const datesMode     = fdStr(formData, "dates_mode");     // "Dates précises" | "Période flexible"
  const dateStart     = fdStr(formData, "date_start");     // YYYY-MM-DD
  const dateEnd       = fdStr(formData, "date_end");       // YYYY-MM-DD
  const flexMonth     = fdStr(formData, "flex_month");     // e.g. "Printemps"
  const flexDuration  = fdStr(formData, "flex_duration"); // e.g. "1 semaine"
  const hebergements  = fdStr(formData, "hebergements");  // comma-separated
  const vision        = fdStr(formData, "vision");         // dot-separated
  const notes         = fdStr(formData, "notes");          // project description

  const budgetIdealRaw  = fdStr(formData, "budget_ideal");
  const budgetMaxRaw    = fdStr(formData, "budget_max_field");
  const budgetCurrency  = fdStr(formData, "budget_currency"); // EUR | USD | DZD

  // Currency conversion helper (all stored as EUR)
  function toEur(raw: string): number | null {
    const v = parseFloat(raw);
    if (!raw || !isFinite(v) || v <= 0) return null;
    if (budgetCurrency === "DZD") return Math.round((v / 276) * 100) / 100;
    if (budgetCurrency === "USD") return Math.round(v * 0.92 * 100) / 100;
    return v;
  }

  const budgetMinEur = toEur(budgetIdealRaw);
  const budgetMaxEur = toEur(budgetMaxRaw);
  const peopleCount  = peopleRaw ? (parseInt(peopleRaw, 10) || 1) : null;

  // Build human-readable trip_dates string
  let tripDates = "";
  if (datesMode === "Dates précises" || datesMode === "exact") {
    const parts: string[] = [];
    if (dateStart) parts.push(`du ${dateStart}`);
    if (dateEnd)   parts.push(`au ${dateEnd}`);
    tripDates = parts.join(" ");
  } else if (datesMode === "Période flexible" || datesMode === "flex") {
    const parts: string[] = [];
    if (flexMonth)    parts.push(flexMonth);
    if (flexDuration) parts.push(flexDuration);
    tripDates = parts.join(" · ");
  }

  // Build travelers text: "groupe — X voyageur(s)"
  let travelersText = "";
  if (groupe) travelersText += groupe;
  if (peopleCount) {
    const suffix = peopleCount > 1 ? "voyageurs" : "voyageur";
    travelersText += travelersText ? ` — ${peopleCount} ${suffix}` : `${peopleCount} ${suffix}`;
  }

  // Build human-readable budget text
  let budgetText = "";
  if (budgetMinEur !== null) {
    const idealStr = Math.round(budgetMinEur).toLocaleString("fr-FR");
    budgetText = `${idealStr} € / pers.`;
    if (budgetMaxEur !== null) {
      const maxStr = Math.round(budgetMaxEur).toLocaleString("fr-FR");
      budgetText = `${idealStr}–${maxStr} € / pers.`;
    }
  }

  const patch: Record<string, unknown> = {
    traveler_name: travelerName,
    email: fdStr(formData, "email"),
    phone: fdStr(formData, "phone"),
    priority,
    whatsapp_phone_number: wa.length ? wa : null,
  };

  if (intakeChannel) patch.intake_channel = intakeChannel;

  // Travelers
  if (groupe || peopleCount !== null) {
    if (travelersText) patch.travelers = travelersText;
    if (peopleCount !== null) {
      patch.travelers_adults   = peopleCount;
      patch.travelers_children = 0;
    }
  }

  // Dates
  if (tripDates) patch.trip_dates = tripDates;
  if (datesMode === "Dates précises" || datesMode === "exact") {
    if (dateStart) patch.travel_start_date = dateStart;
    if (dateEnd)   patch.travel_end_date   = dateEnd;
  }

  // Style & projet
  if (vision)        patch.travel_style = vision;
  if (notes)         patch.trip_summary = notes;
  if (hebergements) {
    patch.qualification_summary = `Hébergements : ${hebergements}`;
  }

  // Budget (always per_person for site-aligned form)
  if (budgetMinEur !== null) {
    patch.budget_min  = budgetMinEur;
    patch.budget_unit = "per_person";
    if (budgetText)   patch.budget = budgetText;
  }
  if (budgetMaxEur !== null) {
    patch.budget_max = budgetMaxEur;
  }

  // Planning stage
  const planningStageRaw = fdStr(formData, "planning_stage");
  if (planningStageRaw === "ideas" || planningStageRaw === "planning" || planningStageRaw === "ready") {
    patch.planning_stage = planningStageRaw;
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
  if (nextStatus === "won" || nextStatus === "lost") {
    revalidatePath("/contacts");
  }
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
  if (nextStatus === "won" || nextStatus === "lost") {
    revalidatePath("/contacts");
  }
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

// ─── MVP v5 — opérateur manuel ───────────────────────────────────────────────

async function logLeadActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  actorId: string | null,
  kind: string,
  detail?: string,
): Promise<void> {
  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: actorId,
    kind,
    detail: detail ?? "",
  });
}

/** Marque l'email de bienvenue comme envoyé et passe le lead en qualification. */
export async function markWelcomeEmailSent(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: row, error: fetchErr } = await supabase
    .from("leads")
    .select("status, referent_id")
    .eq("id", leadId)
    .maybeSingle();
  if (fetchErr || !row) return { ok: false, error: "Lead introuvable." };
  if (!row.referent_id) {
    return { ok: false, error: "Allouez d'abord un opérateur travel desk." };
  }

  const patch: Record<string, unknown> = {
    welcome_email_sent_at: new Date().toISOString(),
    welcome_email_template_used: "ai_double_cta",
  };
  if (row.status === "new") patch.status = "qualification";

  const { error: updErr } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await logLeadActivity(supabase, leadId, user.id, "welcome_email_sent");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

/** Annule le statut "email de bienvenue envoyé" (correction manuelle). */
export async function cancelWelcomeEmailSent(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error } = await supabase
    .from("leads")
    .update({ welcome_email_sent_at: null, welcome_email_template_used: null })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Enregistre le canal préféré détecté à la première réponse du voyageur. */
export async function setPreferredChannel(
  leadId: string,
  channel: "whatsapp" | "email",
): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error: updErr } = await supabase.from("leads").update({
    preferred_channel: channel,
    preferred_channel_detected_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await logLeadActivity(supabase, leadId, user.id, "preferred_channel_detected", channel);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Génère et sauvegarde le brief agence à partir des données de qualification. */
export async function generateAndSaveBrief(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: row, error: fetchErr } = await supabase
    .from("leads")
    .select(
      "reference, travelers, trip_dates, budget, travel_style, trip_summary, destination_main, qualification_notes, qualification_blocks, budget_min, budget_max, budget_unit, travelers_adults, travelers_children",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (fetchErr || !row) return { ok: false, error: "Lead introuvable." };

  const brief = generateBrief(row as Parameters<typeof generateBrief>[0]);

  const { error: updErr } = await supabase.from("leads").update({
    generated_brief: brief,
    brief_generated_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await logLeadActivity(supabase, leadId, user.id, "brief_generated");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Sauvegarde les modifications manuelles du brief. */
export async function saveBriefEdit(leadId: string, text: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error: updErr } = await supabase.from("leads").update({
    generated_brief: text,
    brief_edited_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await logLeadActivity(supabase, leadId, user.id, "brief_edited");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Crée des lignes lead_circuit_proposals pour N agences sélectionnées. */
export async function assignMultipleAgencies(
  leadId: string,
  agencyIds: string[],
): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  if (!agencyIds.length) return { ok: false, error: "Sélectionnez au moins une agence." };
  if (agencyIds.some((id) => !isUuid(id))) {
    return { ok: false, error: "Identifiant d'agence invalide." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: agencies, error: agErr } = await supabase
    .from("agencies")
    .select("id")
    .in("id", agencyIds);
  if (agErr) return { ok: false, error: agErr.message };
  const foundIds = new Set((agencies ?? []).map((a) => String(a.id)));
  const missing = agencyIds.find((id) => !foundIds.has(id));
  if (missing) return { ok: false, error: "Agence introuvable." };

  // Upsert one row per agency — uses lead_id + agency_id uniqueness
  for (const agencyId of agencyIds) {
    const { error: upsErr } = await supabase.from("lead_circuit_proposals").insert({
      lead_id: leadId,
      agency_id: agencyId,
      title: "Brief envoyé",
      circuit_outline: "",
      status: "pending_send",
      created_by_profile_id: user.id,
    });
    if (upsErr && upsErr.code !== "23505") return { ok: false, error: upsErr.message };

    await logLeadActivity(supabase, leadId, user.id, "agency_consultation_created", agencyId);
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Marque le brief comme envoyé à une agence. */
export async function markBriefSent(proposalId: string, leadId: string): Promise<ActionResult> {
  if (!isUuid(proposalId) || !isUuid(leadId)) {
    return { ok: false, error: "Identifiants invalides." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error: updErr } = await supabase
    .from("lead_circuit_proposals")
    .update({ brief_sent_at: new Date().toISOString(), status: "awaiting_response" })
    .eq("id", proposalId)
    .eq("lead_id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await logLeadActivity(supabase, leadId, user.id, "brief_sent_to_agency", proposalId);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Enregistre une proposition reçue d'une agence. */
export async function markProposalReceived(
  proposalId: string,
  leadId: string,
  data: { price?: number | null; durationDays?: number | null; summary?: string },
): Promise<ActionResult> {
  if (!isUuid(proposalId) || !isUuid(leadId)) {
    return { ok: false, error: "Identifiants invalides." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error: pErr } = await supabase
    .from("lead_circuit_proposals")
    .update({
      status: "submitted",
      proposal_received_at: new Date().toISOString(),
      agency_proposal_price: data.price ?? null,
      agency_proposal_duration_days: data.durationDays ?? null,
      agency_proposal_summary: data.summary?.trim() ?? null,
    })
    .eq("id", proposalId)
    .eq("lead_id", leadId);
  if (pErr) return { ok: false, error: pErr.message };

  await logLeadActivity(supabase, leadId, user.id, "agency_proposal_received", proposalId);

  const { data: leadRow } = await supabase
    .from("leads").select("status").eq("id", leadId).maybeSingle();
  if (leadRow?.status === "agency_assignment") {
    await supabase.from("leads").update({ status: "co_construction" }).eq("id", leadId);
    revalidatePath("/leads");
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Marque une proposition comme refusée par l'agence. */
export async function markProposalDeclined(
  proposalId: string,
  leadId: string,
): Promise<ActionResult> {
  if (!isUuid(proposalId) || !isUuid(leadId)) {
    return { ok: false, error: "Identifiants invalides." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error: updErr } = await supabase
    .from("lead_circuit_proposals")
    .update({ status: "declined", proposal_declined_at: new Date().toISOString() })
    .eq("id", proposalId)
    .eq("lead_id", leadId);
  if (updErr) return { ok: false, error: updErr.message };

  await logLeadActivity(supabase, leadId, user.id, "agency_proposal_declined", proposalId);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Retient une proposition d'agence (arbitrage co_construction). */
export async function retainAgencyProposal(
  leadId: string,
  agencyId: string,
  proposalId: string,
): Promise<ActionResult> {
  if (!isUuid(leadId) || !isUuid(agencyId) || !isUuid(proposalId)) {
    return { ok: false, error: "Identifiants invalides." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error: propErr } = await supabase
    .from("lead_circuit_proposals")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_profile_id: user.id,
    })
    .eq("id", proposalId)
    .eq("lead_id", leadId);
  if (propErr) return { ok: false, error: propErr.message };

  const { error: leadErr } = await supabase
    .from("leads")
    .update({ retained_agency_id: agencyId })
    .eq("id", leadId);
  if (leadErr) return { ok: false, error: leadErr.message };

  await logLeadActivity(supabase, leadId, user.id, "agency_selected", agencyId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

/** Auto-alloue un référent via round-robin (appel explicite, distinct du trigger). */
export async function autoAllocateReferent(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: referentId, error: rpcErr } = await supabase.rpc("allocate_next_referent");
  if (rpcErr) return { ok: false, error: rpcErr.message };
  if (!referentId) return { ok: false, error: "Aucun opérateur disponible pour l'allocation." };

  const { error } = await supabase
    .from("leads")
    .update({ referent_id: referentId, referent_assigned_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await logLeadActivity(supabase, leadId, user.id, "auto_round_robin_allocation", referentId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Remet un lead à zéro (admin uniquement). Snapshot complet dans activities.payload. */
export async function resetLead(leadId: string, reason?: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false, error: "Seuls les administrateurs peuvent remettre un lead à zéro." };
  }

  const { data: lead, error: fetchErr } = await supabase
    .from("leads").select("*").eq("id", leadId).maybeSingle();
  if (fetchErr || !lead) return { ok: false, error: "Lead introuvable." };

  // Snapshot complet dans activities pour récupération manuelle si besoin
  const { error: actErr } = await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: user.id,
    kind: "lead_reset",
    detail: `Reset admin. Motif : ${reason?.trim() || "non renseigné"}`,
    payload: lead,
  });
  if (actErr) return { ok: false, error: actErr.message };

  // Remise à zéro des champs métier (les colonnes NOT NULL reçoivent "" au lieu de null)
  const { error: updateErr } = await supabase.from("leads").update({
    status: "new",
    trip_summary: "",
    travel_style: "",
    travelers: "",
    budget: "",
    trip_dates: "",
    qualification_summary: null,
    internal_notes: null,
    retained_agency_id: null,
    preferred_channel: null,
    preferred_channel_detected_at: null,
    welcome_email_sent_at: null,
    welcome_email_template_used: null,
    generated_brief: null,
    brief_generated_at: null,
    brief_edited_at: null,
    qualification_validated_at: null,
    qualification_validation_status: "pending",
    lead_score: null,
    lead_score_override: null,
  }).eq("id", leadId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Ré-allocation round-robin
  const { data: newReferentId } = await supabase.rpc("allocate_next_referent");
  if (newReferentId) {
    await supabase.from("leads").update({
      referent_id: newReferentId,
      referent_assigned_at: new Date().toISOString(),
    }).eq("id", leadId);
  }

  // Archiver les consultations agences
  await supabase
    .from("lead_circuit_proposals")
    .update({ status: "reset_archived" })
    .eq("lead_id", leadId)
    .neq("status", "reset_archived");

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ─── PRD Refonte v1 — Nouvelles actions admin ────────────────────────────────

/** Soft delete : masque le lead sans suppression physique. Admin only. */
export async function softDeleteLead(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const isAdmin = await loadUserIsAdmin(supabase, user.id);
  if (!isAdmin) return { ok: false, error: "Action réservée aux administrateurs." };

  const { error } = await supabase
    .from("leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await logLeadActivity(supabase, leadId, user.id, "lead_soft_deleted", "Soft delete par admin.");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Réinitialise le lead à l'étape "new" et insère une entrée dans lead_history. Admin only. */
export async function resetLeadToNew(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const isAdmin = await loadUserIsAdmin(supabase, user.id);
  if (!isAdmin) return { ok: false, error: "Action réservée aux administrateurs." };

  // Récupérer l'étape actuelle pour l'historique
  const { data: current } = await supabase.from("leads").select("status").eq("id", leadId).single();
  const fromStage = current?.status ?? "unknown";

  const { error } = await supabase
    .from("leads")
    .update({
      status: "new",
      closed_at: null,
      welcome_email_sent_at: null,
      workflow_launched_at: null,
      workflow_launched_by: null,
      workflow_mode: null,
      workflow_run_ref: null,
    })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  // Insère manuellement une entrée d'historique (le trigger le fera aussi, c'est ok)
  await supabase.from("lead_history").insert({
    lead_id: leadId,
    from_stage: fromStage,
    to_stage: "new",
    changed_by: user.id,
    note: "Réinitialisation manuelle par admin.",
  });

  // Purger les entrées d'historique antérieures à ce reset
  await supabase.from("lead_history")
    .delete()
    .eq("lead_id", leadId)
    .lt("changed_at", new Date().toISOString());

  await logLeadActivity(supabase, leadId, user.id, "lead_reset", `Réinitialisé depuis ${fromStage} → new.`);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

/** Crée ou rattache un Contact depuis les données du lead. Disponible à tous les référents. */
export async function copyLeadToContact(leadId: string): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, traveler_name, email, phone, whatsapp_phone_number, created_at, status, contact_id")
    .eq("id", leadId)
    .single();
  if (leadErr || !lead) return { ok: false, error: "Lead introuvable." };

  const email = (lead.email as string | null)?.trim() || null;
  if (!email) return { ok: false, error: "Impossible de créer un contact sans email." };

  const nameParts = ((lead.traveler_name as string | null) ?? "").trim().split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ").trim() || null;

  // Upsert contact par email
  const { data: contact, error: upsertErr } = await supabase
    .from("contacts")
    .upsert({
      email,
      full_name: (lead.traveler_name as string | null) ?? "Inconnu",
      first_name: firstName || null,
      last_name: lastName,
      phone: (lead.phone as string | null)?.trim() || null,
      phone_e164: (lead.phone as string | null)?.trim() || null,
      whatsapp_phone_number: (lead.whatsapp_phone_number as string | null)?.trim() || null,
      first_seen_at: lead.created_at,
      first_lead_at: lead.created_at,
      last_activity_at: new Date().toISOString(),
      type: lead.status === "won" ? "traveler" : "seeker",
      source_lead_id: leadId,
    }, { onConflict: "email" })
    .select("id")
    .single();

  if (upsertErr || !contact) return { ok: false, error: upsertErr?.message ?? "Erreur création contact." };

  // Rattacher le lead au contact si pas encore fait
  if (!lead.contact_id) {
    await supabase.from("leads").update({ contact_id: contact.id }).eq("id", leadId);
  }

  await logLeadActivity(supabase, leadId, user.id, "contact_linked", `Contact ${contact.id} créé/mis à jour.`);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/contacts");
  return { ok: true };
}

/** Logge le déverrouillage d'une étape passée pour modification (traçabilité). */
export async function unlockStepForEdit(
  leadId: string,
  stageName: LeadStatus,
  motif?: string,
): Promise<ActionResult> {
  if (!isUuid(leadId)) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  await logLeadActivity(
    supabase, leadId, user.id,
    "step_unlocked",
    JSON.stringify({ stage: stageName, motif: motif?.trim() ?? "" }),
  );
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
