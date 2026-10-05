import { buildLeadInsertFromIntake } from "@/lib/intake-lead-insert";
import { analyzeLeadQualification } from "@/lib/lead-qualification-completeness";

/** Empty strings mean unknown, including counts. Never turn the DB defaults into evidence. */
export type ManualLeadDraft = {
  full_name: string; email: string; phone: string; project_title: string;
  language: "fr" | "en";
  planning_stage: string; group_type: string; travellers_count: string;
  travelers_adults: string; travelers_children: string; children_ages: string;
  date_start: string; date_end: string; flex_period: string; flex_duration: string;
  hebergements: string; vision: string; destination_main: string;
  budget_ideal: string; budget_max: string; budget_unit: string; currency: string;
  budget_includes_flights: string;
  flights: string; departure_airport: string; rooms: string;
  arrival_details: string; departure_details: string; constraints: string;
  notes_longues: string;
};

export const MANUAL_LEAD_FIELDS = [
  "full_name", "email", "phone", "project_title", "language", "planning_stage", "group_type",
  "travellers_count", "travelers_adults", "travelers_children", "children_ages",
  "date_start", "date_end", "flex_period", "flex_duration", "hebergements", "vision",
  "destination_main", "budget_ideal", "budget_max", "budget_unit", "currency", "budget_includes_flights",
  "flights", "departure_airport", "rooms", "arrival_details", "departure_details",
  "constraints", "notes_longues",
] as const;

function safeIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}

export function normalizeManualLeadDraft(raw: unknown): ManualLeadDraft {
  const object = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const draft = Object.fromEntries(MANUAL_LEAD_FIELDS.map(key => [key,
    typeof object[key] === "string" ? object[key].trim() : typeof object[key] === "number" ? String(object[key]) : "",
  ])) as ManualLeadDraft;
  for (const key of ["travellers_count", "travelers_adults", "travelers_children"] as const) {
    if (!/^\d+$/.test(draft[key]) || Number(draft[key]) > 500) draft[key] = "";
  }
  for (const key of ["budget_ideal", "budget_max"] as const) {
    const normalized = draft[key].replace(/\s/g, "").replace(",", ".");
    draft[key] = /^\d+(\.\d+)?$/.test(normalized) && Number(normalized) > 0 ? normalized : "";
  }
  draft.date_start = safeIsoDate(draft.date_start);
  draft.date_end = safeIsoDate(draft.date_end);
  if (!["ideas", "planning", "ready"].includes(draft.planning_stage)) draft.planning_stage = "";
  if (!["included", "excluded", "booked"].includes(draft.flights)) draft.flights = "";
  if (!["per_person", "total"].includes(draft.budget_unit)) draft.budget_unit = "";
  if (!["EUR", "USD", "DZD", "GBP"].includes(draft.currency)) draft.currency = "";
  if (!["yes", "no"].includes(draft.budget_includes_flights)) draft.budget_includes_flights = "";
  draft.language = draft.language === "en" ? "en" : "fr";
  return draft;
}

/** Budget scope is distinct from wanting an agency to arrange flights. */
function explicitBudgetFlightScope(source: string): "yes" | "no" | "" {
  let included = false, excluded = false;
  for (const original of source.split(/\r?\n/)) {
    const line = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!/\bbudget\b/.test(line) || /\?|a confirmer|to be confirmed|uncertain/.test(line)) continue;
    excluded ||= /(?:hors|sans)\s+(?:les\s+)?vols?|vols?\s+(?:exclus|non inclus)|(?:excluding|exclude|without)\s+(?:international\s+)?flights|flights\s+excluded|not\s+including\s+flights/.test(line);
    const withoutNegativeInclusion = line.replace(/not\s+including\s+flights/g, "");
    included ||= /vols?\s+(?:internationaux\s+)?inclus|(?:including|include)\s+(?:international\s+)?flights|flights\s+included/.test(withoutNegativeInclusion);
  }
  return included === excluded ? "" : included ? "yes" : "no";
}

