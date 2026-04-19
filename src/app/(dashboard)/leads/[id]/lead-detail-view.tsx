"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  FileText,
  GitBranch,
  Mail,
  MessageSquare,
  Phone,
  UserCheck,
} from "lucide-react";
import { LeadAgencyWorkflow } from "@/components/lead-agency-workflow";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { TopHeader } from "@/components/top-header";
import { useLeadsDemo } from "@/context/leads-demo-context";
import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

const actions: { label: string; icon: typeof UserCheck }[] = [
  { label: "Qualifier", icon: UserCheck },
  { label: "Assigner agence", icon: Building2 },
  { label: "Préparer devis", icon: FileText },
  { label: "Note interne", icon: MessageSquare },
  { label: "Changer étape", icon: GitBranch },
];

export function LeadDetailView() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { leads, setLeadStatus } = useLeadsDemo();
  const lead = leads.find((l) => l.id === id);

  if (!id || !lead) {
    notFound();
  }

  const currentIndex = LEAD_PIPELINE.indexOf(lead.status);

  return (
    <div className="space-y-5 sm:space-y-6">
      <TopHeader
        title={lead.travelerName}
        description={lead.tripSummary}
        actions={<LeadStatusBadge status={lead.status} />}
      />

      <Link
        href="/leads"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour aux leads
      </Link>

      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
        <ol className="flex min-w-max items-stretch gap-0 border border-border bg-panel">
          {LEAD_PIPELINE.map((step, index) => {
            const done = currentIndex > index;
            const current = lead.status === step;
            return (
              <li
                key={step}
                className={[
                  "relative flex items-center border-r border-border px-3 py-2.5 text-xs font-semibold last:border-r-0 sm:px-4 sm:text-sm",
                  current
                    ? "bg-[#182b35]"
                    : done
                      ? "bg-panel-muted"
                      : "bg-panel",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex items-center gap-1.5",
                    current
                      ? "text-[#f3f7fa]"
                      : done
                        ? "text-foreground/80"
                        : "text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? (
                    <Check className="size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] tabular-nums">
                      {index + 1}
                    </span>
                  )}
                  <span className="max-w-[7.5rem] truncate sm:max-w-[9rem]">
                    {leadStatusLabelFr[step]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_16.5rem]">
        <div className="space-y-5">
          <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Coordonnées
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={lead.email} />
              <InfoRow icon={Phone} label="Téléphone" value={lead.phone} />
              <InfoRow icon={CalendarDays} label="Dates" value={lead.dates} />
              <InfoRow icon={UserCheck} label="Voyageurs" value={lead.travelers} />
            </div>
          </section>

          <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projet
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              {lead.qualificationSummary}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoCard label="Budget" value={lead.budget} />
              <InfoCard label="Style" value={lead.travelStyle} />
              <InfoCard label="Source" value={lead.source} />
              <InfoCard label="Agence (synthèse)" value={lead.assignedAgency} />
            </div>
          </section>

          <LeadAgencyWorkflow lead={lead} />

          <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notes internes
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              {lead.internalNotes}
            </p>
          </section>

          <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Devis
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoCard label="État" value={lead.quoteStatus} />
              <InfoCard label="Agence assignée" value={lead.assignedAgency} />
            </div>
          </section>

          <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Historique
            </h3>
            <ul className="mt-4 space-y-3">
              {lead.timeline.map((item) => (
                <li key={item.id} className="flex gap-3 border-l-2 border-accent pl-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-foreground">{item.label}</p>
                      <time className="text-xs font-medium text-muted-foreground">
                        {item.date}
                      </time>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/85">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-border bg-panel p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Étape
            </h3>
            <label className="mt-3 block text-xs text-muted-foreground">
              <span className="sr-only">Changer l&apos;étape</span>
              <select
                value={lead.status}
                onChange={(e) => {
                  const next = e.target.value as LeadStatus;
                  if (!lead.referentId && next !== "new") {
                    window.alert(
                      "Assignez d'abord un référent opérateur sur ce dossier avant de changer d'étape.",
                    );
                    return;
                  }
                  setLeadStatus(lead.id, next);
                }}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-steel/25"
              >
                {LEAD_PIPELINE.map((s) => (
                  <option key={s} value={s}>
                    {leadStatusLabelFr[s]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="rounded-md border border-border bg-panel p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </h3>
            <div className="mt-3 grid gap-2">
              {actions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-panel-muted px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-panel"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-border bg-panel p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Synthèse
            </h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Étape</dt>
                <dd className="mt-1">
                  <LeadStatusBadge status={lead.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Agence</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {lead.assignedAgency}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Devis</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {lead.quoteStatus}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel-muted/60 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm leading-snug text-foreground/90">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border bg-panel-muted/60 px-3 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-foreground/90">{value}</p>
      </div>
    </div>
  );
}
