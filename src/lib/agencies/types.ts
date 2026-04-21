import type { PartnerAgencyType, PartnerAgencyStatus } from "@/lib/mock-agencies";

export type { PartnerAgencyType as AgencyType, PartnerAgencyStatus as AgencyStatus };

export type PreferredChannel = "email" | "whatsapp" | "phone";

export interface AgencyContact {
  id: string;
  agency_id: string;
  is_primary: boolean;
  full_name: string;
  role: string | null;
  email: string;
  phone: string;
  whatsapp: string | null;
  preferred_channel: PreferredChannel | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyContactInput {
  full_name: string;
  role?: string | null;
  email?: string;
  phone?: string;
  whatsapp?: string | null;
  preferred_channel?: PreferredChannel | null;
  notes?: string | null;
  is_primary?: boolean;
}

export interface AgencyMetrics {
  leadsActive: number;
  leadsWon: number;
  consultationsTotal: number;
  consultationsAccepted: number;
  acceptanceRate: number;
  revenueWon: number;
}

export interface AgencyLeadLink {
  lead_id: string;
  reference: string;
  traveler_name: string;
  status: string;
  budget_parsed: number | null;
  created_at: string;
  link_kind: "retained" | "consultation";
}

export interface AgencyListItem {
  id: string;
  legal_name: string;
  trade_name: string | null;
  type: PartnerAgencyType;
  status: PartnerAgencyStatus;
  country: string;
  city: string;
  website: string | null;
  destinations: string;
  languages: string;
  segments: string;
  sla_quote_days: number;
  internal_notes: string | null;
  logo_storage_path: string | null;
  logo_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  metrics: AgencyMetrics;
  created_at: string;
  updated_at: string;
}

export interface AgencyDetail extends AgencyListItem {
  ai_capabilities_summary: string | null;
  circuits_data: unknown[];
  logo_updated_at: string | null;
  contacts: AgencyContact[];
  activeLeads: AgencyLeadLink[];
}

export interface AgencyCreateInput {
  legal_name: string;
  trade_name?: string | null;
  type: PartnerAgencyType;
  status?: PartnerAgencyStatus;
  country: string;
  city: string;
  website?: string | null;
  destinations?: string;
  languages?: string;
  segments?: string;
  sla_quote_days?: number;
  internal_notes?: string | null;
  contact_name?: string;
  email?: string;
  phone?: string;
}

export interface AgencyUpdateInput {
  legal_name?: string;
  trade_name?: string | null;
  type?: PartnerAgencyType;
  country?: string;
  city?: string;
  website?: string | null;
  destinations?: string;
  languages?: string;
  segments?: string;
  sla_quote_days?: number;
  internal_notes?: string | null;
  ai_capabilities_summary?: string | null;
}
