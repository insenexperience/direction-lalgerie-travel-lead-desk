"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { updateLeadStatus } from "@/app/(dashboard)/leads/actions";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";
type LeadCockpitPipelineProps = {
  leadId: string;
  status: LeadStatus;
};

function visibleSteps(status: LeadStatus): LeadStatus[] {
  return LEAD_PIPELINE.filter((s) => s !== "lost" || status === "lost");
}

export function LeadCockpitPipeline({ leadId, status }: LeadCockpitPipelineProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const steps = visibleSteps(status);
  const curIdx = LEAD_PIPELINE.indexOf(status);

  function apply(next: LeadStatus) {
    setErr(null);
    start(() => {
      void (async () => {
        const r = await updateLeadStatus(leadId, next);
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        router.refresh();
      })();
    });
  }

  return (
    <div className="border-b border-border bg-panel-muted">
      <div className="overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
        <ol className="flex min-w-max items-center gap-0 px-0.5">
          {steps.map((step, i) => {
            const idx = LEAD_PIPELINE.indexOf(step);
            const isFuture = idx > curIdx;
            const isActive = idx === curIdx;
            const isDone = idx < curIdx;
            const clickable = !isFuture && !pending;

            return (
              <li key={step} className="flex items-center">
                {i > 0 ? (
                  <ChevronRight
                    className="mx-0.5 size-3 shrink-0 text-muted-foreground/60"
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  disabled={!clickable}
                  title={
                    isFuture
                      ? "Complétez l’étape en cours avant de sauter en avant."
                      : leadStatusLabelFr[step]
                  }
                  onClick={() => {
                    if (!clickable) return;
                    apply(step);
                  }}
                  className={[
                    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                    isActive
                      ? "border-b-2 border-steel bg-panel text-steel"
                      : isDone
                        ? "text-foreground hover:bg-panel/80"
                        : "cursor-not-allowed text-foreground/40",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex size-2 shrink-0 rounded-full border",
                      isDone
                        ? "border-emerald-600 bg-[#e8f4ef]"
                        : isActive
                          ? "border-steel bg-steel"
                          : "border-border bg-transparent",
                    ].join(" ")}
                    aria-hidden
                  />
                  {isDone ? (
                    <span className="text-emerald-800" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                  <span className="max-w-[9rem] truncate">{leadStatusLabelFr[step]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {err ? (
        <p className="px-2 pb-2 text-xs text-red-600" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
