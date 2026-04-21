"use client";

import { useState, type ReactNode } from "react";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";
import { LeadStepUnlockButton } from "@/components/leads/lead-step-unlock-button";

type StageMode = "past" | "active" | "future";

type LeadStageDisplayWrapperProps = {
  mode: StageMode;
  stageName: LeadStatus;
  activeStage: LeadStatus;
  leadId: string;
  children: ReactNode;
};

export function LeadStageDisplayWrapper({
  mode,
  stageName,
  activeStage,
  leadId,
  children,
}: LeadStageDisplayWrapperProps) {
  const [unlocked, setUnlocked] = useState(false);
  if (mode === "future") {
    return (
      <div className="relative">
        <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-sm text-[var(--warn)]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 size-4 shrink-0"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Disponible après validation de l'étape{" "}
            <strong>«&nbsp;{leadStatusLabelFr[activeStage]}&nbsp;»</strong>.
          </span>
        </div>
        <div className="pointer-events-none select-none opacity-40">{children}</div>
      </div>
    );
  }

  if (mode === "past" && !unlocked) {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-xs text-[var(--info)]">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5 shrink-0"
              aria-hidden
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>
              Lecture seule — étape{" "}
              <strong>«&nbsp;{leadStatusLabelFr[stageName]}&nbsp;»</strong> déjà validée.
            </span>
          </div>
          <LeadStepUnlockButton
            leadId={leadId}
            stageName={stageName}
            onUnlocked={() => setUnlocked(true)}
          />
        </div>
        <div className="pointer-events-none select-none opacity-75">{children}</div>
      </div>
    );
  }

  // active
  return <>{children}</>;
}
