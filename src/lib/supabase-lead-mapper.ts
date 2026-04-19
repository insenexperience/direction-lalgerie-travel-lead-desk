import type { LeadAgencyLink, LeadStatus, MockLead } from "@/lib/mock-leads";
import { coerceLeadStatus } from "@/lib/lead-status-coerce";

function coerceStatus(value: unknown): LeadStatus {
  const s = typeof value === "string" ? value : "new";
  return coerceLeadStatus(s);
}

function buildDatesLine(row: Record<string, unknown>): string {
  const base = typeof row.trip_dates === "string" ? row.trip_dates.trim() : "";
  if (base) return base;
  const intake = row.intake_payload as Record<string, unknown> | null | undefined;
  if (!intake) return "—";
  const mode = String(intake.dates_mode ?? "");
  if (mode.toLowerCase().includes("flex")) {
    const parts = [
      intake.flex_period,
      intake.flex_month,
      intake.flex_duration,
    ]
      .map((x) => (x != null ? String(x).trim() : ""))
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : "Periode flexible";
  }
  const a = intake.date_start ? String(intake.date_start) : "";
  const b = intake.date_end ? String(intake.date_end) : "";
  if (a || b) return `${a || "—"} \u2192 ${b || "—"}`;
  return "—";
}

export function mapDbLeadRowToMock(
  row: Record<string, unknown>,
  agencyLinks: LeadAgencyLink[] = [],
): MockLead {
  const referentId = row.referent_id ? String(row.referent_id) : null;
  const retained = row.retained_agency_id ? String(row.retained_agency_id) : null;

  let assignedAgency = referentId
    ? "Operateur assigne"
    : "A assigner (operateur)";
  if (retained) {
    assignedAgency = "Agence retenue (voir fiche)";
  }

  return {
    id: String(row.id),
    referentId,
    travelerName: String(row.traveler_name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    status: coerceStatus(row.status),
    source: String(row.source ?? "").trim() || "Formulaire site",
    tripSummary: String(row.trip_summary ?? "").trim() || "—",
    travelStyle: String(row.travel_style ?? "").trim() || "—",
    travelers: String(row.travelers ?? "").trim() || "—",
    budget: String(row.budget ?? "").trim() || "—",
    dates: buildDatesLine(row),
    qualificationSummary:
      String(row.qualification_summary ?? "").trim() || "—",
    internalNotes: String(row.internal_notes ?? "").trim() || "—",
    assignedAgency,
    quoteStatus: String(row.quote_status ?? "").trim() || "—",
    timeline: [],
    starred: Boolean(row.starred),
    priority: row.priority === "high" ? "high" : "normal",
    agencyLinks,
    retainedAgencyId: retained,
    intakeChannel: row.intake_channel != null ? String(row.intake_channel) : null,
    qualificationPending:
      String(row.qualification_validation_status ?? "pending") === "pending",
  };
}

export function mapDbLeadRowsToMocks(
  rows: unknown[] | null,
  consultationsByLeadId?: Map<string, LeadAgencyLink[]>,
): MockLead[] {
  if (!rows?.length) return [];
  const out: MockLead[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    try {
      const row = r as Record<string, unknown>;
      const id = String(row.id);
      const links = consultationsByLeadId?.get(id) ?? [];
      out.push(mapDbLeadRowToMock(row, links));
    } catch {
      /* ligne ignorée si schéma inattendu */
    }
  }
  return out;
}
