/**
 * Construction de l’objet `leads` à partir d’un payload « intake » (JSON formulaire
 * Squarespace ou champs alignés dashboard). Utilisé par `/api/intake` et `createLeadFromIntake`.
 */
import { demandeProjetDescription, readDemandeProjet } from "@/lib/demande-projet-intake";

export function intakeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Un objet simple, et non un tableau ni null : ce que la trame du site doit être pour être lue. */
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Limite également les appels directs au CRM. */
function trameBornee(value: unknown): Record<string, unknown> | null {
  if (!record(value)) return null;
  try { return JSON.stringify(value).length <= 60_000 ? value : null; } catch { return null; }
}

/** Nom voyageur : full_name, ou prénom + nom pour les formulaires historiques. */
export function resolveFullNameFromIntakeBody(body: Record<string, unknown>): string {
  const single = intakeStr(body.full_name);
  if (single) return single;
  const first = intakeStr(body.first) || intakeStr(body.prenom) || intakeStr(body.given_name);
  const last =
    intakeStr(body.last) || intakeStr(body.nom) || intakeStr(body.family_name) || intakeStr(body.surname);
  return [first, last].filter(Boolean).join(" ").trim();
}

/** Normalise le body JSON (champs optionnels → chaînes, dates flex, etc.). */
export function buildIntakeRecordFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const flexPeriod = intakeStr(body.flex_period);
  const flexMonth = intakeStr(body.flex_month);
  const flexDuration = intakeStr(body.flex_duration);
  const mergedFlex = [flexMonth, flexDuration].filter(Boolean).join(" · ") || flexPeriod;

  const notesLong = intakeStr(body.notes_longues);

  return {
    full_name: resolveFullNameFromIntakeBody(body),
    email: intakeStr(body.email),
    phone: intakeStr(body.phone),
    follow_prefs: intakeStr(body.follow_prefs),
    planning_stage: intakeStr(body.planning_stage),
    project_notes_short: intakeStr(body.project_notes_short) || notesLong.slice(0, 200),
    group_type: intakeStr(body.group_type),
    travellers_count: intakeStr(body.travellers_count),
    dates_mode: intakeStr(body.dates_mode),
    date_start: intakeStr(body.date_start),
    date_end: intakeStr(body.date_end),
    flex_period: mergedFlex,
    flex_month: flexMonth,
    flex_duration: flexDuration,
    hebergements: intakeStr(body.hebergements),
    vision: intakeStr(body.vision),
    currency: intakeStr(body.currency) || "EUR",
    budget_ideal: intakeStr(body.budget_ideal),
    budget_max: intakeStr(body.budget_max),
    budget_total: intakeStr(body.budget_total),
    notes_longues: notesLong,
    // Trame structurée du site (relais /api/projet) : conservée telle quelle, pour que la demande arrive entière
    // dans intake_payload. Sans cela, le composeur et la demande de projet envoyaient un objet que rien ne lisait.
    // Garder la limite aussi pour les appels directs à l’API CRM.
    trame: trameBornee(body.trame),
    submission_id: intakeStr(body.submission_id),
    page_origin: intakeStr(body.page_origin),
    submitted_at:
      typeof body.submitted_at === "string" && body.submitted_at
        ? body.submitted_at
        : new Date().toISOString(),
  };
}

type BuildLeadInsertOptions = {
  /** Libellé `source` si `page_origin` est vide (ex. dashboard DA vs Squarespace). */
  sourceFallback?: string;
  priority?: "normal" | "high";
};

/** Ligne à passer à `supabase.from("leads").insert(...)` (schéma Travel Lead Desk). */
function normalizePlanningStage(raw: string): "ideas" | "planning" | "ready" | null {
  const v = raw.toLowerCase();
  if (v.includes("idée") || v.includes("ide") || v.includes("inspiration")) return "ideas";
  if (v.includes("planif") || v.includes("construi") || v.includes("concret")) return "planning";
  if (v.includes("réserv") || v.includes("reserv") || v.includes("prêt") || v.includes("pret")) return "ready";
  return null;
}

