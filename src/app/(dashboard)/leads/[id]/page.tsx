import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import {
  mapProposalRowFromDb,
  mapQuoteRowFromDb,
} from "@/lib/co-construction-proposal";
import { getWorkflowEmailDeliveryHints } from "@/lib/email/workflow-email-config";
import { allocateLeadReferenceIfMissing } from "@/lib/lead-reference";
import { referentDisplayLabel } from "@/lib/referent-display";
import {
  LEAD_SELECT_LEGACY,
  LEAD_SELECT_V2,
  mapRowToSupabaseLeadRow,
} from "@/lib/supabase-lead-detail-map";
import { isPostgresUndefinedColumnError } from "@/lib/supabase-schema-fallback";
import { LEAD_PIPELINE } from "@/lib/mock-leads";
import type { LeadStatus } from "@/lib/mock-leads";
import { LeadDetailSupabase } from "./lead-detail-supabase";

export const dynamic = "force-dynamic";
export const revalidate = 30;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const QUOTE_SELECT_V2 =
  "id, kind, status, workflow_status, items, summary, created_at, sent_at, sent_via, pdf_storage_path";

const QUOTE_SELECT_LEGACY =
  "id, kind, status, workflow_status, items, summary, created_at";

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const stageParam = typeof sp.stage === "string" ? sp.stage : null;

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
  let lead = mapRowToSupabaseLeadRow(row, schemaV2);

  if (schemaV2) {
    try {
      const ref = await allocateLeadReferenceIfMissing(supabase, id);
      if (ref) lead = { ...lead, reference: ref };
    } catch {
      /* colonnes cockpit absentes (migration non appliquée) */
    }
  }

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

  let isAdmin = false;
  if (user?.id) {
    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = me?.role === "admin";
  }

  let qualificationValidatorLabel: string | null = null;
  if (lead.qualification_validated_by) {
    const v = referents.find((r) => r.id === lead.qualification_validated_by);
    qualificationValidatorLabel = v ? referentDisplayLabel(v) : null;
  }

  const workflowHints = getWorkflowEmailDeliveryHints();

  const displayedStage: LeadStatus =
    stageParam && (LEAD_PIPELINE as string[]).includes(stageParam)
      ? (stageParam as LeadStatus)
      : lead.status;

  return (
    <LeadDetailSupabase
      lead={lead}
      currentUserId={user?.id ?? null}
      isAdmin={isAdmin}
      qualificationValidatorLabel={qualificationValidatorLabel}
      workflowEmailBanner={workflowHints.bannerMessage}
      referents={referents}
      referentLabel={referentLabel}
      agencies={agencies}
      retainedAgencyLabel={retainedAgencyLabel}
      coProposals={coProposals}
      leadQuotes={leadQuotes}
      displayedStage={displayedStage}
    />
  );
}
