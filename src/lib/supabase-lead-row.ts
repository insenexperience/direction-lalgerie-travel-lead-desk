import type { CrmConversionBand, CrmFollowUpStrategy } from "@/lib/crm-fields";
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
  crm_conversion_band: CrmConversionBand;
  crm_follow_up_strategy: CrmFollowUpStrategy;
  intake_channel: string | null;
  whatsapp_phone_number: string | null;
  whatsapp_thread_id: string | null;
  conversation_transcript: unknown;
  ai_qualification_payload: unknown;
  ai_qualification_confidence: number | null;
  scoring_weights: unknown;
  qualification_validated_at: string | null;
  qualification_validated_by: string | null;
  qualification_validation_status: string;
  manual_takeover: boolean;
};
