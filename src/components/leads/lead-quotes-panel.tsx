"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { updateQuoteWorkflowStatus } from "@/app/(dashboard)/leads/quote-actions";
import type { LeadQuoteListItem } from "@/lib/co-construction-proposal";
import {
  isTerminalQuoteWorkflow,
  quoteWorkflowStatusLabelFr,
  type QuoteWorkflowStatus,
} from "@/lib/quote-workflow";

type LeadQuotesPanelProps = {
  leadId: string;
  quotes: LeadQuoteListItem[];
};

const TRACKING: QuoteWorkflowStatus[] = [
  "draft",
  "sent",
  "awaiting_response",
  "renegotiation",
];

const OUTCOMES: QuoteWorkflowStatus[] = ["won", "lost", "suspended"];

export function LeadQuotesPanel({ leadId, quotes }: LeadQuotesPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (quotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun devis en base pour ce dossier. Générez-en un depuis une proposition validée (étape
        co-construction) ou créez un brouillon manuel plus tard.
      </p>
    );
  }

  function applyStatus(quoteId: string, next: QuoteWorkflowStatus) {
    setError(null);
    startTransition(async () => {
      const res = await updateQuoteWorkflowStatus(leadId, quoteId, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      <ul className="space-y-5">
        {quotes.map((q) => {
          const pdfHref = `/api/leads/${leadId}/quotes/${q.id}/pdf`;
          const terminal = isTerminalQuoteWorkflow(q.workflow_status);

          return (
            <li
              key={q.id}
              className="rounded-md border border-border bg-panel-muted/30 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] text-muted-foreground">{q.id.slice(0, 8)}…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(q.created_at).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <a
                  href={pdfHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-[#182b35] bg-panel px-3 py-2 text-sm font-semibold text-[#182b35] transition-colors hover:bg-panel-muted"
                >
                  <Download className="size-4" aria-hidden />
                  Télécharger PDF
                </a>
              </div>

              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Suivi :</span>{" "}
                <span className="font-semibold text-foreground">
                  {quoteWorkflowStatusLabelFr[q.workflow_status]}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">({q.kind})</span>
              </p>

              {!terminal ? (
                <div className="mt-4 space-y-3 rounded-md border border-border bg-panel p-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Statut de suivi
                    <select
                      disabled={pending}
                      value={q.workflow_status}
                      onChange={(e) =>
                        applyStatus(q.id, e.target.value as QuoteWorkflowStatus)
                      }
                      className="mt-1 w-full max-w-md rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-steel/25 disabled:opacity-50"
                    >
                      {TRACKING.map((s) => (
                        <option key={s} value={s}>
                          {quoteWorkflowStatusLabelFr[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Issue du devis
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {OUTCOMES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={pending}
                          onClick={() => applyStatus(q.id, s)}
                          className={[
                            "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50",
                            s === "won"
                              ? "border-emerald-700 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                              : s === "lost"
                                ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                                : "border-amber-600 bg-amber-50 text-amber-950 hover:bg-amber-100",
                          ].join(" ")}
                        >
                          {quoteWorkflowStatusLabelFr[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Devis clos — le statut ne peut plus être modifié depuis cette fiche.
                </p>
              )}

              {q.items.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Lignes (aperçu)
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {q.items.slice(0, 8).map((it, i) => (
                      <li key={i} className="flex gap-2 text-foreground/90">
                        <span className="shrink-0 font-medium text-foreground">{it.label} :</span>
                        <span className="text-muted-foreground">{it.detail}</span>
                      </li>
                    ))}
                    {q.items.length > 8 ? (
                      <li className="text-xs text-muted-foreground">
                        + {q.items.length - 8} ligne(s) — voir le PDF complet.
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {q.summary ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                    Texte brut (résumé interne)
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-panel p-3 text-xs text-foreground/85">
                    {q.summary}
                  </pre>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
