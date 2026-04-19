import {
  Building2,
  CheckCircle2,
  FileText,
  Inbox,
  ListChecks,
  Handshake,
  Users,
  XCircle,
} from "lucide-react";
import type { LeadStatus } from "@/lib/mock-leads";
import { leadStatusLabelFr } from "@/lib/mock-leads";

const statusMap: Record<
  LeadStatus,
  { className: string; Icon: typeof Inbox }
> = {
  new: {
    className: "border-[#d7dee5] bg-[#f7fafc] text-[#1c2b32]",
    Icon: Inbox,
  },
  qualification: {
    className: "border-[#cfd8e0] bg-[#eef2f6] text-[#223842]",
    Icon: ListChecks,
  },
  agency_assignment: {
    className: "border-[#b8c6d2] bg-[#dfe8ef] text-[#152a35]",
    Icon: Building2,
  },
  co_construction: {
    className: "border-[#a8bac9] bg-[#d4e0ea] text-[#0f1c24]",
    Icon: Users,
  },
  quote: {
    className: "border-[#d7dee5] bg-[#f0f4f8] text-[#1a3040]",
    Icon: FileText,
  },
  negotiation: {
    className: "border-[#dce3e9] bg-[#eceff2] text-[#3d4f5c]",
    Icon: Handshake,
  },
  won: {
    className: "border-[#b8dcc8] bg-[#e5f3ef] text-[#1f5c4a]",
    Icon: CheckCircle2,
  },
  lost: {
    className: "border-[#d4d8dc] bg-[#eef0f2] text-[#5c6570]",
    Icon: XCircle,
  },
};

type LeadStatusBadgeProps = {
  status: LeadStatus;
};

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const config = statusMap[status];
  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-none border px-2 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
      {leadStatusLabelFr[status]}
    </span>
  );
}
