"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { launchWorkflowManual } from "@/app/(dashboard)/leads/workflow-actions";

type LeadManualWorkflowFormProps = {
  leadId: string;
  resendReady: boolean;
};

export function LeadManualWorkflowForm({ leadId, resendReady }: LeadManualWorkflowFormProps) {
  const router = useRouter();
  const [sendWelcome, setSendWelcome] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await launchWorkflowManual(leadId, sendWelcome);
          if (!r.ok) {
            setError(r.error);
            return;
          }
          router.push(`/leads/${leadId}`);
          router.refresh();
        });
      }}
    >
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-panel p-4">
        <input
          type="checkbox"
          checked={sendWelcome}
          onChange={(e) => setSendWelcome(e.target.checked)}
          className="mt-1 size-4 rounded border-border"
        />
        <span className="text-sm leading-relaxed text-foreground/90">
          <span className="font-semibold text-foreground">Envoyer l&apos;email de bienvenue</span>{" "}
          au voyageur (même contenu que le mode IA, sans les boutons WhatsApp / email).
        </span>
      </label>

      {!resendReady ? (
        <p className="text-sm text-muted-foreground">
          Tant que Resend n&apos;est pas configuré sur l&apos;hébergeur, cocher cette case n&apos;enverra
          pas d&apos;email ; le workflow sera tout de même enregistré (voir trace dans les activités du
          dossier).
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-[#182b35] px-5 py-2.5 text-sm font-semibold text-[#f3f7fa] transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Suivant →"}
        </button>
      </div>
    </form>
  );
}
