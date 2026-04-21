"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft, UserCheck, UserX, Mail, Phone, Tag, ChevronDown, ChevronRight, Plus,
} from "lucide-react";
import type { ContactRow, SourceLeadRow, ActivityRow } from "@/app/(dashboard)/contacts/[id]/page";
import { StageDot } from "@/components/ui/stage-dot";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";

type ContactDetailProps = {
  contact: ContactRow;
  activities: ActivityRow[];
  sourceLead: SourceLeadRow | null;
  activeLeads: SourceLeadRow[];
  closedLeads: SourceLeadRow[];
};

function dateFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ContactDetail({
  contact,
  activities,
  activeLeads,
  closedLeads,
}: ContactDetailProps) {
  const isTraveler = contact.type === "traveler";
  const [historyOpen, setHistoryOpen] = useState(false);

  const displayName =
    (contact as unknown as { first_name?: string; last_name?: string }).first_name
      ? `${(contact as unknown as { first_name?: string }).first_name ?? ""} ${(contact as unknown as { last_name?: string }).last_name ?? ""}`.trim()
      : contact.full_name;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back nav */}
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1.5 text-[13px] text-[#6b7a85] hover:text-[#0e1a21]"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour aux contacts
      </Link>

      {/* ── En-tête identité + CTA proéminent ───────────────────────────── */}
      <div className="rounded-[10px] border border-[#e4e8eb] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#e8f0f5] text-xl font-bold text-[#15323f]">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[18px] font-semibold text-[#0e1a21]">{displayName}</h1>
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    isTraveler
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-700",
                  ].join(" ")}
                >
                  {isTraveler ? <UserCheck className="size-3" aria-hidden /> : <UserX className="size-3" aria-hidden />}
                  {isTraveler ? "Voyageur" : "Prospect"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[12px] text-[#6b7a85]">
                {contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" aria-hidden />
                    <a href={`mailto:${contact.email}`} className="hover:text-[#0e1a21]">{contact.email}</a>
                  </span>
                )}
                {(contact.phone || contact.whatsapp_phone_number) && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" aria-hidden />
                    {contact.phone ?? contact.whatsapp_phone_number}
                  </span>
                )}
              </div>
              {(contact.tags ?? []).length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Tag className="size-3 text-[#9aa7b0]" aria-hidden />
                  {(contact.tags ?? []).map((tag) => (
                    <span key={tag} className="rounded-full border border-[#e4e8eb] bg-[#f4f7fa] px-2 py-0.5 text-[10px] text-[#6b7a85]">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CTA proéminent */}
          <Link
            href={`/leads/new?contact_id=${contact.id}&email=${encodeURIComponent(contact.email ?? "")}&name=${encodeURIComponent(displayName)}`}
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#15323f] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0e1a21] transition-colors shrink-0"
          >
            <Plus className="size-4" aria-hidden />
            Créer un nouveau dossier voyage
          </Link>
        </div>

        {/* Métadonnées */}
        <div className="mt-5 grid gap-3 border-t border-[#e4e8eb] pt-4 text-[12px] sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0]">Premier contact</p>
            <p className="mt-1 text-[#0e1a21]">{dateFr(contact.first_seen_at)}</p>
          </div>
          {isTraveler && contact.won_at && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0]">Voyage validé</p>
              <p className="mt-1 text-[#0e1a21]">{dateFr(contact.won_at)}</p>
            </div>
          )}
          {!isTraveler && contact.lost_at && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0]">Date perdu</p>
              <p className="mt-1 text-[#0e1a21]">{dateFr(contact.lost_at)}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0]">Dossiers totaux</p>
            <p className="mt-1 text-[#0e1a21]">{activeLeads.length + closedLeads.length}</p>
          </div>
        </div>
      </div>

      {/* ── Section "Dossiers actifs" ────────────────────────────────────── */}
      <div className="rounded-[10px] border border-[#e4e8eb] bg-white p-5">
        <h2 className="text-[13px] font-semibold text-[#0e1a21] mb-3">
          Dossiers actifs
          {activeLeads.length > 0 && (
            <span className="ml-2 rounded-full bg-[#f4f7fa] px-2 py-0.5 text-[11px] font-normal text-[#6b7a85]">
              {activeLeads.length}
            </span>
          )}
        </h2>

        {activeLeads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-[13px] text-[#6b7a85]">Aucun dossier actif pour ce contact.</p>
            <Link
              href={`/leads/new?contact_id=${contact.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#1e5a8a] hover:underline"
            >
              <Plus className="size-3.5" aria-hidden />
              Créer un dossier voyage
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activeLeads.map((l) => (
              <LeadRow key={l.id} lead={l} />
            ))}
          </div>
        )}
      </div>

      {/* ── Section "Historique" (repliée) ───────────────────────────────── */}
      {closedLeads.length > 0 && (
        <div className="rounded-[10px] border border-[#e4e8eb] bg-white p-5">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex w-full items-center justify-between text-[13px] font-semibold text-[#0e1a21]"
          >
            <span>
              Historique
              <span className="ml-2 rounded-full bg-[#f4f7fa] px-2 py-0.5 text-[11px] font-normal text-[#6b7a85]">
                {closedLeads.length} dossier{closedLeads.length > 1 ? "s" : ""} clos
              </span>
            </span>
            {historyOpen
              ? <ChevronDown className="size-4 text-[#9aa7b0]" aria-hidden />
              : <ChevronRight className="size-4 text-[#9aa7b0]" aria-hidden />
            }
          </button>

          {historyOpen && (
            <div className="mt-4 space-y-2 border-t border-[#e4e8eb] pt-4">
              {closedLeads.map((l) => (
                <LeadRow key={l.id} lead={l} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Timeline activités ───────────────────────────────────────────── */}
      {activities.length > 0 && (
        <div className="rounded-[10px] border border-[#e4e8eb] bg-white p-5">
          <h2 className="text-[13px] font-semibold text-[#0e1a21] mb-4">Activités récentes</h2>
          <ol className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-[12px]">
                <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#15323f]" aria-hidden />
                <div>
                  <p className="font-medium text-[#0e1a21]">{a.kind.replace(/_/g, " ")}</p>
                  {a.detail && <p className="text-[#9aa7b0] line-clamp-1">{a.detail}</p>}
                  <p className="text-[10px] text-[#9aa7b0] mt-0.5">
                    {new Date(a.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function LeadRow({ lead }: { lead: SourceLeadRow }) {
  const isWon = lead.status === "won";
  const isLost = lead.status === "lost";

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="flex items-center justify-between gap-3 rounded-[6px] border border-[#e4e8eb] bg-[#fafbfc] px-3 py-2.5 hover:bg-[#f4f7fa] transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <StageDot status={lead.status as LeadStatus} />
        <div className="min-w-0">
          {lead.reference && (
            <span className="font-mono text-[10px] text-[#9aa7b0]">{lead.reference} · </span>
          )}
          <span className="text-[12px] font-medium text-[#0e1a21] truncate">
            {lead.trip_summary || lead.traveler_name || "Dossier sans titre"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            isWon  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : isLost ? "bg-red-50 text-red-600 border border-red-200"
            : "bg-[#f4f7fa] text-[#6b7a85] border border-[#e4e8eb]",
          ].join(" ")}
        >
          {leadStatusLabelFr[lead.status as LeadStatus] ?? lead.status}
        </span>
      </div>
    </Link>
  );
}
