"use client";

import { AssignMultiplePartnerAgenciesForm } from "@/components/leads/assign-multiple-partner-agencies-form";
import { AssignReferentForm } from "@/components/leads/assign-referent-form";
import { LeadWelcomeEmailSender } from "@/components/leads/lead-welcome-email-sender";
import { LeadPreferredChannelSelector } from "@/components/leads/lead-preferred-channel-selector";
import { LeadBriefEditor } from "@/components/leads/lead-brief-editor";
import { LeadProposalsTable } from "@/components/leads/lead-proposals-table";
import { CoConstructionPanel } from "@/components/leads/co-construction-panel";
import { LeadQualificationWorkspace } from "@/components/leads/qualification/lead-qualification-workspace";
import { LeadQuotesPanel } from "@/components/leads/lead-quotes-panel";
import { LeadStageDisplayWrapper } from "@/components/leads/lead-stage-display-wrapper";
import type {
  CoConstructionProposalRow,
  LeadQuoteListItem,
} from "@/lib/co-construction-proposal";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

import type { ReferentDisplayRow } from "@/lib/referent-display";

type ReferentRow = ReferentDisplayRow;

type AgencyOption = { id: string; label: string };

type LeadSupabaseStageWorkspaceProps = {
  lead: SupabaseLeadRow;
  displayedStage: LeadStatus;
  referents: ReferentRow[];
  referentLabel: string | null;
  agencies: AgencyOption[];
  retainedAgencyLabel: string | null;
  coProposals: CoConstructionProposalRow[];
  leadQuotes: LeadQuoteListItem[];
};

function stageIntro(status: LeadStatus): { title: string; body: string } {
  const map: Record<LeadStatus, { title: string; body: string }> = {
    new: {
      title: "Nouveau — prise en main",
      body:
        "Allouez d'abord un opérateur travel desk au dossier. Ensuite, envoyez l'email de bienvenue au voyageur pour débloquer la qualification.",
    },
    qualification: {
      title: "Qualification & affinage du besoin",
      body:
        "Attendez la première réponse du voyageur pour détecter son canal préféré (WhatsApp ou email), puis remplissez la fiche de qualification.",
    },
    agency_assignment: {
      title: "Assignation — agences partenaires",
      body:
        "Envoyez le brief à 2–3 agences partenaires (réseau Direction l'Algérie). Chaque agence reçoit une copie du brief et retourne une proposition ou un refus.",
    },
    co_construction: {
      title: "Co-construction — propositions de circuit",
      body:
        "Comparez les propositions reçues, retenez la meilleure offre et préparez le devis DA à envoyer au voyageur.",
    },
    quote: {
      title: "Devis",
      body:
        "Consolidation des propositions et préparation du devis voyageur.",
    },
    negotiation: {
      title: "Négociation",
      body:
        "Ajustements avec le voyageur après envoi de l'offre.",
    },
    won: {
      title: "Dossier gagné",
      body: "Projet validé : suite opérationnelle hors périmètre de cette fiche.",
    },
    lost: {
      title: "Dossier clos",
      body: "Lead archivé.",
    },
  };
  return map[status];
}

