import type { PartnerAgency, PartnerAgencyStatus, PartnerAgencyType } from "@/lib/mock-agencies";

const TYPES: PartnerAgencyType[] = ["dmc", "travel_agency", "tour_operator", "other"];
const STATUSES: PartnerAgencyStatus[] = ["active", "pending_validation", "suspended"];

function coerceType(v: unknown): PartnerAgencyType {
  const s = typeof v === "string" ? v : "other";
  return TYPES.includes(s as PartnerAgencyType) ? (s as PartnerAgencyType) : "other";
}

function coerceStatus(v: unknown): PartnerAgencyStatus {
  const s = typeof v === "string" ? v : "pending_validation";
  return STATUSES.includes(s as PartnerAgencyStatus)
    ? (s as PartnerAgencyStatus)
    : "pending_validation";
}

/** Ligne `agencies` renvoyée par Supabase (snake_case). */
export function mapAgencyRowToPartner(row: Record<string, unknown>): PartnerAgency {
  const trade = row.trade_name != null ? String(row.trade_name).trim() : "";
  const created =
    row.created_at != null ? String(row.created_at) : new Date().toISOString();

  return {
    id: String(row.id),
    legalName: String(row.legal_name ?? "").trim() || "—",
    tradeName: trade || undefined,
    type: coerceType(row.type),
    country: String(row.country ?? "").trim(),
    city: String(row.city ?? "").trim(),
    website: row.website != null ? String(row.website).trim() || undefined : undefined,
    contactName: String(row.contact_name ?? "").trim(),
    email: String(row.email ?? "").trim(),
    phone: String(row.phone ?? "").trim(),
    destinations: String(row.destinations ?? "").trim(),
    languages: String(row.languages ?? "").trim(),
    segments: String(row.segments ?? "").trim(),
    slaQuoteDays: Number.isFinite(Number(row.sla_quote_days))
      ? Math.max(1, Math.min(30, Number(row.sla_quote_days)))
      : 5,
    status: coerceStatus(row.status),
    internalNotes:
      row.internal_notes != null ? String(row.internal_notes).trim() || undefined : undefined,
    createdAt: created.slice(0, 10),
  };
}
