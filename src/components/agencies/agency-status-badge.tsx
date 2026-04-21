import type { PartnerAgencyStatus } from "@/lib/mock-agencies";

const STATUS_CONFIG: Record<PartnerAgencyStatus, { dot: string; bg: string; border: string; text: string; label: string }> = {
  active: {
    dot:    "bg-[var(--status-active)]",
    bg:     "bg-[var(--revenue-bg)]",
    border: "border-[var(--revenue-border)]",
    text:   "text-[var(--revenue)]",
    label:  "Actif",
  },
  pending_validation: {
    dot:    "bg-[var(--status-pending)]",
    bg:     "bg-[var(--warn-bg)]",
    border: "border-[var(--warn-border)]",
    text:   "text-[var(--warn)]",
    label:  "En validation",
  },
  suspended: {
    dot:    "bg-[var(--status-suspended)]",
    bg:     "bg-[var(--panel-muted)]",
    border: "border-[var(--border)]",
    text:   "text-[var(--ink-3)]",
    label:  "Suspendu",
  },
};

interface AgencyStatusBadgeProps {
  status: PartnerAgencyStatus;
}

export function AgencyStatusBadge({ status }: AgencyStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span className={`h-[5px] w-[5px] rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}
