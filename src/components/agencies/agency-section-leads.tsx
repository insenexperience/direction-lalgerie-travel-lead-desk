import Link from "next/link";
import { StageDot } from "@/components/ui/stage-dot";
import { leadStatusLabelFr } from "@/lib/mock-leads";
import type { AgencyDetail, AgencyLeadLink } from "@/lib/agencies/types";
import type { LeadStatus } from "@/lib/mock-leads";

function formatBudget(n: number | null | undefined): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
}

function LeadRow({ lead }: { lead: AgencyLeadLink }) {
  return (
    <Link
      href={`/leads/${lead.lead_id}`}
      className="group flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[13px] transition-colors hover:bg-[#f6f7f8]"
    >
      <span className="font-mono text-[12px] text-[#6b7a85]">{lead.reference}</span>
      <span className="flex-1 truncate font-medium text-[#0e1a21]">{lead.traveler_name}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <StageDot status={lead.status as LeadStatus} />
        <span className="text-[12px] text-[#6b7a85]">{leadStatusLabelFr[lead.status as LeadStatus] ?? lead.status}</span>
      </span>
      {lead.budget_parsed && (
        <span className="shrink-0 font-mono text-[12px] text-[#3a4a55]">{formatBudget(lead.budget_parsed)}</span>
      )}
    </Link>
  );
}

interface AgencySectionLeadsProps {
  agency: AgencyDetail;
}

export function AgencySectionLeads({ agency }: AgencySectionLeadsProps) {
  const retained = agency.activeLeads.filter((l) => l.link_kind === "retained");
  const consulted = agency.activeLeads.filter((l) => l.link_kind === "consultation");

  return (
    <div className="space-y-6">
      {/* Leads retenus */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[12px] font-semibold text-[#0e1a21]">Agence retenue</p>
          <span className="rounded-full bg-[#e4e8eb] px-1.5 py-0.5 text-[10px] tabular-nums text-[#6b7a85]">{retained.length}</span>
        </div>
        {retained.length === 0 ? (
          <p className="text-[13px] text-[#9aa7b0]">Aucun lead actif avec cette agence retenue.</p>
        ) : (
          <div className="rounded-[8px] border border-[#e4e8eb] bg-white">
            {retained.map((l) => <LeadRow key={l.lead_id} lead={l} />)}
          </div>
        )}
      </div>

      {/* Leads consultés */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[12px] font-semibold text-[#0e1a21]">Agence consultée</p>
          <span className="rounded-full bg-[#e4e8eb] px-1.5 py-0.5 text-[10px] tabular-nums text-[#6b7a85]">{consulted.length}</span>
        </div>
        {consulted.length === 0 ? (
          <p className="text-[13px] text-[#9aa7b0]">Aucun dossier en cours de consultation.</p>
        ) : (
          <div className="rounded-[8px] border border-[#e4e8eb] bg-white">
            {consulted.map((l) => <LeadRow key={l.lead_id} lead={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
