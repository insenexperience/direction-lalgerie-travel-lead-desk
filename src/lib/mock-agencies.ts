export type PartnerAgencyType = "dmc" | "travel_agency" | "tour_operator" | "other";

export type PartnerAgencyStatus = "active" | "pending_validation" | "suspended";

export type PartnerAgency = {
  id: string;
  legalName: string;
  tradeName?: string;
  type: PartnerAgencyType;
  country: string;
  city: string;
  website?: string;
  contactName: string;
  email: string;
  phone: string;
  destinations: string;
  languages: string;
  segments: string;
  slaQuoteDays: number;
  status: PartnerAgencyStatus;
  internalNotes?: string;
  createdAt: string;
};

/** Payload création agence (formulaire / action serveur). */
export type CreatePartnerAgencyInput = {
  legalName: string;
  tradeName?: string;
  type: PartnerAgencyType;
  country: string;
  city: string;
  website?: string;
  contactName: string;
  email: string;
  phone: string;
  destinations: string;
  languages: string;
  segments: string;
  slaQuoteDays: number;
  status: PartnerAgencyStatus;
  internalNotes?: string;
};

export const partnerAgencyTypeLabelFr: Record<PartnerAgencyType, string> = {
  dmc: "DMC / réceptif",
  travel_agency: "Agence de voyages",
  tour_operator: "Tour-opérateur",
  other: "Autre",
};

export const partnerAgencyStatusLabelFr: Record<PartnerAgencyStatus, string> = {
  active: "Active",
  pending_validation: "En validation",
  suspended: "Suspendue",
};

export const seedPartnerAgencies: PartnerAgency[] = [];
