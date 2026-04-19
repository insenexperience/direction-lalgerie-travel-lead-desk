import type {
  CrmCommercialPriority,
  CrmConversionBand,
  CrmFeasibilityBand,
  CrmFollowUpStrategy,
  CrmPrimaryObjection,
} from "@/lib/crm-fields";
import type { LeadStatus } from "@/lib/mock-leads";

/** Ligne `leads` telle qu’affichée / éditée sur la fiche Supabase. */
export type SupabaseLeadRow = {
  id: string;
  referent_id: string | null;
  /** Agence partenaire retenue pour traiter le dossier (étape Assignation). */
  retained_agency_id: string | null;
  traveler_name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  trip_summary: string;
  travel_style: string;
  travelers: string;
  budget: string;
  trip_dates: string;
  qualification_summary: string;
  internal_notes: string;
  quote_status: string;
  source: string;
  priority: "normal" | "high";
  updated_at: string;
  crm_commercial_priority: CrmCommercialPriority;
  crm_conversion_band: CrmConversionBand;
  crm_feasibility_band: CrmFeasibilityBand;
  crm_follow_up_strategy: CrmFollowUpStrategy;
  crm_primary_objection: CrmPrimaryObjection;
};
