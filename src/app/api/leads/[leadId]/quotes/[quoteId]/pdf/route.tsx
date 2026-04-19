import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { QuoteDevisPdfDocument } from "@/lib/pdf/quote-devis-pdf";
import type { QuoteItemLine } from "@/lib/quote-items-build";
import {
  coerceQuoteWorkflowStatus,
  quoteWorkflowStatusLabelFr,
} from "@/lib/quote-workflow";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ leadId: string; quoteId: string }> };

function parseItems(raw: unknown): QuoteItemLine[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: QuoteItemLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    const detail = typeof o.detail === "string" ? o.detail : "";
    if (label || detail) out.push({ label: label || "—", detail: detail || "—" });
  }
  return out;
}

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

  const wf = coerceQuoteWorkflowStatus(quote.workflow_status);
  const items = parseItems(quote.items);

  const created = new Date(String(quote.created_at ?? "")).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const buffer = await renderToBuffer(
    <QuoteDevisPdfDocument
      data={{
        quoteId: String(quote.id),
        createdAt: created,
        travelerName: String(lead.traveler_name ?? ""),
        travelerEmail: String(lead.email ?? ""),
        travelerPhone: String(lead.phone ?? ""),
        tripSummary: String(lead.trip_summary ?? ""),
        workflowLabel: quoteWorkflowStatusLabelFr[wf],
        items: items.length
          ? items
          : [
              {
                label: "Contenu",
                detail:
                  "— (aucune ligne structurée — complétez le devis ou régénérez depuis la proposition)",
              },
            ],
      }}
    />,
  );

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
