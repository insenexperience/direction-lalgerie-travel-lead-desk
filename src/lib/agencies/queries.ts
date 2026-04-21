import { createClient } from "@/lib/supabase/server";
import { getAgencyLogoUrl } from "@/lib/agencies/logo-upload";
import type { AgencyListItem, AgencyDetail, AgencyMetrics, AgencyLeadLink } from "@/lib/agencies/types";
import type { PartnerAgencyType, PartnerAgencyStatus } from "@/lib/mock-agencies";

function parseBudget(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export interface AgencyListFilters {
  search?: string;
  status?: PartnerAgencyStatus;
  type?: PartnerAgencyType;
  country?: string;
}

export async function getAgenciesList(filters?: AgencyListFilters): Promise<AgencyListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("agencies")
    .select("id, legal_name, trade_name, type, status, country, city, website, destinations, languages, segments, sla_quote_days, internal_notes, logo_storage_path, contact_name, email, phone, created_at, updated_at")
    .order("legal_name");

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.type)   query = query.eq("type", filters.type);
  if (filters?.country) query = query.ilike("country", `%${filters.country}%`);
  if (filters?.search) {
    query = query.or(
      `legal_name.ilike.%${filters.search}%,trade_name.ilike.%${filters.search}%,city.ilike.%${filters.search}%,destinations.ilike.%${filters.search}%`
    );
  }

  const { data: agencies } = await query;
  if (!agencies) return [];

  const agencyIds = agencies.map((a) => a.id);

  // Metrics in parallel
  const [contactsRes, retainedRes, consultationsRes] = await Promise.all([
    supabase
      .from("agency_contacts")
      .select("agency_id, is_primary, full_name, email, phone")
      .in("agency_id", agencyIds),
    supabase
      .from("leads")
      .select("retained_agency_id, status, budget")
      .in("retained_agency_id", agencyIds),
    supabase
      .from("consultations")
      .select("agency_id, status")
      .in("agency_id", agencyIds)
      .gte("created_at", new Date(Date.now() - 90 * 86400_000).toISOString()),
  ]);

  const contacts = contactsRes.data ?? [];
  const retainedLeads = retainedRes.data ?? [];
  const consultations = consultationsRes.data ?? [];

  return agencies.map((a) => {
    const agencyContacts = contacts.filter((c) => c.agency_id === a.id);
    const primary = agencyContacts.find((c) => c.is_primary) ?? agencyContacts[0];
    const aLeads = retainedLeads.filter((l) => l.retained_agency_id === a.id);
    const aConsults = consultations.filter((c) => c.agency_id === a.id);
    const accepted = aConsults.filter((c) => c.status === "quote_received").length;

    const metrics: AgencyMetrics = {
      leadsActive: aLeads.filter((l) => !["won", "lost"].includes(l.status as string)).length,
      leadsWon: aLeads.filter((l) => l.status === "won").length,
      consultationsTotal: aConsults.length,
      consultationsAccepted: accepted,
      acceptanceRate: aConsults.length > 0 ? Math.round((accepted / aConsults.length) * 100) : 0,
      revenueWon: aLeads.filter((l) => l.status === "won").reduce((sum, l) => sum + parseBudget(l.budget as string), 0),
    };

    return {
      id: a.id,
      legal_name: a.legal_name,
      trade_name: a.trade_name ?? null,
      type: a.type as PartnerAgencyType,
      status: a.status as PartnerAgencyStatus,
      country: a.country,
      city: a.city,
      website: a.website ?? null,
      destinations: a.destinations,
      languages: a.languages,
      segments: a.segments,
      sla_quote_days: a.sla_quote_days,
      internal_notes: a.internal_notes ?? null,
      logo_storage_path: (a as Record<string, unknown>).logo_storage_path as string | null ?? null,
      logo_url: getAgencyLogoUrl((a as Record<string, unknown>).logo_storage_path as string | null),
      primary_contact_name: primary?.full_name ?? (a.contact_name as string | null) ?? null,
      primary_contact_email: primary?.email ?? (a.email as string | null) ?? null,
      primary_contact_phone: primary?.phone ?? (a.phone as string | null) ?? null,
      metrics,
      created_at: a.created_at,
      updated_at: a.updated_at,
    } as AgencyListItem;
  });
}

