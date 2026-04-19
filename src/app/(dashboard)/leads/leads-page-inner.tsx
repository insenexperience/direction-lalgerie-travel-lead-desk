"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  filterLeadsByQueue,
  parseLeadsQueueFilter,
  type LeadsQueueFilter,
} from "@/lib/leads-queue-filter";
import { useMemo, useState } from "react";
import {
  Kanban,
  LayoutList,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Waypoints,
} from "lucide-react";
import { isUuid } from "@/lib/is-uuid";
import { PageEmpty } from "@/components/page-empty";
import { LeadIntakeModal } from "@/components/leads/lead-intake-modal";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { LeadsKanbanBoard } from "@/components/leads-kanban-board";
import { TopHeader } from "@/components/top-header";
import { useLeadsDemo } from "@/context/leads-demo-context";
import { leadStatuses } from "@/lib/mock-leads";

function leadsHref(opts: {
  view?: "kanban";
  status?: string;
  queue?: LeadsQueueFilter;
}) {
  const p = new URLSearchParams();
  if (opts.view === "kanban") p.set("view", "kanban");
  if (opts.status && opts.status !== "all") p.set("status", opts.status);
  if (opts.queue && opts.queue !== "all") p.set("queue", opts.queue);
  const q = p.toString();
  return q ? `/leads?${q}` : "/leads";
}

