import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import {
  mapProposalRowFromDb,
  mapQuoteRowFromDb,
} from "@/lib/co-construction-proposal";
import { parseCrmConversionBand, parseCrmFollowUpStrategy } from "@/lib/crm-fields";
import { normalizeLeadStatusForUi } from "@/lib/lead-status-coerce";
import { referentDisplayLabel } from "@/lib/referent-display";
import { isPostgresUndefinedColumnError } from "@/lib/supabase-schema-fallback";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { LeadDetailSupabase } from "./lead-detail-supabase";

export const dynamic = "force-dynamic";
export const revalidate = 30;

type PageProps = {
  params: Promise<{ id: string }>;
};

const LEAD_SELECT_V2 = [
  "id",
  "referent_id",
  "retained_agency_id",
  "traveler_name",
  "email",
  "phone",
  "status",
  "trip_summary",
  "travel_style",
  "travelers",
  "budget",
  "trip_dates",
  "qualification_summary",
  "internal_notes",
  "quote_status",
  "source",
  "priority",
  "updated_at",
  "crm_conversion_band",
  "crm_follow_up_strategy",
  "intake_channel",
  "whatsapp_phone_number",
  "whatsapp_thread_id",
  "conversation_transcript",
  "ai_qualification_payload",
  "ai_qualification_confidence",
  "scoring_weights",
  "qualification_validated_at",
  "qualification_validated_by",
  "qualification_validation_status",
  "manual_takeover",
  "submission_id",
  "workflow_launched_at",
  "workflow_launched_by",
  "workflow_mode",
].join(", ");

/** Schéma avant migration `20260428100000_travel_lead_desk_v2.sql` (pas de colonnes IA / WhatsApp dédiées). */
const LEAD_SELECT_LEGACY = [
  "id",
  "referent_id",
  "retained_agency_id",
  "traveler_name",
  "email",
  "phone",
  "status",
  "trip_summary",
  "travel_style",
  "travelers",
  "budget",
  "trip_dates",
  "qualification_summary",
  "internal_notes",
  "quote_status",
  "source",
  "priority",
  "updated_at",
  "crm_conversion_band",
  "crm_follow_up_strategy",
  "submission_id",
].join(", ");

const QUOTE_SELECT_V2 =
  "id, kind, status, workflow_status, items, summary, created_at, sent_at, sent_via, pdf_storage_path";

const QUOTE_SELECT_LEGACY =
  "id, kind, status, workflow_status, items, summary, created_at";

