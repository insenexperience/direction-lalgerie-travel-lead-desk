import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deskGmailConfiguration, syncDeskGmail } from "@/lib/email/gmail-sync";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Cron unavailable" }, { status: 503, headers });
  const expected = Buffer.from("Bearer " + secret);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const configuration = deskGmailConfiguration();
  if (configuration === "disabled") return NextResponse.json({ disabled: true }, { headers });
  if (configuration === "unconfigured") return NextResponse.json({ error: "Gmail not configured" }, { status: 503, headers });
  try {
    return NextResponse.json(await syncDeskGmail(createServiceRoleClient()), { headers });
  } catch {
    return NextResponse.json({ error: "Gmail sync unavailable" }, { status: 503, headers });
  }
}
