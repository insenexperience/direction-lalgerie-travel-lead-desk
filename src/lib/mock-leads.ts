export type LeadStatus =
  | "new"
  | "qualification"
  | "agency_assignment"
  | "co_construction"
  | "quote"
  | "negotiation"
  | "won"
  | "lost";

export type LeadTimelineItem = {
  id: string;
  label: string;
  detail: string;
  date: string;
};

/** Agency consultation on a lead (multi-agency workflow). */
export type AgencyConsultationStatus =
  | "invited"
  | "pending"
  | "quote_received"
  | "declined"
  | "reminded"
  | "expired";

export type LeadAgencyLink = {
  id: string;
  agencyId: string;
  /** Display name for search (decoupled from catalog). */
  agencyName: string;
  status: AgencyConsultationStatus;
  quoteSummary?: string;
};

export const agencyConsultationLabelFr: Record<AgencyConsultationStatus, string> = {
  invited: "Invitee",
  pending: "En attente",
  quote_received: "Devis recu",
  declined: "Refus",
  reminded: "Relancee",
  expired: "Expiree",
};

export type MockLead = {
  id: string;
  travelerName: string;
  email: string;
  phone: string;
  status: LeadStatus;
  source: string;
  tripSummary: string;
  travelStyle: string;
  travelers: string;
  budget: string;
  dates: string;
  qualificationSummary: string;
  internalNotes: string;
  assignedAgency: string;
  quoteStatus: string;
  timeline: LeadTimelineItem[];
  /** Starred in table */
  starred?: boolean;
  /** High priority flag */
  priority?: "normal" | "high";
  /** Agency consultations */
  agencyLinks?: LeadAgencyLink[];
  /** Retained partner agency id */
  retainedAgencyId?: string | null;
  /** Referent (public.profiles.id); null = not assigned yet */
  referentId?: string | null;
};

export const LEAD_PIPELINE: LeadStatus[] = [
  "new",
  "qualification",
  "agency_assignment",
  "co_construction",
  "quote",
  "negotiation",
  "won",
  "lost",
];

export const leadStatusLabelFr: Record<LeadStatus, string> = {
  new: "Nouveau",
  qualification: "Qualification & affinage",
  agency_assignment: "Assignation",
  co_construction: "Co-construction",
  quote: "Devis",
  negotiation: "N\u00e9gociation",
  won: "Gagn\u00e9",
  lost: "Perdu",
};

export const leadStatuses: Array<{ value: LeadStatus | "all"; label: string }> = [
  { value: "all", label: "Tous" },
  ...LEAD_PIPELINE.map((value) => ({
    value,
    label: leadStatusLabelFr[value],
  })),
];

export const mockLeads: MockLead[] = [];

export function getLeadById(id: string) {
  return mockLeads.find((lead) => lead.id === id);
}