export function LeadsPageInner() {
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "all";
  const view = searchParams.get("view") === "kanban" ? "kanban" : "list";
  const queue = parseLeadsQueueFilter(searchParams.get("queue"));
  const {
    filteredLeads,
    search,
    setSearch,
    refreshLeads,
    toggleStar,
    leads,
    currentUserId,
    deleteLead,
  } = useLeadsDemo();

  const [modalOpen, setModalOpen] = useState(false);

  const queueFiltered = useMemo(
    () => filterLeadsByQueue(filteredLeads, queue, currentUserId),
    [filteredLeads, queue, currentUserId],
  );

  const visibleLeads = useMemo(() => {
    if (currentStatus === "all") return queueFiltered;
    return queueFiltered.filter((l) => l.status === currentStatus);
  }, [queueFiltered, currentStatus]);

  const viewToggle = (
    <div className="inline-flex rounded-md border border-border bg-panel-muted p-0.5">
      <Link
        href={leadsHref({ status: currentStatus, queue })}
        scroll={false}
        className={[
          "inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold transition-colors",
          view === "list" ? "bg-panel text-foreground shadow-sm" : "hover:bg-panel/80",
        ].join(" ")}
      >
        <LayoutList
          className={[
            "size-4 shrink-0",
            view === "list" ? "text-foreground" : "text-muted-foreground",
          ].join(" ")}
          aria-hidden
        />
        <span
          className={
            view === "list" ? "text-foreground" : "text-muted-foreground"
          }
        >
          Liste
        </span>
      </Link>
      <Link
        href={leadsHref({ view: "kanban", status: currentStatus, queue })}
        scroll={false}
        className={[
          "inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold transition-colors",
          view === "kanban" ? "bg-panel text-foreground shadow-sm" : "hover:bg-panel/80",
        ].join(" ")}
      >
        <Kanban
          className={[
            "size-4 shrink-0",
            view === "kanban" ? "text-foreground" : "text-muted-foreground",
          ].join(" ")}
          aria-hidden
        />
        <span
          className={
            view === "kanban" ? "text-foreground" : "text-muted-foreground"
          }
        >
          Kanban
        </span>
      </Link>
    </div>
  );

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-[12rem] flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-md border border-border bg-panel py-2 pl-10 pr-3 text-sm text-foreground outline-none ring-steel/20 placeholder:text-muted-foreground focus:ring-2"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-steel px-3 py-2 text-sm font-semibold text-[#f3f7fa] transition-colors hover:bg-[#0f1c24]"
        >
          <Plus className="size-4" aria-hidden />
          Nouveau lead
        </button>
        <button
          type="button"
          onClick={() => refreshLeads()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted"
        >
          <RotateCcw className="size-4" aria-hidden />
          Actualiser
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <TopHeader title="Leads" actions={viewToggle} />

      {toolbar}

      <div className="flex flex-col gap-2 rounded-md border border-border bg-panel px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          File d&apos;assignation
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "all" as const, label: "Tous les leads" },
              { value: "unassigned" as const, label: "À assigner (sans référent)" },
              { value: "mine" as const, label: "Mes dossiers" },
            ] as const
          ).map(({ value, label }) => {
            const active = queue === value;
            return (
              <Link
                key={value}
                href={leadsHref({
                  view: view === "kanban" ? "kanban" : undefined,
                  status: currentStatus === "all" ? undefined : currentStatus,
                  queue: value,
                })}
                scroll={false}
                className={[
                  "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-[#182b35] bg-[#182b35] text-[#f3f7fa]"
                    : "border-border bg-panel-muted text-foreground/85 hover:bg-panel",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="space-y-3">
          <PageEmpty
            Icon={Waypoints}
            title="Aucun lead pour l'instant"
          />
          <p className="text-center text-sm text-muted-foreground">
            Créez un dossier avec « Nouveau lead » ou actualisez la liste.
          </p>
        </div>
      ) : null}

      {view === "kanban" ? (
        <LeadsKanbanBoard />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {leadStatuses.map((status) => {
              const isActive = currentStatus === status.value;
              return (
                <Link
                  key={status.value}
                  href={leadsHref({
                    status: status.value === "all" ? undefined : status.value,
                    queue,
                  })}
                  scroll={false}
                  className={[
                    "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                    isActive
                      ? "border-[#182b35] bg-[#182b35]"
                      : "border-border bg-panel text-foreground/85 hover:bg-panel-muted",
                  ].join(" ")}
                >
                  <span
                    className={
                      isActive ? "text-[#f3f7fa]" : "text-foreground/85"
                    }
                  >
                    {status.label}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border bg-panel px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {visibleLeads.length}
            </p>
            <p className="text-sm text-muted-foreground">leads</p>
          </div>

          {leads.length > 0 && visibleLeads.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-panel-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
              Aucun résultat pour ces filtres. Essayez une autre étape ou « Tous les leads ».
            </p>
          ) : null}

          <section className="overflow-hidden rounded-md border border-border bg-panel">
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-panel-muted/80">
                  <tr className="text-muted-foreground">
                    <th className="w-10 px-2 py-3 sm:px-3" aria-label="Favori" />
                    <th className="px-4 py-3 font-semibold sm:px-6">Voyageur</th>
                    <th className="px-4 py-3 font-semibold sm:px-6">Projet</th>
                    <th className="px-4 py-3 font-semibold sm:px-6">Budget</th>
                    <th className="px-4 py-3 font-semibold sm:px-6">Étape</th>
                    <th className="px-4 py-3 font-semibold sm:px-6">Agence</th>
                    <th className="w-14 px-2 py-3 text-right font-semibold sm:px-3">Gestion</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-t border-border transition-colors hover:bg-panel-muted/50"
                    >
                      <td className="px-2 py-4 align-top sm:px-3">
                        <button
                          type="button"
                          onClick={() => toggleStar(lead.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-panel-muted hover:text-amber-600"
                          aria-label={
                            lead.starred ? "Retirer des favoris" : "Favori"
                          }
                        >
                          <Star
                            className={
                              lead.starred
                                ? "size-4 fill-amber-500 text-amber-600"
                                : "size-4"
                            }
                            aria-hidden
                          />
                        </button>
                      </td>
                      <td className="px-4 py-4 align-top sm:px-6">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block text-foreground"
                        >
                          <p className="font-semibold text-foreground">
                            {lead.travelerName}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {lead.email}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-4 align-top sm:px-6">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block text-foreground"
                        >
                          <p className="font-medium text-foreground/90">
                            {lead.tripSummary}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {lead.dates}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-4 align-top text-foreground/85 sm:px-6">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block text-foreground"
                        >
                          {lead.budget}
                        </Link>
                      </td>
                      <td className="px-4 py-4 align-top sm:px-6">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block text-foreground"
                        >
                          <LeadStatusBadge status={lead.status} />
                        </Link>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-foreground/85 sm:px-6">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block text-foreground"
                        >
                          {lead.assignedAgency}
                        </Link>
                      </td>
                      <td className="px-2 py-4 align-top text-right sm:px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const label = lead.travelerName || lead.email || "ce lead";
                            if (
                              !window.confirm(
                                `Supprimer définitivement « ${label} » ?${isUuid(lead.id) ? " Données Supabase incluses." : ""}`,
                              )
                            ) {
                              return;
                            }
                            void deleteLead(lead.id);
                          }}
                          className="inline-flex rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700"
                          aria-label="Supprimer le lead"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 p-3 sm:hidden">
              {visibleLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex gap-2 rounded-md border border-border bg-panel-muted/50 p-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleStar(lead.id)}
                    className="shrink-0 self-start rounded p-1 text-muted-foreground"
                    aria-label="Favori"
                  >
                    <Star
                      className={
                        lead.starred
                          ? "size-4 fill-amber-500 text-amber-600"
                          : "size-4"
                      }
                    />
                  </button>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="min-w-0 flex-1 text-foreground"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{lead.travelerName}</p>
                      <LeadStatusBadge status={lead.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {lead.email}
                    </p>
                    <p className="mt-2 text-sm leading-snug text-foreground/90">
                      {lead.tripSummary}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lead.dates} · {lead.budget}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const label = lead.travelerName || lead.email || "ce lead";
                      if (
                        !window.confirm(
                          `Supprimer « ${label} » ?${isUuid(lead.id) ? " Action définitive en base." : ""}`,
                        )
                      ) {
                        return;
                      }
                      void deleteLead(lead.id);
                    }}
                    className="shrink-0 self-start rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-700"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <LeadIntakeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => refreshLeads()}
      />
    </div>
  );
}
