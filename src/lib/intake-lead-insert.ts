/**
 * Construction de l’objet `leads` à partir d’un payload « intake » (JSON formulaire
 * Squarespace ou champs alignés dashboard). Utilisé par `/api/intake` et `createLeadFromIntake`.
 */

export function intakeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Nom affiché / voyageur : `full_name` si présent, sinon « prénom + nom »
 * (`first`/`last` sur le formulaire site, aligné avec le modal dashboard).
 */
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
export function buildLeadInsertFromIntake(
  intake: Record<string, unknown>,
  opts?: BuildLeadInsertOptions,
) {
  const sourceDefault = opts?.sourceFallback ?? "Formulaire site (Squarespace)";
  const priority = opts?.priority === "high" ? "high" : "normal";
  const travelerName = intakeStr(intake.full_name) || intakeStr(intake.email);
  const email = intakeStr(intake.email);
  const mode = String(intake.dates_mode ?? "").toLowerCase();

  let tripDates = "—";
  if (mode.includes("flex")) {
    const parts = [intake.flex_month, intake.flex_duration]
      .map((x) => (x != null ? String(x).trim() : ""))
      .filter(Boolean);
    tripDates = parts.length ? parts.join(" · ") : "Période flexible";
  } else if (intake.date_start || intake.date_end) {
    tripDates = `${intake.date_start || "—"} → ${intake.date_end || "—"}`;
  }

  const cur = String(intake.currency || "EUR");
  const ideal = intake.budget_ideal ? String(intake.budget_ideal) : "";
  const max = intake.budget_max ? String(intake.budget_max) : "";
  const budgetLine =
    ideal || max
      ? `${ideal ? `${ideal} ${cur}` : "?"} → ${max ? `${max} ${cur}` : "?"} / pers.`
      : "";

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

  const internalBits = [
    intake.follow_prefs && `Préférences suivi : ${intake.follow_prefs}`,
    intake.notes_longues,
    intake.page_origin && `Page d'origine : ${intake.page_origin}`,
    `submission_id : ${intake.submission_id}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    traveler_name: travelerName,
    email,
    phone: String(intake.phone ?? ""),
    intake_channel: "web_form" as const,
    status: "new" as const,
    source: (intake.page_origin as string) || sourceDefault,
    trip_summary:
      (intake.planning_stage as string) ||
      `Demande web — ${travelerName}`,
    travel_style: (intake.vision as string) || "—",
    travelers: travelersLine || "—",
    budget: budgetLine || "—",
    trip_dates: tripDates,
    qualification_summary: qualification || "—",
    internal_notes: internalBits || "—",
    quote_status: "Nouveau",
    starred: false,
    priority,
    intake_payload: intake,
    submission_id: String(intake.submission_id),
    page_origin: (intake.page_origin as string) || null,
    referent_id: null,
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
