"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  computeLeadScore,
  overrideLeadScore,
  recalculateLeadScoreAfterOverrideClear,
  updateLeadScoringWeights,
} from "@/app/(dashboard)/leads/actions";
import {
  computeScoreFromWeights,
  DEFAULT_SCORING_WEIGHTS,
  displayLeadScore,
} from "@/lib/lead-score";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

type LeadScoreModalProps = {
  open: boolean;
  onClose: () => void;
  lead: SupabaseLeadRow;
  isAdmin: boolean;
};

export function LeadScoreModal({ open, onClose, lead, isAdmin }: LeadScoreModalProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [overrideInput, setOverrideInput] = useState(
    lead.lead_score_override != null ? String(lead.lead_score_override) : "",
  );
  const [weightsJson, setWeightsJson] = useState(
    JSON.stringify(lead.scoring_weights ?? DEFAULT_SCORING_WEIGHTS, null, 2),
  );

  const computedPreview = useMemo(
    () => computeScoreFromWeights(lead),
    [lead],
  );

  if (!open) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(() => {
      void (async () => {
        const r = await fn();
        if (!r.ok) {
          setMsg(r.error ?? "Erreur");
          return;
        }
        router.refresh();
        onClose();
      })();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1419]/50 backdrop-blur-[1px]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(92vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-md border border-border bg-panel shadow-lg sm:rounded-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-modal-title"
      >
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <h2 id="score-modal-title" className="text-base font-semibold text-foreground">
            Score lead
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Valeur affichée :{" "}
            <strong className="text-foreground">{displayLeadScore(lead) ?? "—"}</strong>{" "}
            (calcul auto : {computedPreview})
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Surcharge manuelle (0–100, vide = auto)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold hover:bg-panel disabled:opacity-50"
              onClick={() => {
                const v = overrideInput.trim();
                const num = v === "" ? null : Number(v);
                if (num !== null && (!Number.isFinite(num) || num < 0 || num > 100)) {
                  setMsg("Score entre 0 et 100.");
                  return;
                }
                run(() => overrideLeadScore(lead.id, num));
              }}
            >
              Enregistrer la surcharge
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-steel px-3 py-2 text-sm font-semibold text-[#f3f7fa] hover:opacity-95 disabled:opacity-50"
              onClick={() => run(() => recalculateLeadScoreAfterOverrideClear(lead.id))}
            >
              Recalculer via IA
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-panel-muted disabled:opacity-50"
              onClick={() => run(() => computeLeadScore(lead.id))}
            >
              Recalculer (garder surcharge)
            </button>
          </div>
          {isAdmin ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pondérations (JSON, admin)
              </label>
              <textarea
                value={weightsJson}
                onChange={(e) => setWeightsJson(e.target.value)}
                rows={8}
                className="mt-1 w-full resize-y rounded-md border border-border bg-panel-muted px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-steel/25"
              />
              <button
                type="button"
                disabled={pending}
                className="mt-2 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-panel-muted disabled:opacity-50"
                onClick={() => run(() => updateLeadScoringWeights(lead.id, weightsJson))}
              >
                Enregistrer les poids
              </button>
            </div>
          ) : null}
          {msg ? (
            <p className="text-sm text-red-600" role="alert">
              {msg}
            </p>
          ) : null}
        </div>
        <div className="border-t border-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-panel-muted"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
