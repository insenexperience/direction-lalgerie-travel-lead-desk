"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetWorkflowVoyageurSession } from "@/app/(dashboard)/leads/workflow-actions";

type LeadWorkflowSessionResetPanelProps = {
  leadId: string;
  /** Au moins une session enregistrée (dates + mode). */
  hasSession: boolean;
  workflowRunRef: string | null;
};

export function LeadWorkflowSessionResetPanel({
  leadId,
  hasSession,
  workflowRunRef,
}: LeadWorkflowSessionResetPanelProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!hasSession) {
    return null;
  }

  return (
    <div className="mb-6 rounded-md border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold text-amber-950">Session workflow existante</p>
      {workflowRunRef ? (
        <p className="mt-1 text-xs text-amber-900/90">
          Réf.&nbsp;: <span className="font-mono font-semibold">{workflowRunRef}</span>
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-amber-950/95">
        Pour enregistrer un nouveau lancement (manuel ou IA depuis la fiche), supprimez d&apos;abord
        la session en cours. Cela efface aussi le transcript et remet la validation qualification en
        attente.
      </p>
      {err ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const ok = window.confirm(
            "Supprimer la session workflow sur ce dossier ? Transcript et brouillon qualification seront effacés.",
          );
          if (!ok) return;
          setErr(null);
          start(() => {
            void (async () => {
              const r = await resetWorkflowVoyageurSession(leadId);
              if (!r.ok) {
                setErr(r.error);
                return;
              }
              router.refresh();
            })();
          });
        }}
        className="mt-3 inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "Suppression…" : "Supprimer la session workflow"}
      </button>
    </div>
  );
}
