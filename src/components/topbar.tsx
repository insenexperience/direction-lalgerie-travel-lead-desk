"use client";

import { useState } from "react";
import { Bell, Plus } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { LeadIntakeModal } from "@/components/leads/lead-intake-modal";
import { UserAvatarMenu } from "@/components/user-avatar-menu";

type TopbarProps = {
  userEmail?: string;
  userName?: string;
  avatarUrl?: string | null;
};

export function Topbar({ userEmail, userName, avatarUrl }: TopbarProps) {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const displayName = userName || userEmail || "Utilisateur";

  return (
    <>
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-[#e4e8eb] bg-white px-4 sm:px-6 lg:px-8">
        {/* Search */}
        <div className="flex-1">
          <GlobalSearch />
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Notifications — placeholder v1 */}
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-[6px] text-[#6b7a85] transition-colors hover:bg-[#f6f7f8] hover:text-[#0e1a21]"
            aria-label="Notifications"
          >
            <Bell className="h-[1.05rem] w-[1.05rem]" aria-hidden />
          </button>

          {/* Nouveau lead */}
          <button
            type="button"
            onClick={() => setIntakeOpen(true)}
            className="flex items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nouveau lead
          </button>

          <UserAvatarMenu userName={displayName} avatarUrl={avatarUrl ?? null} />
        </div>
      </header>

      <LeadIntakeModal
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onCreated={() => setIntakeOpen(false)}
      />
    </>
  );
}
