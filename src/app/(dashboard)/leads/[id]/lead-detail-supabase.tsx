import { LeadAiOpsPanel } from "@/components/leads/lead-ai-ops-panel";
import { LeadCockpitShell } from "@/components/leads/lead-cockpit-shell";
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
      currentUserId={currentUserId}
    >
      <div className="scroll-mt-20 space-y-5">
        {/* L1 — Tâche / étape active (premier focus) */}
        <div className="space-y-3">
          {!lead.referent_id ? (
            <p
              className="rounded-md border border-dashed border-amber-300/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              À l’étape <strong className="text-foreground">Nouveau</strong>, allouez un{" "}
              <strong className="text-foreground">opérateur travel desk</strong> dans le bloc
              ci-dessous pour débloquer le passage aux étapes suivantes.
            </p>
          ) : null}
          <LeadSupabaseStageWorkspace
            lead={lead}
            referents={referents}
            referentLabel={referentLabel}
            agencies={agencies}
            retainedAgencyLabel={retainedAgencyLabel}
            coProposals={coProposals}
            leadQuotes={leadQuotes}
          />
        </div>

        {/* L2 — Contexte pipeline / IA (second plan) */}
        <section
          className="space-y-4 rounded-lg border border-border/80 bg-panel-muted/25 p-4 sm:p-5"
          aria-labelledby="lead-context-heading"
        >
          <h2
            id="lead-context-heading"
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Contexte
          </h2>
          <LeadWorkflowPanel
            leadId={lead.id}
            currentUserId={currentUserId}
            referentId={lead.referent_id}
            status={lead.status}
            workflowLaunchedAt={lead.workflow_launched_at}
            workflowMode={lead.workflow_mode}
            workflowRunRef={lead.workflow_run_ref}
            manualTakeover={lead.manual_takeover}
            workflowEmailBanner={workflowEmailBanner}
          />
          <LeadAiOpsPanel lead={lead} hideAutopilotToggle />
        </section>
      </div>
    </LeadCockpitShell>
  );
}
