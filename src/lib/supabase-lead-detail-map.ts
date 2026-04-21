import { parseCrmConversionBand, parseCrmFollowUpStrategy } from "@/lib/crm-fields";
import { normalizeLeadStatusForUi } from "@/lib/lead-status-coerce";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { safeQualificationBlocks, EMPTY_QUALIFICATION_BLOCKS } from "@/lib/qualification-blocks";

export const LEAD_SELECT_V2 = [
  "id",
  "referent_id",
  "retained_agency_id",
  "traveler_name",
  "email",
  "phone",
  "status",
  "trip_summary",
  "travel_style",
  "travelers",
  "budget",
  "trip_dates",
  "qualification_summary",
  "internal_notes",
  "quote_status",
  "source",
  "priority",
  "updated_at",
  "crm_conversion_band",
  "crm_follow_up_strategy",
  "intake_channel",
  "whatsapp_phone_number",
  "whatsapp_thread_id",
  "conversation_transcript",
  "ai_qualification_payload",
  "ai_qualification_confidence",
  "scoring_weights",
  "qualification_validated_at",
  "qualification_validated_by",
  "qualification_validation_status",
  "manual_takeover",
  "submission_id",
  "workflow_launched_at",
  "workflow_launched_by",
  "workflow_mode",
  "workflow_run_ref",
  "reference",
  "lead_score",
  "lead_score_override",
  "lead_score_computed_at",
  "referent_assigned_at",
  "created_at",
  "travel_desire_narrative",
  "destination_main",
  "qualification_notes",
  "qualification_blocks",
].join(", ");

export const LEAD_SELECT_LEGACY = [
  "id",
  "referent_id",
  "retained_agency_id",
  "traveler_name",
  "email",
  "phone",
  "status",
  "trip_summary",
  "travel_style",
  "travelers",
  "budget",
  "trip_dates",
  "qualification_summary",
  "internal_notes",
  "quote_status",
  "source",
  "priority",
  "updated_at",
  "crm_conversion_band",
  "crm_follow_up_strategy",
  "submission_id",
  "created_at",
].join(", ");

export function mapRowToSupabaseLeadRow(
  row: Record<string, unknown>,
  schemaV2: boolean,
): SupabaseLeadRow {
  const priority: "high" | "normal" = row.priority === "high" ? "high" : "normal";

  const base = {
    id: String(row.id),
    referent_id: row.referent_id ? String(row.referent_id) : null,
    retained_agency_id: row.retained_agency_id ? String(row.retained_agency_id) : null,
    traveler_name: String(row.traveler_name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    status: normalizeLeadStatusForUi(String(row.status ?? "new")),
    trip_summary: String(row.trip_summary ?? ""),
    travel_style: String(row.travel_style ?? ""),
    travelers: String(row.travelers ?? ""),
    budget: String(row.budget ?? ""),
    trip_dates: String(row.trip_dates ?? ""),
    qualification_summary: String(row.qualification_summary ?? ""),
    internal_notes: String(row.internal_notes ?? ""),
    quote_status: String(row.quote_status ?? ""),
    source: String(row.source ?? ""),
    priority,
    updated_at: String(row.updated_at ?? ""),
    created_at: String(row.created_at ?? row.updated_at ?? ""),
    crm_conversion_band:
      parseCrmConversionBand(String(row.crm_conversion_band ?? "")) ?? "medium",
    crm_follow_up_strategy:
      parseCrmFollowUpStrategy(String(row.crm_follow_up_strategy ?? "")) ?? "none",
  };

  if (!schemaV2) {
    const hasSubmission =
      row.submission_id != null && String(row.submission_id).trim() !== "";
    const sid =
      row.submission_id != null && String(row.submission_id).trim() !== ""
        ? String(row.submission_id).trim()
        : null;
    return {
      ...base,
      intake_channel: hasSubmission ? "web_form" : "manual",
      whatsapp_phone_number: null,
      whatsapp_thread_id: null,
      conversation_transcript: [],
      ai_qualification_payload: null,
      ai_qualification_confidence: null,
      scoring_weights: null,
      qualification_validated_at: null,
      qualification_validated_by: null,
      qualification_validation_status: "pending",
      manual_takeover: false,
      submission_id: sid,
      workflow_launched_at: null,
      workflow_launched_by: null,
      workflow_mode: null,
      workflow_run_ref: null,
      reference: null,
      lead_score: null,
      lead_score_override: null,
      lead_score_computed_at: null,
      referent_assigned_at: null,
      travel_desire_narrative: null,
      destination_main: null,
      qualification_notes: null,
      qualification_blocks: { ...EMPTY_QUALIFICATION_BLOCKS },
    };
  }

  return {
    ...base,
    intake_channel: row.intake_channel != null ? String(row.intake_channel) : null,
    whatsapp_phone_number: row.whatsapp_phone_number != null
      ? String(row.whatsapp_phone_number)
      : null,
    whatsapp_thread_id:
      row.whatsapp_thread_id != null ? String(row.whatsapp_thread_id) : null,
    conversation_transcript: row.conversation_transcript ?? [],
    ai_qualification_payload: row.ai_qualification_payload ?? null,
    ai_qualification_confidence:
      row.ai_qualification_confidence != null &&
      Number.isFinite(Number(row.ai_qualification_confidence))
        ? Number(row.ai_qualification_confidence)
        : null,
    scoring_weights: row.scoring_weights ?? null,
    qualification_validated_at: row.qualification_validated_at
      ? String(row.qualification_validated_at)
      : null,
    qualification_validated_by: row.qualification_validated_by
      ? String(row.qualification_validated_by)
      : null,
    qualification_validation_status: String(
      row.qualification_validation_status ?? "pending",
    ),
    manual_takeover: Boolean(row.manual_takeover),
    submission_id:
      row.submission_id != null && String(row.submission_id).trim() !== ""
        ? String(row.submission_id).trim()
        : null,
    workflow_launched_at: row.workflow_launched_at
      ? String(row.workflow_launched_at)
      : null,
    workflow_launched_by: row.workflow_launched_by
      ? String(row.workflow_launched_by)
      : null,
    workflow_mode:
      row.workflow_mode === "ai" || row.workflow_mode === "manual"
        ? row.workflow_mode
        : null,
    workflow_run_ref:
      row.workflow_run_ref != null && String(row.workflow_run_ref).trim() !== ""
        ? String(row.workflow_run_ref).trim()
        : null,
    reference: row.reference != null ? String(row.reference).trim() || null : null,
    lead_score:
      row.lead_score != null && Number.isFinite(Number(row.lead_score))
        ? Math.round(Number(row.lead_score))
        : null,
    lead_score_override:
      row.lead_score_override != null &&
      Number.isFinite(Number(row.lead_score_override))
        ? Math.round(Number(row.lead_score_override))
        : null,
    lead_score_computed_at: row.lead_score_computed_at
      ? String(row.lead_score_computed_at)
      : null,
    referent_assigned_at: row.referent_assigned_at
      ? String(row.referent_assigned_at)
      : null,
    travel_desire_narrative: row.travel_desire_narrative != null
      ? String(row.travel_desire_narrative)
      : null,
    destination_main: row.destination_main != null
      ? String(row.destination_main)
      : null,
    qualification_notes: row.qualification_notes != null
      ? String(row.qualification_notes)
      : null,
    qualification_blocks: safeQualificationBlocks(row.qualification_blocks),
  };
}
