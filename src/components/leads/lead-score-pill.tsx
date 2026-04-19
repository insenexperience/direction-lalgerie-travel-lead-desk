"use client";

import { displayLeadScore, scoreTier } from "@/lib/lead-score";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

const tierClass: Record<string, string> = {
  cold: "bg-neutral-200 text-neutral-800",
  tepid: "bg-amber-100 text-amber-900",
  warm: "bg-[#fdf3e0] text-[#8a5c1a]",
  hot: "bg-red-100 text-[#7a1f1f]",
};

const tierLabel: Record<string, string> = {
  cold: "Froid",
  tepid: "Tiède",
  warm: "Chaud",
  hot: "Très chaud",
};

type LeadScorePillProps = {
  lead: SupabaseLeadRow;
  onOpenModal: () => void;
  compact?: boolean;
};

export function LeadScorePill({ lead, onOpenModal, compact }: LeadScorePillProps) {
  const score = displayLeadScore(lead);
  const tier = scoreTier(score);
  const label = tierLabel[tier] ?? "—";

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className={[
        "inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-panel-muted px-2 py-1 text-left transition-colors hover:bg-panel",
        compact ? "shrink-0" : "",
      ].join(" ")}
      title="Paramétrer le score"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Score
      </span>
      <span
        className="flex h-1.5 min-w-[2.5rem] max-w-[4rem] overflow-hidden rounded-full bg-border"
        aria-hidden
      >
        <span
          className="h-full bg-steel"
          style={{ width: `${score != null ? score : 0}%` }}
        />
      </span>
      <span className="font-mono text-sm font-bold text-steel">
        {score != null ? score : "—"}
      </span>
      <span
        className={[
          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          tierClass[tier] ?? tierClass.cold,
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}
