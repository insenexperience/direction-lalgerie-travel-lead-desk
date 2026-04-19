"use client";

import { AssignPartnerAgencyForm } from "@/components/leads/assign-partner-agency-form";
import { AssignReferentForm } from "@/components/leads/assign-referent-form";
import { LeadCommercialCrmForm } from "@/components/leads/lead-commercial-crm-form";
import { CoConstructionPanel } from "@/components/leads/co-construction-panel";
import { LeadQuotesPanel } from "@/components/leads/lead-quotes-panel";
import type {
  CoConstructionProposalRow,
  LeadQuoteListItem,
} from "@/lib/co-construction-proposal";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";

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
        "Infos voyageur souvent incomplètes à l’entrée : un échange (e-mail, appel ou WhatsApp) permet d’enrichir la fiche (menu « Modifier la fiche »). La conversation IA apparaît dans le bloc « Conversation voyageur & IA ». Grille CRM express ci-dessous (conversion + relance) — cible ~1 minute.",
    },
    agency_assignment: {
      title: "Assignation — agence partenaire",
      body:
        "Choisissez l’agence partenaire chargée de traiter ce lead (réseau Direction l’Algérie). Ce n’est pas l’opérateur travel desk, déjà alloué à l’étape « Nouveau ».",
    },
    co_construction: {
      title: "Co-construction",
      body:
        "Propositions de circuit avec l’agence retenue : en attente de proposition, puis réception et retouches, validation travel desk, et génération du devis.",
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

  return (
    <>
      <section className="rounded-md border border-[#182b35]/25 bg-panel p-4 sm:p-6">
        <div className="border-b border-border pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">
            Étape active — {leadStatusLabelFr[status]}
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">
            {intro.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{intro.body}</p>
        </div>

        <div className="mt-6 space-y-8">
        {status === "qualification" ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Menu — Grille CRM express
            </h3>
            <p className="mt-2 text-sm text-foreground/85">
              Probabilité de conversion et stratégie de relance — utile pour closer sans alourdir la
              fiche voyageur.
            </p>
            <div className="mt-4 rounded-md border border-border bg-panel-muted/30 p-4 sm:p-5">
              <LeadCommercialCrmForm lead={lead} />
            </div>
          </div>
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
          <div>
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
