import type { MockLead } from "@/lib/mock-leads";

export type LeadsQueueFilter = "all" | "unassigned" | "mine";

export function parseLeadsQueueFilter(value: string | null): LeadsQueueFilter {
  if (value === "unassigned" || value === "mine") return value;
  return "all";
}

/** Filtre « file » : tous les leads, seulement sans référent, ou seulement assignés à moi. */
export function filterLeadsByQueue(
  leads: MockLead[],
  queue: LeadsQueueFilter,
  currentUserId: string | null,
): MockLead[] {
  if (queue === "unassigned") {
    return leads.filter((l) => !l.referentId);
  }
  if (queue === "mine") {
    if (!currentUserId) return [];
    return leads.filter((l) => l.referentId === currentUserId);
  }
  return leads;
}
