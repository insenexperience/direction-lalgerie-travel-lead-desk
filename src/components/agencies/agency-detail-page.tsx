"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, MoreHorizontal, Globe, ChevronDown } from "lucide-react";
import { AgencyLogoUploader } from "@/components/agencies/agency-logo-uploader";
import { AgencyStatusBadge } from "@/components/agencies/agency-status-badge";
import { AgencyTabsNav, type TabId } from "@/components/agencies/agency-tabs-nav";
import { AgencySectionInfo } from "@/components/agencies/agency-section-info";
import { AgencySectionContacts } from "@/components/agencies/agency-section-contacts";
import { AgencySectionLeads } from "@/components/agencies/agency-section-leads";
import { AgencySectionPerformance } from "@/components/agencies/agency-section-performance";
import { AgencySectionCircuits } from "@/components/agencies/agency-section-circuits";
import { AgencyEditDrawer } from "@/components/agencies/agency-edit-drawer";
import { AgencyDeleteDialog } from "@/components/agencies/agency-delete-dialog";
import { updateAgencyStatus } from "@/app/(dashboard)/agencies/actions";
import type { AgencyDetail } from "@/lib/agencies/types";

interface AgencyDetailPageProps {
  agency: AgencyDetail;
  revenueChart: { label: string; value: number; isCurrent: boolean }[];
}

export function AgencyDetailPage({ agency, revenueChart }: AgencyDetailPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [kebabOpen, setKebabOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(agency.logo_url ?? null);

  const displayName = agency.trade_name ?? agency.legal_name;

  const tabCounts: Partial<Record<TabId, number>> = {
    contacts: agency.contacts.length,
    leads: agency.activeLeads.length,
  };

  async function toggleStatus() {
    const next = agency.status === "active" ? "suspended" : "active";
    await updateAgencyStatus(agency.id, next);
    setKebabOpen(false);
  }

  return (
    <div className="space-y-0">
      {/* Back */}
      <div className="mb-4">
        <Link href="/agencies" className="flex items-center gap-1.5 text-[12px] text-[#6b7a85] hover:text-[#0e1a21] transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Agences partenaires
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-t-[8px] border border-b-0 border-[#e4e8eb] bg-white px-6 py-5">
        <div className="flex flex-wrap items-start gap-4">
          <AgencyLogoUploader
            agencyId={agency.id}
            currentLogoUrl={logoUrl}
            agencyName={displayName}
            onUpdate={setLogoUrl}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold text-[#0e1a21]">{displayName}</h1>
              <AgencyStatusBadge status={agency.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#6b7a85]">
              <span>{agency.type === "dmc" ? "DMC" : agency.type === "travel_agency" ? "Agence de voyage" : agency.type === "tour_operator" ? "Tour Opérateur" : "Autre"}</span>
              <span>·</span>
              <span>{agency.city}, {agency.country}</span>
              {agency.website && (
                <>
                  <span>·</span>
                  <a href={agency.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#1e5a8a] hover:underline">
                    <Globe className="h-3 w-3" aria-hidden />
                    Site web
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[13px] font-medium text-[#3a4a55] hover:bg-[#f6f7f8] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Modifier
            </button>

            <div className="relative">
              <button
                onClick={() => setKebabOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#e4e8eb] bg-white text-[#6b7a85] hover:bg-[#f6f7f8] transition-colors"
                aria-label="Plus d'actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {kebabOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-[8px] border border-[#e4e8eb] bg-white py-1 shadow-lg">
                  <button
                    onClick={toggleStatus}
                    className="block w-full px-4 py-2 text-left text-[13px] text-[#3a4a55] hover:bg-[#f6f7f8] transition-colors"
                  >
                    {agency.status === "active" ? "Suspendre" : "Réactiver"}
                  </button>
                  <div className="my-1 border-t border-[#f0f2f4]" />
                  <button
                    onClick={() => { setKebabOpen(false); setDeleteOpen(true); }}
                    className="block w-full px-4 py-2 text-left text-[13px] text-[#c1411f] hover:bg-[#fceee9] transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-x border-[#e4e8eb]">
        <AgencyTabsNav counts={tabCounts} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Content */}
      <div className="rounded-b-[8px] border border-t-0 border-[#e4e8eb] bg-white px-6 py-6">
        {activeTab === "info" && <AgencySectionInfo agency={agency} />}
        {activeTab === "contacts" && <AgencySectionContacts agency={agency} />}
        {activeTab === "leads" && <AgencySectionLeads agency={agency} />}
        {activeTab === "performance" && <AgencySectionPerformance agency={agency} revenueChart={revenueChart} />}
        {activeTab === "circuits" && <AgencySectionCircuits agency={agency} />}
      </div>

      {/* Drawers & dialogs */}
      <AgencyEditDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        agency={agency}
      />
      <AgencyDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        agencyId={agency.id}
        agencyName={displayName}
      />

      {/* Close kebab on outside click */}
      {kebabOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setKebabOpen(false)} aria-hidden />
      )}
    </div>
  );
}
