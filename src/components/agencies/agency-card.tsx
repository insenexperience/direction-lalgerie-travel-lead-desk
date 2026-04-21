import Link from "next/link";
import { MapPin } from "lucide-react";
import { AgencyLogo } from "@/components/agencies/agency-logo";
import { AgencyStatusBadge } from "@/components/agencies/agency-status-badge";
import type { AgencyListItem } from "@/lib/agencies/types";

function formatRevenue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
}

interface AgencyCardProps {
  agency: AgencyListItem;
}

export function AgencyCard({ agency }: AgencyCardProps) {
  const displayName = agency.trade_name ?? agency.legal_name;
  const typeLabel: Record<string, string> = {
    dmc: "DMC",
    travel_agency: "Agence de voyage",
    tour_operator: "Tour Opérateur",
    other: "Autre",
  };

  return (
    <Link
      href={`/agencies/${agency.id}`}
      className="group flex flex-col gap-3 rounded-[8px] border border-[#e4e8eb] bg-white p-5 transition-all duration-150 hover:-translate-y-px hover:border-[#15323f]/25 hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <AgencyLogo name={displayName} logoUrl={agency.logo_url} size={48} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-semibold text-[#0e1a21]">{displayName}</p>
            <AgencyStatusBadge status={agency.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#6b7a85]">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {agency.city}, {agency.country}
          </div>
          <p className="mt-0.5 text-[11px] text-[#9aa7b0]">
            {typeLabel[agency.type] ?? agency.type}
            {agency.destinations ? ` · ${agency.destinations}` : ""}
          </p>
        </div>
      </div>

      <div className="border-t border-[#f0f2f4]" />

      {/* Metrics */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-[12px] text-[#6b7a85]">
          <span className="font-mono font-semibold text-[#0e1a21]">{agency.metrics.leadsActive}</span> leads actifs
        </span>
        <span className="text-[#9aa7b0]">·</span>
        <span className="text-[12px] text-[#6b7a85]">
          <span className="font-mono font-semibold text-[#0f6b4b]">{agency.metrics.acceptanceRate} %</span> acceptation
        </span>
        {agency.metrics.revenueWon > 0 && (
          <>
            <span className="text-[#9aa7b0]">·</span>
            <span className="text-[12px] text-[#6b7a85]">
              <span className="font-mono font-semibold text-[#0e1a21]">{formatRevenue(agency.metrics.revenueWon)}</span> CA
            </span>
          </>
        )}
        <span className="text-[#9aa7b0]">·</span>
        <span className="text-[12px] text-[#6b7a85]">
          SLA <span className="font-mono font-medium text-[#0e1a21]">{agency.sla_quote_days}j</span>
        </span>
      </div>

      {/* Primary contact */}
      {agency.primary_contact_name && (
        <>
          <div className="border-t border-[#f0f2f4]" />
          <div className="text-[12px]">
            <span className="font-medium text-[#0e1a21]">{agency.primary_contact_name}</span>
            {agency.primary_contact_email && (
              <span className="ml-2 text-[#6b7a85]">{agency.primary_contact_email}</span>
            )}
          </div>
        </>
      )}
    </Link>
  );
}
