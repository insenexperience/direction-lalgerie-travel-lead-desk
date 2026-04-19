"use client";

import { createClient } from "@/lib/supabase/client";
import type { MockLead } from "@/lib/mock-leads";
import { mapDbLeadRowsToMocks } from "@/lib/supabase-lead-mapper";

/** Lecture des leads avec la session navigateur (cookies) — fiabilise l’affichage si le RSC n’a pas la session. */
export async function fetchLeadsFromBrowser(): Promise<{
  leads: MockLead[];
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { leads: [], error: error.message };
  }

  return {
    leads: mapDbLeadRowsToMocks(data ?? null),
    error: null,
  };
}
