import type { QuoteItemLine } from "@/lib/quote-items-build";
import type { QuoteWorkflowStatus } from "@/lib/quote-workflow";
import { coerceQuoteWorkflowStatus } from "@/lib/quote-workflow";

export type CoConstructionProposalStatus =
  | "awaiting_agency"
  | "submitted"
  | "approved";

export type CoConstructionProposalRow = {
  id: string;
  lead_id: string;
  agency_id: string | null;
  title: string;
  circuit_outline: string;
  status: CoConstructionProposalStatus;
  version: number;
  created_by_profile_id: string | null;
  approved_at: string | null;
  approved_by_profile_id: string | null;
  converted_quote_id: string | null;
  created_at: string;
  updated_at: string;
  ai_suggested?: boolean;
  ai_match_score?: number | null;
  ai_match_rationale?: string | null;
  ai_recommended?: boolean;
  ai_proposal_score?: number | null;
  ai_proposal_rationale?: string | null;
  agency_proposal_received_at?: string | null;
};

export const coConstructionProposalStatusLabelFr: Record<
  CoConstructionProposalStatus,
  string
> = {
  awaiting_agency: "En attente — proposition agence",
  submitted: "Reçue — modifiable",
  approved: "Validée — prêt pour devis",
};

export type LeadQuoteListItem = {
  id: string;
  kind: string;
  status: string;
  workflow_status: QuoteWorkflowStatus;
  summary: string | null;
  created_at: string;
  items: QuoteItemLine[];
  sent_at: string | null;
  sent_via: string | null;
  pdf_storage_path: string | null;
};

export function mapProposalRowFromDb(
  r: Record<string, unknown>,
): CoConstructionProposalRow {
  const st = String(r.status ?? "awaiting_agency");
  const status: CoConstructionProposalStatus =
    st === "submitted" || st === "approved" ? st : "awaiting_agency";

  const aiMatch = r.ai_match_score;
  const aiProp = r.ai_proposal_score;

  return {
    id: String(r.id),
    lead_id: String(r.lead_id),
    agency_id: r.agency_id ? String(r.agency_id) : null,
    title: String(r.title ?? "Proposition de circuit"),
    circuit_outline: String(r.circuit_outline ?? ""),
    status,
    version: Number.isFinite(Number(r.version)) ? Number(r.version) : 1,
    created_by_profile_id: r.created_by_profile_id
      ? String(r.created_by_profile_id)
      : null,
    approved_at: r.approved_at ? String(r.approved_at) : null,
    approved_by_profile_id: r.approved_by_profile_id
      ? String(r.approved_by_profile_id)
      : null,
    converted_quote_id: r.converted_quote_id ? String(r.converted_quote_id) : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
    ai_suggested: Boolean(r.ai_suggested),
    ai_match_score:
      aiMatch != null && Number.isFinite(Number(aiMatch)) ? Number(aiMatch) : null,
    ai_match_rationale:
      r.ai_match_rationale != null ? String(r.ai_match_rationale) : null,
    ai_recommended: Boolean(r.ai_recommended),
    ai_proposal_score:
      aiProp != null && Number.isFinite(Number(aiProp)) ? Number(aiProp) : null,
    ai_proposal_rationale:
      r.ai_proposal_rationale != null ? String(r.ai_proposal_rationale) : null,
    agency_proposal_received_at: r.agency_proposal_received_at
      ? String(r.agency_proposal_received_at)
      : null,
  };
}

function parseQuoteItems(raw: unknown): QuoteItemLine[] {
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

export function mapQuoteRowFromDb(r: Record<string, unknown>): LeadQuoteListItem {
  return {
    id: String(r.id),
    kind: String(r.kind ?? ""),
    status: String(r.status ?? ""),
    workflow_status: coerceQuoteWorkflowStatus(r.workflow_status),
    summary: r.summary != null ? String(r.summary) : null,
    created_at: String(r.created_at ?? ""),
    items: parseQuoteItems(r.items),
    sent_at: r.sent_at != null ? String(r.sent_at) : null,
    sent_via: r.sent_via != null ? String(r.sent_via) : null,
    pdf_storage_path: r.pdf_storage_path != null ? String(r.pdf_storage_path) : null,
  };
}
