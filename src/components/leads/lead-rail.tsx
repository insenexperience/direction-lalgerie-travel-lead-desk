"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { LeadStatus } from "@/lib/mock-leads";
import { StageDot } from "@/components/ui/stage-dot";

const PIPELINE_STEPS: { status: LeadStatus; label: string }[] = [
  { status: "new",               label: "Nouveau" },
  { status: "qualification",     label: "Qualif." },
  { status: "agency_assignment", label: "Assignation" },
  { status: "co_construction",   label: "Co-construct." },
  { status: "quote",             label: "Devis" },
  { status: "negotiation",       label: "Négociation" },
  { status: "won",               label: "Gagné" },
];

const STEP_ORDER: LeadStatus[] = PIPELINE_STEPS.map((s) => s.status);

type LeadRailProps = {
  status: LeadStatus;
  compact?: boolean;
  leadId?: string;
};

export function LeadRail({ status, compact = false, leadId }: LeadRailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewedStage = (searchParams.get("stage") as LeadStatus | null) ?? status;
  const currentIndex = STEP_ORDER.indexOf(status === "lost" ? "new" : status);

  function navigate(step: LeadStatus) {
    if (!leadId) return;
    if (step === status) {
      router.push(`/leads/${leadId}`);
    } else {
      router.push(`/leads/${leadId}?stage=${step}`);
    }
  }

  return (
    <div className="flex items-center gap-0" role="list" aria-label="Étapes du pipeline">
      {PIPELINE_STEPS.map((step, i) => {
        const isDone    = i < currentIndex;
        const isActive  = i === currentIndex;
        const isFuture  = i > currentIndex;
        const isViewed  = step.status === viewedStage && step.status !== status;
        const clickable = !!leadId;

        return (
          <div key={step.status} className="flex items-center" role="listitem">
            {/* Step node */}
            <div
              className={`flex flex-col items-center gap-1 ${compact ? "min-w-[48px]" : "min-w-[64px]"}`}
            >
              <button
                type="button"
                onClick={() => navigate(step.status)}
                disabled={!clickable}
                title={clickable ? `Voir : ${step.label}` : step.label}
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                  clickable ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15323f]/50" : "cursor-default",
                  isViewed
                    ? "border-[#1e5a8a] bg-[#dbeafe] ring-2 ring-[#1e5a8a]/30"
                    : isActive
                    ? "border-[#15323f] bg-[#15323f]"
                    : isDone
                    ? "border-[#15323f] bg-white hover:bg-[#f0f4f6]"
                    : "border-[#e4e8eb] bg-white hover:bg-[#f6f7f8]",
                ].join(" ")}
              >
                {isDone ? (
                  <svg className="h-3 w-3 text-[#15323f]" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isViewed ? (
                  <span className="h-2 w-2 rounded-full bg-[#1e5a8a]" aria-hidden />
                ) : isActive ? (
                  <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
                ) : (
                  <StageDot status={step.status} />
                )}
              </button>
              {!compact && (
                <span
                  className={`text-center text-[10px] leading-tight ${
                    isViewed
                      ? "font-semibold text-[#1e5a8a]"
                      : isActive
                      ? "font-semibold text-[#0e1a21]"
                      : isDone
                      ? "text-[#3a4a55]"
                      : "text-[#9aa7b0]"
                  }`}
                >
                  {step.label}
                </span>
              )}
            </div>

            {/* Connector */}
            {i < PIPELINE_STEPS.length - 1 && (
              <div
                className={`h-[2px] flex-1 ${compact ? "w-2" : "w-4"} ${
                  i < currentIndex ? "bg-[#15323f]" : "bg-[#e4e8eb]"
                }`}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
