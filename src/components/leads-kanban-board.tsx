"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Hand,
  Mail,
  Star,
  Trash2,
} from "lucide-react";
import { claimLead } from "@/app/(dashboard)/leads/actions";
import { useLeadsDemo } from "@/context/leads-demo-context";
import { isUuid } from "@/lib/is-uuid";
import {
  filterLeadsByQueue,
  parseLeadsQueueFilter,
} from "@/lib/leads-queue-filter";
import type { LeadStatus, MockLead } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

function sortInColumn(list: MockLead[]) {
  return [...list].sort(
    (a, b) => Number(!!b.starred) - Number(!!a.starred),
  );
}

function consultationBadge(lead: MockLead): string | null {
  const links = lead.agencyLinks ?? [];
  const total = links.length;
  if (!total) return null;
  const resp = links.filter((l) => l.status === "quote_received").length;
  return `${total} ag. · ${resp} rép.`;
}

function KanbanColumn({
  status,
  leads,
}: {
  status: LeadStatus;
  leads: MockLead[];
}) {
  const sorted = useMemo(() => sortInColumn(leads), [leads]);

  return (
    <section
      className={[
        "flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-md border bg-panel-muted/80",
        "border-border",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-panel px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {leadStatusLabelFr[status]}
        </h3>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-panel-muted px-1.5 text-xs font-semibold text-foreground">
          {sorted.length}
        </span>
      </div>
      <div className="flex max-h-[min(70vh,40rem)] min-h-[12rem] flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {sorted.length === 0 ? (
          <div
            className="mx-auto my-8 h-8 w-8 rounded-full border border-dashed border-border"
            aria-hidden
          />
        ) : (
          sorted.map((lead) => <LeadKanbanCard key={lead.id} lead={lead} />)
        )}
      </div>
    </section>
  );
}

function LeadKanbanCard({ lead }: { lead: MockLead }) {
  const router = useRouter();
  const { toggleStar, deleteLead, moveLeadToStatus } = useLeadsDemo();
  const badge = consultationBadge(lead);

  return (
    <div className="rounded-md border border-border bg-panel text-foreground shadow-sm">
      <div className="flex gap-1 p-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <Link
              href={`/leads/${lead.id}`}
              className="min-w-0 flex-1 hover:underline"
            >
              <p className="font-semibold leading-snug text-foreground">
                {lead.travelerName}
              </p>
            </Link>
            <div className="flex shrink-0 items-center gap-0.5">
              {isUuid(lead.id) && !lead.referentId ? (
                <button
                  type="button"
                  title="Prendre ce lead"
                  onClick={async (e) => {
                    e.preventDefault();
                    const r = await claimLead(lead.id);
                    if (!r.ok) {
                      window.alert(r.error);
                      return;
                    }
                    router.refresh();
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-800"
                  aria-label="Prendre ce lead"
                >
                  <Hand className="size-4" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleStar(lead.id);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-panel-muted"
                aria-label={
                  lead.starred ? "Retirer des favoris" : "Mettre en favori"
                }
              >
                <Star
                  className={[
                    "size-4",
                    lead.starred ? "fill-amber-500 text-amber-600" : "",
                  ].join(" ")}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const label = lead.travelerName || lead.email || "ce lead";
                  if (
                    !window.confirm(
                      `Supprimer « ${label} » ?${isUuid(lead.id) ? " Action définitive." : ""}`,
                    )
                  ) {
                    return;
                  }
                  void deleteLead(lead.id);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                aria-label="Supprimer le lead"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          {lead.priority === "high" ? (
            <span
              className="mt-1 inline-block size-1.5 rounded-full bg-amber-500"
              title="Priorité haute"
              aria-hidden
            />
          ) : null}
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Mail className="size-3 shrink-0 opacity-70" aria-hidden />
            {lead.email}
          </p>
          {!lead.referentId ? (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              À assigner (opérateur)
            </p>
          ) : null}
          {badge ? (
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{badge}</p>
          ) : null}
          {lead.qualificationPending ? (
            <p className="mt-1 text-[10px] font-semibold uppercase text-red-700">
              Validation IA
            </p>
          ) : null}
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-foreground/85">
            {lead.tripSummary}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3 shrink-0" aria-hidden />
            {lead.dates}
          </p>
          <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Étape
            <select
              className="mt-1 w-full rounded border border-border bg-panel-muted px-1.5 py-1 text-xs font-medium text-foreground"
              value={lead.status}
              onChange={(e) => {
                const next = e.target.value as LeadStatus;
                if (next !== lead.status) {
                  void moveLeadToStatus(lead.id, next);
                }
              }}
            >
              {LEAD_PIPELINE.map((s) => (
                <option key={s} value={s}>
                  {leadStatusLabelFr[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

export function LeadsKanbanBoard() {
  const searchParams = useSearchParams();
  const queue = parseLeadsQueueFilter(searchParams.get("queue"));
  const { filteredLeads, currentUserId } = useLeadsDemo();

  const queueFiltered = useMemo(
    () => filterLeadsByQueue(filteredLeads, queue, currentUserId),
    [filteredLeads, queue, currentUserId],
  );

  const byStatus = useMemo(() => {
    return LEAD_PIPELINE.reduce<Record<LeadStatus, MockLead[]>>(
      (acc, status) => {
        acc[status] = queueFiltered.filter((l) => l.status === status);
        return acc;
      },
      {} as Record<LeadStatus, MockLead[]>,
    );
  }, [queueFiltered]);

  return (
    <div className="min-w-0 max-w-full overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2">
      <div className="flex min-h-[min(70vh,36rem)] gap-4 px-0.5 pb-1 pt-1">
        {LEAD_PIPELINE.map((status) => (
          <KanbanColumn key={status} status={status} leads={byStatus[status]} />
        ))}
      </div>
    </div>
  );
}
