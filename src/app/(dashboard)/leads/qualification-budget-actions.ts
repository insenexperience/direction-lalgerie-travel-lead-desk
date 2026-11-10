"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";
import { buildQualificationBudgetPatch, parseQualificationBudget, type QualificationBudgetInput } from "@/lib/qualification-budget";

export async function saveQualificationBudget(leadId: string, expectedUpdatedAt: string, input: QualificationBudgetInput) {
  if (!isUuid(leadId) || typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return { ok: false as const, error: "Dossier ou version invalide." };
  }
  const parsed = parseQualificationBudget(input, true);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Non authentifié." };
  const [{ data: lead, error: loadError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("leads").select("intake_payload,updated_at,referent_id,deleted_at,closed_at,status").eq("id", leadId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (loadError || !lead) return { ok: false as const, error: "Dossier introuvable ou inaccessible." };
  if (profileError || !profile || !["admin", "lead_referent"].includes(profile.role)) {
    return { ok: false as const, error: "Vous n’êtes pas autorisé à modifier ce budget." };
  }
  if (lead.deleted_at || lead.closed_at || ["won", "lost"].includes(lead.status)) {
    return { ok: false as const, error: "Ce dossier est clos ou archivé." };
  }
  if (lead.referent_id && lead.referent_id !== user.id && profile.role !== "admin") {
    return { ok: false as const, error: "Seul le référent assigné ou un administrateur peut modifier ce budget." };
  }
  const conflict = { ok: false as const, error: "Le dossier a été modifié entre-temps. Rechargez la fiche avant de réessayer." };
  if (lead.updated_at !== expectedUpdatedAt) return conflict;

  const now = new Date().toISOString();
  const patch = buildQualificationBudgetPatch(lead.intake_payload, parsed.value, { confirmedBy: user.id, confirmedAt: now });
  let update = supabase.from("leads").update({
    ...patch,
    ...(!lead.referent_id ? { referent_id: user.id, referent_assigned_at: now } : {}),
  }).eq("id", leadId).eq("updated_at", expectedUpdatedAt).eq("status", lead.status).is("deleted_at", null).is("closed_at", null);
  update = lead.referent_id ? update.eq("referent_id", lead.referent_id) : update.is("referent_id", null);
  const { data: saved, error } = await update.select("id").maybeSingle();
  if (error) return { ok: false as const, error: "Le budget n’a pas pu être enregistré." };
  if (!saved) return conflict;

  const { error: activityError } = await supabase.from("activities").insert({
    lead_id: leadId, actor_id: user.id, kind: "qualification_budget_saved",
    detail: "Budget du voyageur renseigné manuellement.",
    payload: { k: "sys", s: "Budget renseigné", b: patch.budget },
  });
  if (activityError) console.error("[qualification-budget] Journal non enregistré.", activityError.code);
  for (const path of [`/leads/${leadId}`, "/leads", "/inbox", "/dashboard", "/metrics"]) revalidatePath(path);
  return { ok: true as const };
}
