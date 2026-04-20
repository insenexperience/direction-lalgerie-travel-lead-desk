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
  isAdmin?: boolean;
};

function visibleSteps(status: LeadStatus): LeadStatus[] {
  return LEAD_PIPELINE.filter((s) => s !== "lost" || status === "lost");
}

export function LeadCockpitPipeline({
  leadId,
  status,
  isAdmin = false,
}: LeadCockpitPipelineProps) {
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
    <div className="border-b border-border bg-panel">
      <div className="overflow-x-auto px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:thin] sm:px-2">
        <ol className="flex min-w-max items-center gap-1.5">
          {steps.map((step, i) => {
            const idx = LEAD_PIPELINE.indexOf(step);
            const isFuture = idx > curIdx;
            const isActive = idx === curIdx;
            const isDone = idx < curIdx;
            const clickable =
              !pending &&
              (isAdmin ? !isFuture : isActive || idx === curIdx - 1);

            return (
              <li key={step} className="flex items-center">
                {i > 0 ? (
                  <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/60" aria-hidden />
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
                    "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                    isActive
                      ? "border-steel bg-steel text-steel-ink shadow-sm"
                      : isDone
                        ? "border-border bg-panel-muted text-foreground hover:bg-panel"
                        : "cursor-not-allowed border-border/70 bg-transparent text-foreground/45",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex size-2.5 shrink-0 rounded-full border",
                      isDone
                        ? "border-emerald-600 bg-[#e8f4ef]"
                        : isActive
                          ? "border-steel-ink/70 bg-steel-ink"
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
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {err ? (
        <p className="px-2 pb-2 text-xs font-medium text-red-600" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
