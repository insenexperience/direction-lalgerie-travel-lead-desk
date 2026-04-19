"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { completeJson } from "@/lib/ai/agent";
import { parseJsonObject } from "@/lib/ai/json-parse";
import { AGENCY_SCORING_SYSTEM_PROMPT } from "@/lib/ai/prompts/agency-scoring";
import { PROPOSAL_COMPARISON_SYSTEM_PROMPT } from "@/lib/ai/prompts/proposal-comparison";
import { isUuid } from "@/lib/is-uuid";
import {
  findLeadIdByWhatsAppPhone,
  processTravelerWhatsAppMessage,
} from "@/lib/leads-whatsapp-inbound";
import { sendWhatsAppTextMessage, sendWhatsAppTemplate } from "@/lib/whatsapp/client";

export type AiActionResult = { ok: true } | { ok: false; error: string };

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  actorId: string | null,
  kind: string,
  detail: string,
) {
  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: actorId,
    kind,
    detail,
  });
}

export async function triggerQualificationConversation(leadId: string): Promise<void> {
  if (!isUuid(leadId)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead, error } = await supabase
    .from("leads")
    .select(
      "id, traveler_name, phone, whatsapp_phone_number, conversation_transcript, manual_takeover",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (error || !lead) return;
  if (lead.manual_takeover === true) return;

  const wa =
    (lead.whatsapp_phone_number && String(lead.whatsapp_phone_number).trim()) ||
    String(lead.phone ?? "").trim();
  if (!wa) {
    await logActivity(
      supabase,
      leadId,
      user?.id ?? null,
      "whatsapp_skipped",
      "Assignation enregistrée — pas de numéro WhatsApp sur la fiche.",
    );
    return;
  }

  const template = process.env.WHATSAPP_QUALIFICATION_TEMPLATE?.trim();
  const firstName = String(lead.traveler_name ?? " ").trim().split(/\s+/)[0] || "Bonjour";

  const opening = template
    ? await sendWhatsAppTemplate(wa, template, "fr", [firstName])
    : await sendWhatsAppTextMessage(
        wa,
        `Bonjour ${firstName}, c'est Direction l'Algérie. Nous avons bien reçu votre demande de voyage et allons vous poser quelques questions pour affiner votre projet.`,
      );

  if (!opening.ok) {
    await logActivity(supabase, leadId, user?.id ?? null, "whatsapp_error", opening.error);
    return;
  }

  const transcript = Array.isArray(lead.conversation_transcript)
    ? [...(lead.conversation_transcript as unknown[])]
    : [];
  transcript.push({
    ts: new Date().toISOString(),
    from: "ai",
    text: template
      ? `(template ${template})`
      : `Bonjour ${firstName}, c'est Direction l'Algérie. Nous avons bien reçu votre demande de voyage et allons vous poser quelques questions pour affiner votre projet.`,
  });

  await supabase
    .from("leads")
    .update({ conversation_transcript: transcript })
    .eq("id", leadId);

  await logActivity(
    supabase,
    leadId,
    user?.id ?? null,
    "whatsapp_qualification_start",
    "Premier message WhatsApp de qualification envoyé.",
  );

  revalidatePath(`/leads/${leadId}`);
}

export async function processIncomingMessage(
  leadId: string,
  text: string,
): Promise<AiActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Lead invalide." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const res = await processTravelerWhatsAppMessage(supabase, leadId, text);
  if (!res.ok) {
    return res;
  }
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function processIncomingWhatsAppFromWebhook(
  fromPhone: string,
  text: string,
): Promise<AiActionResult> {
  const { createServiceRoleClient } = await import("@/lib/supabase/admin");
  const supabase = createServiceRoleClient();
  const leadId = await findLeadIdByWhatsAppPhone(supabase, fromPhone);
  if (!leadId) {
    return { ok: false, error: "Lead introuvable pour ce numéro." };
  }
  const res = await processTravelerWhatsAppMessage(supabase, leadId, text);
  return res;
}

export async function setLeadManualTakeover(
  leadId: string,
  value: boolean,
): Promise<AiActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Lead invalide." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { error } = await supabase
    .from("leads")
    .update({ manual_takeover: value })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function validateLeadQualification(
  leadId: string,
  status: "validated" | "overridden" | "rejected",
): Promise<AiActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Lead invalide." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const patch =
    status === "rejected"
      ? {
          qualification_validation_status: "rejected" as const,
          qualification_validated_at: null,
          qualification_validated_by: null,
        }
      : {
          qualification_validation_status: status,
          qualification_validated_at: new Date().toISOString(),
          qualification_validated_by: user.id,
        };

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) {
    return { ok: false, error: error.message };
  }
  await logActivity(
    supabase,
    leadId,
    user.id,
    "qualification_validation",
    `Qualification ${status} par l'opérateur.`,
  );
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function generateAgencyShortlist(leadId: string): Promise<AiActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Lead invalide." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .select("ai_qualification_payload, scoring_weights, qualification_validation_status")
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    return { ok: false, error: "Lead introuvable." };
  }
  if (
    lead.qualification_validation_status !== "validated" &&
    lead.qualification_validation_status !== "overridden"
  ) {
    return { ok: false, error: "Qualifiez et validez d'abord la synthèse IA." };
  }

  const { data: agencies, error: aErr } = await supabase
    .from("agencies")
    .select(
      "id, legal_name, trade_name, destinations, sla_quote_days, circuits_data, performance_history",
    );

  if (aErr || !agencies?.length) {
    return { ok: false, error: "Aucune agence en base." };
  }

  const userMsg = JSON.stringify(
    {
      qualification: lead.ai_qualification_payload,
      weights: lead.scoring_weights,
      agencies,
    },
    null,
    0,
  );

  const ai = await completeJson(AGENCY_SCORING_SYSTEM_PROMPT, userMsg);
  if ("error" in ai) {
    return { ok: false, error: ai.error };
  }

  const parsed = parseJsonObject<{ ranking?: Array<Record<string, unknown>> }>(ai.raw);
  const ranking = parsed?.ranking;
  if (!Array.isArray(ranking) || !ranking.length) {
    return { ok: false, error: "Réponse IA shortlist invalide." };
  }

  await supabase.from("lead_circuit_proposals").delete().eq("lead_id", leadId).eq("ai_suggested", true);

  for (const row of ranking.slice(0, 5)) {
    const agencyId = String(row.agency_id ?? "");
    if (!isUuid(agencyId)) continue;
    const score = Number(row.ai_match_score);
    const rationale = String(row.ai_match_rationale ?? "");
    const recommended = Boolean(row.ai_recommended);
    await supabase.from("lead_circuit_proposals").insert({
      lead_id: leadId,
      agency_id: agencyId,
      title: "Shortlist IA",
      circuit_outline: rationale || "—",
      status: "awaiting_agency",
      ai_suggested: true,
      ai_match_score: Number.isFinite(score) ? score : null,
      ai_match_rationale: rationale || null,
      ai_recommended: recommended,
      created_by_profile_id: user.id,
    });
  }

  await logActivity(supabase, leadId, user.id, "ai_shortlist", "Shortlist agences générée par l'IA.");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function compareAgencyProposals(leadId: string): Promise<AiActionResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Lead invalide." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .select("ai_qualification_payload, scoring_weights")
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    return { ok: false, error: "Lead introuvable." };
  }

  const { data: proposals, error: pErr } = await supabase
    .from("lead_circuit_proposals")
    .select("id, agency_proposal_payload, agency_id")
    .eq("lead_id", leadId)
    .not("agency_proposal_payload", "is", null);

  if (pErr || !proposals?.length) {
    return { ok: false, error: "Aucune proposition agence à comparer." };
  }

  const userMsg = JSON.stringify(
    {
      qualification: lead.ai_qualification_payload,
      weights: lead.scoring_weights,
      proposals,
    },
    null,
    0,
  );

  const ai = await completeJson(PROPOSAL_COMPARISON_SYSTEM_PROMPT, userMsg);
  if ("error" in ai) {
    return { ok: false, error: ai.error };
  }

  const parsed = parseJsonObject<{ results?: Array<Record<string, unknown>> }>(ai.raw);
  const results = parsed?.results;
  if (!Array.isArray(results)) {
    return { ok: false, error: "Réponse IA comparaison invalide." };
  }

  for (const row of results) {
    const id = String(row.proposal_id ?? "");
    if (!isUuid(id)) continue;
    const score = Number(row.ai_proposal_score);
    const rationale = String(row.ai_proposal_rationale ?? "");
    const recommended = Boolean(row.ai_recommended);
    await supabase
      .from("lead_circuit_proposals")
      .update({
        ai_proposal_score: Number.isFinite(score) ? score : null,
        ai_proposal_rationale: rationale || null,
        ai_recommended: recommended,
      })
      .eq("id", id)
      .eq("lead_id", leadId);
  }

  await logActivity(supabase, leadId, user.id, "ai_compare", "Comparatif des propositions agences (IA).");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
