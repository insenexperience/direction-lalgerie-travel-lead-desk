"use client";

import Link from "next/link";
import { ArrowUpRight, Mail, Phone, Users as UsersIcon } from "lucide-react";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { NextActionCard } from "@/components/leads/next-action-card";
import { LeadRail } from "@/components/leads/lead-rail";
import { Avatar } from "@/components/ui/avatar";

type LeadPreviewPanelProps = {
  lead: SupabaseLeadRow;
  currentUserId: string | null;
  isAdmin: boolean;
};

export function LeadPreviewPanel({ lead, currentUserId, isAdmin }: LeadPreviewPanelProps) {
  const confidencePct = lead.ai_qualification_confidence != null
    ? Math.round(lead.ai_qualification_confidence * 100)
    : null;

  const confidenceColor =
    confidencePct == null ? ""
    : confidencePct >= 80  ? "bg-[#0f6b4b]"
    : confidencePct >= 60  ? "bg-[#a8710b]"
    : "bg-[#c1411f]";

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold leading-tight text-[#0e1a21]">
            {lead.traveler_name || "—"}
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6b7a85]">
            {lead.reference ?? lead.id.slice(0, 8)}
          </p>
        </div>
        <Link
          href={`/leads/${lead.id}`}
          className="flex shrink-0 items-center gap-1 rounded-[6px] border border-[#e4e8eb] px-3 py-1.5 text-[12px] font-medium text-[#3a4a55] transition-colors hover:border-[#15323f]/30 hover:text-[#15323f]"
        >
          Cockpit complet
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <NextActionCard lead={lead} currentUserId={currentUserId} />
      <div className="overflow-x-auto">
        <LeadRail status={lead.status} compact />
      </div>

      <section className="rounded-[8px] border border-[#e4e8eb] bg-white">
        <div className="flex items-center gap-2 border-b border-[#e4e8eb] px-4 py-3">
          <Avatar name={lead.traveler_name || "?"} size={30} gold />
          <h3 className="text-[13px] font-semibold text-[#0e1a21]">Dossier voyageur</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3">
          {lead.email && (
            <div className="col-span-2 flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-[#6b7a85]" aria-hidden />
              <span className="truncate text-[12px] text-[#3a4a55]">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[#6b7a85]" aria-hidden />
              <span className="text-[12px] text-[#3a4a55]">{lead.phone}</span>
            </div>
          )}
          {lead.travelers && (
            <div className="flex items-center gap-2">
              <UsersIcon className="h-3.5 w-3.5 shrink-0 text-[#6b7a85]" aria-hidden />
              <span className="text-[12px] text-[#3a4a55]">{lead.travelers}</span>
            </div>
          )}
          {lead.budget && (
            <InfoRow label="Budget" value={lead.budget} mono />
          )}
          {lead.trip_dates && (
            <InfoRow label="Dates" value={lead.trip_dates} />
          )}
          {lead.travel_style && (
            <InfoRow label="Style" value={lead.travel_style} />
          )}
        </div>
        {lead.trip_summary && (
          <p className="border-t border-[#e4e8eb] px-4 py-3 text-[12px] leading-relaxed text-[#6b7a85]">
            {lead.trip_summary}
          </p>
        )}
      </section>

      {/* Qualification IA */}
      {(lead.qualification_summary || lead.ai_qualification_payload != null) && (
        <section className="rounded-[8px] border border-[#e4e8eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4e8eb] px-4 py-3">
            <h3 className="text-[13px] font-semibold text-[#0e1a21]">Qualification IA</h3>
            {confidencePct != null && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6b7a85]">Confiance</span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e4e8eb]">
                  <div
                    className={`h-full rounded-full ${confidenceColor}`}
                    style={{ width: `${confidencePct}%` }}
                    aria-label={`${confidencePct}% de confiance`}
                  />
                </div>
                <span className="text-[11px] font-medium text-[#3a4a55]">{confidencePct}%</span>
              </div>
            )}
          </div>
          <p className="px-4 py-3 text-[12px] leading-relaxed text-[#3a4a55]">
            {lead.qualification_summary || "Aucune synthèse disponible."}
          </p>
        </section>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-[#9aa7b0]">{label}</span>
      <span className={`text-[12px] text-[#3a4a55] ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
