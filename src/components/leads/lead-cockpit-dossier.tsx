"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { deleteLead } from "@/app/(dashboard)/leads/actions";
import { displayLeadScore, scoreTier as scoreTierFn } from "@/lib/lead-score";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr, LEAD_PIPELINE } from "@/lib/mock-leads";
import { LeadScorePill } from "./lead-score-pill";

const tierLabel: Record<string, string> = {
  cold: "Froid",
  tepid: "Tiède",
  warm: "Chaud",
  hot: "Très chaud",
};

function intakeLabel(ch: string | null): string {
  switch (ch) {
    case "web_form":
      return "Web form";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    case "manual":
      return "Manuel";
    default:
      return "—";
  }
}

function validationLabel(s: string): string {
  switch (s) {
    case "pending":
      return "En attente";
    case "validated":
      return "Validée";
    case "overridden":
      return "Modifiée";
    case "rejected":
      return "Rejetée";
    default:
      return s;
  }
}

function formatDateFr(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function truncateEmail(email: string, max = 32): { short: string; full: string } {
  const e = email.trim();
  if (e.length <= max) return { short: e || "—", full: e };
  return { short: `${e.slice(0, max)}…`, full: e };
}

type LeadCockpitDossierProps = {
  lead: SupabaseLeadRow;
  referentLabel: string | null;
  qualificationValidatorLabel: string | null;
  isAdmin: boolean;
  onOpenScoreModal: () => void;
  /** Masquer le lien ancre vers la fiche (ex. page workflow sans bloc fiche). */
  showFicheLink?: boolean;
};

export function LeadCockpitDossier({
  lead,
  referentLabel,
  qualificationValidatorLabel,
  isAdmin,
  onOpenScoreModal,
  showFicheLink = true,
}: LeadCockpitDossierProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const emailDisp = truncateEmail(lead.email);
  const score = displayLeadScore(lead);
  const tier = tierLabel[scoreTierFn(score)] ?? "—";
  const stepIdx = LEAD_PIPELINE.indexOf(lead.status as LeadStatus);
  const stepLabel = leadStatusLabelFr[lead.status as LeadStatus];

  function runDelete() {
    const ok = window.confirm(
      `Supprimer définitivement le dossier « ${lead.traveler_name || "lead"} » ?`,
    );
    if (!ok) return;
    setErr(null);
    start(() => {
      void (async () => {
        const res = await deleteLead(lead.id);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        router.push("/leads");
        router.refresh();
      })();
    });
  }

  return (
    <section
      className="rounded-md border border-border bg-panel p-4"
      aria-labelledby="cockpit-dossier-title"
    >
      <h3 id="cockpit-dossier-title" className="sr-only">
        Dossier
      </h3>
      <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        Dossier
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Voyageur
          </p>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="text-[10px] text-muted-foreground">Contact</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {lead.email.trim() ? (
                  <a href={`mailto:${lead.email}`} title={emailDisp.full} className="hover:underline">
                    {emailDisp.short}
                  </a>
                ) : (
                  <span className="italic text-muted-foreground">non renseigné</span>
                )}
                {lead.phone.trim() ? (
                  <>
                    {" · "}
                    <a href={`tel:${lead.phone}`} className="hover:underline">
                      {lead.phone}
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Canal · création</dt>
              <dd className="text-[12px] font-medium text-foreground">
                <span className="rounded border border-border bg-panel-muted px-1.5 py-0.5 text-[11px]">
                  {intakeLabel(lead.intake_channel)}
                </span>{" "}
                · {formatDateFr(lead.created_at)}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Voyage
          </p>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="text-[10px] text-muted-foreground">Dates</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {lead.trip_dates.trim() ? (
                  lead.trip_dates
                ) : (
                  <span className="italic text-muted-foreground">non renseigné</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Groupe</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {lead.travelers.trim() ? (
                  lead.travelers
                ) : (
                  <span className="italic text-muted-foreground">non renseigné</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Budget</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {lead.budget.trim() ? (
                  lead.budget
                ) : (
                  <span className="italic text-muted-foreground">non renseigné</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Qualification
          </p>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="text-[10px] text-muted-foreground">Score</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <LeadScorePill lead={lead} onOpenModal={onOpenScoreModal} compact />
                <span className="text-[12px] font-medium text-foreground">{tier}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Confiance IA</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {lead.ai_qualification_confidence != null
                  ? `${Math.round(
                      lead.ai_qualification_confidence > 1
                        ? lead.ai_qualification_confidence
                        : lead.ai_qualification_confidence * 100,
                    )} %`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Validation</dt>
              <dd className="text-[12px] font-medium text-foreground">
                <span className="rounded border border-border bg-panel-muted px-1.5 py-0.5 text-[11px]">
                  {validationLabel(lead.qualification_validation_status)}
                </span>
                {lead.qualification_validated_at ? (
                  <> · {formatDateFr(lead.qualification_validated_at)}</>
                ) : null}
                {qualificationValidatorLabel ? (
                  <> · {qualificationValidatorLabel}</>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Pilotage
          </p>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="text-[10px] text-muted-foreground">Référent</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {referentLabel ?? (
                  <span className="italic text-muted-foreground">non renseigné</span>
                )}
                {lead.referent_assigned_at ? (
                  <> · {formatDateFr(lead.referent_assigned_at)}</>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Mode workflow</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {lead.workflow_mode === "ai"
                  ? "IA"
                  : lead.workflow_mode === "manual"
                    ? "Manuel"
                    : "—"}
                {lead.workflow_launched_at ? (
                  <> · {formatDateFr(lead.workflow_launched_at)}</>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Étape</dt>
              <dd className="text-[12px] font-medium text-foreground">
                {stepLabel}
                {stepIdx >= 0 ? ` · ${stepIdx + 1} / ${LEAD_PIPELINE.length}` : ""}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-3">
          {showFicheLink ? (
            <a
              href="#lead-fiche-edit"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted focus:outline-none focus:ring-2 focus:ring-steel/25"
            >
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              Fiche complète
            </a>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              disabled={pending}
              onClick={runDelete}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-transparent px-3 py-2 text-sm font-semibold text-[#a83232] transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {pending ? "Suppression…" : "Supprimer ce lead"}
            </button>
          ) : null}
        </div>
        {err ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </section>
  );
}
