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

function messageParagraphs(source: string): string[] {
  return source.replace(/\r\n/g, "\n").trim().split(/\n+/)
    .flatMap(line => line.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u)).map(line => line.trim()).filter(Boolean);
}

/** Natural-language fallback remains deliberately narrow: ambiguity never becomes a fact. */
function explicitNaturalFacts(source: string): Partial<ManualLeadDraft> {
  const paragraphs = messageParagraphs(source);
  const confirmed = paragraphs.filter(line => !/\?|peut-être|peut etre|éventuellement|non confirmé|a priori|\b(?:environ|probablement|envisageons|envisage|maybe|perhaps|approximately|pas|not)\b|à confirmer|a confirmer|sous réserve|\bsi\b|\bou\b|\bor\b|\bentre\s+\d|\b\d+\s*(?:à|a|[-–]|to)\s*\d+/iu.test(line));
  const unique = (values: string[]) => {
    const distinct = [...new Set(values.filter(Boolean))];
    return distinct.length === 1 ? distinct[0] : "";
  };
  const count = (word: string) => unique(confirmed.flatMap(line => {
    if (/\b(?:pas|not|budget)\b/iu.test(line)) return [];
    return [...line.matchAll(new RegExp(`\\b(\\d{1,3})\\s+${word}\\b`, "giu"))].map(match => match[1]);
  }));
  const adults = count("adultes?");
  const children = count("enfants?");
  const name = confirmed.map(line => line.match(/\b(?:je m['’]appelle|mon nom est)\s+([\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){0,5})(?=\s*(?:[.(,!]|$))/u)?.[1]
    ?? line.match(/\bje suis\s+([\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*){1,5})(?=\s*(?:[.(,!]|$))/u)?.[1] ?? "");
  const roomLines = confirmed.filter(line => !/\b(?:pas|not)\b/iu.test(line));
  const rooms = roomLines.flatMap(line => [...line.matchAll(/\b\d{1,2}\s+(?:chambres?(?:\s+(?:singles?|doubles?|twins?|triples?|familiales?))?|singles?|doubles?|twins?)\b/giu)].map(match => match[0]));
  const roomGroups = new Map<string, { amounts: Set<string>; wording: string }>();
  for (const wording of rooms) {
    const type = wording.match(/single|double|twin|triple|familial/iu)?.[0]?.toLowerCase() ?? "unspecified";
    const amount = wording.match(/^\d+/)?.[0] ?? "";
    const group = roomGroups.get(type) ?? { amounts: new Set<string>(), wording };
    group.amounts.add(amount); roomGroups.set(type, group);
  }
  const roomDistribution = [...roomGroups.values()].some(group => group.amounts.size > 1) ? "" : [...roomGroups.values()].map(group => group.wording).join(", ");
  const ages = unique(confirmed.flatMap(line => {
    const match = line.match(/\benfants?(?:\s+âgés?)?\s+(?:de\s+)?((?:\d{1,2}\s*(?:ans)?\s*(?:(?:,|et)\s*)?)+)\s*ans\b/iu);
    if (!match) return [];
    if (/\d,\d/.test(match[1])) return []; // Decimal age vs comma list is ambiguous.
    const values = match[1].match(/\d+/g) ?? [];
    return children && values.length !== Number(children) ? [] : [values.join(", ")];
  }));
  const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const dateRanges = confirmed.flatMap(line => [...line.matchAll(new RegExp(`\\bdu\\s+(\\d{1,2})\\s+au\\s+(\\d{1,2})\\s+(${monthNames.join("|")})(?:\\s+(\\d{4}))?\\b`, "giu"))]);
  const periods = unique(dateRanges.map(match => match[0]));
  const exact = dateRanges.length === 1 && dateRanges[0][4] ? dateRanges[0] : null;
  const month = exact ? String(monthNames.indexOf(exact[3].toLowerCase()) + 1).padStart(2, "0") : "";
  const budgetLines = confirmed.filter(line => /\bbudget\b/iu.test(line));
  const amounts = budgetLines.flatMap(line => {
    const tail = line.slice(line.search(/\bbudget\b/iu));
    if (/\b(?:millions?|mille|k)\b/iu.test(tail)) return [];
    const match = tail.match(/^budget(?:\s+(?:idéal|maximum|max|global|total))?(?:\s+(?:est|de|prévu|sera))?\s*[:=]?\s*(?:(EUR|USD|GBP|DZD)\s*)?(\d[\d \u00a0]*(?:[,.]\d{1,2})?)(?![\d,.])\s*(€|euros?|EUR|USD|GBP|DZD|£)?/iu);
    if (!match) return [];
    return [{ amount: match[2].replace(/[ \u00a0]/g, "").replace(",", "."), currency: /^(?:€|euros?)$/iu.test(match[3] ?? "") ? "EUR" : match[1]?.toUpperCase() || (match[3] === "£" ? "GBP" : match[3]?.toUpperCase() ?? ""), maximum: /\b(?:maximum|max)\b/iu.test(tail) }];
  });
  const flightModes = confirmed.flatMap(line => {
    if (/\b(?:nos|mes|les)\s+vols\s+(?:sont\s+)?(?:déjà\s+)?réservés|\b(?:nous avons|j['’]ai)\s+réservé\s+(?:nos|mes|les)\s+vols/iu.test(line)) return ["booked"];
    if (/\b(?:nous|je)\s+réserver(?:ons|ai)\s+(?:nos|mes|les)\s+vols/iu.test(line)) return ["excluded"];
    if (/\b(?:nous souhaitons|je souhaite)\s+(?:une proposition\s+)?(?:avec|incluant)\s+(?:les\s+)?vols/iu.test(line)) return ["included"];
    return [];
  });
  const travelLines = confirmed.filter(line => /\b(?:visiter|découvrir|séjour|voyage|traversée)\b/iu.test(line));
  const places = ["Alger", "Tipaza", "Djemila", "Timgad", "Djanet", "Tamanrasset", "In Salah", "Tefedest", "Oran", "Constantine", "Ghardaïa"]
    .filter(place => travelLines.some(line => new RegExp(`\\b${place}\\b`, "iu").test(line)));
  const accommodation = unique(confirmed.flatMap(line => [...line.matchAll(/\bhôtels?\s+(?:de\s+)?[1-5]\s+étoiles?\b/giu)].map(match => match[0])));
  return {
    full_name: unique(name), travelers_adults: adults, travelers_children: children,
    travellers_count: adults && children ? String(Number(adults) + Number(children)) : "",
    children_ages: ages, rooms: roomDistribution, flex_period: periods,
    date_start: exact ? `${exact[4]}-${month}-${exact[1].padStart(2, "0")}` : "",
    date_end: exact ? `${exact[4]}-${month}-${exact[2].padStart(2, "0")}` : "",
    budget_ideal: unique(amounts.filter(item => !item.maximum).map(item => item.amount)),
    budget_max: unique(amounts.filter(item => item.maximum).map(item => item.amount)),
    currency: unique(amounts.map(item => item.currency)),
    budget_unit: unique(budgetLines.map(line => /\bpar personne\b|\/\s*pers\b/iu.test(line) ? "per_person" : /\b(?:total|groupe)\b/iu.test(line) ? "total" : "")),
    flights: unique(flightModes), hebergements: accommodation,
    destination_main: places.join(" et "),
  };
}

/** Conservative fallback when AI is unavailable: explicit labelled or unambiguous facts only. */
export function extractManualLeadFallback(source: string): ManualLeadDraft {
  function label(names: string): string {
    return source.match(new RegExp(`^(?:${names})\\s*:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
  }
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const solo = /\bsolo foot travel\b|\bvoyage(?:urs)?\s*:\s*(?:seul|solo)|\bvoyage seul\b/i.test(source);
  const natural = explicitNaturalFacts(source);
  return normalizeManualLeadDraft({
    ...natural,
    // Use the message's wording, never the traveler's nationality.
    language: /\b(?:expedition leader|proposed dates|preferred regions|dear team|kind regards|I (?:would|am|want|plan|hope|wish)|could you|would you)\b/i.test(source) ? "en" : "fr",
    full_name: label("Expedition leader|Nom complet|Prénom|Name|Full name") || natural.full_name,
    email, phone: label("Téléphone|Telephone|Phone"),
    project_title: natural.destination_main ? `Voyage à ${natural.destination_main}` : (messageParagraphs(source)[0] ?? "").slice(0, 120),
    group_type: solo ? "Solo" : label("Voyageurs|Type de groupe"),
    travellers_count: solo ? "1" : label("Nombre de voyageurs|Participants") || natural.travellers_count,
    travelers_adults: solo ? "1" : label("Adultes") || natural.travelers_adults, travelers_children: solo ? "0" : label("Enfants") || natural.travelers_children,
    flex_period: label("Proposed dates|Période|Mois") || natural.flex_period, flex_duration: label("Durée|Duration"),
    destination_main: label("Preferred regions|Destinations|Destination") || natural.destination_main,
    vision: label("Activity|Vision du voyage"),
    budget_includes_flights: explicitBudgetFlightScope(source),
    notes_longues: messageParagraphs(source).join("\n\n"),
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
