"use client";

import { useCallback, useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { InboxItem } from "@/components/leads/inbox-item";
import { LeadPreviewPanel } from "@/components/leads/lead-preview-panel";

type InboxClientShellProps = {
  leads: SupabaseLeadRow[];
  queue: string;
  currentUserId: string | null;
  isAdmin: boolean;
};

export function InboxClientShell({ leads, queue, currentUserId, isAdmin }: InboxClientShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    leads.length > 0 ? leads[0].id : null,
  );

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!leads.length) return;
      const currentIndex = leads.findIndex((l) => l.id === selectedId);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = leads[Math.min(currentIndex + 1, leads.length - 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = leads[Math.max(currentIndex - 1, 0)];
        if (prev) setSelectedId(prev.id);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    },
    [leads, selectedId],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-[#9aa7b0]">
        <Coffee className="h-10 w-10" aria-hidden />
        <p className="text-[14px] font-medium">
          {queue === "all" ? "Tout est traité. Prenez un café." : "Aucun lead dans cette file."}
        </p>
        {queue !== "all" && (
          <a href="/inbox" className="text-[12px] text-[#1e5a8a] underline underline-offset-2">
            Voir tous les leads
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-[8px] border border-[#e4e8eb] bg-white">
      {/* List panel */}
      <div
        className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-r border-[#e4e8eb]"
        role="listbox"
        aria-label="Leads"
        tabIndex={0}
      >
        {leads.map((lead) => (
          <InboxItem
            key={lead.id}
            lead={lead}
            selected={lead.id === selectedId}
            onClick={() => setSelectedId(lead.id)}
          />
        ))}
      </div>

      {/* Preview panel */}
      <div className="flex min-w-0 flex-1 overflow-y-auto">
        {selectedLead ? (
          <LeadPreviewPanel
            lead={selectedLead}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-[#9aa7b0]">
            Sélectionnez un lead pour le prévisualiser
          </div>
        )}
      </div>
    </div>
  );
}
