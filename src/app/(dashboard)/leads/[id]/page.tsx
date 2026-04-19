import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import {
  mapProposalRowFromDb,
  mapQuoteRowFromDb,
} from "@/lib/co-construction-proposal";
import {
  parseCrmCommercialPriority,
  parseCrmConversionBand,
  parseCrmFeasibilityBand,
  parseCrmFollowUpStrategy,
  parseCrmPrimaryObjection,
} from "@/lib/crm-fields";
import { normalizeLeadStatusForUi } from "@/lib/lead-status-coerce";
import { referentDisplayLabel } from "@/lib/referent-display";
import { LeadDetailView } from "./lead-detail-view";
import { LeadDetailSupabase, type SupabaseLeadRow } from "./lead-detail-supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (!isUuid(id)) {
    return <LeadDetailView />;
  }

  const supabase = await createClient();
  const { data: leadRow, error: leadError } = await supabase
    .from("leads")
    .select(
      [
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
        "crm_commercial_priority",
        "crm_conversion_band",
        "crm_feasibility_band",
        "crm_follow_up_strategy",
        "crm_primary_objection",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();

  if (leadError || !leadRow) {
    notFound();
  }

  const row = leadRow as unknown as Record<string, unknown>;

  const lead: SupabaseLeadRow = {
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
    priority: row.priority === "high" ? "high" : "normal",
    updated_at: String(row.updated_at ?? ""),
    crm_commercial_priority:
      parseCrmCommercialPriority(String(row.crm_commercial_priority ?? "")) ??
      "medium",
    crm_conversion_band:
      parseCrmConversionBand(String(row.crm_conversion_band ?? "")) ?? "medium",
    crm_feasibility_band:
      parseCrmFeasibilityBand(String(row.crm_feasibility_band ?? "")) ?? "possible",
    crm_follow_up_strategy:
      parseCrmFollowUpStrategy(String(row.crm_follow_up_strategy ?? "")) ?? "none",
    crm_primary_objection:
      parseCrmPrimaryObjection(String(row.crm_primary_objection ?? "")) ?? "none",
  };

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

  const { data: quoteRows, error: quotesError } = await supabase
    .from("quotes")
    .select("id, kind, status, workflow_status, items, summary, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const leadQuotes =
    !quotesError && quoteRows
      ? quoteRows.map((r) => mapQuoteRowFromDb(r as unknown as Record<string, unknown>))
      : [];

  return (
    <LeadDetailSupabase
      lead={lead}
      referents={referents}
      referentLabel={referentLabel}
      agencies={agencies}
      retainedAgencyLabel={retainedAgencyLabel}
      coProposals={coProposals}
      leadQuotes={leadQuotes}
    />
  );
}
