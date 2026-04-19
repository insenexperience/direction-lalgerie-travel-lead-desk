import { connection } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { mapDbLeadRowsToMocks } from "@/lib/supabase-lead-mapper";
import type { LeadStatus, MockLead } from "@/lib/mock-leads";
import { coerceLeadStatus } from "@/lib/lead-status-coerce";

export type LeadsWorkspaceResult = {
  leads: MockLead[];
  error: string | null;
  userId: string | null;
};

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

  const leads = mapDbLeadRowsToMocks(data ?? null);

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
