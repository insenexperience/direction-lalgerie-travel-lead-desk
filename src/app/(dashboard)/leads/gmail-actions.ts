"use server";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { loadDeskGmail } from "@/lib/email/desk-gmail-read";

export async function readDeskGmail(leadId: string) {
  if (typeof leadId !== "string" || !isUuid(leadId)) return { ok: false as const };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const };
  const [{ data: lead }, { data: profile }] = await Promise.all([
    db.from("leads").select("referent_id").eq("id", leadId).is("deleted_at", null).maybeSingle(),
    db.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!lead || (profile?.role !== "admin" && lead.referent_id !== user.id)) return { ok: false as const };
  return loadDeskGmail(db, leadId);
}
