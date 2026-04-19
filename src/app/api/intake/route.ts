import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type IntakeJson = {
  full_name?: unknown;
  email?: unknown;
  submission_id?: unknown;
  page_origin?: unknown;
  phone?: unknown;
  follow_prefs?: unknown;
  planning_stage?: unknown;
  project_notes_short?: unknown;
  group_type?: unknown;
  travellers_count?: unknown;
  dates_mode?: unknown;
  date_start?: unknown;
  date_end?: unknown;
  flex_period?: unknown;
  flex_month?: unknown;
  flex_duration?: unknown;
  hebergements?: unknown;
  vision?: unknown;
  currency?: unknown;
  budget_ideal?: unknown;
  budget_max?: unknown;
  budget_total?: unknown;
  notes_longues?: unknown;
  submitted_at?: unknown;
  [key: string]: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function corsHeaders(allowOrigin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Dev : `*`. Prod + `ALLOWED_ORIGIN` : refuse si `Origin` est présent et différent (navigateur) ;
 * requêtes sans `Origin` (ex. curl) autorisées.
 */
function resolveCors(
  request: Request,
): { allowOrigin: string; forbidden: boolean } {
  const isProd = process.env.NODE_ENV === "production";
  const allowed = process.env.ALLOWED_ORIGIN?.trim();
  const reqOrigin = request.headers.get("origin");

  if (!isProd) {
    return { allowOrigin: "*", forbidden: false };
  }
  if (!allowed) {
    return { allowOrigin: "*", forbidden: false };
  }
  if (reqOrigin && reqOrigin !== allowed) {
    return { allowOrigin: allowed, forbidden: true };
  }
  return { allowOrigin: allowed, forbidden: false };
}

function buildIntakeRecord(body: IntakeJson): Record<string, unknown> {
  const flexPeriod = str(body.flex_period);
  const flexMonth = str(body.flex_month);
  const flexDuration = str(body.flex_duration);
  const mergedFlex = [flexMonth, flexDuration].filter(Boolean).join(" · ") || flexPeriod;

  return {
    full_name: str(body.full_name),
    email: str(body.email),
    phone: str(body.phone),
    follow_prefs: str(body.follow_prefs),
    planning_stage: str(body.planning_stage),
    project_notes_short: str(body.project_notes_short),
    group_type: str(body.group_type),
    travellers_count: str(body.travellers_count),
    dates_mode: str(body.dates_mode),
    date_start: str(body.date_start),
    date_end: str(body.date_end),
    flex_period: mergedFlex,
    flex_month: flexMonth,
    flex_duration: flexDuration,
    hebergements: str(body.hebergements),
    vision: str(body.vision),
    currency: str(body.currency) || "EUR",
    budget_ideal: str(body.budget_ideal),
    budget_max: str(body.budget_max),
    budget_total: str(body.budget_total),
    notes_longues: str(body.notes_longues),
    submission_id: str(body.submission_id),
    page_origin: str(body.page_origin),
    submitted_at:
      typeof body.submitted_at === "string" && body.submitted_at
        ? body.submitted_at
        : new Date().toISOString(),
  };
}

function buildLeadInsertFromIntake(intake: Record<string, unknown>) {
  const travelerName = str(intake.full_name) || str(intake.email);
  const email = str(intake.email);
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
    source: (intake.page_origin as string) || "Formulaire site (Squarespace)",
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
    priority: "normal" as const,
    intake_payload: intake,
    submission_id: String(intake.submission_id),
    page_origin: (intake.page_origin as string) || null,
    referent_id: null,
  };
}

export function OPTIONS(request: Request) {
  const { allowOrigin } = resolveCors(request);
  return new NextResponse(null, { status: 204, headers: corsHeaders(allowOrigin) });
}

export async function POST(request: Request) {
  const { allowOrigin, forbidden } = resolveCors(request);
  const jsonHeaders = { ...corsHeaders(allowOrigin), "Content-Type": "application/json" };

  if (forbidden) {
    return NextResponse.json(
      { error: "Forbidden origin" },
      { status: 403, headers: jsonHeaders },
    );
  }

  let body: IntakeJson;
  try {
    body = (await request.json()) as IntakeJson;
  } catch (e) {
    console.error("[api/intake] invalid JSON", e);
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const fullName = str(body.full_name);
  const email = str(body.email);
  const submissionId = str(body.submission_id);

  if (!fullName || !email || !submissionId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 422, headers: jsonHeaders },
    );
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    console.error("[api/intake] Supabase service client", e);
    return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
  }

  try {
    const { data: existing, error: findErr } = await supabase
      .from("leads")
      .select("id")
      .eq("submission_id", submissionId)
      .maybeSingle();

    if (findErr) {
      console.error("[api/intake] idempotency select", findErr);
      return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
    }

    if (existing?.id) {
      return NextResponse.json(
        { status: "already_received", id: String(existing.id) },
        { status: 200, headers: jsonHeaders },
      );
    }

    const intake = buildIntakeRecord(body);
    const row = buildLeadInsertFromIntake(intake);

    const { data: created, error: insErr } = await supabase
      .from("leads")
      .insert(row)
      .select("id")
      .single();

    if (insErr || !created?.id) {
      console.error("[api/intake] insert", insErr);
      return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
    }

    return NextResponse.json(
      { status: "created", id: String(created.id) },
      { status: 201, headers: jsonHeaders },
    );
  } catch (e) {
    console.error("[api/intake] unexpected", e);
    return NextResponse.json({ error: "DB error" }, { status: 500, headers: jsonHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
