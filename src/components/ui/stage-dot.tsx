import type { LeadStatus } from "@/lib/mock-leads";

const statusColors: Record<LeadStatus, string> = {
  new:                "bg-[#6b7a85]",
  qualification:      "bg-[#1e5a8a]",
  agency_assignment:  "bg-[#b68d3d]",
  co_construction:    "bg-[#a8710b]",
  quote:              "bg-[#15323f]",
  negotiation:        "bg-[#a8710b]",
  won:                "bg-[#0f6b4b]",
  lost:               "bg-[#c1411f]",
};

type StageDotProps = {
  status: LeadStatus;
  className?: string;
};

export function StageDot({ status, className = "" }: StageDotProps) {
  return (
    <span
      className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${statusColors[status]} ${className}`}
      aria-hidden
    />
  );
}
