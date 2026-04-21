import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { LeadStatus } from "@/lib/mock-leads";

export type TeamLoadEntry = {
  referentId: string;
  fullName: string;
  avatarUrl: string | null;
  totalActive: number;
  byStatus: Partial<Record<LeadStatus, number>>;
};

const ACTIVE_STATUSES: LeadStatus[] = [
  "new", "qualification", "agency_assignment", "co_construction", "quote", "negotiation",
];

const STATUS_COLORS: Record<LeadStatus, string> = {
  new:               "#8896a0",
  qualification:     "#1e5a8a",
  agency_assignment: "#b68d3d",
  co_construction:   "#9a5fb4",
  quote:             "#d97706",
  negotiation:       "#c1411f",
  won:               "#0f6b4b",
  lost:              "#6b7a85",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new:               "Nouveau",
  qualification:     "Qualification",
  agency_assignment: "Assignation",
  co_construction:   "Co-construction",
  quote:             "Devis",
  negotiation:       "Négociation",
  won:               "Gagné",
  lost:              "Perdu",
};

type Props = {
  entries: TeamLoadEntry[];
};

export function DashboardTeamLoad({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-6 text-center text-[13px] text-[#9aa7b0]">
        Aucun dossier actif en équipe
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-[#e4e8eb] bg-white">
      <div className="border-b border-[#e4e8eb] px-4 py-3">
        <p className="text-[13px] font-semibold text-[#0e1a21]">Charge équipe</p>
        <p className="mt-0.5 text-[11px] text-[#6b7a85]">Dossiers actifs par opérateur</p>
      </div>
      <div className="divide-y divide-[#f0f2f4] p-2">
        {entries.map((entry) => {
          const total = entry.totalActive;
          return (
            <Link
              key={entry.referentId}
              href={`/leads?referent=${entry.referentId}`}
              className="flex items-center gap-3 rounded-[6px] px-2 py-3 transition-colors hover:bg-[#f6f7f8]"
            >
              {entry.avatarUrl ? (
                <img
                  src={entry.avatarUrl}
                  alt={entry.fullName}
                  className="size-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <Avatar name={entry.fullName} size={34} />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold text-[#0e1a21]">{entry.fullName}</p>
                  <span className="shrink-0 font-mono text-[12px] font-semibold text-[#0e1a21]">
                    {total} lead{total !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Colored bar segments */}
                {total > 0 && (
                  <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-[#f0f2f4]">
                    {ACTIVE_STATUSES.map((status) => {
                      const count = entry.byStatus[status] ?? 0;
                      if (count === 0) return null;
                      return (
                        <div
                          key={status}
                          style={{
                            width: `${(count / total) * 100}%`,
                            background: STATUS_COLORS[status],
                          }}
                          title={`${STATUS_LABELS[status]}: ${count}`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Status counters */}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {ACTIVE_STATUSES.map((status) => {
                    const count = entry.byStatus[status] ?? 0;
                    if (count === 0) return null;
                    return (
                      <span key={status} className="flex items-center gap-1 text-[11px] text-[#6b7a85]">
                        <span
                          className="inline-block size-1.5 rounded-full"
                          style={{ background: STATUS_COLORS[status] }}
                          aria-hidden
                        />
                        {STATUS_LABELS[status]}&nbsp;{count}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
