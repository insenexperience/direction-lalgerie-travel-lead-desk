"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "info",         label: "Informations" },
  { id: "contacts",     label: "Contacts" },
  { id: "leads",        label: "Leads assignés" },
  { id: "performance",  label: "Performance" },
  { id: "circuits",     label: "Circuits & notes" },
] as const;

type TabId = typeof TABS[number]["id"];

interface AgencyTabsNavProps {
  counts?: Partial<Record<TabId, number>>;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function AgencyTabsNav({ counts, activeTab, onTabChange }: AgencyTabsNavProps) {
  return (
    <div className="sticky top-0 z-10 flex gap-0 overflow-x-auto border-b border-[#e4e8eb] bg-white px-6">
      {TABS.map(({ id, label }) => {
        const count = counts?.[id];
        const isActive = id === activeTab;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={[
              "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors",
              isActive
                ? "border-[#15323f] text-[#0e1a21]"
                : "border-transparent text-[#6b7a85] hover:text-[#0e1a21]",
            ].join(" ")}
          >
            {label}
            {count !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none tabular-nums ${isActive ? "bg-[#15323f] text-white" : "bg-[#e4e8eb] text-[#6b7a85]"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type { TabId };
