import type { MockLead } from "@/lib/mock-leads";

export type LeadsQueueFilter =
  | "all"
  | "unassigned"
  | "mine"
  | "pending_validation"
  | "whatsapp";

export function parseLeadsQueueFilter(value: string | null): LeadsQueueFilter {
  if (
    value === "unassigned" ||
    value === "mine" ||
    value === "pending_validation" ||
    value === "whatsapp"
  ) {
    return value;
  }
  return "all";
}

/** Filtre « file » : tous, sans référent, mes dossiers, validation IA en attente, entrée WhatsApp. */
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
  if (queue === "pending_validation") {
    return leads.filter((l) => l.qualificationPending === true);
  }
  if (queue === "whatsapp") {
    return leads.filter((l) => String(l.intakeChannel ?? "") === "whatsapp");
  }
  return leads;
}
