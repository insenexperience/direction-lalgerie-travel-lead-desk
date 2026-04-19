import { connection } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { mapDbLeadRowsToMocks } from "@/lib/supabase-lead-mapper";
import type {
  AgencyConsultationStatus,
  LeadAgencyLink,
  LeadStatus,
} from "@/lib/mock-leads";
import { coerceLeadStatus } from "@/lib/lead-status-coerce";

export type LeadsWorkspaceResult = {
  leads: ReturnType<typeof mapDbLeadRowsToMocks>;
  error: string | null;
  userId: string | null;
};

function agencyLabel(row: {
  legal_name?: string | null;
  trade_name?: string | null;
}): string {
  const t = row.trade_name?.trim();
  if (t) return t;
  return String(row.legal_name ?? "Agence");
}

/**
 * Loads leads for the signed-in user. Uses `connection()` so Next never
 * statically caches an empty result before the session is available.
 */
export async function getLeadsForWorkspace(): Promise<LeadsWorkspaceResult> {
  await connection();
  void (await headers());

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      leads: [],
      error: userError.message,
      userId: null,
    };
  }

  if (!user) {
    return { leads: [], error: "Session expirée ou absente.", userId: null };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      leads: [],
      error: error.message,
      userId: user.id,
    };
  }

  const rows = data ?? [];
  const leadIds = rows.map((r) => String((r as Record<string, unknown>).id));
  const consultationsByLeadId = new Map<string, LeadAgencyLink[]>();

  if (leadIds.length) {
    const { data: cons } = await supabase
      .from("consultations")
      .select("id, lead_id, agency_id, status, quote_summary")
      .in("lead_id", leadIds);

    const agencyIds = [
      ...new Set((cons ?? []).map((c) => String(c.agency_id)).filter(Boolean)),
    ];

    const agencyNames = new Map<string, string>();
    if (agencyIds.length) {
      const { data: agRows } = await supabase
        .from("agencies")
        .select("id, legal_name, trade_name")
        .in("id", agencyIds);
      for (const a of agRows ?? []) {
        agencyNames.set(
          String(a.id),
          agencyLabel({
            legal_name: a.legal_name as string,
            trade_name: a.trade_name as string | null,
          }),
        );
      }
    }

    for (const c of cons ?? []) {
      const leadId = String(c.lead_id);
      const list = consultationsByLeadId.get(leadId) ?? [];
      const st = String(c.status ?? "invited");
      const allowed: AgencyConsultationStatus[] = [
        "invited",
        "pending",
        "quote_received",
        "declined",
        "reminded",
        "expired",
      ];
      const status: AgencyConsultationStatus = allowed.includes(
        st as AgencyConsultationStatus,
      )
        ? (st as AgencyConsultationStatus)
        : "pending";
      list.push({
        id: String(c.id),
        agencyId: String(c.agency_id),
        agencyName: agencyNames.get(String(c.agency_id)) ?? String(c.agency_id),
        status,
        quoteSummary:
          typeof c.quote_summary === "string" ? c.quote_summary : undefined,
      });
      consultationsByLeadId.set(leadId, list);
    }
  }

  const leads = mapDbLeadRowsToMocks(rows, consultationsByLeadId);

  return { leads, error: null, userId: user.id };
}

export type RecentLeadSummary = {
  id: string;
  travelerName: string;
  status: LeadStatus;
};

export async function getRecentLeadSummaries(
  limit = 6,
): Promise<{ items: RecentLeadSummary[]; error: string | null }> {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { items: [], error: null };
  }

  const { data, error } = await supabase
    .from("leads")
    .select("id, traveler_name, status")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { items: [], error: error.message };
  }

  const items: RecentLeadSummary[] = (data ?? []).map((row) => ({
    id: String(row.id),
    travelerName: String(row.traveler_name ?? ""),
    status: coerceLeadStatus(String(row.status ?? "new")),
  }));

  return { items, error: null };
}
