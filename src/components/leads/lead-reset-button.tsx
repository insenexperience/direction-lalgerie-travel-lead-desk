"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { resetLead } from "@/app/(dashboard)/leads/actions";

type LeadResetButtonProps = {
  leadId: string;
  isAdmin: boolean;
};

export function LeadResetButton({ leadId, isAdmin }: LeadResetButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isAdmin) return null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await resetLead(leadId, motif || undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function handleClose() {
    setOpen(false);
    setConfirmed(false);
    setMotif("");
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#f5c9bc] bg-white px-3 py-2 text-xs font-medium text-[#c1411f] transition-colors hover:bg-[#fceee9]"
      >
        <RotateCcw className="size-3.5 shrink-0" aria-hidden />
        Remettre à zéro le lead
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[#e4e8eb] bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-[#e4e8eb] px-5 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fceee9]">
                <AlertTriangle className="size-5 text-[#c1411f]" aria-hidden />
              </div>
              <div>
                <h2 id="reset-modal-title" className="text-sm font-semibold text-[#0e1a21]">
                  Remettre ce lead à zéro ?
                </h2>
                <p className="mt-0.5 text-xs text-[#6b7a85]">Action réservée aux administrateurs · traçée dans la timeline</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-[#3a4a55]">Les données suivantes seront <strong>effacées</strong> :</p>
              <ul className="text-xs text-[#6b7a85] list-disc list-inside space-y-1">
                <li>Résumé voyage, style, voyageurs, budget, dates</li>
                <li>Notes de qualification, canal préféré, brief agence</li>
                <li>Email de bienvenue, agence retenue, score</li>
                <li>Toutes les consultations agences (archivées)</li>
              </ul>
              <p className="text-xs text-[#6b7a85]">
                La <strong>référence</strong> et la <strong>timeline</strong> sont conservées.
                Un snapshot complet est sauvegardé dans les activités.
              </p>

              <div className="mt-4">
                <label className="text-xs font-medium text-[#3a4a55]" htmlFor="reset-motif">
                  Motif <span className="text-[#9aa7b0]">(optionnel)</span>
                </label>
                <textarea
                  id="reset-motif"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={2}
                  placeholder="Ex. : Voyageur a changé de projet..."
                  className="mt-1 w-full rounded-md border border-[#e4e8eb] px-3 py-2 text-xs text-[#0e1a21] placeholder:text-[#9aa7b0] focus:border-[#15323f] focus:outline-none focus:ring-1 focus:ring-[#15323f]/30 resize-none"
                />
              </div>

              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[#3a4a55]">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="size-4 cursor-pointer rounded border-[#e4e8eb] accent-[#c1411f]"
                />
                Je comprends que les données listées ci-dessus seront remises à zéro
              </label>

              {error && (
                <p className="text-xs text-[#c1411f]" role="alert">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e4e8eb] px-5 py-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded-md border border-[#e4e8eb] bg-white px-4 py-2 text-xs font-medium text-[#3a4a55] transition-colors hover:bg-[#f6f7f8] disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!confirmed || pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#c1411f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#a8350f] disabled:pointer-events-none disabled:opacity-45"
              >
                <RotateCcw className="size-3.5 shrink-0" aria-hidden />
                {pending ? "Remise à zéro…" : "Confirmer le reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
