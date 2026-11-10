import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeskInboundMail } from "./gmail-intake";

export async function loadDeskGmail(db: SupabaseClient, leadId: string) {
  const { data, error } = await db.from("desk_gmail_messages")
    .select("gmail_id,gmail_thread_id,sender,subject,received_at,kind,excerpt,attachments")
    .eq("lead_id", leadId).order("received_at", { ascending: false }).limit(20).returns<DeskInboundMail[]>();
  return error ? { ok: false as const } : { ok: true as const, messages: data ?? [] };
}
