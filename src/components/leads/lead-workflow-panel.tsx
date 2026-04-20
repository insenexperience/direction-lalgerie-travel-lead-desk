"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, MailWarning } from "lucide-react";
import {
  launchWorkflowAi,
  resetWorkflowVoyageurSession,
} from "@/app/(dashboard)/leads/workflow-actions";
import type { LeadStatus } from "@/lib/mock-leads";
import { ContextBanner } from "@/components/leads/context-banner";

type LeadWorkflowPanelProps = {
  leadId: string;
  currentUserId: string | null;
  referentId: string | null;
  status: LeadStatus;
  workflowLaunchedAt: string | null;
  workflowMode: "ai" | "manual" | null;
  workflowRunRef: string | null;
  manualTakeover: boolean;
  /** Bannière opérateur quand Resend / CTA ne sont pas encore branchés (null = rien à afficher). */
  workflowEmailBanner: string | null;
};

export function LeadWorkflowPanel({
  leadId,
  currentUserId,
  referentId,
  status,
  workflowLaunchedAt,
  workflowMode,
  workflowRunRef,
  manualTakeover,
  workflowEmailBanner,
}: LeadWorkflowPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isReferent = Boolean(currentUserId) && referentId === currentUserId;
  const mayLaunchSlot =
    (status === "new" || status === "qualification") && !workflowLaunchedAt;
  const showManualLink =
    isReferent &&
    (status === "new" || status === "qualification") &&
    (!workflowLaunchedAt || (workflowMode === "ai" && manualTakeover));

  if (workflowLaunchedAt && workflowMode) {
    const d = new Date(workflowLaunchedAt);
    const modeLabel = workflowMode === "ai" ? "IA" : "Manuel";
    const dateLabel = Number.isNaN(d.getTime())
      ? workflowLaunchedAt
      : d.toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        });
    return (
      <div className="space-y-3">
        <ContextBanner variant="info" title="Workflow voyageur" icon={CalendarClock}>
          <span>
            Réf.&nbsp;: <span className="font-mono font-semibold">{workflowRunRef ?? "—"}</span>
            <span className="mt-1 block font-normal">
              Lancé le {dateLabel} — Mode&nbsp;: {modeLabel}
            </span>
          </span>
        </ContextBanner>
        {workflowMode === "ai" && manualTakeover ? (
          <p className="text-xs text-muted-foreground">
            IA suspendue : vous pouvez agir manuellement sur la fiche ; la page « Gérer manuellement
            » est disponible ci-dessous. Reprenez l’IA depuis la bandeau cockpit pour poursuivre le
            fil automatique à partir de l’état actuel du transcript.
          </p>
        ) : workflowMode === "ai" ? (
          <p className="text-xs text-muted-foreground">
            Mode IA actif : la reprise manuelle (bandeau cockpit) suspend l’envoi automatique et
            rouvre les options manuelles.
          </p>
        ) : null}
        {isReferent ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
              onClick={() => {
                const ok = window.confirm(
                  "Supprimer cette session workflow ? Le transcript, le brouillon de qualification IA et la validation seront réinitialisés. Le statut pipeline du dossier ne change pas.",
                );
                if (!ok) return;
                setError(null);
                startTransition(async () => {
                  const r = await resetWorkflowVoyageurSession(leadId);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              {pending ? "Suppression…" : "Supprimer cette session workflow"}
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {showManualLink ? (
          <Link
            href={`/leads/${leadId}/workflow`}
            className="inline-flex w-fit items-center justify-center rounded-md border border-border bg-panel px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted"
          >
            Gérer manuellement
          </Link>
        ) : null}
      </div>
    );
  }

  if (!isReferent || !mayLaunchSlot) {
    return null;
  }

  return (
    <section
      className="rounded-md border border-border bg-panel p-4 sm:p-5"
      aria-labelledby="workflow-launch-heading"
    >
      <h2
        id="workflow-launch-heading"
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Lancer le workflow voyageur
      </h2>
      <p className="mt-2 text-sm text-foreground/85">
        {status === "qualification"
          ? "Depuis la qualification, vous pouvez démarrer une session (email voyageur, puis canal IA ou suivi manuel) sans changer l’étape du pipeline."
          : "Premier contact structuré avec le voyageur (email). Choisissez le mode IA (WhatsApp + email pour co-construction) ou le mode manuel."}
      </p>
      {workflowEmailBanner ? (
        <div className="mt-3">
          <ContextBanner variant="warning" title="Configuration e-mail" icon={MailWarning}>
            {workflowEmailBanner}
          </ContextBanner>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-[#182b35] px-4 py-2.5 text-sm font-semibold text-[#f3f7fa] transition-opacity hover:opacity-95 disabled:opacity-50"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await launchWorkflowAi(leadId);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending ? "Envoi…" : "Lancer le workflow IA"}
        </button>
        <Link
          href={`/leads/${leadId}/workflow`}
          className="inline-flex items-center justify-center rounded-md border border-border bg-panel px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted"
        >
          Gérer manuellement
        </Link>
      </div>
    </section>
  );
}
