"use client";

import { useState, useTransition, useRef } from "react";
import { Unlock, X } from "lucide-react";
import { unlockStepForEdit } from "@/app/(dashboard)/leads/actions";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";

type LeadStepUnlockButtonProps = {
  leadId: string;
  stageName: LeadStatus;
  onUnlocked?: () => void;
};

export function LeadStepUnlockButton({
  leadId,
  stageName,
  onUnlocked,
}: LeadStepUnlockButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const motifRef = useRef<HTMLTextAreaElement>(null);

  function handleUnlock() {
    const motif = motifRef.current?.value.trim() || undefined;
    setError(null);
    startTransition(async () => {
      const res = await unlockStepForEdit(leadId, stageName, motif);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      onUnlocked?.();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-[var(--info-border)] bg-[var(--info-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--info)] hover:bg-[var(--info)] hover:text-white transition-colors"
      >
        <Unlock className="size-3.5" aria-hidden />
        Déverrouiller pour modifier
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-5 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Déverrouiller l'étape «&nbsp;{leadStatusLabelFr[stageName]}&nbsp;»
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cette action est journalisée. Renseignez un motif si nécessaire.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-panel-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-muted-foreground">
                Motif (facultatif)
                <textarea
                  ref={motifRef}
                  rows={3}
                  className="mt-1 w-full rounded border border-border bg-panel px-2.5 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-steel/30"
                  placeholder="ex. Correction d'une erreur saisie lors de la qualification…"
                />
              </label>
            </div>

            {error ? (
              <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleUnlock}
                className="inline-flex items-center gap-1.5 rounded border border-[var(--info)] bg-[var(--info)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-45"
              >
                <Unlock className="size-3.5" aria-hidden />
                {pending ? "Déverrouillage…" : "Déverrouiller"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-border bg-panel px-3 py-2 text-xs font-semibold text-foreground hover:bg-panel-muted"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