export function buildLeadInsertFromIntake(
  intake: Record<string, unknown>,
  opts?: BuildLeadInsertOptions,
) {
  // Le site n'est plus sur Squarespace depuis septembre 2026 : la plateforme
  // envoie sa `page_origin`, et ce repli ne sert qu'aux appels qui n'en ont pas.
  const sourceDefault = opts?.sourceFallback ?? "Formulaire site";
  const priority = opts?.priority === "high" ? "high" : "normal";
  const travelerName = intakeStr(intake.full_name) || intakeStr(intake.email);
  const email = intakeStr(intake.email);
  const mode = String(intake.dates_mode ?? "").toLowerCase();
  const demande = readDemandeProjet(intake);

  let tripDates = "—";
  if (mode.includes("flex")) {
    const parts = [intake.flex_month, intake.flex_duration]
      .map((x) => (x != null ? String(x).trim() : ""))
      .filter(Boolean);
    tripDates = parts.length ? parts.join(" · ") : intakeStr(intake.flex_period) || "Période flexible";
  } else if (intake.date_start || intake.date_end) {
    tripDates = `${intake.date_start || "—"} → ${intake.date_end || "—"}`;
  } else if (intakeStr(intake.flex_period)) {
    tripDates = intakeStr(intake.flex_period);
  }

  const cur = String(intake.currency || "EUR");
  const ideal = intake.budget_ideal ? String(intake.budget_ideal) : "";
  const max = intake.budget_max ? String(intake.budget_max) : "";
  const budgetLine =
    ideal || max
      ? `${ideal ? `${ideal} ${cur}` : "?"} → ${max ? `${max} ${cur}` : "?"} / pers.`
      : intakeStr(intake.budget_total);

  const travelersLine = [
    intake.group_type,
    intake.travellers_count
      ? `${intake.travellers_count} voyageur(s)`
      : "",
  ]
    .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
    .filter(Boolean)
    .join(" · ");

  const qualification = [
    intake.planning_stage && `Plan : ${intake.planning_stage}`,
    intake.hebergements && `Hébergements : ${intake.hebergements}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Demande de projet du site (trame « demande-projet-voyage ») : le conseiller lit d'abord où et avec qui. Sans
  // trame, tout ce qui suit reste vide et le lead est construit comme avant.
  const trame = record(intake.trame) ? (intake.trame as Record<string, unknown>) : null;
  const ou = trame && record(trame.ou) ? (trame.ou as Record<string, unknown>) : null;
  const lieux = demande
    ? demande.destination.unknown ? [] : demande.destination.names.length ? demande.destination.names
      : demande.destination.territories.length ? demande.destination.territories : demande.destination.regionNames
    : Array.isArray(ou?.noms) ? (ou!.noms as unknown[]).map(v => intakeStr(v)).filter(Boolean) : [];
  const groupe = trame && record(trame.voyageurs) ? (trame.voyageurs as Record<string, unknown>) : null;
  const entier = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);
  const adultes = demande ? demande.travelers.adults : entier(groupe?.adultes);
  const enfants = demande ? demande.travelers.children : entier(groupe?.enfants);
  const description = demande ? demandeProjetDescription(demande) : "";
  const style = demande ? demande.wishes.styles.join(" · ") : intakeStr(intake.vision);
  const knownChoice = (value: string) => value === "Je ne sais pas encore" ? "" : value;
  const preferredChannel = demande?.contact.channel === "WhatsApp" ? "whatsapp" as const
    : demande?.contact.channel === "E-mail" ? "email" as const : null;
  const qualificationFromDemande = demande ? [
    intake.planning_stage && `Plan : ${intake.planning_stage}`,
    demande.wishes.comfort && `Hébergements : ${demande.wishes.comfort}`,
    style && `Manières de voyager : ${style}`,
    demande.wishes.selection.length ? `Envies gardées : ${demande.wishes.selection.map(e => e.name).join(" · ")}` : "",
  ].filter(Boolean).join("\n") : qualification;
  // Facts are explicit traveler answers only. Wishes are interests, never a confirmed itinerary.
  const payload = demande ? {
    ...intake,
    qualification_facts: {
      ...(record(intake.qualification_facts) ? intake.qualification_facts : {}),
      travelers_adults: adultes,
      travelers_children: enfants,
      ...(knownChoice(demande.timing.duration) ? { duration: demande.timing.duration } : {}),
      ...(demande.timing.mode === "mois" && demande.timing.period ? { travel_period: demande.timing.period } : {}),
      ...(knownChoice(demande.wishes.comfort) ? { accommodation: demande.wishes.comfort } : {}),
    },
  } : intake;

  // Le récit voyageur va dans la description ; les notes internes restent à l’équipe.
  const internalBits = intake.follow_prefs ? `Préférences de suivi : ${intake.follow_prefs}` : "";
  const titreTrame = intakeStr(trame?.nom);

  return {
    traveler_name: travelerName,
    email,
    phone: String(intake.phone ?? ""),
    intake_channel: "web_form" as const,
    status: "new" as const,
    source: (intake.page_origin as string) || sourceDefault,
    trip_summary:
      (!demande ? titreTrame || intakeStr(intake.project_notes_short) : "") ||
      (intake.planning_stage as string) ||
      (lieux.length ? lieux.join(" · ") : "") ||
      `Demande web — ${travelerName}`,
    project_description: intakeStr(intake.notes_longues) || intakeStr(intake.project_notes_short) || null,
    destination_main: lieux[0] || null,
    travel_style: style || "—",
    travelers: (demande ? demande.travelers.label : travelersLine) || "—",
    ...(adultes === null ? {} : { travelers_adults: adultes }),
    ...(enfants === null ? {} : { travelers_children: enfants }),
    budget: budgetLine || "—",
    trip_dates: (demande ? demande.timing.label : tripDates) || "—",
    ...(demande ? {
      travel_period: demande.timing.mode === "mois" ? demande.timing.period || null : null,
      travel_start_date: demande.timing.start,
      travel_end_date: demande.timing.end,
      project_description: description || null,
      travel_desire_narrative: [
        style,
        demande.wishes.selection.length ? `Envies gardées : ${demande.wishes.selection.map(e => e.name).join(" · ")}` : "",
        demande.wishes.message,
      ].filter(Boolean).join("\n\n") || null,
      ...(preferredChannel ? { preferred_channel: preferredChannel } : {}),
    } : {}),
    qualification_summary: qualificationFromDemande || "—",
    internal_notes: internalBits,
    quote_status: "Nouveau",
    starred: false,
    priority,
    intake_payload: payload,
    submission_id: String(intake.submission_id),
    page_origin: (intake.page_origin as string) || null,
    referent_id: null,
    planning_stage: normalizePlanningStage(intakeStr(intake.planning_stage)),
  };
}

export function corsHeaders(allowOrigin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Intake-Secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGIN?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function resolveCors(request: Request): { allowOrigin: string; forbidden: boolean } {
  const isProd = process.env.NODE_ENV === "production";
  const allowedList = parseAllowedOrigins();
  const reqOriginRaw = request.headers.get("origin");
  const reqOrigin = reqOriginRaw ? normalizeOrigin(reqOriginRaw) : null;

  if (!isProd) {
    return { allowOrigin: "*", forbidden: false };
  }
  if (!allowedList.length) {
    return { allowOrigin: "*", forbidden: false };
  }
  const primary = allowedList[0];
  if (reqOrigin && !allowedList.includes(reqOrigin)) {
    return { allowOrigin: primary, forbidden: true };
  }
  const allowOrigin = reqOrigin && allowedList.includes(reqOrigin) ? reqOrigin : primary;
  return { allowOrigin, forbidden: false };
}

/** Si `INTAKE_SHARED_SECRET` est défini, impose le même secret (Bearer ou header dédié). */
export function verifyIntakeSharedSecret(request: Request): boolean {
  const secret = process.env.INTAKE_SHARED_SECRET?.trim();
  if (!secret) return true;

  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token === secret) return true;
  }
  const header = request.headers.get("x-intake-secret");
  if (header?.trim() === secret) return true;

  return false;
}
