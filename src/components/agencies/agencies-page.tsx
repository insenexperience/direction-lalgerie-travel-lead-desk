"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { AgencyCard } from "@/components/agencies/agency-card";
import { AgenciesFilters } from "@/components/agencies/agencies-filters";
import { AgencyEditDrawer } from "@/components/agencies/agency-edit-drawer";
import type { AgencyListItem } from "@/lib/agencies/types";

interface AgenciesPageProps {
  agencies: AgencyListItem[];
  activeCount: number;
  consultationsCount: number;
  wonCount: number;
}

export function AgenciesPage({ agencies, activeCount, consultationsCount, wonCount }: AgenciesPageProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold text-[#0e1a21]">Agences partenaires</h1>
          <p className="mt-0.5 text-[13px] text-[#6b7a85]">
            <span className="font-medium text-[#0e1a21]">{activeCount}</span> agences actives
            {" · "}
            <span className="font-medium text-[#0e1a21]">{consultationsCount}</span> consultations en cours
            {" · "}
            <span className="font-medium text-[#0f6b4b]">{wonCount}</span> dossiers gagnés cette année
          </p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 rounded-[6px] bg-[#15323f] px-4 py-2 text-[13px] font-medium text-[#f3f7fa] hover:bg-[#1a3d4e] transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nouvelle agence
        </button>
      </div>

      {/* Filters */}
      <AgenciesFilters />

      {/* Grid */}
      {agencies.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[8px] border border-dashed border-[#e4e8eb] py-20">
          <Building2 className="h-12 w-12 text-[#9aa7b0]" aria-hidden />
          <p className="text-[14px] text-[#6b7a85]">Aucune agence partenaire. Commencez par en créer une.</p>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-[6px] bg-[#15323f] px-4 py-2 text-[13px] font-medium text-[#f3f7fa] hover:bg-[#1a3d4e] transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle agence
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agencies.map((agency) => (
            <AgencyCard key={agency.id} agency={agency} />
          ))}
        </div>
      )}

      <AgencyEditDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
