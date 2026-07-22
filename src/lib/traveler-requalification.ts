import { getAllOptionIds } from "@/components/leads/qualification/qualification-blocks-config";

export const TOKEN_TTL_DAYS = 30;
const TEXT_MAX = 500;

export const TRAVELER_ENUMS = {
  rooms: ["two_rooms", "triple", "suite", "advise"],
  passports: ["algerian", "french", "both", "other"],
  flightsMode: ["include", "already_booked", "self_managed"],
  rhythm: ["intense", "slow", "balanced"],
  structure: ["fixed", "flexible", "full_trust"],
  businessMode: ["none", "curiosity", "meetings"],
  accompaniment: ["full_guide", "partial", "advise"],
  board: ["breakfast", "half_board", "mixed", "advise"],
} as const;

export interface TravelerResponses {
  version: 1;
  travelers: { age: number }[];
  rooms: (typeof TRAVELER_ENUMS.rooms)[number];
  passports: (typeof TRAVELER_ENUMS.passports)[number][];
  flights: {
    mode: (typeof TRAVELER_ENUMS.flightsMode)[number];
    departure_city: string;
  };
  wishes: {
    must_see: string[];
    rhythm: (typeof TRAVELER_ENUMS.rhythm)[number];
    structure: (typeof TRAVELER_ENUMS.structure)[number];
    family_days: string;
    notes: string;
  };
  business: {
    mode: (typeof TRAVELER_ENUMS.businessMode)[number];
    details: string;
  };
  constraints: {
    diet: string[];
    accompaniment: (typeof TRAVELER_ENUMS.accompaniment)[number];
    board: (typeof TRAVELER_ENUMS.board)[number];
    notes: string;
  };
}

function cleanText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/<[^>]*>/g, "").trim().slice(0, TEXT_MAX);
}

function oneOf<T extends readonly string[]>(
  list: T,
  v: unknown,
): T[number] | null {
  return typeof v === "string" && (list as readonly string[]).includes(v)
    ? (v as T[number])
    : null;
}

function gridIds(v: unknown, max = 20): string[] | null {
  if (!Array.isArray(v)) return null;
  const known = getAllOptionIds();
  const out: string[] = [];
  for (const item of v.slice(0, max)) {
    if (typeof item !== "string") return null;
    if (!known.has(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/** Valide un payload inconnu. Retourne null si non conforme (→ 422). */
export function parseTravelerResponses(raw: unknown): TravelerResponses | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const travelersRaw = o.travelers;
  if (
    !Array.isArray(travelersRaw) ||
    travelersRaw.length < 1 ||
    travelersRaw.length > 8
  )
    return null;
  const travelers: { age: number }[] = [];
  for (const t of travelersRaw) {
    const age = (t as Record<string, unknown>)?.age;
    if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 110)
      return null;
    travelers.push({ age });
  }

  const rooms = oneOf(TRAVELER_ENUMS.rooms, o.rooms);
  if (!rooms) return null;

  const passportsRaw = o.passports;
  if (!Array.isArray(passportsRaw) || passportsRaw.length !== travelers.length)
    return null;
  const passports: TravelerResponses["passports"] = [];
  for (const p of passportsRaw) {
    const val = oneOf(TRAVELER_ENUMS.passports, p);
    if (!val) return null;
    passports.push(val);
  }

  const flightsO = (o.flights ?? {}) as Record<string, unknown>;
  const flightsMode = oneOf(TRAVELER_ENUMS.flightsMode, flightsO.mode);
  if (!flightsMode) return null;

  const wishesO = (o.wishes ?? {}) as Record<string, unknown>;
  const mustSee = gridIds(wishesO.must_see);
  const rhythm = oneOf(TRAVELER_ENUMS.rhythm, wishesO.rhythm);
  const structure = oneOf(TRAVELER_ENUMS.structure, wishesO.structure);
  if (!mustSee || !rhythm || !structure) return null;

  const businessO = (o.business ?? {}) as Record<string, unknown>;
  const businessMode = oneOf(TRAVELER_ENUMS.businessMode, businessO.mode);
  if (!businessMode) return null;

  const constraintsO = (o.constraints ?? {}) as Record<string, unknown>;
  const diet = gridIds(constraintsO.diet);
  const accompaniment = oneOf(
    TRAVELER_ENUMS.accompaniment,
    constraintsO.accompaniment,
  );
  const board = oneOf(TRAVELER_ENUMS.board, constraintsO.board);
  if (!diet || !accompaniment || !board) return null;

  return {
    version: 1,
    travelers,
    rooms,
    passports,
    flights: {
      mode: flightsMode,
      departure_city: cleanText(flightsO.departure_city),
    },
    wishes: {
      must_see: mustSee,
      rhythm,
      structure,
      family_days: cleanText(wishesO.family_days),
      notes: cleanText(wishesO.notes),
    },
    business: { mode: businessMode, details: cleanText(businessO.details) },
    constraints: {
      diet,
      accompaniment,
      board,
      notes: cleanText(constraintsO.notes),
    },
  };
}

export interface TravelerSummary {
  reference: string;
  travelerName: string;
  datesLine: string;
  travelers: string;
  travelStyle: string;
  budget: string;
  tripSummary: string;
}

/** Synthèse publique — ne JAMAIS inclure email/téléphone. */
export function buildTravelerSummary(
  row: Record<string, unknown>,
): TravelerSummary {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const reference = str(row.reference) || `${String(row.id).slice(0, 8)}…`;
  return {
    reference,
    travelerName: str(row.traveler_name) || "—",
    datesLine: str(row.trip_dates) || "—",
    travelers: str(row.travelers) || "—",
    travelStyle: str(row.travel_style) || "—",
    budget: str(row.budget) || "—",
    tripSummary: str(row.trip_summary) || "—",
  };
}

export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) || t < Date.now();
}
