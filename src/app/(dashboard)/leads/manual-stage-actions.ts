"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { chargerProjets } from "@/lib/bo3/load";
import { etapesManuellesSuivantes, MANUAL_CHANNELS, MANUAL_STAGE_DB_STATUS, type ManualChannel, type ManualStage } from "@/lib/bo3/manual-stage";
import type { Resultat } from "./projet-actions";

export type ManualStageInput = {
  stage: ManualStage;
  channel: ManualChannel;
  note: string;
  expectedUpdatedAt: string;
  firstResponse: boolean;
};

export async function avancerEtapeManuellement(leadId: string, input: ManualStageInput): Promise<Resultat> {
  if (!isUuid(leadId) || !input || typeof input !== "object"
    || !Object.hasOwn(MANUAL_STAGE_DB_STATUS, input.stage) || !Object.hasOwn(MANUAL_CHANNELS, input.channel)
    || typeof input.note !== "string" || !input.note.trim() || input.note.length > 2000
    || typeof input.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(input.expectedUpdatedAt))
    || typeof input.firstResponse !== "boolean") {
    return { ok: false, erreur: "Choisissez une étape et un canal, puis décrivez le traitement effectué (2 000 caractères maximum)." };
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, erreur: "Session expirée : reconnectez-vous." };
    const [{ data: lead, error }, { data: profile }] = await Promise.all([
      supabase.from("leads").select("id,referent_id,deleted_at,updated_at").eq("id", leadId).maybeSingle(),
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (error || !lead || lead.deleted_at) return { ok: false, erreur: "Dossier introuvable ou archivé." };
    if (!profile || !["admin", "lead_referent"].includes(profile.role)
      || (lead.referent_id && lead.referent_id !== user.id && profile.role !== "admin")) {
      return { ok: false, erreur: "Seul le référent assigné ou un administrateur peut avancer ce dossier." };
    }
    if (Date.parse(lead.updated_at) !== Date.parse(input.expectedUpdatedAt)) {
      return { ok: false, erreur: "Le dossier a été modifié entre-temps. Rechargez la fiche avant de réessayer." };
    }
    const [p] = await chargerProjets({ supabase, userId: user.id, role: profile.role, nom: "", apercu: false }, { id: leadId });
    if (!p || !etapesManuellesSuivantes(p.statut).includes(input.stage)) {
      return { ok: false, erreur: "Choisissez une étape suivante. La clôture se fait avec « Marquer gagné » ou « Clore · perdu »." };
    }
    // Statut, prise en charge, jalon et première réponse sont enregistrés ensemble.
    const { error: saveError } = await supabase.rpc("advance_lead_manual_stage", {
      p_lead_id: leadId, p_stage: input.stage, p_channel: input.channel, p_note: input.note.trim(),
      p_expected_updated_at: input.expectedUpdatedAt, p_first_response: input.firstResponse,
    });
    if (saveError) return { ok: false, erreur: saveError.code === "P0001" ? saveError.message : "L’avancement n’a pas pu être enregistré. Rechargez la fiche et réessayez." };
    for (const path of [`/leads/${leadId}`, "/leads", "/inbox", "/dashboard", "/metrics"]) revalidatePath(path);
    return { ok: true, info: "Étape avancée. Le traitement manuel est enregistré dans l’historique." };
  } catch {
    return { ok: false, erreur: "L’avancement n’a pas pu être enregistré. Rechargez la fiche et réessayez." };
  }
}
