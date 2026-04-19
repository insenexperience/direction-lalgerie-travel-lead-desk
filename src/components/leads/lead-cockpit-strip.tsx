"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { toggleAiAutopilot } from "@/app/(dashboard)/leads/ai-actions";
import { formatLeadReferenceDisplay } from "@/lib/lead-reference";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { LeadAiStatusPill } from "./lead-ai-status-pill";
import { LeadScorePill } from "./lead-score-pill";

type LeadCockpitStripProps = {
  lead: SupabaseLeadRow;
  onOpenScoreModal: () => void;
  onOpenDetailsDrawer: () => void;
};

export function LeadCockpitStrip({
  lead,
  onOpenScoreModal,
  onOpenDetailsDrawer,
}: LeadCockpitStripProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const ref = formatLeadReferenceDisplay(lead);

  function toggleTakeover() {
    setErr(null);
    start(() => {
      void (async () => {
        const r = await toggleAiAutopilot(lead.id);
        if (!r.ok) {
          setErr(r.error ?? "Erreur");
          return;
        }
        router.refresh();
      })();
    });
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-panel px-0 py-2 sm:gap-x-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
        <span className="font-mono text-xs font-semibold text-steel sm:text-sm">{ref}</span>
        <span className="hidden text-muted-foreground sm:inline" aria-hidden>
          |
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {lead.traveler_name || "—"}
        </span>
        <span className="hidden text-muted-foreground sm:inline" aria-hidden>
          |
        </span>
        <LeadScorePill lead={lead} onOpenModal={onOpenScoreModal} />
        <span className="hidden text-muted-foreground sm:inline" aria-hidden>
          |
        </span>
        <LeadAiStatusPill lead={lead} onOpenDetails={onOpenDetailsDrawer} />
        <button
          type="button"
          disabled={pending}
          onClick={toggleTakeover}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-panel-muted px-2 py-1 text-xs font-semibold text-foreground hover:bg-panel disabled:opacity-50"
        >
          {lead.manual_takeover ? (
            <>
              <Play className="size-3.5 shrink-0" aria-hidden />
              Reprendre
            </>
          ) : (
            <>
              <Pause className="size-3.5 shrink-0" aria-hidden />
              Suspendre
            </>
          )}
        </button>
        {err ? (
          <span className="w-full text-xs text-red-600 sm:w-auto" role="alert">
            {err}
          </span>
        ) : null}
      </div>
      <Link
        href="/leads"
        className="shrink-0 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Tous les leads
      </Link>
    </div>
  );
}