export async function getAgencyDetail(id: string): Promise<AgencyDetail | null> {
  const supabase = await createClient();

  const { data: a } = await supabase
    .from("agencies")
    .select("*")
    .eq("id", id)
    .single();

  if (!a) return null;

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [contactsRes, retainedRes, consultedRes, consultationsRes, wonLeadsRes] = await Promise.all([
    supabase.from("agency_contacts").select("*").eq("agency_id", id).order("is_primary", { ascending: false }),
    supabase.from("leads").select("id, reference, traveler_name, status, budget, created_at, updated_at").eq("retained_agency_id", id).not("status", "in", '("won","lost")').order("updated_at", { ascending: false }),
    supabase.from("consultations").select("lead_id, status, leads(id, reference, traveler_name, status, budget, created_at)").eq("agency_id", id).not("status", "eq", "declined").order("created_at", { ascending: false }).limit(50),
    supabase.from("consultations").select("status").eq("agency_id", id).gte("created_at", new Date(Date.now() - 90 * 86400_000).toISOString()),
    supabase.from("leads").select("budget, updated_at").eq("retained_agency_id", id).eq("status", "won").gte("updated_at", twelveMonthsAgo.toISOString()),
  ]);

  const contacts = contactsRes.data ?? [];
  const retainedLeads = retainedRes.data ?? [];

  type ConsultRow = { lead_id: string; status: string; leads: { id: string; reference: string | null; traveler_name: string; status: string; budget: string | null; created_at: string } | null };
  const consulted = (consultedRes.data ?? []) as unknown as ConsultRow[];
  const consultations = consultationsRes.data ?? [];

  const retainedLeadIds = new Set(retainedLeads.map((l) => l.id));

  const activeLeads: AgencyLeadLink[] = [
    ...retainedLeads.map((l) => ({
      lead_id: l.id,
      reference: (l.reference as string | null) ?? l.id.slice(0, 8),
      traveler_name: l.traveler_name as string,
      status: l.status as string,
      budget_parsed: parseBudget(l.budget as string) || null,
      created_at: l.created_at as string,
      link_kind: "retained" as const,
    })),
    ...consulted
      .filter((c) => c.leads && !retainedLeadIds.has(c.lead_id))
      .map((c) => ({
        lead_id: c.lead_id,
        reference: c.leads!.reference ?? c.lead_id.slice(0, 8),
        traveler_name: c.leads!.traveler_name,
        status: c.leads!.status,
        budget_parsed: parseBudget(c.leads!.budget) || null,
        created_at: c.leads!.created_at,
        link_kind: "consultation" as const,
      })),
  ];

  const accepted = consultations.filter((c) => c.status === "quote_received").length;
  const revenueWon = (wonLeadsRes.data ?? []).reduce((sum, l) => sum + parseBudget(l.budget as string), 0);

  const allRetained = await supabase.from("leads").select("status, budget").eq("retained_agency_id", id);
  const allRetainedRows = allRetained.data ?? [];

  const metrics: AgencyMetrics = {
    leadsActive: allRetainedRows.filter((l) => !["won", "lost"].includes(l.status as string)).length,
    leadsWon: allRetainedRows.filter((l) => l.status === "won").length,
    consultationsTotal: consultations.length,
    consultationsAccepted: accepted,
    acceptanceRate: consultations.length > 0 ? Math.round((accepted / consultations.length) * 100) : 0,
    revenueWon,
  };

  const primary = contacts.find((c) => c.is_primary) ?? contacts[0];

  return {
    id: a.id,
    legal_name: a.legal_name as string,
    trade_name: (a.trade_name as string | null) ?? null,
    type: a.type as PartnerAgencyType,
    status: a.status as PartnerAgencyStatus,
    country: a.country as string,
    city: a.city as string,
    website: (a.website as string | null) ?? null,
    destinations: a.destinations as string,
    languages: a.languages as string,
    segments: a.segments as string,
    sla_quote_days: a.sla_quote_days as number,
    internal_notes: (a.internal_notes as string | null) ?? null,
    ai_capabilities_summary: (a.ai_capabilities_summary as string | null) ?? null,
    circuits_data: (a.circuits_data as unknown[]) ?? [],
    logo_storage_path: (a.logo_storage_path as string | null) ?? null,
    logo_url: getAgencyLogoUrl(a.logo_storage_path as string | null),
    logo_updated_at: (a.logo_updated_at as string | null) ?? null,
    primary_contact_name: primary?.full_name ?? null,
    primary_contact_email: primary?.email ?? null,
    primary_contact_phone: primary?.phone ?? null,
    contacts: contacts as AgencyDetail["contacts"],
    metrics,
    activeLeads,
    created_at: a.created_at as string,
    updated_at: a.updated_at as string,
  };
}

export async function getAgencyRevenueChart(agencyId: string): Promise<{ label: string; value: number; isCurrent: boolean }[]> {
  const supabase = await createClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);

  const { data } = await supabase
    .from("leads")
    .select("budget, updated_at")
    .eq("retained_agency_id", agencyId)
    .eq("status", "won")
    .gte("updated_at", twelveMonthsAgo.toISOString());

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const buckets: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    buckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  (data ?? []).forEach((l) => {
    const d = new Date(l.updated_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in buckets) buckets[key] += parseBudget(l.budget as string);
  });

  return Object.entries(buckets).map(([key, val]) => ({
    label: new Date(key + "-01").toLocaleDateString("fr-FR", { month: "short" }),
    value: val,
    isCurrent: key === currentMonthKey,
  }));
}
