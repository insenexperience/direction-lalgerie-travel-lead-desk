import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadDetailDeleteZone } from "@/components/leads/lead-detail-delete-zone";
import { LeadFicheModifier } from "@/components/leads/lead-fiche-modifier";
import { LeadReadOnlySummary } from "@/components/leads/lead-read-only-summary";
import { LeadSupabasePipeline } from "@/components/leads/lead-supabase-pipeline";
import { LeadSupabaseStageWorkspace } from "@/components/leads/lead-supabase-stage-workspace";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { TopHeader } from "@/components/top-header";
import type {
  CoConstructionProposalRow,
  LeadQuoteListItem,
} from "@/lib/co-construction-proposal";
import type { ReferentDisplayRow } from "@/lib/referent-display";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

export type { SupabaseLeadRow };

type ReferentRow = ReferentDisplayRow;

type AgencyOption = { id: string; label: string };

type LeadDetailSupabaseProps = {
  lead: SupabaseLeadRow;
  referents: ReferentRow[];
  referentLabel: string | null;
  agencies: AgencyOption[];
  retainedAgencyLabel: string | null;
  coProposals: CoConstructionProposalRow[];
  leadQuotes: LeadQuoteListItem[];
};

export function LeadDetailSupabase({
  lead,
  referents,
  referentLabel,
  agencies,
  retainedAgencyLabel,
  coProposals,
  leadQuotes,
}: LeadDetailSupabaseProps) {
  return (
    <div className="space-y-5 pb-20 sm:space-y-6 sm:pb-24">
      <TopHeader
        title={lead.traveler_name}
        description={lead.trip_summary}
        actions={<LeadStatusBadge status={lead.status} />}
      />

      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux leads
      </Link>

      <LeadSupabasePipeline
        leadId={lead.id}
        status={lead.status}
        referentId={lead.referent_id}
      />

      {!lead.referent_id ? (
        <p
          className="rounded-md border border-dashed border-border bg-panel-muted/50 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          À l’étape <strong className="text-foreground">Nouveau</strong>, allouez un{" "}
          <strong className="text-foreground">opérateur travel desk</strong> (bloc ci-dessous)
          pour débloquer le passage aux étapes suivantes.
        </p>
      ) : null}

      <div className="space-y-5">
        <LeadSupabaseStageWorkspace
          lead={lead}
          referents={referents}
          referentLabel={referentLabel}
          agencies={agencies}
          retainedAgencyLabel={retainedAgencyLabel}
          coProposals={coProposals}
          leadQuotes={leadQuotes}
        />
        <LeadReadOnlySummary
          lead={lead}
          operatorLabel={referentLabel}
          partnerAgencyLabel={retainedAgencyLabel}
        />
        <LeadFicheModifier lead={lead} />
        <LeadDetailDeleteZone leadId={lead.id} travelerName={lead.traveler_name} />
      </div>
    </div>
  );
}
