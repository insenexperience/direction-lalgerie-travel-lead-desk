"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { launchWorkflowAi } from "@/app/(dashboard)/leads/workflow-actions";
import type { LeadStatus } from "@/lib/mock-leads";

type LeadWorkflowPanelProps = {
  leadId: string;
  currentUserId: string | null;
  referentId: string | null;
  status: LeadStatus;
  workflowLaunchedAt: string | null;
  workflowMode: "ai" | "manual" | null;
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
  workflowEmailBanner,
}: LeadWorkflowPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
      <div
        className="rounded-md border border-border bg-panel-muted/40 px-4 py-3 text-sm text-foreground/90"
        role="status"
      >
        <p className="font-medium text-foreground">
          Workflow lancé le {dateLabel} — Mode&nbsp;: {modeLabel}
        </p>
      </div>
    );
  }

  const canLaunch =
    Boolean(currentUserId) &&
    referentId === currentUserId &&
    status === "new";

  if (!canLaunch) {
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
        Lancer le workflow
      </h2>
      <p className="mt-2 text-sm text-foreground/85">
        Premier contact structuré avec le voyageur (email). Choisissez le mode IA (WhatsApp + email
        pour co-construction) ou le mode manuel.
      </p>
      {workflowEmailBanner ? (
        <p
          className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950/90 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100/90"
          role="note"
        >
          {workflowEmailBanner}
        </p>
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
