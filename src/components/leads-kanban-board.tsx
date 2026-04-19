"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  GripVertical,
  Mail,
  Star,
  Trash2,
} from "lucide-react";
import { useLeadsDemo } from "@/context/leads-demo-context";
import { isUuid } from "@/lib/is-uuid";
import {
  filterLeadsByQueue,
  parseLeadsQueueFilter,
} from "@/lib/leads-queue-filter";
import type { LeadStatus, MockLead } from "@/lib/mock-leads";
import { LEAD_PIPELINE, leadStatusLabelFr } from "@/lib/mock-leads";

const colId = (s: LeadStatus) => `col-${s}`;

function sortInColumn(list: MockLead[]) {
  return [...list].sort(
    (a, b) => Number(!!b.starred) - Number(!!a.starred),
  );
}

function KanbanColumn({
  status,
  leads,
}: {
  status: LeadStatus;
  leads: MockLead[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId(status) });
  const sorted = useMemo(() => sortInColumn(leads), [leads]);

  return (
    <section
      ref={setNodeRef}
      className={[
        "flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-md border bg-panel-muted/80",
        isOver
          ? "border-steel ring-2 ring-steel/25"
          : "border-border",
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
  const { toggleStar, deleteLead } = useLeadsDemo();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id });
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-md border border-border bg-panel text-foreground shadow-sm",
        isDragging ? "opacity-60 shadow-md ring-2 ring-steel/30" : "",
      ].join(" ")}
    >
      <div className="flex gap-1 p-2">
        <button
          type="button"
          className="mt-0.5 flex shrink-0 cursor-grab touch-none items-start rounded border border-transparent p-1 text-muted-foreground hover:bg-panel-muted hover:text-foreground active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label="Déplacer le lead"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
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
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-foreground/85">
            {lead.tripSummary}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3 shrink-0" aria-hidden />
            {lead.dates}
          </p>
        </div>
      </div>
    </div>
  );
}

function CardPreview({ lead }: { lead: MockLead }) {
  return (
    <div className="w-[min(100%,16rem)] rounded-md border border-border bg-panel p-3 text-foreground shadow-lg">
      <p className="font-semibold">{lead.travelerName}</p>
      <p className="mt-1 text-xs text-muted-foreground">{lead.tripSummary}</p>
    </div>
  );
}

export function LeadsKanbanBoard() {
  const searchParams = useSearchParams();
  const queue = parseLeadsQueueFilter(searchParams.get("queue"));
  const { leads, filteredLeads, moveLeadToStatus, currentUserId } =
    useLeadsDemo();
  const [activeLead, setActiveLead] = useState<MockLead | null>(null);

  const queueFiltered = useMemo(
    () => filterLeadsByQueue(filteredLeads, queue, currentUserId),
    [filteredLeads, queue, currentUserId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
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

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    const lead = leads.find((l) => l.id === id);
    setActiveLead(lead ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = e;
    if (!over) return;
    const leadId = String(active.id);
    const overId = String(over.id);
    let target: LeadStatus | null = null;
    if (overId.startsWith("col-")) {
      target = overId.slice(4) as LeadStatus;
    } else {
      const hit = leads.find((l) => l.id === overId);
      if (hit) target = hit.status;
    }
    if (target) moveLeadToStatus(leadId, target);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-w-0 max-w-full overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2">
        <div className="flex min-h-[min(70vh,36rem)] gap-4 px-0.5 pb-1 pt-1">
          {LEAD_PIPELINE.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={byStatus[status]}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeLead ? <CardPreview lead={activeLead} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
