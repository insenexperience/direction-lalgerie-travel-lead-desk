import { LeadAiOpsPanel } from "@/components/leads/lead-ai-ops-panel";
import { LeadCockpitShell } from "@/components/leads/lead-cockpit-shell";
import { LeadFicheModifier } from "@/components/leads/lead-fiche-modifier";
import { LeadSupabaseStageWorkspace } from "@/components/leads/lead-supabase-stage-workspace";
import { LeadWorkflowPanel } from "@/components/leads/lead-workflow-panel";
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
  currentUserId: string | null;
  isAdmin: boolean;
  qualificationValidatorLabel: string | null;
  workflowEmailBanner: string | null;
  referents: ReferentRow[];
  referentLabel: string | null;
  agencies: AgencyOption[];
  retainedAgencyLabel: string | null;
  coProposals: CoConstructionProposalRow[];
  leadQuotes: LeadQuoteListItem[];
};

export function LeadDetailSupabase({
  lead,
  currentUserId,
  isAdmin,
  qualificationValidatorLabel,
  workflowEmailBanner,
  referents,
  referentLabel,
  agencies,
  retainedAgencyLabel,
  coProposals,
  leadQuotes,
}: LeadDetailSupabaseProps) {
  return (
    <LeadCockpitShell
      lead={lead}
      referentLabel={referentLabel}
      qualificationValidatorLabel={qualificationValidatorLabel}
      isAdmin={isAdmin}
    >
      <LeadWorkflowPanel
        leadId={lead.id}
        currentUserId={currentUserId}
        referentId={lead.referent_id}
        status={lead.status}
        workflowLaunchedAt={lead.workflow_launched_at}
        workflowMode={lead.workflow_mode}
        workflowEmailBanner={workflowEmailBanner}
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
        <LeadAiOpsPanel lead={lead} hideAutopilotToggle />
        <LeadSupabaseStageWorkspace
          lead={lead}
          referents={referents}
          referentLabel={referentLabel}
          agencies={agencies}
          retainedAgencyLabel={retainedAgencyLabel}
          coProposals={coProposals}
          leadQuotes={leadQuotes}
        />
        <LeadFicheModifier lead={lead} />
      </div>
    </LeadCockpitShell>
  );
}
