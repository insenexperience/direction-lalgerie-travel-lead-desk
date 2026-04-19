"use client";

import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
import { TopHeader } from "@/components/top-header";
import {
  computeLeadTotals,
  computePipelineCounts,
  computeSourceBreakdown,
} from "@/lib/lead-metrics";
import type { MockLead } from "@/lib/mock-leads";

type MetricsPageInnerProps = {
  leads: MockLead[];
};

export function MetricsPageInner({ leads }: MetricsPageInnerProps) {
  const totals = computeLeadTotals(leads);
  const pipeline = computePipelineCounts(leads);
  const { rows: sourceRows, max: sourceMax } = computeSourceBreakdown(leads);

  const kpiCards = [
    { label: "Leads (total)", value: String(totals.total) },
    { label: "En cours", value: String(totals.open) },
    { label: "Gagnés", value: String(totals.won) },
    { label: "Perdus", value: String(totals.lost) },
    { label: "Taux conversion", value: `${totals.conversionRate} %` },
    { label: "Dossiers multi-agences", value: String(totals.withConsultation) },
    { label: "Au moins 1 devis agence", value: String(totals.withQuoteReceived) },
    { label: "Arbitrage enregistré", value: String(totals.retained) },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <TopHeader
        title="Métriques & data"
        description="Indicateurs calculés à partir des leads Supabase."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Vue synthétique pour le pilotage : pipeline, sources, conversion et usage des consultations agence.
        </p>
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel"
        >
          Aller aux leads
          <ArrowRight className="size-4 opacity-70" aria-hidden />
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <article
            key={card.label}
            className="flex gap-4 rounded-md border border-border bg-panel p-4 sm:p-5"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-panel-muted text-steel">
              <BarChart3 className="size-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {card.value}
              </p>
            </div>
          </article>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            Pipeline (volume par étape)
          </h2>
          <ul className="mt-5 space-y-3">
            {pipeline.map((row) => {
              const pct =
                totals.total > 0 ? Math.round((row.count / totals.total) * 100) : 0;
              return (
                <li key={row.status}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground/90">{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.count}{" "}
                      <span className="text-xs">({pct} %)</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel-muted">
                    <div
                      className="h-full rounded-full bg-[#2a4a5a]"
                      style={{
                        width: `${totals.total ? (row.count / totals.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            Sources (top)
          </h2>
          <ul className="mt-5 space-y-3">
            {sourceRows.map(([label, count]) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span
                    className="min-w-0 truncate font-medium text-foreground/90"
                    title={label}
                  >
                    {label}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel-muted">
                  <div
                    className="h-full rounded-full bg-[#182b35]"
                    style={{ width: `${(count / sourceMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
