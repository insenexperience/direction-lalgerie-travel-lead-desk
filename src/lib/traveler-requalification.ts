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

/** Libellés FR partagés (panneau cockpit + email de qualification). */
export const TRAVELER_LABELS: Record<string, string> = {
  // Chambres
  two_rooms: "Deux chambres",
  triple: "Une chambre triple",
  suite: "Suite familiale",
  advise: "Conseillez-nous",
  // Passeports
  algerian: "Algérien",
  french: "Français",
  both: "Les deux",
  other: "Autre",
  // Vols
  include: "À intégrer au dossier",
  already_booked: "Déjà réservés",
  self_managed: "Le voyageur s'en occupe",
  // Rythme
  intense: "On bouge beaucoup",
  balanced: "Équilibré",
  slow: "Tranquille, on savoure",
  // Structure
  fixed: "Itinéraire précis",
  flexible: "Trame souple",
  full_trust: "Confiance totale",
  // Business
  none: "Pas un sujet",
  curiosity: "Curiosité au fil du voyage",
  meetings: "Rencontres pro à organiser",
  // Accompagnement
  full_guide: "Chauffeur-guide tout le séjour",
  partial: "Ponctuel selon les étapes",
  // Pension
  breakfast: "Petits-déjeuners",
  half_board: "Demi-pension",
  mixed: "Mixte selon les étapes",
  // Incontournables (ids grille)
  casbah: "Casbah d'Alger",
  tipaza: "Tipaza",
  constantine: "Constantine",
  kabylie: "Kabylie",
  bejaia: "Béjaïa & la côte",
  ghardaia: "Ghardaïa / M'Zab",
  sahara: "Sahara / dunes",
  hoggar: "Hoggar / Tamanrasset",
  tassili: "Tassili n'Ajjer",
  // Contraintes (ids grille)
  halal: "Halal strict",
  vegetarian: "Végétarien / végétalien",
  allergies: "Allergies alimentaires",
  no_alcohol: "Sans alcool",
  mobility: "Mobilité réduite",
  child_friendly: "Jeunes enfants",
};

export function travelerLabel(id: string): string {
  return TRAVELER_LABELS[id] ?? id;
}

export interface TravelerLine {
  label: string;
  value: string;
  /** Champ libre affiché pleine largeur. */
  wide?: boolean;
}

/** Aplati les réponses en lignes label/valeur (partagé cockpit + email). */
export function travelerResponseLines(r: TravelerResponses): TravelerLine[] {
  const lines: TravelerLine[] = [
    { label: "Âges des voyageurs", value: r.travelers.map((t) => t.age).join(", ") },
    { label: "Chambres", value: travelerLabel(r.rooms) },
    {
      label: "Passeports",
      value: r.passports.map((p, i) => `V${i + 1} : ${travelerLabel(p)}`).join(" · "),
    },
    {
      label: "Vols",
      value:
        travelerLabel(r.flights.mode) +
        (r.flights.departure_city ? ` — départ ${r.flights.departure_city}` : ""),
    },
    {
      label: "Incontournables",
      value: r.wishes.must_see.map(travelerLabel).join(", ") || "—",
    },
    {
      label: "Rythme & structure",
      value: `${travelerLabel(r.wishes.rhythm)} · ${travelerLabel(r.wishes.structure)}`,
    },
    { label: "Algérie business", value: travelerLabel(r.business.mode) },
    { label: "Accompagnement", value: travelerLabel(r.constraints.accompaniment) },
    { label: "Pension", value: travelerLabel(r.constraints.board) },
    {
      label: "Contraintes",
      value: r.constraints.diet.map(travelerLabel).join(", ") || "—",
    },
  ];
  if (r.wishes.family_days)
    lines.push({ label: "Famille à visiter / jours libres", value: r.wishes.family_days, wide: true });
  if (r.business.details)
    lines.push({ label: "Précisions business", value: r.business.details, wide: true });
  if (r.wishes.notes)
    lines.push({ label: "Autre (envies)", value: r.wishes.notes, wide: true });
  if (r.constraints.notes)
    lines.push({ label: "Santé / précisions", value: r.constraints.notes, wide: true });
  return lines;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Email complet des réponses de qualification, envoyé à l'équipe DA. */
export function buildTravelerResponsesEmailHtml(
  responses: TravelerResponses,
  summary: TravelerSummary,
): string {
  const rows = travelerResponseLines(responses)
    .map(
      (l) =>
        `<tr>` +
        `<td style="padding:7px 12px;border-top:1px solid #e4e8eb;color:#6b7a85;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;vertical-align:top">${escapeHtml(l.label)}</td>` +
        `<td style="padding:7px 12px;border-top:1px solid #e4e8eb;color:#0e1a21;font-size:14px">${escapeHtml(l.value)}</td>` +
        `</tr>`,
    )
    .join("");
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#0e1a21">` +
    `<div style="background:#15323f;color:#fff;padding:18px 20px;border-radius:8px 8px 0 0">` +
    `<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.7">Qualification voyageur · ${escapeHtml(summary.reference)}</div>` +
    `<div style="font-size:20px;font-weight:600;margin-top:4px">${escapeHtml(summary.travelerName)}</div>` +
    `</div>` +
    `<div style="border:1px solid #e4e8eb;border-top:none;border-radius:0 0 8px 8px;padding:8px 8px 16px">` +
    `<p style="color:#3a4a55;font-size:14px;padding:8px 12px 0;margin:0">Le voyageur a complété son parcours de qualification. Détail ci-dessous ; dossier également accessible dans le Travel Lead Desk.</p>` +
    `<table style="border-collapse:collapse;width:100%;margin-top:8px">${rows}</table>` +
    `</div>` +
    `</div>`
  );
}
