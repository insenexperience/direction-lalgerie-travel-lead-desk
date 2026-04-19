"use client";

import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

type LeadAiStatusPillProps = {
  lead: SupabaseLeadRow;
  onOpenDetails: () => void;
};

export function LeadAiStatusPill({ lead, onOpenDetails }: LeadAiStatusPillProps) {
  const status = lead.status as LeadStatus;
  const phase = leadStatusLabelFr[status];

  const notStarted = lead.workflow_mode == null;
  const suspended = lead.manual_takeover === true;

  const dotClass = notStarted
    ? "bg-neutral-400"
    : suspended
      ? "bg-[#c47c20]"
      : "bg-[#2d7a5f]";

  const label = notStarted
    ? "IA non démarrée"
    : suspended
      ? "IA suspendue"
      : "IA active";

  return (
    <button
      type="button"
      onClick={onOpenDetails}
      className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-md border border-border bg-panel-muted px-2 py-1 text-left transition-colors hover:bg-panel"
      title="Détails IA et workflow"
    >
      <span
        className={[
          "relative flex size-2 shrink-0 rounded-full",
          dotClass,
          !notStarted && !suspended ? "animate-pulse" : "",
        ].join(" ")}
        aria-hidden
      />
      <span className="min-w-0 truncate text-xs font-semibold text-foreground">
        {label}
        <span className="font-normal text-muted-foreground"> · {phase}</span>
      </span>
    </button>
  );
}
