import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyTrackingRelaySecret } from "@/lib/traveler-project-tracking";
import { dispatchProjectStatusEmails } from "@/lib/email/project-status-dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store, private" };

async function dispatch() {
  if (process.env.PROJECT_STATUS_EMAILS_ENABLED?.trim() !== "true") {
    return NextResponse.json({ disabled: true }, { status: 503, headers });
  }
  try {
    return NextResponse.json(await dispatchProjectStatusEmails(createServiceRoleClient()), { headers });
  } catch {
    return NextResponse.json({ error: "Email queue unavailable" }, { status: 503, headers });
  }
}

/** Local/server worker: retains the intake relay credential contract. */
export async function POST(request: Request) {
  if (!verifyTrackingRelaySecret(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  return dispatch();
}

/** Vercel Cron: only its own Bearer credential can trigger the GET schedule. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Cron unavailable" }, { status: 503, headers });
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const provided = Buffer.from(request.headers.get("authorization") || "", "utf8");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  return dispatch();
}