function mapRowToSupabaseLeadRow(
  row: Record<string, unknown>,
  schemaV2: boolean,
): SupabaseLeadRow {
  const priority: "high" | "normal" = row.priority === "high" ? "high" : "normal";

  const base = {
    id: String(row.id),
    referent_id: row.referent_id ? String(row.referent_id) : null,
    retained_agency_id: row.retained_agency_id ? String(row.retained_agency_id) : null,
    traveler_name: String(row.traveler_name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    status: normalizeLeadStatusForUi(String(row.status ?? "new")),
    trip_summary: String(row.trip_summary ?? ""),
    travel_style: String(row.travel_style ?? ""),
    travelers: String(row.travelers ?? ""),
    budget: String(row.budget ?? ""),
    trip_dates: String(row.trip_dates ?? ""),
    qualification_summary: String(row.qualification_summary ?? ""),
    internal_notes: String(row.internal_notes ?? ""),
    quote_status: String(row.quote_status ?? ""),
    source: String(row.source ?? ""),
    priority,
    updated_at: String(row.updated_at ?? ""),
    crm_conversion_band:
      parseCrmConversionBand(String(row.crm_conversion_band ?? "")) ?? "medium",
    crm_follow_up_strategy:
      parseCrmFollowUpStrategy(String(row.crm_follow_up_strategy ?? "")) ?? "none",
  };

  if (!schemaV2) {
    const hasSubmission =
      row.submission_id != null && String(row.submission_id).trim() !== "";
    const sid =
      row.submission_id != null && String(row.submission_id).trim() !== ""
        ? String(row.submission_id).trim()
        : null;
    return {
      ...base,
      intake_channel: hasSubmission ? "web_form" : "manual",
      whatsapp_phone_number: null,
      whatsapp_thread_id: null,
      conversation_transcript: [],
      ai_qualification_payload: null,
      ai_qualification_confidence: null,
      scoring_weights: null,
      qualification_validated_at: null,
      qualification_validated_by: null,
      qualification_validation_status: "pending",
      manual_takeover: false,
      submission_id: sid,
      workflow_launched_at: null,
      workflow_launched_by: null,
      workflow_mode: null,
    };
  }

  return {
    ...base,
    intake_channel: row.intake_channel != null ? String(row.intake_channel) : null,
    whatsapp_phone_number: row.whatsapp_phone_number != null
      ? String(row.whatsapp_phone_number)
      : null,
    whatsapp_thread_id:
      row.whatsapp_thread_id != null ? String(row.whatsapp_thread_id) : null,
    conversation_transcript: row.conversation_transcript ?? [],
    ai_qualification_payload: row.ai_qualification_payload ?? null,
    ai_qualification_confidence:
      row.ai_qualification_confidence != null &&
      Number.isFinite(Number(row.ai_qualification_confidence))
        ? Number(row.ai_qualification_confidence)
        : null,
    scoring_weights: row.scoring_weights ?? null,
    qualification_validated_at: row.qualification_validated_at
      ? String(row.qualification_validated_at)
      : null,
    qualification_validated_by: row.qualification_validated_by
      ? String(row.qualification_validated_by)
      : null,
    qualification_validation_status: String(
      row.qualification_validation_status ?? "pending",
    ),
    manual_takeover: Boolean(row.manual_takeover),
    submission_id:
      row.submission_id != null && String(row.submission_id).trim() !== ""
        ? String(row.submission_id).trim()
        : null,
    workflow_launched_at: row.workflow_launched_at
      ? String(row.workflow_launched_at)
      : null,
    workflow_launched_by: row.workflow_launched_by
      ? String(row.workflow_launched_by)
      : null,
    workflow_mode:
      row.workflow_mode === "ai" || row.workflow_mode === "manual"
        ? row.workflow_mode
        : null,
  };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const supabase = await createClient();

  let schemaV2 = true;
  let leadRes = await supabase
    .from("leads")
    .select(LEAD_SELECT_V2)
    .eq("id", id)
    .maybeSingle();

  if (leadRes.error && isPostgresUndefinedColumnError(leadRes.error)) {
    schemaV2 = false;
    leadRes = await supabase
      .from("leads")
      .select(LEAD_SELECT_LEGACY)
      .eq("id", id)
      .maybeSingle();
  }

  const { data: leadRow, error: leadError } = leadRes;

  if (leadError) {
    throw new Error(
      `Chargement du lead impossible (${leadError.code ?? "?"}) : ${leadError.message}. ` +
        "Vérifiez les migrations Supabase (`npm run db:push` ou SQL Editor — voir docs/DEPLOY_VERCEL.md §2).",
    );
  }

  if (!leadRow) {
    notFound();
  }

  const row = leadRow as unknown as Record<string, unknown>;
  const lead = mapRowToSupabaseLeadRow(row, schemaV2);

  const { data: referentRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  const referents = referentRows ?? [];

  let referentLabel: string | null = null;
  if (lead.referent_id) {
    const match = referents.find((r) => r.id === lead.referent_id);
    referentLabel = match ? referentDisplayLabel(match) : null;
  }

  const { data: agencyRows } = await supabase
    .from("agencies")
    .select("id, legal_name, trade_name")
    .order("legal_name", { ascending: true });

  const agencies =
    agencyRows?.map((a) => ({
      id: String(a.id),
      label: (a.trade_name as string | null)?.trim()
        ? String(a.trade_name)
        : String(a.legal_name ?? ""),
    })) ?? [];

  let retainedAgencyLabel: string | null = null;
  if (lead.retained_agency_id) {
    const ag = agencies.find((x) => x.id === lead.retained_agency_id);
    retainedAgencyLabel = ag?.label ?? `Agence ${lead.retained_agency_id.slice(0, 8)}…`;
  }

  const { data: proposalRows, error: proposalsError } = await supabase
    .from("lead_circuit_proposals")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const coProposals =
    !proposalsError && proposalRows
      ? proposalRows.map((r) =>
          mapProposalRowFromDb(r as unknown as Record<string, unknown>),
        )
      : [];

  const quotesPrimary = await supabase
    .from("quotes")
    .select(schemaV2 ? QUOTE_SELECT_V2 : QUOTE_SELECT_LEGACY)
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const quotesFinal =
    quotesPrimary.error &&
    schemaV2 &&
    isPostgresUndefinedColumnError(quotesPrimary.error)
      ? await supabase
          .from("quotes")
          .select(QUOTE_SELECT_LEGACY)
          .eq("lead_id", id)
          .order("created_at", { ascending: false })
      : quotesPrimary;

  const { data: quoteRows, error: quotesError } = quotesFinal;

  const leadQuotes =
    !quotesError && quoteRows
      ? quoteRows.map((r) => mapQuoteRowFromDb(r as unknown as Record<string, unknown>))
      : [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <LeadDetailSupabase
      lead={lead}
      currentUserId={user?.id ?? null}
      referents={referents}
      referentLabel={referentLabel}
      agencies={agencies}
      retainedAgencyLabel={retainedAgencyLabel}
      coProposals={coProposals}
      leadQuotes={leadQuotes}
    />
  );
}
