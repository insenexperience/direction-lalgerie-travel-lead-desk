"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileText,
  Kanban,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { TopHeader } from "@/components/top-header";
import { coerceLeadStatus } from "@/lib/lead-status-coerce";
import type { LeadStatus } from "@/lib/mock-leads";
import { createClient } from "@/lib/supabase/client";

export type DashboardKpis = {
  newLeads: number;
  inQualification: number;
  consultations: number;
  quotesOpen: number;
};

const workflowSteps = [
  "Nouveau",
  "Qualification",
  "Affinage",
  "Assignation",
  "Co-construction",
  "Devis",
  "Négociation",
  "Gagné / Perdu",
];

function n(v: number) {
  return String(v);
}

type RecentLeadRow = {
  id: string;
  travelerName: string;
  status: LeadStatus;
};

export function DashboardPageInner({ kpis }: { kpis: DashboardKpis }) {
  const [liveKpis, setLiveKpis] = useState(kpis);
  const [recentLeads, setRecentLeads] = useState<RecentLeadRow[]>([]);

  useEffect(() => {
    setLiveKpis(kpis);
  }, [kpis]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [
        recentRes,
        newLeads,
        inQualification,
        consultations,
        quotesOpen,
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("id, traveler_name, status")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("status", "qualification"),
        supabase
          .from("consultations")
          .select("*", { count: "exact", head: true }),
        supabase.from("quotes").select("*", { count: "exact", head: true }),
      ]);

      if (cancelled) return;

      if (!recentRes.error) {
        setRecentLeads(
          (recentRes.data ?? []).map((row) => ({
            id: String(row.id),
            travelerName: String(row.traveler_name ?? ""),
            status: coerceLeadStatus(String(row.status ?? "new")),
          })),
        );
      }

      if (
        !newLeads.error &&
        !inQualification.error &&
        !consultations.error &&
        !quotesOpen.error
      ) {
        setLiveKpis({
          newLeads: newLeads.count ?? 0,
          inQualification: inQualification.count ?? 0,
          consultations: consultations.count ?? 0,
          quotesOpen: quotesOpen.count ?? 0,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpiCards = [
    { label: "Nouveaux leads", value: n(liveKpis.newLeads), icon: UserPlus },
    {
      label: "En qualification",
      value: n(liveKpis.inQualification),
      icon: Sparkles,
    },
    {
      label: "Consultations agence",
      value: n(liveKpis.consultations),
      icon: Building2,
    },
    { label: "Devis (lignes)", value: n(liveKpis.quotesOpen), icon: FileText },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <TopHeader title="Tableau de bord" />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="flex gap-4 rounded-md border border-border bg-panel p-4 sm:p-5"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-panel-muted text-steel">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {card.value}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
                Pipeline
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/metrics"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel"
              >
                Métriques & data
                <ArrowRight className="size-4 opacity-70" aria-hidden />
              </Link>
              <Link
                href="/leads?view=kanban"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel"
              >
                <Kanban className="size-4" aria-hidden />
                Ouvrir le Kanban
                <ArrowRight className="size-4 opacity-70" aria-hidden />
              </Link>
            </div>
          </div>
          <ol className="mt-6 flex flex-wrap gap-2">
            {workflowSteps.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-2 rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-medium text-foreground/90"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-panel text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
          <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Derniers leads
          </h3>
          {recentLeads.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Aucun lead à afficher pour le moment. Créez-en un depuis la page Leads.
            </p>
          ) : null}
          {recentLeads.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-foreground/85">
              {recentLeads.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel-muted px-3 py-2.5 transition-colors hover:bg-panel"
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {lead.travelerName || "Sans nom"}
                    </span>
                    <LeadStatusBadge status={lead.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
