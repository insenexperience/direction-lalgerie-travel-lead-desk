import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { buildQuoteDevisPdfBuffer } from "@/lib/pdf/build-quote-devis-buffer";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ leadId: string; quoteId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { leadId, quoteId } = await params;

  if (!isUuid(leadId) || !isUuid(quoteId)) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: leadAccess, error: accessErr } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .maybeSingle();

  if (accessErr || !leadAccess) {
    return NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
  }

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, lead_id, items, workflow_status, created_at")
    .eq("id", quoteId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (qErr || !quote) {
    return NextResponse.json({ error: "Devis introuvable." }, { status: 404 });
  }

  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .select("traveler_name, email, phone, trip_summary")
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    return NextResponse.json({ error: "Lead introuvable." }, { status: 404 });
  }

  const buffer = await buildQuoteDevisPdfBuffer({
    quote: {
      id: String(quote.id),
      items: quote.items,
      workflow_status: quote.workflow_status,
      created_at: quote.created_at,
    },
    lead: {
      traveler_name: String(lead.traveler_name ?? ""),
      email: String(lead.email ?? ""),
      phone: String(lead.phone ?? ""),
      trip_summary: String(lead.trip_summary ?? ""),
    },
  });

  const safeName = `devis-${quoteId.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