export function LeadSupabaseStageWorkspace({
  lead,
  displayedStage,
  referents,
  referentLabel,
  agencies,
  retainedAgencyLabel,
  coProposals,
  leadQuotes,
}: LeadSupabaseStageWorkspaceProps) {
  const activeStatus = lead.status as LeadStatus;
  const activeIdx = LEAD_PIPELINE.indexOf(activeStatus);
  const displayedIdx = LEAD_PIPELINE.indexOf(displayedStage);

  const mode =
    displayedIdx < activeIdx
      ? "past"
      : displayedIdx === activeIdx
        ? "active"
        : "future";

  const isEditable = mode === "active";
  const intro = stageIntro(displayedStage);
  const stepHuman = displayedIdx >= 0 ? displayedIdx + 1 : 0;
  const stepTotal = LEAD_PIPELINE.length;

  const isNew = displayedStage === "new";
  const isAgencyAssignment = displayedStage === "agency_assignment";

  return (
    <>
      <section
        id="lead-stage-active"
        className="relative z-[1] scroll-mt-24 rounded-xl border-2 border-steel/20 bg-panel p-4 shadow-sm ring-1 ring-steel/10 sm:p-6"
      >
        <div className="border-b border-border pb-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-panel-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
            {mode === "active" ? (
              <>
                <span className="size-1.5 shrink-0 rounded-full bg-steel" aria-hidden />
                Étape active · {stepHuman} / {stepTotal}
              </>
            ) : mode === "past" ? (
              <>
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--info)]" aria-hidden />
                Étape passée · {stepHuman} / {stepTotal}
              </>
            ) : (
              <>
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--warn)]" aria-hidden />
                Étape future · {stepHuman} / {stepTotal}
              </>
            )}
            <span className="sr-only"> ({leadStatusLabelFr[displayedStage]})</span>
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {leadStatusLabelFr[displayedStage]}
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {intro.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{intro.body}</p>
        </div>

        <div className="mt-6 space-y-8">
          <LeadStageDisplayWrapper
            mode={mode}
            stageName={displayedStage}
            activeStage={activeStatus}
            leadId={lead.id}
          >
            <div className="space-y-8">
              {displayedStage === "qualification" ? (
                <div className="space-y-4">
                  <LeadPreferredChannelSelector
                    leadId={lead.id}
                    preferredChannel={lead.preferred_channel}
                    travelerName={lead.traveler_name}
                    reference={lead.reference}
                  />
                  <LeadQualificationWorkspace lead={lead} />
                </div>
              ) : null}

              {/* Opérateur travel desk */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isNew && isEditable
                    ? "Menu — Opérateur travel desk"
                    : "Opérateur travel desk (alloué)"}
                </h3>
                {isNew && isEditable ? (
                  <>
                    <p className="mt-2 text-sm text-foreground/90">
                      Actuellement :{" "}
                      <span className="font-medium text-foreground">
                        {referentLabel ?? "Non alloué"}
                      </span>
                    </p>
                    <div className="mt-4 max-w-md rounded-md border border-border bg-panel-muted/40 p-4">
                      <AssignReferentForm
                        key={lead.referent_id ?? "none"}
                        leadId={lead.id}
                        currentReferentId={lead.referent_id}
                        referents={referents}
                        variant="travel_desk"
                      />
                    </div>
                    {/* Email de bienvenue — affiché dès qu'un opérateur est alloué */}
                    {lead.referent_id ? (
                      <div className="mt-4">
                        <LeadWelcomeEmailSender lead={lead} />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-foreground/90">
                    {referentLabel ?? "—"}
                    {isEditable && !isNew ? (
                      <span className="ml-1 text-muted-foreground">
                        (modification à l'étape « Nouveau » uniquement.)
                      </span>
                    ) : null}
                  </p>
                )}
              </div>

              {/* Brief agence — affiché dans l'étape agency_assignment */}
              {displayedStage === "agency_assignment" ? (
                <LeadBriefEditor
                  leadId={lead.id}
                  generatedBrief={lead.generated_brief}
                  briefGeneratedAt={lead.brief_generated_at}
                  briefEditedAt={lead.brief_edited_at}
                />
              ) : null}

              {/* Agence partenaire */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isAgencyAssignment && isEditable
                    ? "Menu — Agence partenaire"
                    : "Agence partenaire (traitement du lead)"}
                </h3>
                {isAgencyAssignment && isEditable ? (
                  <div className="mt-4">
                    <AssignMultiplePartnerAgenciesForm
                      leadId={lead.id}
                      agencies={agencies}
                      proposals={coProposals}
                      generatedBrief={lead.generated_brief}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-foreground/90">
                    {retainedAgencyLabel ? (
                      retainedAgencyLabel
                    ) : (
                      <span className="text-muted-foreground">
                        Aucune — à définir à l'étape « Assignation ».
                      </span>
                    )}
                  </p>
                )}
              </div>

              {displayedStage === "co_construction" ? (
                <div className="space-y-6">
                  {/* Proposals table for arbitrage */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Propositions agences — arbitrage
                    </h3>
                    <div className="mt-4">
                      <LeadProposalsTable
                        leadId={lead.id}
                        proposals={coProposals}
                        agencies={agencies}
                        retainedAgencyId={lead.retained_agency_id}
                      />
                    </div>
                  </div>
                  {/* DA quote builder */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Devis DA — construction
                    </h3>
                    <div className="mt-4">
                      <CoConstructionPanel
                        leadId={lead.id}
                        proposals={coProposals}
                        editable={isEditable}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {displayedStage !== "co_construction" && coProposals.length > 0 ? (
                <div className="rounded-lg border border-dashed border-border/90 bg-panel-muted/20 p-4 opacity-95">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Historique — propositions de circuit
                  </h3>
                  <div className="mt-4">
                    <CoConstructionPanel
                      leadId={lead.id}
                      proposals={coProposals}
                      editable={false}
                    />
                  </div>
                </div>
              ) : null}

              {(displayedStage === "quote" || displayedStage === "negotiation") && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Menu — Devis & offre
                  </h3>
                  <p className="mt-2 text-sm text-foreground/85">
                    Devis générés et brouillons liés au dossier.
                  </p>
                  <div className="mt-4">
                    <LeadQuotesPanel leadId={lead.id} quotes={leadQuotes} />
                  </div>
                </div>
              )}

              {(displayedStage === "won" || displayedStage === "lost") && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Menu — Clôture
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Synthèse finale et archivage.
                  </p>
                </div>
              )}
            </div>
          </LeadStageDisplayWrapper>
        </div>
      </section>
    </>
  );
}
