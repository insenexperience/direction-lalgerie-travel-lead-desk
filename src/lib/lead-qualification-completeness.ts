/**
 * Shared, deterministic qualification checks for the cockpit and mail composer.
 * No database, AI, clock or browser dependency. Suggestions are never facts:
 * qualification blocks count only after operator confirmation. In particular,
 * the database defaults (one adult / no child) are not proof of group size.
 */
export type QualificationLanguage = "fr" | "en";

export type QualificationQuestionId =
  | "flights" | "departure_city" | "participants" | "children_ages"
  | "rooms" | "dates" | "duration" | "budget" | "budget_scope"
  | "accommodation" | "itinerary" | "arrival_departure" | "services"
  | "constraints" | "expedition_water" | "expedition_shelter";

export interface QualificationQuestion {
  id: QualificationQuestionId;
  label: string;
  question: string;
  priority: number;
  requiredForBrief: boolean;
}

export interface QualificationChecklistItem {
  id: QualificationQuestionId;
  label: string;
  status: "complete" | "missing" | "not_applicable";
  requiredForBrief: boolean;
  /** Only supported information; no inference from numeric database defaults. */
  value?: string;
}

/**
 * Supplemental confirmed facts can live in intake_payload.qualification_facts
 * or traveler_responses.qualification_facts without new database columns.
 * Only populate these from traveler answers or an operator's explicit entry.
 */
export interface LeadQualificationFacts {
  flight_mode?: "include" | "already_booked" | "self_managed" | "none" | "included" | "excluded" | "booked";
  departure_city?: string;
  adults?: number;
  children?: number;
  travelers_adults?: number | null;
  travelers_children?: number | null;
  children_ages?: number[] | string;
  room_distribution?: string | { single?: number; double?: number; twin?: number; triple?: number; family?: number };
  accommodation?: string;
  accommodation_required?: boolean;
  travel_period?: string;
  duration?: string;
  budget_amount?: number;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_unit?: "per_person" | "total";
  currency?: string;
  budget_includes_flights?: boolean;
  itinerary?: string;
  arrival?: string;
  departure?: string;
  arrival_details?: string;
  departure_details?: string;
  services?: string;
  constraints?: string;
  expedition_water?: string;
  expedition_shelter?: string;
}

export interface LeadQualificationInput {
  travelers?: string | null;
  travelers_adults?: number | null;
  travelers_children?: number | null;
  traveler_responses?: unknown;
  intake_payload?: unknown;
  ai_qualification_payload?: unknown;
  qualification_blocks?: unknown;
  trip_dates?: string | null;
  travel_period?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  budget?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_unit?: string | null;
  currency?: string | null;
  destination_main?: string | null;
  travel_style?: string | null;
  trip_summary?: string | null;
  project_description?: string | null;
  travel_desire_narrative?: string | null;
  qualification_notes?: string | null;
  qualification_summary?: string | null;
}

export interface LeadQualificationAnalysis {
  language: QualificationLanguage;
  expedition: boolean;
  questions: QualificationQuestion[];
  checklist: QualificationChecklistItem[];
  /** Content completeness, distinct from operator sign-off / legal feasibility. */
  readyForAgencyBrief: boolean;
  completeness: number;
  missingRequired: QualificationQuestionId[];
}

