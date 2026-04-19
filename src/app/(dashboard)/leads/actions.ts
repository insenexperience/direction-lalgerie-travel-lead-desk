"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE } from "@/lib/mock-leads";
import {
  parseCrmCommercialPriority,
  parseCrmConversionBand,
  parseCrmFeasibilityBand,
  parseCrmFollowUpStrategy,
  parseCrmPrimaryObjection,
} from "@/lib/crm-fields";
import { normalizeLeadStatusForUi } from "@/lib/lead-status-coerce";

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

  const { error } = await supabase
    .from("leads")
    .update({ referent_id: referentId })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
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

  const patch = {
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
  };

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

  const p = parseCrmCommercialPriority(fdStr(formData, "crm_commercial_priority"));
  const c = parseCrmConversionBand(fdStr(formData, "crm_conversion_band"));
  const f = parseCrmFeasibilityBand(fdStr(formData, "crm_feasibility_band"));
  const r = parseCrmFollowUpStrategy(fdStr(formData, "crm_follow_up_strategy"));
  const o = parseCrmPrimaryObjection(fdStr(formData, "crm_primary_objection"));

  if (!p || !c || !f || !r || !o) {
    return { ok: false, error: "Valeurs CRM invalides." };
  }

  const { error } = await supabase
    .from("leads")
    .update({
      crm_commercial_priority: p,
      crm_conversion_band: c,
      crm_feasibility_band: f,
      crm_follow_up_strategy: r,
      crm_primary_objection: o,
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
  const blocked = assertLeadStatusTransition(
    currentStatus,
    nextStatus,
    row.referent_id as string | null,
    row.retained_agency_id as string | null,
  );
  if (blocked) return blocked;

  const coBlock = await assertCoConstructionApprovedIfLeaving(
    supabase,
    leadId,
    currentStatus,
    nextStatus,
  );
  if (coBlock) return coBlock;

  const { error } = await supabase
    .from("leads")
    .update({ status: nextStatus })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
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

  const coBlock = await assertCoConstructionApprovedIfLeaving(
    supabase,
    leadId,
    currentStatus,
    nextStatus,
  );
  if (coBlock) return coBlock;

  const { error } = await supabase
    .from("leads")
    .update({ status: nextStatus })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
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

  const { error } = await supabase.from("leads").delete().eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath("/metrics");
  revalidatePath(`/leads/${leadId}`);
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

  const mode = String(intake.dates_mode ?? "");
  let tripDates = "";
  if (mode.toLowerCase().includes("flex")) {
    tripDates =
      [intake.flex_month, intake.flex_duration]
        .map((x) => (x != null ? String(x).trim() : ""))
        .filter(Boolean)
        .join(" · ") || "Période flexible";
  } else if (intake.date_start || intake.date_end) {
    tripDates = `${intake.date_start || "—"} → ${intake.date_end || "—"}`;
  } else {
    tripDates = "—";
  }

  const cur = String(intake.currency || "EUR");
  const ideal = intake.budget_ideal ? String(intake.budget_ideal) : "";
  const max = intake.budget_max ? String(intake.budget_max) : "";
  const budgetLine =
    ideal || max
      ? `${ideal ? `${ideal} ${cur}` : "?"} → ${max ? `${max} ${cur}` : "?"} / pers.`
      : "";

  const travelersLine = [
    intake.group_type,
    intake.travellers_count
      ? `${intake.travellers_count} voyageur(s)`
      : "",
  ]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .join(" · ");

  const qualification = [
    intake.planning_stage && `Plan : ${intake.planning_stage}`,
    intake.hebergements && `Hébergements : ${intake.hebergements}`,
  ]
    .filter(Boolean)
    .join("\n");

  const internalBits = [
    intake.follow_prefs && `Préférences suivi : ${intake.follow_prefs}`,
    intake.notes_longues,
    intake.page_origin && `Page d'origine : ${intake.page_origin}`,
    `submission_id : ${intake.submission_id}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const priority = fdStr(formData, "priority") === "high" ? "high" : "normal";

  const { error } = await supabase.from("leads").insert({
    traveler_name: travelerName,
    email,
    phone: String(intake.phone ?? ""),
    status: "new",
    source: (intake.page_origin as string) || "Formulaire site DA",
    trip_summary:
      (intake.planning_stage as string) ||
      `Demande web — ${travelerName}`,
    travel_style: (intake.vision as string) || "—",
    travelers: travelersLine || "—",
    budget: budgetLine || "—",
    trip_dates: tripDates,
    qualification_summary: qualification || "—",
    internal_notes: internalBits || "—",
    quote_status: "Nouveau",
    starred: false,
    priority,
    intake_payload: intake,
    submission_id: String(intake.submission_id),
    page_origin: (intake.page_origin as string) || null,
    referent_id: null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}
