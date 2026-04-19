"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import type { CoConstructionProposalStatus } from "@/lib/co-construction-proposal";
import { buildQuoteItemsFromProposal } from "@/lib/quote-items-build";
import { quoteWorkflowToLeadQuoteStatusFr } from "@/lib/quote-workflow";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fdStr(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function loadProposal(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase
    .from("lead_circuit_proposals")
    .select("id, lead_id, status, circuit_outline, converted_quote_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    id: string;
    lead_id: string;
    status: CoConstructionProposalStatus;
    circuit_outline: string;
    converted_quote_id: string | null;
  };
}

async function assertLeadInCoConstruction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
): Promise<ActionResult | null> {
  const { data: lead, error } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !lead) {
    return { ok: false, error: "Lead introuvable." };
  }
  if (lead.status !== "co_construction") {
    return {
      ok: false,
      error: "Les propositions de circuit ne sont gérées qu’à l’étape « Co-construction ».",
    };
  }
  return null;
}

export async function createCircuitProposal(leadId: string): Promise<ActionResult> {
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

  const gate = await assertLeadInCoConstruction(supabase, leadId);
  if (gate) return gate;

  const { data: leadRow } = await supabase
    .from("leads")
    .select("retained_agency_id")
    .eq("id", leadId)
    .maybeSingle();

  const { data: verRows } = await supabase
    .from("lead_circuit_proposals")
    .select("version")
    .eq("lead_id", leadId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion =
    verRows && verRows.length > 0 && typeof verRows[0]?.version === "number"
      ? (verRows[0]!.version as number) + 1
      : 1;

  const { error } = await supabase.from("lead_circuit_proposals").insert({
    lead_id: leadId,
    agency_id: (leadRow?.retained_agency_id as string | null) ?? null,
    title: `Proposition de circuit v${nextVersion}`,
    circuit_outline: "",
    status: "awaiting_agency",
    version: nextVersion,
    created_by_profile_id: user.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Simulation côté desk : l’agence dépose le circuit (passe en « reçue / modifiable »). */
export async function submitCircuitProposalFromAgency(
  proposalId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!isUuid(proposalId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const row = await loadProposal(supabase, proposalId);
  if (!row) {
    return { ok: false, error: "Proposition introuvable." };
  }

  const gate = await assertLeadInCoConstruction(supabase, row.lead_id);
  if (gate) return gate;

  if (row.status !== "awaiting_agency") {
    return {
      ok: false,
      error: "Cette proposition n’est plus en attente de l’agence.",
    };
  }

  const outline = fdStr(formData, "circuit_outline");
  if (!outline) {
    return { ok: false, error: "Décrivez le circuit proposé par l’agence." };
  }

  const title = fdStr(formData, "title") || "Proposition de circuit";

  const { error } = await supabase
    .from("lead_circuit_proposals")
    .update({
      circuit_outline: outline,
      title,
      status: "submitted",
    })
    .eq("id", proposalId)
    .eq("status", "awaiting_agency");

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${row.lead_id}`);
  return { ok: true };
}

/** Mise à jour du texte tant que la proposition est « reçue » (modifiable). */
export async function updateCircuitProposalOutline(
  proposalId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!isUuid(proposalId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const row = await loadProposal(supabase, proposalId);
  if (!row) {
    return { ok: false, error: "Proposition introuvable." };
  }

  const gate = await assertLeadInCoConstruction(supabase, row.lead_id);
  if (gate) return gate;

  if (row.status !== "submitted") {
    return {
      ok: false,
      error: "Seules les propositions « reçues » peuvent être modifiées ici.",
    };
  }

  const outline = fdStr(formData, "circuit_outline");
  if (!outline) {
    return { ok: false, error: "Le descriptif du circuit est obligatoire." };
  }

  const title = fdStr(formData, "title");

  const patch: Record<string, string> = { circuit_outline: outline };
  if (title) patch.title = title;

  const { error } = await supabase
    .from("lead_circuit_proposals")
    .update(patch)
    .eq("id", proposalId)
    .eq("status", "submitted");

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${row.lead_id}`);
  return { ok: true };
}

/** Validation travel desk : le parcours co-construit est OK pour enchaîner sur le devis. */
export async function approveCircuitProposal(proposalId: string): Promise<ActionResult> {
  if (!isUuid(proposalId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const row = await loadProposal(supabase, proposalId);
  if (!row) {
    return { ok: false, error: "Proposition introuvable." };
  }

  const gate = await assertLeadInCoConstruction(supabase, row.lead_id);
  if (gate) return gate;

  if (row.status !== "submitted") {
    return {
      ok: false,
      error: "Seule une proposition « reçue » peut être validée.",
    };
  }

  const { error } = await supabase
    .from("lead_circuit_proposals")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_profile_id: user.id,
    })
    .eq("id", proposalId)
    .eq("status", "submitted");

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/leads/${row.lead_id}`);
  return { ok: true };
}

function buildGeneratedQuoteSummary(params: {
  travelerName: string;
  tripSummary: string;
  tripDates: string;
  budget: string;
  circuitTitle: string;
  circuitOutline: string;
}): string {
  const parts = [
    "=== DEVIS GÉNÉRÉ (APERÇU INTERNE) ===",
    "",
    `Voyageur : ${params.travelerName}`,
    `Résumé besoin : ${params.tripSummary || "—"}`,
    `Dates : ${params.tripDates || "—"}`,
    `Budget indicatif : ${params.budget || "—"}`,
    "",
    `— ${params.circuitTitle} —`,
    "",
    params.circuitOutline.trim(),
    "",
    "Ce document est un brouillon généré depuis la proposition validée ; à compléter (prix, conditions) avant envoi voyageur.",
  ];
  return parts.join("\n");
}

/** Crée une ligne `quotes` à partir d’une proposition approuvée et passe le lead à l’étape Devis. */
export async function generateQuoteFromProposal(proposalId: string): Promise<ActionResult> {
  if (!isUuid(proposalId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: prop, error: pErr } = await supabase
    .from("lead_circuit_proposals")
    .select(
      "id, lead_id, status, title, circuit_outline, converted_quote_id, agency_id",
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (pErr || !prop) {
    return { ok: false, error: "Proposition introuvable." };
  }

  const gate = await assertLeadInCoConstruction(supabase, prop.lead_id as string);
  if (gate) return gate;

  if (prop.status !== "approved") {
    return {
      ok: false,
      error: "Validez d’abord la proposition (bouton « Valider pour devis »).",
    };
  }
  if (prop.converted_quote_id) {
    return { ok: false, error: "Un devis a déjà été généré pour cette proposition." };
  }

  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .select(
      "traveler_name, trip_summary, trip_dates, budget, status",
    )
    .eq("id", prop.lead_id)
    .maybeSingle();

  if (lErr || !lead) {
    return { ok: false, error: "Lead introuvable." };
  }

  const summary = buildGeneratedQuoteSummary({
    travelerName: String(lead.traveler_name ?? ""),
    tripSummary: String(lead.trip_summary ?? ""),
    tripDates: String(lead.trip_dates ?? ""),
    budget: String(lead.budget ?? ""),
    circuitTitle: String(prop.title ?? "Proposition"),
    circuitOutline: String(prop.circuit_outline ?? ""),
  });

  const items = buildQuoteItemsFromProposal({
    circuitTitle: String(prop.title ?? "Proposition"),
    circuitOutline: String(prop.circuit_outline ?? ""),
    tripSummary: String(lead.trip_summary ?? ""),
    tripDates: String(lead.trip_dates ?? ""),
    budget: String(lead.budget ?? ""),
  });

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      lead_id: prop.lead_id,
      consultation_id: null,
      kind: "agency_internal",
      status: "draft",
      workflow_status: "draft",
      summary,
      items,
      is_traveler_visible: false,
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    return {
      ok: false,
      error: quoteError?.message ?? "Échec création du devis.",
    };
  }

  const quoteId = quote.id as string;

  const { error: uProp } = await supabase
    .from("lead_circuit_proposals")
    .update({ converted_quote_id: quoteId })
    .eq("id", proposalId);

  if (uProp) {
    return { ok: false, error: uProp.message };
  }

  const { error: uLead } = await supabase
    .from("leads")
    .update({
      status: "quote",
      quote_status: quoteWorkflowToLeadQuoteStatusFr("draft"),
    })
    .eq("id", prop.lead_id);

  if (uLead) {
    return { ok: false, error: uLead.message };
  }

  revalidatePath(`/leads/${prop.lead_id}`);
  revalidatePath("/leads");
  revalidatePath("/metrics");
  return { ok: true };
}
