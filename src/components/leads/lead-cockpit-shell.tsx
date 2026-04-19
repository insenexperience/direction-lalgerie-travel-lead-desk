"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { LeadCockpitBottomNav } from "./lead-cockpit-bottom-nav";
import { LeadCockpitDossier } from "./lead-cockpit-dossier";
import { LeadCockpitPipeline } from "./lead-cockpit-pipeline";
import { LeadCockpitStrip } from "./lead-cockpit-strip";
import { LeadScoreModal } from "./lead-score-modal";

type LeadCockpitShellProps = {
  lead: SupabaseLeadRow;
  referentLabel: string | null;
  qualificationValidatorLabel: string | null;
  isAdmin: boolean;
  children: ReactNode;
  showFicheLink?: boolean;
};

export function LeadCockpitShell({
  lead,
  referentLabel,
  qualificationValidatorLabel,
  isAdmin,
  children,
  showFicheLink = true,
}: LeadCockpitShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);

  return (
    <div className="space-y-4 pb-28 sm:space-y-5 sm:pb-32">
      <LeadCockpitStrip
        lead={lead}
        onOpenScoreModal={() => setScoreModalOpen(true)}
        onOpenDetailsDrawer={() => setDrawerOpen(true)}
      />
      <LeadCockpitPipeline leadId={lead.id} status={lead.status} />
      {children}
      <LeadCockpitDossier
        lead={lead}
        referentLabel={referentLabel}
        qualificationValidatorLabel={qualificationValidatorLabel}
        isAdmin={isAdmin}
        onOpenScoreModal={() => setScoreModalOpen(true)}
        showFicheLink={showFicheLink}
      />
      <LeadCockpitBottomNav
        lead={lead}
        referentLabel={referentLabel}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
      />
      <LeadScoreModal
        open={scoreModalOpen}
        onClose={() => setScoreModalOpen(false)}
        lead={lead}
        isAdmin={isAdmin}
      />
    </div>
  );
}
