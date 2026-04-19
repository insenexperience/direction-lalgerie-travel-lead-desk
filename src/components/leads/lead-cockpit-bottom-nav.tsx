"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { moveLeadPipelineStep } from "@/app/(dashboard)/leads/actions";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

type LeadCockpitBottomNavProps = {
  lead: SupabaseLeadRow;
  referentLabel: string | null;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
};

function primaryLabel(status: LeadStatus): string {
  switch (status) {
    case "new":
      return "Étape suivante";
    case "qualification":
      return "Vers assignation";
    case "agency_assignment":
      return "Vers co-construction";
    case "co_construction":
      return "Vers devis";
    case "quote":
      return "Vers négociation";
    case "negotiation":
      return "Marquer gagné";
    default:
      return "Suivant";
  }
}

export function LeadCockpitBottomNav({
  lead,
  referentLabel,
  drawerOpen,
  onToggleDrawer,
}: LeadCockpitBottomNavProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const status = lead.status as LeadStatus;
  const idx = LEAD_PIPELINE.indexOf(status);
  const canPrev = idx > 0;
  const canNext =
    idx >= 0 &&
    idx < LEAD_PIPELINE.length - 1 &&
    status !== "won" &&
    status !== "lost";

  function run(dir: "next" | "prev") {
    setErr(null);
    start(() => {
      void (async () => {
        const r = await moveLeadPipelineStep(lead.id, dir);
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        router.refresh();
      })();
    });
  }

  const iaLine = lead.manual_takeover ? "IA suspendue" : "IA active";

  return (
    <>
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 sm:px-5 lg:left-[18rem] lg:right-0 lg:px-8"
        role="region"
        aria-label="Navigation cockpit"
      >
        <div className="pointer-events-auto w-full max-w-4xl rounded-lg border border-border/45 bg-panel/45 px-2 py-2 shadow-[0_-6px_28px_rgba(15,28,36,0.07)] backdrop-blur-md supports-[backdrop-filter]:bg-panel/35 sm:px-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={!canPrev || pending}
              onClick={() => run("prev")}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-panel/80 px-2 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-panel disabled:opacity-45"
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              Précédent
            </button>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5">
              <span className="rounded-full border border-border bg-panel/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/90">
                {leadStatusLabelFr[status]}
              </span>
              <span className="rounded-full border border-border bg-panel/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/90">
                {iaLine}
              </span>
              <span className="max-w-[10rem] truncate rounded-full border border-border bg-panel/90 px-2 py-0.5 text-[10px] font-semibold text-foreground/90">
                {referentLabel ?? "Sans référent"}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleDrawer}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-panel/80 px-2 py-1.5 text-xs font-semibold hover:bg-panel"
              >
                {drawerOpen ? (
                  <>
                    <Minus className="size-4" aria-hidden />
                    Fermer
                  </>
                ) : (
                  <>
                    <Plus className="size-4" aria-hidden />
                    Détails
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!canNext || pending}
                onClick={() => run("next")}
                className="inline-flex items-center gap-1 rounded-md border border-[#182b35]/90 bg-[#182b35]/92 px-2.5 py-1.5 text-xs font-semibold text-[#f3f7fa] shadow-sm hover:bg-[#213e4b] disabled:opacity-45"
              >
                {primaryLabel(status)}
                <ChevronRight className="size-4 shrink-0" aria-hidden />
              </button>
            </div>
          </div>
          {err ? (
            <p className="mt-1 text-center text-[11px] text-red-600" role="alert">
              {err}
            </p>
          ) : null}
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center lg:items-stretch">
          <button
            type="button"
            className="absolute inset-0 bg-[#0b1419]/40"
            aria-label="Fermer le panneau"
            onClick={onToggleDrawer}
          />
          <div
            className="relative mb-[4.5rem] flex max-h-[55vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-lg border border-border bg-panel shadow-lg sm:mb-[5rem]"
            role="dialog"
            aria-modal="true"
            aria-label="Détails référent et qualification"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-sm font-semibold">Détails</span>
              <button
                type="button"
                onClick={onToggleDrawer}
                className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-panel-muted"
              >
                Fermer
              </button>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-3">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Référent
                </h4>
                <p className="mt-2 text-sm text-foreground">{referentLabel ?? "—"}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Réassignation via la fiche (bloc assignation) ou la liste.
                </p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Workflow
                </h4>
                <p className="mt-2 text-sm text-foreground">
                  Mode :{" "}
                  {lead.workflow_mode === "ai"
                    ? "IA"
                    : lead.workflow_mode === "manual"
                      ? "Manuel"
                      : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lancé le : {lead.workflow_launched_at ?? "—"}
                </p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Qualification
                </h4>
                <p className="mt-2 text-sm text-foreground">
                  Statut : {lead.qualification_validation_status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reprise manuelle / IA : bouton Suspendre dans la bande.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
