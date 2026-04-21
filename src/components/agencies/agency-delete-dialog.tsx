"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { deleteAgency } from "@/app/(dashboard)/agencies/actions";

interface AgencyDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  agencyId: string;
  agencyName: string;
}

export function AgencyDeleteDialog({ open, onClose, agencyId, agencyName }: AgencyDeleteDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [impact, setImpact] = useState<{ activeLeads: number; activeConsultations: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDelete(force = false) {
    setError(null);
    startTransition(async () => {
      const result = await deleteAgency(agencyId, { force });
      if (result.ok) {
        onClose();
        router.push("/agencies");
        return;
      }
      if ("blocked" in result && result.blocked) {
        setImpact({ activeLeads: result.activeLeads, activeConsultations: result.activeConsultations });
      } else {
        setError("error" in result ? result.error : "Une erreur est survenue.");
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative z-10 w-full max-w-md rounded-[12px] border border-[#e4e8eb] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e4e8eb] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0e1a21]">
            Supprimer {agencyName} ?
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#6b7a85] hover:bg-[#f6f7f8] hover:text-[#0e1a21] transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {impact ? (
            <div className="rounded-[8px] border border-[var(--hot-border)] bg-[var(--hot-bg)] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--hot)]" aria-hidden />
                <div>
                  <p className="text-[13px] font-semibold text-[var(--hot)]">Cette agence est liée à des dossiers en cours</p>
                  <ul className="mt-1.5 space-y-0.5 text-[12px] text-[#3a4a55]">
                    {impact.activeLeads > 0 && (
                      <li>{impact.activeLeads} lead{impact.activeLeads > 1 ? "s" : ""} avec cette agence retenue</li>
                    )}
                    {impact.activeConsultations > 0 && (
                      <li>{impact.activeConsultations} consultation{impact.activeConsultations > 1 ? "s" : ""} en cours</li>
                    )}
                  </ul>
                  <p className="mt-2 text-[11px] text-[#6b7a85]">
                    La suppression forcée détachera les leads et archivera les consultations.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#3a4a55]">
              Cette action est irréversible. L'agence et tous ses contacts seront définitivement supprimés.
            </p>
          )}

          {error && (
            <p className="text-[12px] text-[var(--hot)]">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#e4e8eb] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-[6px] border border-[#e4e8eb] bg-white px-4 py-2 text-[13px] font-medium text-[#3a4a55] hover:bg-[#f6f7f8] transition-colors"
          >
            Annuler
          </button>

          {impact ? (
            <button
              onClick={() => handleDelete(true)}
              disabled={isPending}
              className="flex items-center gap-2 rounded-[6px] bg-[#c1411f] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#a8361a] disabled:opacity-60 transition-colors"
            >
              {isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              Détacher et supprimer quand même
            </button>
          ) : (
            <button
              onClick={() => handleDelete(false)}
              disabled={isPending}
              className="flex items-center gap-2 rounded-[6px] bg-[#c1411f] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#a8361a] disabled:opacity-60 transition-colors"
            >
              {isPending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              Supprimer définitivement
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
