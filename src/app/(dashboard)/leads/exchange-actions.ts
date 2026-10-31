"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { MANUAL_CHANNELS, type ManualChannel } from "@/lib/bo3/manual-stage";
import type { Resultat } from "./projet-actions";

export type ExternalExchangeInput = { channel: ManualChannel; note: string; occurredAt: string; firstResponse: boolean; expectedUpdatedAt: string };

export async function enregistrerEchangeExterne(leadId: string, input: ExternalExchangeInput): Promise<Resultat> {
  if (!isUuid(leadId) || !input || typeof input !== "object"
    || !Object.hasOwn(MANUAL_CHANNELS, input.channel) || typeof input.note !== "string" || !input.note.trim() || input.note.length > 2000
    || typeof input.firstResponse !== "boolean" || typeof input.occurredAt !== "string" || !Number.isFinite(Date.parse(input.occurredAt))
    || Date.parse(input.occurredAt) > Date.now() + 60000
    || typeof input.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) {
    return { ok: false, erreur: "Précisez le canal, la date réelle et une note sur l’échange (2 000 caractères maximum)." };
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, erreur: "Session expirée : reconnectez-vous." };
    const [{ data: lead, error }, { data: profile }] = await Promise.all([
      supabase.from("leads").select("id,status,deleted_at,referent_id,updated_at").eq("id", leadId).maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (error || !lead || lead.deleted_at || ["won", "lost"].includes(lead.status)) return { ok: false, erreur: "Dossier introuvable, archivé ou clos." };
    if (!profile || !["admin", "lead_referent"].includes(profile.role) || (lead.referent_id && lead.referent_id !== user.id && profile.role !== "admin")) {
      return { ok: false, erreur: "Seul le référent assigné ou un administrateur peut enregistrer cet échange." };
    }
    if (Date.parse(lead.updated_at) !== Date.parse(input.expectedUpdatedAt)) return { ok: false, erreur: "La fiche a changé. Rechargez-la avant d’enregistrer l’échange." };
    const { error: saveError } = await supabase.rpc("record_lead_external_exchange", {
      p_lead_id: leadId, p_channel: input.channel, p_note: input.note.trim(), p_occurred_at: input.occurredAt,
      p_first_response: input.firstResponse, p_expected_updated_at: input.expectedUpdatedAt,
    });
    if (saveError) return { ok: false, erreur: saveError.code === "P0001" ? saveError.message : "L’échange n’a pas pu être enregistré. Rechargez la fiche et réessayez." };
    for (const path of [`/leads/${leadId}`, "/leads", "/inbox", "/dashboard", "/metrics"]) revalidatePath(path);
    return { ok: true, info: "Échange enregistré. L’étape du dossier est conservée." };
  } catch {
    return { ok: false, erreur: "L’enregistrement n’a pas pu être confirmé. Rechargez la fiche avant de réessayer." };
  }
}
