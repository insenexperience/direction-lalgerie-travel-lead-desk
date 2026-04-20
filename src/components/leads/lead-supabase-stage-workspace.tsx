"use client";

import { AssignPartnerAgencyForm } from "@/components/leads/assign-partner-agency-form";
import { AssignReferentForm } from "@/components/leads/assign-referent-form";
import { LeadCommercialCrmForm } from "@/components/leads/lead-commercial-crm-form";
import { CoConstructionPanel } from "@/components/leads/co-construction-panel";
import { LeadQualificationWorkspace } from "@/components/leads/lead-qualification-workspace";
import { LeadQuotesPanel } from "@/components/leads/lead-quotes-panel";
import type {
  CoConstructionProposalRow,
  LeadQuoteListItem,
} from "@/lib/co-construction-proposal";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";
import {
  getBriefGateBlockMessage,
  isLeadBriefExploitable,
  leadBriefChecklist,
} from "@/lib/lead-brief-gate";
import { ContextBanner } from "@/components/leads/context-banner";

import type { ReferentDisplayRow } from "@/lib/referent-display";

type ReferentRow = ReferentDisplayRow;

type AgencyOption = { id: string; label: string };

type LeadSupabaseStageWorkspaceProps = {
  lead: SupabaseLeadRow;
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
        "Allouez d’abord un opérateur travel desk au dossier. Ensuite, faites avancer le pipeline. L’assignation d’une agence partenaire intervient plus tard, à l’étape « Assignation ».",
    },
    qualification: {
      title: "Qualification & affinage du besoin",
      body:
        "Enrichissez la fiche jusqu’à ce qu’elle soit exploitable (mêmes champs requis en mode IA ou manuel). Validez la qualification dans le bloc « Contexte » si l’IA a produit une proposition. La grille CRM express (conversion + relance) reste en dessous — cible ~1 minute.",
    },
    agency_assignment: {
      title: "Assignation — agence partenaire",
      body:
        "Choisissez l’agence partenaire chargée de traiter ce lead (réseau Direction l’Algérie). La fiche anonymisée part vers l’agence pour préparer les propositions de circuit. Ce n’est pas l’opérateur travel desk, déjà alloué à l’étape « Nouveau ».",
    },
    co_construction: {
      title: "Co-construction — propositions de circuit",
      body:
        "L’agence retenue envoie des propositions de circuit ; vous comparez, affinez, puis validez. L’IA ou l’opérateur peut aider à trancher la meilleure option avant génération du devis chiffré.",
    },
    quote: {
      title: "Devis",
      body:
        "Consolidation des propositions et préparation du devis voyageur.",
    },
    negotiation: {
      title: "Négociation",
      body:
        "Ajustements avec le voyageur après envoi de l’offre.",
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
  referents,
  referentLabel,
  agencies,
  retainedAgencyLabel,
  coProposals,
  leadQuotes,
}: LeadSupabaseStageWorkspaceProps) {
  const status = lead.status as LeadStatus;
  const intro = stageIntro(status);
  const isNew = status === "new";
  const isAgencyAssignment = status === "agency_assignment";
  const stepIdx = LEAD_PIPELINE.indexOf(status);
  const stepHuman = stepIdx >= 0 ? stepIdx + 1 : 0;
  const stepTotal = LEAD_PIPELINE.length;

  return (
    <>
      <section
        id="lead-stage-active"
        className="relative z-[1] scroll-mt-24 rounded-xl border-2 border-steel/20 bg-panel p-4 shadow-sm ring-1 ring-steel/10 sm:p-6"
      >
        <div className="border-b border-border pb-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-panel-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel">
            <span className="size-1.5 shrink-0 rounded-full bg-steel" aria-hidden />
            Étape active · {stepHuman} / {stepTotal}
            <span className="sr-only"> ({leadStatusLabelFr[status]})</span>
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {leadStatusLabelFr[status]}
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {intro.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{intro.body}</p>
        </div>

        <div className="mt-6 space-y-8">
        {status === "qualification" ? (
          <div className="rounded-lg border border-border bg-panel-muted/35 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Brief prêt pour l’assignation agence
            </h3>
            <p className="mt-2 text-sm text-foreground/85">
              Tant que la checklist n’est pas complète ou la qualification non validée, le passage
              à « Assignation » est bloqué côté serveur.
            </p>
            {!isLeadBriefExploitable(lead) && getBriefGateBlockMessage(lead) ? (
              <div className="mt-3">
                <ContextBanner variant="operator" title="Action requise">
                  {getBriefGateBlockMessage(lead)}
                </ContextBanner>
              </div>
            ) : null}
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {leadBriefChecklist(lead).map((item) => (
                <li
                  key={item.id}
                  className={[
                    "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium",
                    item.ok
                      ? "border-emerald-200/90 bg-emerald-50/80 text-emerald-950"
                      : "border-border bg-panel text-foreground/80",
                  ].join(" ")}
                >
                  <span aria-hidden>{item.ok ? "✓" : "○"}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {status === "qualification" ? (
          <LeadQualificationWorkspace lead={lead} />
        ) : null}

        {/* Opérateur travel desk : uniquement à l’étape Nouveau (allocation). */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isNew ? "Menu — Opérateur travel desk" : "Opérateur travel desk (alloué)"}
          </h3>
          {isNew ? (
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
            </>
          ) : (
            <p className="mt-2 text-sm text-foreground/90">
              {referentLabel ?? "—"}{" "}
              <span className="text-muted-foreground">
                (modification à l’étape « Nouveau » uniquement.)
              </span>
            </p>
          )}
        </div>

        {/* Agence partenaire : étape Assignation ; lecture seule ensuite. */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isAgencyAssignment
              ? "Menu — Agence partenaire"
              : "Agence partenaire (traitement du lead)"}
          </h3>
          {isAgencyAssignment ? (
            <>
              <p className="mt-2 text-sm text-foreground/90">
                Agence retenue :{" "}
                <span className="font-medium text-foreground">
                  {retainedAgencyLabel ?? "Aucune"}
                </span>
              </p>
              <div className="mt-4 max-w-md rounded-md border border-border bg-panel-muted/40 p-4">
                <AssignPartnerAgencyForm
                  key={lead.retained_agency_id ?? "none"}
                  leadId={lead.id}
                  currentAgencyId={lead.retained_agency_id}
                  agencies={agencies}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-foreground/90">
              {retainedAgencyLabel ? (
                retainedAgencyLabel
              ) : (
                <span className="text-muted-foreground">
                  Aucune — à définir à l’étape « Assignation ».
                </span>
              )}
            </p>
          )}
        </div>

        {status === "co_construction" ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Menu — Co-construction & propositions de circuit
            </h3>
            <div className="mt-4">
              <CoConstructionPanel
                leadId={lead.id}
                proposals={coProposals}
                editable
              />
            </div>
          </div>
        ) : null}

        {status !== "co_construction" && coProposals.length > 0 ? (
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

        {(status === "quote" || status === "negotiation") && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Menu — Devis & offre
            </h3>
            <p className="mt-2 text-sm text-foreground/85">
              Devis générés et brouillons liés au dossier (aperçu texte — prix et conditions à
              compléter avant envoi voyageur).
            </p>
            <div className="mt-4">
              <LeadQuotesPanel leadId={lead.id} quotes={leadQuotes} />
            </div>
          </div>
        )}

        {(status === "won" || status === "lost") && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Menu — Clôture
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Synthèse finale et archivage : extensions possibles (date de clôture, motif).
            </p>
          </div>
        )}
        </div>
      </section>
    </>
  );
}