/** Conservative fallback when AI is unavailable. Only explicit labelled facts are extracted. */
export function extractManualLeadFallback(source: string): ManualLeadDraft {
  function label(names: string): string {
    return source.match(new RegExp(`^(?:${names})\\s*:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
  }
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const solo = /\bsolo foot travel\b|\bvoyage(?:urs)?\s*:\s*(?:seul|solo)|\bvoyage seul\b/i.test(source);
  return normalizeManualLeadDraft({
    // Use the message's wording, never the traveler's nationality.
    language: /\b(?:expedition leader|proposed dates|preferred regions|dear team|kind regards|I (?:would|am|want|plan|hope|wish)|could you|would you)\b/i.test(source) ? "en" : "fr",
    full_name: label("Expedition leader|Nom complet|Prénom|Name|Full name"),
    email, phone: label("Téléphone|Telephone|Phone"),
    project_title: source.split(/\r?\n/).find(line => line.trim())?.trim() ?? "",
    group_type: solo ? "Solo" : label("Voyageurs|Type de groupe"),
    travellers_count: solo ? "1" : label("Nombre de voyageurs|Participants"),
    travelers_adults: solo ? "1" : label("Adultes"), travelers_children: solo ? "0" : label("Enfants"),
    flex_period: label("Proposed dates|Période|Mois"), flex_duration: label("Durée|Duration"),
    destination_main: label("Preferred regions|Destinations|Destination"),
    vision: label("Activity|Vision du voyage"),
    budget_includes_flights: explicitBudgetFlightScope(source),
    notes_longues: source.replace(/\r\n/g, "\n").trim(),
  });
}

function manualQualificationFacts(draft: ManualLeadDraft) {
  return {
    flight_mode: draft.flights, departure_city: draft.departure_airport,
    travelers_adults: draft.travelers_adults === "" ? null : Number(draft.travelers_adults),
    travelers_children: draft.travelers_children === "" ? null : Number(draft.travelers_children),
    children_ages: draft.children_ages, room_distribution: draft.rooms,
    arrival_details: draft.arrival_details, departure_details: draft.departure_details,
    constraints: draft.constraints, accommodation: draft.hebergements, duration: draft.flex_duration,
    budget_min: draft.budget_ideal === "" ? null : Number(draft.budget_ideal),
    budget_max: draft.budget_max === "" ? null : Number(draft.budget_max),
    budget_unit: draft.budget_unit, currency: draft.currency,
    budget_includes_flights: draft.budget_includes_flights === "yes" ? true : draft.budget_includes_flights === "no" ? false : null,
  };
}

export function manualLeadUnknownFields(draft: ManualLeadDraft): string[] {
  return analyzeLeadQualification({
    travelers: draft.group_type, trip_dates: draft.flex_period,
    travel_start_date: draft.date_start, travel_end_date: draft.date_end,
    destination_main: draft.destination_main, travel_style: draft.vision,
    project_description: draft.notes_longues,
    intake_payload: { ...draft, import_mode: "manual_message", qualification_facts: manualQualificationFacts(draft) },
  }).questions.map(question => question.label);
}

export function formatManualLeadNotes(draft: ManualLeadDraft): string {
  // The transcript is durable source material. Missing information is recalculated
  // by the shared engine, so yesterday's questions never become agency facts.
  return draft.notes_longues.trim();
}

export function buildManualLeadInsert(
  draftValue: unknown,
  sourceMessage: string,
  options: { submissionId: string; channel: "manual" | "email" | "whatsapp"; priority?: "normal" | "high" },
) {
  const draft = normalizeManualLeadDraft(draftValue);
  const formatted = formatManualLeadNotes(draft);
  const unknownFields = manualLeadUnknownFields(draft);
  const intake = {
    ...draft, dates_mode: draft.date_start || draft.date_end ? "Dates précises" : "Dates flexibles",
    flex_month: draft.flex_period, project_notes_short: draft.project_title,
    notes_longues: formatted, submission_id: options.submissionId,
    submitted_at: new Date().toISOString(), source_message: sourceMessage,
    import_mode: "manual_message", manual_qualification: draft, unknown_fields: unknownFields,
    qualification_facts: manualQualificationFacts(draft),
  };
  const base = buildLeadInsertFromIntake(intake, { sourceFallback: `Import manuel — ${options.channel}`, priority: options.priority });
  const budgetValues = [draft.budget_ideal, draft.budget_max].filter(Boolean).join("–");
  return {
    ...base, intake_channel: options.channel, channel: options.channel,
    trip_summary: draft.project_title || `Projet de voyage — ${draft.full_name}`,
    project_description: formatted,
    destination_main: draft.destination_main || null,
    travel_desire_narrative: draft.vision || null,
    qualification_notes: unknownFields.map(item => `À clarifier : ${item}`).join("\n") || null,
    qualification_summary: [draft.group_type, draft.destination_main, draft.flex_period, draft.hebergements].filter(Boolean).join("\n") || "—",
    planning_stage: draft.planning_stage || null,
    travel_period: draft.flex_period || null,
    travel_start_date: draft.date_start || null,
    travel_end_date: draft.date_end || null,
    // Unknown counts must not inherit the legacy 1-adult/0-child defaults as facts.
    travelers_adults: draft.travelers_adults ? Number(draft.travelers_adults) : 0,
    travelers_children: draft.travelers_children ? Number(draft.travelers_children) : 0,
    // The legacy financial columns are EUR-only. Preserve other currencies in facts,
    // without silently converting them at an invented exchange rate.
    budget_min: draft.currency === "EUR" && draft.budget_ideal ? Number(draft.budget_ideal) : null,
    budget_max: draft.currency === "EUR" && draft.budget_max ? Number(draft.budget_max) : null,
    budget_unit: draft.budget_unit || null,
    currency: "EUR",
    budget: budgetValues ? `${budgetValues} ${draft.currency || "devise à confirmer"} ${draft.budget_unit === "per_person" ? "/ pers." : draft.budget_unit === "total" ? "au total" : "(unité à confirmer)"}` : "—",
  };
}
