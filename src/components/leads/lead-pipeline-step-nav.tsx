"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { moveLeadPipelineStep } from "@/app/(dashboard)/leads/actions";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

type LeadPipelineStepNavProps = {
  leadId: string;
  status: LeadStatus;
  /** Encart intégré dans la page (défaut) ou contenu seul pour barre flottante. */
  variant?: "inline" | "floating";
};

export function LeadPipelineStepNav({
  leadId,
  status,
  variant = "inline",
}: LeadPipelineStepNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const viewingStage = searchParams.get("stage") as LeadStatus | null;
  const isViewingOtherStage =
    viewingStage !== null && viewingStage !== status;

  const idx = LEAD_PIPELINE.indexOf(status);
  const prevLabel = idx > 0 ? leadStatusLabelFr[LEAD_PIPELINE[idx - 1]!] : null;
  const nextLabel =
    idx >= 0 && idx < LEAD_PIPELINE.length - 1
      ? leadStatusLabelFr[LEAD_PIPELINE[idx + 1]!]
      : null;

  const canPrev = idx > 0;
  const canNext =
    idx >= 0 &&
    idx < LEAD_PIPELINE.length - 1 &&
    status !== "won" &&
    status !== "lost";

  function run(direction: "next" | "prev") {
    setError(null);
    startTransition(async () => {
      const res = await moveLeadPipelineStep(leadId, direction);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const isFloating = variant === "floating";

  const btnPrevClass =
    "inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-panel/80 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-panel hover:border-border disabled:pointer-events-none disabled:opacity-45 sm:px-3 sm:text-sm";
  const btnNextClass =
    "inline-flex shrink-0 items-center gap-1 rounded-md border border-[#182b35]/90 bg-[#182b35]/92 px-2.5 py-1.5 text-xs font-semibold text-[#f3f7fa] shadow-sm backdrop-blur-sm transition-colors hover:bg-[#213e4b] disabled:pointer-events-none disabled:opacity-45 sm:px-3 sm:text-sm";

  if (isFloating) {
    return (
      <div className="w-full min-w-0">
        <div className="flex w-full min-w-0 flex-row flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-foreground/85 sm:text-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">
                Pipeline
              </span>
              <span className="mx-1.5 text-muted-foreground/50 sm:mx-2" aria-hidden>
                ·
              </span>
              <span className="text-muted-foreground">Étape :</span>{" "}
              <span className="font-semibold text-foreground">
                {leadStatusLabelFr[status]}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={!canPrev || pending}
              onClick={() => run("prev")}
              className={btnPrevClass}
            >
              <ChevronLeft className="size-3.5 shrink-0 sm:size-4" aria-hidden />
              <span className="sm:hidden">Préc.</span>
              <span className="hidden sm:inline">Précédente</span>
              {prevLabel ? (
                <span className="max-w-[4.5rem] truncate font-normal text-muted-foreground sm:max-w-[10rem] md:max-w-none">
                  ({prevLabel})
                </span>
              ) : null}
            </button>
            <button
              type="button"
              disabled={!canNext || pending}
              onClick={() => run("next")}
              className={btnNextClass}
            >
              <span className="sm:hidden">Suiv.</span>
              <span className="hidden sm:inline">Suivante</span>
              {nextLabel ? (
                <span className="max-w-[4.5rem] truncate font-normal text-[#f3f7fa]/85 sm:max-w-[10rem] md:max-w-none">
                  ({nextLabel})
                </span>
              ) : null}
              <ChevronRight className="size-3.5 shrink-0 sm:size-4" aria-hidden />
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-1.5 truncate text-xs text-red-700 sm:text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-panel-muted/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Pipeline — avancement
      </p>
      {isViewingOtherStage ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-xs text-[var(--info)]">
          <span>
            Vous consultez l'étape{" "}
            <strong>«&nbsp;{leadStatusLabelFr[viewingStage!]}&nbsp;»</strong>.
          </span>
          <button
            type="button"
            onClick={() => router.push(`/leads/${leadId}`)}
            className="ml-auto shrink-0 rounded border border-[var(--info)] px-2 py-0.5 text-[11px] font-semibold hover:bg-[var(--info)] hover:text-white transition-colors"
          >
            Retour à l'étape active
          </button>
        </div>
      ) : null}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/90">
          Étape courante :{" "}
          <span className="font-semibold text-foreground">{leadStatusLabelFr[status]}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canPrev || pending}
            onClick={() => run("prev")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted disabled:pointer-events-none disabled:opacity-45"
          >
            <ChevronLeft className="size-4 shrink-0" aria-hidden />
            Précédente
            {prevLabel ? (
              <span className="hidden font-normal text-muted-foreground sm:inline">
                ({prevLabel})
              </span>
            ) : null}
          </button>
          <button
            type="button"
            disabled={!canNext || pending}
            onClick={() => run("next")}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#182b35] bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] transition-colors hover:bg-[#213e4b] disabled:pointer-events-none disabled:opacity-45"
          >
            Suivante
            {nextLabel ? (
              <span className="hidden font-normal text-[#f3f7fa]/85 sm:inline">
                ({nextLabel})
              </span>
            ) : null}
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
