import type { CrmConversionBand, CrmFollowUpStrategy } from "@/lib/crm-fields";
import type { LeadStatus } from "@/lib/mock-leads";
import type { QualificationBlocks } from "@/lib/qualification-blocks";

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
  created_at: string;
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
  submission_id: string | null;
  workflow_launched_at: string | null;
  workflow_launched_by: string | null;
  workflow_mode: "ai" | "manual" | null;
  /** Référence de la session workflow active (ex. WF-xxxxxxxx). */
  workflow_run_ref: string | null;
  /** Référence cockpit `DA-YYYY-NNNN` (nullable avant backfill / allocation). */
  reference: string | null;
  lead_score: number | null;
  lead_score_override: number | null;
  lead_score_computed_at: string | null;
  referent_assigned_at: string | null;
  // Qualification v2
  travel_desire_narrative: string | null;
  destination_main: string | null;
  qualification_notes: string | null;
  // Qualification Workspace v2 — blocs thématiques structurés
  qualification_blocks: QualificationBlocks;
  // MVP v5 — canal préféré (rempli à la première réponse du voyageur)
  preferred_channel: "whatsapp" | "email" | null;
  preferred_channel_detected_at: string | null;
  // MVP v5 — email de bienvenue
  welcome_email_sent_at: string | null;
  welcome_email_template_used: string | null;
  // MVP v5 — brief agence
  generated_brief: string | null;
  brief_generated_at: string | null;
  brief_edited_at: string | null;
  // PRD Refonte v1 — champs financiers structurés
  budget_min: number | null;
  budget_max: number | null;
  budget_unit: "per_person" | "total" | null;
  travelers_adults: number;
  travelers_children: number;
  currency: string;
  travel_period: string | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  project_description: string | null;
  // PRD Refonte v1 — lien Contact + cycle de vie
  contact_id: string | null;
  closed_at: string | null;
  deleted_at: string | null;
  channel: string | null;
  // Maturité du projet (form site étape 1)
  planning_stage: "ideas" | "planning" | "ready" | null;
};