type Obj = Record<string, unknown>;
function obj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
}
function has(value: Obj, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function text(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^(?:[-—–?]+|n\/?a|non renseign[ée]|inconnu[e]?|unknown|to be confirmed|à (?:confirmer|préciser)|a (?:confirmer|preciser))$/i.test(trimmed)
    ? "" : trimmed;
}
function normal(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function first(...values: unknown[]): string {
  return values.map(text).find(Boolean) ?? "";
}
function count(value: unknown, zeroAllowed = false): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isInteger(n) && n >= (zeroAllowed ? 0 : 1) && n <= 1000 ? n : null;
}
function ages(value: unknown): number[] {
  let values: unknown = value;
  if (typeof value === "string") {
    // Accept explicit ages in years written naturally. A range or a baby's age
    // in months must stay unknown instead of becoming two ages or an older child.
    const normalized = normal(value).trim()
      .replace(/^(?:aged|ages?)\s*:?\s*(?:de\s*)?/, "")
      .replace(/(?:ans?|years?|yrs?)\b/g, "")
      .replace(/(\d)\s*(?:and|et)\s*(?=\d)/g, "$1,")
      .trim();
    if (!/^\d+(?:[\s,;/]+\d+)*$/.test(normalized)) return [];
    values = normalized.split(/[\s,;/]+/).filter(Boolean).map(Number);
  }
  return Array.isArray(values) && values.every((v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 18) ? values as number[] : [];
}
function validatedSelections(blocks: Obj, id: string): string[] {
  const block = obj(blocks[id]);
  return ["confirmed", "adjusted", "manual"].includes(String(block.op_action)) && Array.isArray(block.op_selections)
    ? block.op_selections.filter((v): v is string => typeof v === "string") : [];
}
/** BO3 operator trame takes precedence over the original site composer trame. */
function trameEvidence(lead: LeadQualificationInput, intake: Obj): { raw: Obj; budget: string; places: string[]; wishes: string[] } {
  const operator = obj(obj(lead.ai_qualification_payload).trame_v3);
  const isOperatorTrame = Array.isArray(operator.jours);
  const raw = isOperatorTrame ? operator : obj(intake.trame);
  const siteBudget = obj(raw.budget);
  const siteBudgetAmount = text(siteBudget.par_personne_hors_vol);
  const budget = isOperatorTrame ? text(raw.budget) : typeof raw.budget === "string" ? text(raw.budget) : siteBudgetAmount ? `${siteBudgetAmount} par personne, hors vol` : "";
  const label = (v: unknown) => typeof v === "string" ? text(v) : first(obj(v).titre, obj(v).nom, obj(v).title, obj(v).id);
  const places = Array.isArray(raw.jours) ? raw.jours.flatMap((day) => Array.isArray(obj(day).lieux) ? (obj(day).lieux as unknown[]).map(label).filter(Boolean) : []) : [];
  const envies = obj(raw.envies);
  const wishes = [envies.grandes, envies.experiences, envies.activites, envies.pepites].flatMap((items) => Array.isArray(items) ? items.map(label).filter(Boolean) : []);
  return { raw, budget, places, wishes };
}
function roomDetails(value: unknown): { value: string; capacity: number | null; complete: boolean } {
  if (typeof value === "string") {
    const s = text(value);
    // A room count and room type are needed. "Two rooms" alone is incomplete.
    const matches = Array.from(normal(s).matchAll(/\b(\d+|une?|one|two|deux)\s+(?:chambres?\s+|rooms?\s+)?(single|individuell?e?s?|double|twin|triple|familial|family|suite)/g));
    const capacity = matches.some((m) => /famil|suite/.test(m[2])) ? null : matches.reduce((sum, m) => {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ["two", "deux"].includes(m[1]) ? 2 : 1;
      const places = /double|twin/.test(m[2]) ? 2 : m[2] === "triple" ? 3 : 1;
      return sum + n * places;
    }, 0);
    return { value: s, capacity, complete: matches.length > 0 && (capacity === null || capacity > 0) };
  }
  const roomObject = obj(value);
  const capacities: Record<string, number> = { single: 1, double: 2, twin: 2, triple: 3, family: 0 };
  const entries = Object.keys(capacities).flatMap((type) => {
    const n = count(roomObject[type], true);
    return n !== null ? [{ type, n }] : [];
  });
  const sum = entries.reduce((total, r) => total + r.n, 0);
  return {
    value: entries.filter((r) => r.n > 0).map((r) => `${r.n} ${r.type}`).join(", "),
    capacity: entries.some((r) => r.type === "family" && r.n > 0) ? null : entries.reduce((total, r) => total + capacities[r.type] * r.n, 0),
    complete: sum > 0,
  };
}

const COPY: Record<QualificationQuestionId, { label: [string, string]; question: [string, string] }> = {
  flights: { label: ["Vols", "Flights"], question: ["Souhaitez-vous une proposition incluant les vols, ou préférez-vous réserver vos billets de votre côté ?", "Would you like a proposal including flights, or will you arrange your own tickets?"] },
  departure_city: { label: ["Aéroport de départ", "Departure airport"], question: ["Depuis quelle ville ou quel aéroport souhaitez-vous partir ?", "Which city or airport would you like to depart from?"] },
  participants: { label: ["Participants", "Participants"], question: ["Combien de personnes voyageront au total, vous compris(e) ? Merci de préciser le nombre d’adultes, le nombre d’enfants et l’âge de chaque enfant à la date du départ.", "How many people will travel in total, including yourself? Please specify the number of adults, the number of children and each child's age at departure."] },
  children_ages: { label: ["Âge des enfants", "Children's ages"], question: ["Quel sera l’âge de chaque enfant à la date du départ ?", "How old will each child be at departure?"] },
  rooms: { label: ["Répartition des chambres", "Room allocation"], question: ["Combien de chambres de chaque type souhaitez-vous : individuelles/singles (1 personne), doubles (grand lit), twins (deux lits), triples ou familiales ? Merci d’indiquer aussi si les enfants partagent la chambre des adultes.", "How many rooms of each type would you like: singles (one person), doubles (one large bed), twins (two separate beds), triples or family rooms? Please also indicate whether children will share with adults."] },
  dates: { label: ["Dates et année", "Dates and year"], question: ["Quelles sont vos dates ou votre période de voyage souhaitées, en précisant l’année, la durée en jours ou en nuits et votre éventuelle flexibilité ?", "What are your preferred travel dates or period, including the year, duration in days or nights and any flexibility?"] },
  duration: { label: ["Durée", "Duration"], question: ["Combien de jours ou de nuits souhaitez-vous prévoir pour le séjour ?", "How many days or nights would you like to allow for the trip?"] },
  budget: { label: ["Budget", "Budget"], question: ["Quel budget ou quelle fourchette souhaitez-vous prévoir ? Merci de préciser la devise, s’il s’agit d’un budget par personne ou pour l’ensemble du groupe, et si les vols y sont inclus ou exclus.", "What budget or range would you like to allow? Please specify the currency, whether this is per person or for the entire group, and whether flights are included or excluded."] },
  budget_scope: { label: ["Périmètre du budget", "Budget scope"], question: ["Ce budget comprend-il les vols, ou concerne-t-il uniquement les prestations sur place ?", "Does this budget include flights, or does it cover only services in Algeria?"] },
  accommodation: { label: ["Hébergement", "Accommodation"], question: ["Quel type d’hébergement et quel niveau de confort souhaitez-vous : hôtel, maison d’hôtes, gîte, bivouac ou un mélange ?", "What accommodation and comfort level would you prefer: hotel, guesthouse, lodge, camping or a mix?"] },
  itinerary: { label: ["Itinéraire et envies", "Itinerary and wishes"], question: ["Quelles régions, étapes ou expériences souhaitez-vous privilégier ? Vous pouvez aussi nous laisser vous proposer un itinéraire adapté.", "Which regions, stops or experiences would you like to prioritise? You can also ask us to suggest an itinerary suited to you."] },
  arrival_departure: { label: ["Arrivée et départ en Algérie", "Arrival and departure in Algeria"], question: ["Si vous les connaissez déjà, quels sont vos lieux et horaires d’arrivée et de départ en Algérie ? Sinon, nous pourrons les définir ensemble.", "If already known, what are your arrival and departure locations and times in Algeria? Otherwise, we can decide these together."] },
  services: { label: ["Accompagnement et prestations", "Support and services"], question: ["Souhaitez-vous un chauffeur-guide, des transferts, des visites accompagnées ou une formule de repas particulière ?", "Would you like a driver-guide, transfers, guided visits or a particular meal plan?"] },
  constraints: { label: ["Besoins particuliers", "Specific needs"], question: ["Y a-t-il des contraintes alimentaires, de mobilité ou d’autres besoins particuliers à prendre en compte ? Vous pouvez simplement indiquer « aucun ».", "Are there any dietary, mobility or other specific needs we should account for? You can simply answer 'none'."] },
  expedition_water: { label: ["Autonomie et eau", "Self-sufficiency and water"], question: ["Quelle stratégie d’eau envisagez-vous : capacité portée, durée entre les points d’eau et éventuel recours à des puits ou à des caches ? Quels ajustements de votre format d’autonomie accepteriez-vous pour l’étude de faisabilité ?", "What water strategy are you considering: carrying capacity, time between water sources and possible use of wells or caches? What changes to your unsupported format would you consider for the feasibility assessment?"] },
  expedition_shelter: { label: ["Couchage et matériel d’expédition", "Expedition shelter and equipment"], question: ["Quel couchage et quel matériel prévoyez-vous pendant la traversée ? Avez-vous besoin de prestations avant ou après celle-ci ?", "What shelter and equipment do you plan to use during the traverse? Do you need any services before or after it?"] },
};

/** Missing questions in operational order. Unknown information stays unknown. */
export function analyzeLeadQualification(
  lead: LeadQualificationInput,
  options: { language?: QualificationLanguage } = {},
): LeadQualificationAnalysis {
  const language = options.language ?? "fr";
  const languageIndex = language === "en" ? 1 : 0;
  const intake = obj(lead.intake_payload);
  const manualQualification = obj(intake.manual_qualification);
  const manualImport = intake.import_mode === "manual_message" || Object.keys(manualQualification).length > 0;
  const responses = obj(lead.traveler_responses);
  const facts = { ...obj(intake.qualification_facts), ...obj(responses.qualification_facts) };
  const trame = trameEvidence(lead, intake);
  const trameGroup = obj(trame.raw.groupe);
  const trameCadre = obj(trame.raw.cadre);
  const blocks = obj(lead.qualification_blocks);
  const groupSelections = validatedSelections(blocks, "group");
  const staySelections = validatedSelections(blocks, "stay");
  const timingSelections = validatedSelections(blocks, "timing");
  const budgetSelections = validatedSelections(blocks, "budget");
  const itinerarySelections = validatedSelections(blocks, "highlights");
  // Original traveler notes are evidence, internal activity / operator questions are not.
  const narrative = [lead.travel_style, lead.project_description, lead.travel_desire_narrative, intake.vision, intake.notes_longues].map(text).filter(Boolean).join("\n");
  const narrativeNormalized = normal(narrative);
  const expedition = /unsupported (?:solo |long-distance )?foot|foot traverse|traversee pedestre|expedition.*(?:sans ravitaillement|autonomie)|sans ravitaillement alimentaire/.test(narrativeNormalized);
  const checklist: QualificationChecklistItem[] = [];
  const questions: QualificationQuestion[] = [];
  let priority = 0;
  const check = (id: QualificationQuestionId, complete: boolean, requiredForBrief = true, value = "", applicable = true, customQuestion?: [string, string]) => {
    const copy = COPY[id];
    checklist.push({ id, label: copy.label[languageIndex], status: applicable ? complete ? "complete" : "missing" : "not_applicable", requiredForBrief: applicable && requiredForBrief, ...(value ? { value } : {}) });
    if (applicable && !complete) questions.push({ id, label: copy.label[languageIndex], question: (customQuestion ?? copy.question)[languageIndex], priority: ++priority, requiredForBrief });
  };

  const flights = obj(responses.flights);
  const rawFlightMode = first(facts.flight_mode, flights.mode, intake.flight_mode);
  const flightAliases: Record<string, string> = { included: "include", excluded: "self_managed", booked: "already_booked" };
  const normalizedFlightMode = flightAliases[rawFlightMode] ?? rawFlightMode;
  const flightMode = ["include", "already_booked", "self_managed", "none"].includes(normalizedFlightMode) ? normalizedFlightMode : budgetSelections.includes("flights") ? "include" : "";
  const departureCity = first(facts.departure_city, flights.departure_city, intake.departure_city);
  check("flights", Boolean(flightMode), true, flightMode);
  check("departure_city", Boolean(departureCity), true, departureCity, flightMode === "include");

  const responseTravelers = Array.isArray(responses.travelers) ? responses.travelers.map(obj) : [];
  const allTravelerAges = responseTravelers.length > 0 && responseTravelers.every((t) => typeof t.age === "number" && Number.isInteger(t.age) && t.age >= 0 && t.age <= 110);
  const groupText = normal([text(lead.travelers), text(intake.group_type), text(trameGroup.type)].join(" "));
  const canonicalAdults = has(facts, "travelers_adults") || has(facts, "adults");
  const canonicalChildren = has(facts, "travelers_children") || has(facts, "children");
  const canonicalComposition = canonicalAdults || canonicalChildren;
  let adults = canonicalAdults ? count(has(facts, "travelers_adults") ? facts.travelers_adults : facts.adults, true) : count(intake.adults, true);
  let children = canonicalChildren ? count(has(facts, "travelers_children") ? facts.travelers_children : facts.children, true) : count(intake.children, true);
  const explicitlyUnknownAdults = canonicalAdults && adults === null;
  const explicitlyUnknownChildren = canonicalChildren && children === null;
  let childAges = has(facts, "children_ages") ? ages(facts.children_ages) : ages(intake.children_ages);
  const confirmedComposition = adults !== null && children !== null;
  const trameTotal = count(trameGroup.nombre);
  const trameChildren = count(trameGroup.enfants, true);
  let total = confirmedComposition ? (adults ?? 0) + (children ?? 0) : canonicalComposition ? null : trameTotal ?? count(intake.travellers_count ?? intake.travelers_count);
  if (!confirmedComposition && trameTotal !== null && trameChildren !== null && trameChildren <= trameTotal) {
    if (!explicitlyUnknownAdults) adults ??= trameTotal - trameChildren;
    if (!explicitlyUnknownChildren) children ??= trameChildren;
  }
  if (allTravelerAges && !confirmedComposition && trameTotal === null) {
    if (!explicitlyUnknownAdults) adults ??= responseTravelers.filter((t) => (t.age as number) >= 18).length;
    if (!explicitlyUnknownChildren) children ??= responseTravelers.filter((t) => (t.age as number) < 18).length;
    if (!has(facts, "children_ages")) childAges = responseTravelers.filter((t) => (t.age as number) < 18).map((t) => t.age as number);
    if (!canonicalComposition) total = responseTravelers.length;
  } else {
    // An edited logistics composition takes precedence over the older public form.
    if (allTravelerAges && confirmedComposition && children === responseTravelers.filter((t) => (t.age as number) < 18).length && !childAges.length && !has(facts, "children_ages")) {
      childAges = responseTravelers.filter((t) => (t.age as number) < 18).map((t) => t.age as number);
    }
    if (!explicitlyUnknownAdults) adults ??= count(groupText.match(/\b(\d+)\s+(?:adultes?|adults?)/)?.[1], true);
    if (!explicitlyUnknownChildren) children ??= count(groupText.match(/\b(\d+)\s+(?:enfants?|children|child)\b/)?.[1], true);
    if (/\b(?:solo|seul|seule|alone)\b/.test(groupText) || groupSelections.includes("solo")) {
      if (!explicitlyUnknownAdults) adults ??= 1;
      if (!explicitlyUnknownChildren) children ??= 0;
      if (!canonicalComposition) total ??= 1;
    }
    if (!explicitlyUnknownChildren && /\b(?:sans enfants|adultes uniquement|adults only|no children)\b/.test(groupText)) children ??= 0;
    // A confirmed "friends" / "small group" chip does not confirm exact numbers.
    // Trust explicit non-default scalar entries, but never turn a child default 0
    // into "no children". The logistics editor records explicit zeroes in facts.
    if (!explicitlyUnknownAdults && (count(lead.travelers_adults, true) ?? 0) > 1) adults ??= count(lead.travelers_adults, true);
    if (!explicitlyUnknownChildren && (count(lead.travelers_children, true) ?? 0) > 0) children ??= count(lead.travelers_children, true);
    if (!canonicalComposition) total ??= count(groupText.match(/\b(\d+)\s+(?:voyageur|participant|personne|travell?er|people)/)?.[1]);
  }
  const groupComplete = adults !== null && children !== null && adults + children > 0 && (total === null || total === adults + children);
  const groupValue = groupComplete ? `${adults} ${language === "fr" ? "adulte(s)" : "adult(s)"}, ${children} ${language === "fr" ? "enfant(s)" : "child(ren)"}` : total !== null ? `${total} ${language === "fr" ? "participant(s)" : "participant(s)"}` : "";
  const partialGroupQuestion: [string, string] | undefined = total !== null && !groupComplete
    ? [`Pour les ${total} participants annoncés, combien y aura-t-il d’adultes et d’enfants ? Merci de préciser l’âge de chaque enfant à la date du départ.`, `For the ${total} participants mentioned, how many are adults and children? Please include each child's age at departure.`] : undefined;
  check("participants", groupComplete, true, groupValue, true, partialGroupQuestion);
  // The group question already requests ages when composition is still unknown.
  check("children_ages", children !== null && childAges.length === children, true, childAges.join(", "), groupComplete && (children ?? 0) > 0);

  const accommodation = has(facts, "accommodation") ? text(facts.accommodation) : first(trameCadre.hebergement, intake.hebergements);
  const bivouacOnly = staySelections.includes("bivouac") && !staySelections.some((s) => ["gite", "riad", "hotel_3", "hotel_4_5", "mix"].includes(s)) || /(?:bivouac|camping)/i.test(accommodation) && !/(?:hotel|gite|riad|mix|guesthouse|auberge)/i.test(normal(accommodation));
  const noAccommodation = facts.accommodation_required === false;
  const roomInput = facts.room_distribution ?? responses.room_distribution ?? intake.room_distribution;
  let room = roomDetails(roomInput);
  // Existing traveler form has coarse room options: two_rooms needs refinement.
  if (!has(facts, "room_distribution") && !room.complete && ["triple", "suite"].includes(String(responses.rooms))) room = { value: String(responses.rooms), capacity: responses.rooms === "triple" ? 3 : null, complete: true };
  const groupSize = groupComplete ? (adults ?? 0) + (children ?? 0) : total;
  const roomFits = room.capacity === null || groupSize === null || room.capacity >= groupSize;
  const roomApplicable = !expedition && !bivouacOnly && !noAccommodation;
  check("rooms", room.complete && roomFits, true, room.value, roomApplicable, room.complete && !roomFits ? ["La répartition des chambres indiquée ne semble pas couvrir tous les participants. Pouvez-vous préciser les chambres, leurs occupants et le partage avec les enfants ?", "The room allocation appears to have fewer places than participants. Could you clarify the rooms, their occupants and any sharing with children?"] : undefined);

  const dateText = has(facts, "travel_period") ? text(facts.travel_period) : text(trameCadre.mois) || [lead.travel_start_date, lead.travel_end_date, lead.travel_period, lead.trip_dates, intake.date_start, intake.date_end, intake.flex_month, intake.flex_period].map(text).filter(Boolean).join(" · ");
  const dateHasPeriod = /(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}|janv|january|fev|february|mars|march|avril|april|mai|\bmay\b|juin|june|juil|july|aout|august|sept|oct|nov|dec|printemps|spring|ete|summer|automne|autumn|fall|hiver|winter)/i.test(normal(dateText));
  const dateKnown = dateHasPeriod && /\b(?:19|20|21)\d{2}\b/.test(dateText);
  check("dates", dateKnown, true, dateText, true, dateHasPeriod && !dateKnown ? ["Pour les dates ou la période déjà indiquées, pouvez-vous confirmer l’année du voyage et votre flexibilité ?", "For the dates or period already indicated, could you confirm the year of travel and your flexibility?"] : undefined);
  const duration = has(facts, "duration") ? text(facts.duration) : first(trameCadre.duree, intake.flex_duration);
  const durationKnown = Boolean(duration) || timingSelections.some((s) => ["weekend", "week", "two_weeks", "long"].includes(s)) || /(?:\d+\s*(?:[-–—→]|au|to)\s*\d+|\d+\s*(?:jours?|nuits?|days?|nights?|semaines?|weeks?)|\d{4}-\d{2}-\d{2}.*\d{4}-\d{2}-\d{2})/i.test(dateText) || (expedition && /(?:janvier|january).*(?:fevrier|february)/i.test(normal(dateText)));
  check("duration", durationKnown, true, duration, dateKnown);

  const budgetText = first(trame.budget, lead.budget);
  const amount = [facts.budget_amount, facts.budget_min, facts.budget_max, lead.budget_min, lead.budget_max, intake.budget_ideal, intake.budget_max, intake.budget_total].find((v) => Number(v) > 0);
  const budgetUnit = has(facts, "budget_unit") ? text(facts.budget_unit) : text(lead.budget_unit) || (!manualImport ? Number(intake.budget_total) > 0 ? "total" : Number(intake.budget_ideal) > 0 || Number(intake.budget_max) > 0 ? "per_person" : "" : "");
  const budgetCurrency = has(facts, "currency") ? text(facts.currency) : manualImport ? text(manualQualification.currency) : first(lead.currency, intake.currency);
  const explicitUnknownBasis = has(facts, "budget_unit") && !budgetUnit || has(facts, "currency") && !budgetCurrency;
  const textualBudgetKnown = !explicitUnknownBasis && /\d/.test(budgetText) && /(?:€|eur|usd|dzd|gbp|\$|£|dinars?)/i.test(budgetText) && /(?:pers|person|total|groupe|group)/i.test(budgetText) && !/(?:à definir|a definir|to be defined)/i.test(normal(budgetText));
  // Broad chip classes do not establish a traveler's amount or its basis.
  const budgetKnown = textualBudgetKnown || Boolean(amount && budgetCurrency && ["per_person", "total"].includes(budgetUnit));
  const canonicalBudgetValue = amount && (has(facts, "budget_min") || has(facts, "budget_max") || has(facts, "budget_amount")) ? `${amount} ${budgetCurrency} ${budgetUnit}`.trim() : "";
  check("budget", budgetKnown, true, canonicalBudgetValue || budgetText || (amount ? `${amount} ${budgetCurrency} ${budgetUnit}`.trim() : ""));
  const budgetScopeKnown = has(facts, "budget_includes_flights") ? typeof facts.budget_includes_flights === "boolean" : /(?:hors vols?|vols? (?:exclus|inclus)|excluding flights|including flights|flights excluded|flights included)/i.test(budgetText);
  check("budget_scope", budgetScopeKnown, true, typeof facts.budget_includes_flights === "boolean" ? facts.budget_includes_flights ? "flights included" : "flights excluded" : "", budgetKnown && flightMode !== "none");

  const hasAccommodation = has(facts, "accommodation") ? Boolean(accommodation) : Boolean(accommodation) || staySelections.length > 0;
  check("accommodation", hasAccommodation, true, accommodation || staySelections.join(", "), !expedition && !noAccommodation);
  const itinerary = has(facts, "itinerary") ? text(facts.itinerary) : first([...trame.places, ...trame.wishes].join(", "), lead.destination_main, lead.project_description, lead.travel_desire_narrative, intake.vision);
  const agencyDesign = obj(responses.wishes).structure === "full_trust" || obj(responses.wishes).structure === "flexible";
  const responseStops = obj(responses.wishes).must_see;
  const itineraryKnown = Boolean(itinerary) || itinerarySelections.length > 0 || agencyDesign || Array.isArray(responseStops) && responseStops.length > 0 || /\b(?:alger|algiers|tipaza|djemila|timgad|djanet|tamanrasset|sahara|hoggar|tassili|tefedest|in salah|constantine|kabylie|ghardaia|bejaia)\b/i.test(normal(first(lead.trip_summary, narrative)));
  check("itinerary", itineraryKnown, true, itinerary);
  const arrival = first(facts.arrival_details, facts.arrival, intake.arrival);
  const departure = first(facts.departure_details, facts.departure, intake.departure);
  check("arrival_departure", Boolean(arrival && departure), false, [arrival, departure].filter(Boolean).join(" → "));
  const services = first(facts.services);
  const responseConstraints = obj(responses.constraints);
  const serviceKnown = Boolean(services) || Boolean(responseConstraints.accompaniment && responseConstraints.board) || budgetSelections.some((s) => ["guide", "transfers", "full_board", "half_board"].includes(s)) || (expedition && /(?:assistance requested|support|permissions|logisti|autorisations)/i.test(narrative));
  check("services", serviceKnown, false, services);
  const constraints = first(facts.constraints, responseConstraints.notes);
  const constraintsKnown = Boolean(constraints) || Array.isArray(responseConstraints.diet) || itinerarySelections.some((s) => ["halal", "vegetarian", "allergies", "mobility", "no_alcohol", "child_friendly"].includes(s));
  check("constraints", constraintsKnown, false, constraints);
  check("expedition_water", Boolean(text(facts.expedition_water)), true, text(facts.expedition_water), expedition);
  check("expedition_shelter", Boolean(text(facts.expedition_shelter)), true, text(facts.expedition_shelter), expedition);

  const required = checklist.filter((item) => item.requiredForBrief);
  const missingRequired = required.filter((item) => item.status === "missing").map((item) => item.id);
  return { language, expedition, questions, checklist, readyForAgencyBrief: missingRequired.length === 0, completeness: required.length ? Math.round(100 * (required.length - missingRequired.length) / required.length) : 100, missingRequired };
}
