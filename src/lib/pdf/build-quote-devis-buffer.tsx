import { renderToBuffer } from "@react-pdf/renderer";
import { QuoteDevisPdfDocument } from "@/lib/pdf/quote-devis-pdf";
import type { QuoteItemLine } from "@/lib/quote-items-build";
import {
  coerceQuoteWorkflowStatus,
  quoteWorkflowStatusLabelFr,
} from "@/lib/quote-workflow";

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

export type QuoteDevisPdfSource = {
  quote: {
    id: string;
    items: unknown;
    workflow_status: unknown;
    created_at: unknown;
  };
  lead: {
    traveler_name: string;
    email: string;
    phone: string;
    trip_summary: string;
  };
};

export async function buildQuoteDevisPdfBuffer(
  input: QuoteDevisPdfSource,
): Promise<Buffer> {
  const wf = coerceQuoteWorkflowStatus(input.quote.workflow_status);
  const items = parseItems(input.quote.items);
  const created = new Date(String(input.quote.created_at ?? "")).toLocaleString(
    "fr-FR",
    { dateStyle: "long", timeStyle: "short" },
  );

  return renderToBuffer(
    <QuoteDevisPdfDocument
      data={{
        quoteId: String(input.quote.id),
        createdAt: created,
        travelerName: input.lead.traveler_name,
        travelerEmail: input.lead.email,
        travelerPhone: input.lead.phone,
        tripSummary: input.lead.trip_summary,
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
}
