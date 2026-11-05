import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  normalizeTrackingToken,
  travelerProjectTracking,
  verifyTrackingRelaySecret,
  verifyTrackingToken,
} from "@/lib/traveler-project-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
const unavailable = () => NextResponse.json({ error: "Suivi indisponible" }, { status: 404, headers: HEADERS });

/** Read-only, server relay + per-request browser proof. No public lookup by submission id. */
export async function POST(request: Request) {
  if (!verifyTrackingRelaySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  }
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ error: "Invalid payload" }, { status: 413, headers: HEADERS });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: HEADERS });
  }
  const submissionId = typeof body.submission_id === "string" ? body.submission_id.trim() : "";
  if (!submissionId || submissionId.length > 200 || !normalizeTrackingToken(body.suivi_token)) return unavailable();

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("leads")
      .select("status,intake_payload")
      .eq("submission_id", submissionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Suivi temporairement indisponible" }, { status: 503, headers: HEADERS });
    if (!data || !verifyTrackingToken(body.suivi_token, data.intake_payload)) return unavailable();
    const suivi = travelerProjectTracking(data.status);
    if (!suivi) return NextResponse.json({ error: "Suivi temporairement indisponible" }, { status: 503, headers: HEADERS });
    return NextResponse.json({ ok: true, suivi }, { headers: HEADERS });
  } catch {
    // Do not log proof, body or database errors, which may contain submitted data.
    return NextResponse.json({ error: "Suivi temporairement indisponible" }, { status: 503, headers: HEADERS });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: HEADERS });
}
