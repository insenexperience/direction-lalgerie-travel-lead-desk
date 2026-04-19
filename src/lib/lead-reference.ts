import type { SupabaseClient } from "@supabase/supabase-js";

const REF_RE = /^DA-(\d{4})-(\d{4})$/;

/** Affichage monospace : référence métier ou UUID tronqué (PRD §7.3). */
export function formatLeadReferenceDisplay(lead: {
  id: string;
  reference: string | null;
}): string {
  const r = lead.reference?.trim();
  if (r) return r;
  return `${lead.id.slice(0, 8)}…`;
}

/**
 * Alloue une référence `DA-YYYY-NNNN` si absente (concurrence : retry sur conflit unique).
 */
export async function allocateLeadReferenceIfMissing(
  supabase: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data: row } = await supabase
    .from("leads")
    .select("id, reference, created_at")
    .eq("id", leadId)
    .maybeSingle();

  if (!row) return null;
  const existing = row.reference as string | null;
  if (existing?.trim()) return existing.trim();

  const createdAt = row.created_at ? new Date(String(row.created_at)) : new Date();
  const year = createdAt.getFullYear();

  for (let attempt = 0; attempt < 8; attempt++) {
    const next = await nextReferenceForYear(supabase, year);
    const { error } = await supabase
      .from("leads")
      .update({ reference: next })
      .eq("id", leadId)
      .is("reference", null);

    if (!error) return next;
    if (error.code === "23505") continue;
    return null;
  }
  return null;
}

async function nextReferenceForYear(
  supabase: SupabaseClient,
  year: number,
): Promise<string> {
  const prefix = `DA-${year}-`;
  const { data: rows, error } = await supabase
    .from("leads")
    .select("reference")
    .like("reference", `${prefix}%`);

  if (error) {
    return `${prefix}${String(1).padStart(4, "0")}`;
  }

  let maxN = 0;
  for (const r of rows ?? []) {
    const ref = typeof r.reference === "string" ? r.reference : "";
    const m = REF_RE.exec(ref);
    if (m && Number(m[1]) === year) {
      maxN = Math.max(maxN, parseInt(m[2], 10));
    }
  }
  return `${prefix}${String(maxN + 1).padStart(4, "0")}`;
}
