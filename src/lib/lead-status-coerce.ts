import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE } from "@/lib/mock-leads";

/** Ancienne étape « affinage » fusionnée avec la qualification. */
export function normalizeLeadStatusForUi(raw: string): LeadStatus {
  if (raw === "refinement") return "qualification";
  return LEAD_PIPELINE.includes(raw as LeadStatus) ? (raw as LeadStatus) : "new";
}

export function coerceLeadStatus(value: string): LeadStatus {
  return normalizeLeadStatusForUi(value);
}
