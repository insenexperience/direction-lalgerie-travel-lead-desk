import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendTransactionalHtmlEmail } from "@/lib/email/resend-client";
import {
  buildTravelerSummary,
  isTokenExpired,
  parseTravelerResponses,
} from "@/lib/traveler-requalification";
import { isUuid } from "@/lib/is-uuid";

export const runtime = "nodejs";

const LEAD_COLUMNS =
  "id, reference, traveler_name, trip_dates, travelers, travel_style, budget, trip_summary, public_token, public_token_expires_at, traveler_responses, traveler_responses_submitted_at";

async function findLeadByToken(
  token: string,
): Promise<Record<string, unknown> | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isUuid(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const lead = await findLeadByToken(token);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isTokenExpired(lead.public_token_expires_at as string | null)) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }
    return NextResponse.json({
      summary: buildTravelerSummary(lead),
      alreadySubmitted: Boolean(lead.traveler_responses_submitted_at),
      existingResponses: lead.traveler_responses ?? null,
    });
  } catch (e) {
    console.error("[api/q] GET", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isUuid(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const responses = parseTravelerResponses(body);
  if (!responses) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  try {
    const lead = await findLeadByToken(token);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isTokenExpired(lead.public_token_expires_at as string | null)) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }
    if (lead.traveler_responses_submitted_at) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("leads")
      .update({
        traveler_responses: responses,
        traveler_responses_submitted_at: new Date().toISOString(),
      })
      .eq("id", String(lead.id));

    if (error) {
      console.error("[api/q] update", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    revalidatePath(`/leads/${String(lead.id)}`);
    revalidatePath("/leads");
    revalidatePath("/dashboard");

    // Notification interne best-effort (dégradé silencieux sans Resend).
    const to =
      process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() ||
      process.env.RESEND_FROM_EMAIL?.trim();
    if (to) {
      const reference = String(
        lead.reference ?? String(lead.id).slice(0, 8),
      );
      const result = await sendTransactionalHtmlEmail({
        to,
        subject: `Réponses voyageur reçues — ${reference}`,
        html: `<p>Le voyageur du dossier <strong>${reference}</strong> a complété sa qualification.</p><p>Ouvrez le desk pour consulter ses réponses.</p>`,
      });
      if (!result.ok) console.warn("[api/q] notif email:", result.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/q] POST", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
