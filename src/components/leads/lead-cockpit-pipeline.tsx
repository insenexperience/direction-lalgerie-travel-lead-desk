"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

type LeadCockpitPipelineProps = {
  leadId: string;
  status: LeadStatus;
  displayedStage: LeadStatus;
};

function visibleSteps(status: LeadStatus): LeadStatus[] {
  return LEAD_PIPELINE.filter((s) => s !== "lost" || status === "lost");
}

export function LeadCockpitPipeline({
  leadId,
  status,
  displayedStage,
}: LeadCockpitPipelineProps) {
  const router = useRouter();
  const steps = visibleSteps(status);
  const curIdx = LEAD_PIPELINE.indexOf(status);

  function navigate(step: LeadStatus) {
    if (step === status) {
      // Back to active: remove query param
      router.push(`/leads/${leadId}`);
    } else {
      router.push(`/leads/${leadId}?stage=${step}`);
    }
  }

  return (
    <div className="border-b border-border bg-panel">
      <div className="overflow-x-auto px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:thin] sm:px-2">
        <ol className="flex min-w-max items-center gap-1.5">
          {steps.map((step, i) => {
            const idx = LEAD_PIPELINE.indexOf(step);
            const isFuture = idx > curIdx;
            const isActive = step === status;
            const isDone = idx < curIdx;
            const isViewed = step === displayedStage;

            return (
              <li key={step} className="flex items-center">
                {i > 0 ? (
                  <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/60" aria-hidden />
                ) : null}
                <button
                  type="button"
                  title={leadStatusLabelFr[step]}
                  onClick={() => navigate(step)}
                  className={[
                    "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                    isViewed && isActive
                      ? "border-steel bg-steel text-steel-ink shadow-sm"
                      : isViewed
                        ? "border-[var(--info)] bg-[var(--info-bg)] text-[var(--info)] ring-1 ring-[var(--info)]/40"
                        : isDone
                          ? "border-border bg-panel-muted text-foreground hover:bg-panel"
                          : isActive
                            ? "border-steel bg-steel text-steel-ink shadow-sm"
                            : isFuture
                              ? "border-border/70 bg-transparent text-foreground/45 hover:bg-panel-muted/50"
                              : "border-border bg-panel-muted text-foreground hover:bg-panel",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex size-2.5 shrink-0 rounded-full border",
                      isDone
                        ? "border-emerald-600 bg-[#e8f4ef]"
                        : isActive
                          ? "border-steel-ink/70 bg-steel-ink"
                          : isFuture
                            ? "border-border bg-transparent"
                            : "border-border bg-transparent",
                    ].join(" ")}
                    aria-hidden
                  />
                  {isDone ? (
                    <span className="text-emerald-800" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                  <span className="max-w-[10rem] truncate">
                    {leadStatusLabelFr[step]}
                  </span>
                  {isViewed && !isActive ? (
                    <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">
                      ●
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
