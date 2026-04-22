"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { completeJson } from "@/lib/ai/agent";
import { parseJsonObject } from "@/lib/ai/json-parse";
import { AGENCY_SCORING_SYSTEM_PROMPT } from "@/lib/ai/prompts/agency-scoring";
import { PROPOSAL_COMPARISON_SYSTEM_PROMPT } from "@/lib/ai/prompts/proposal-comparison";
import {
  QUALIFICATION_SUGGESTIONS_SYSTEM_PROMPT,
  buildQualificationSuggestionsUserPrompt,
} from "@/lib/ai/prompts/qualification-suggestions";
import { isUuid } from "@/lib/is-uuid";
import {
  findLeadIdByWhatsAppPhone,
  processTravelerWhatsAppMessage,
} from "@/lib/leads-whatsapp-inbound";
import { sendWhatsAppTextMessage, sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import {
  type BlockId,
  type OpAction,
  type QualificationBlocks,
  BLOCK_IDS,
  allBlocksValidated,
  safeQualificationBlocks,
  EMPTY_QUALIFICATION_BLOCKS,
} from "@/lib/qualification-blocks";
import { getBlockOptionIds } from "@/components/leads/qualification/qualification-blocks-config";

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

/** Premier message WhatsApp de qualification — à n’appeler qu’après lancement du workflow (PRD v3), pas à l’assignation. */
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

  const { data: prev, error: prevErr } = await supabase
    .from("leads")
    .select("manual_takeover")
    .eq("id", leadId)
    .maybeSingle();

  if (prevErr || !prev) {
    return { ok: false, error: "Lead introuvable." };
  }

  const previous = Boolean(prev.manual_takeover);
  if (previous === value) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("leads")
    .update({ manual_takeover: value })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await logActivity(
    supabase,
    leadId,
    user.id,
    "ai_autopilot_toggle",
    value
      ? "Reprise manuelle activée (IA suspendue)."
      : "IA automatique réactivée.",
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/workflow`);
  return { ok: true };
}

/** Bascule `manual_takeover` (cockpit + panneau IA). */
export async function toggleAiAutopilot(leadId: string): Promise<AiActionResult> {
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

  const { data: row, error } = await supabase
    .from("leads")
    .select("manual_takeover")
    .eq("id", leadId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Lead introuvable." };
  }

  return setLeadManualTakeover(leadId, !Boolean(row.manual_takeover));
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

// ─── Qualification Agent (Claude Haiku via Anthropic API) ─────────────────────

export type QualificationAgentResult =
  | {
      ok: true;
      destination_main: string;
      trip_dates: string;
      travelers: string;
      budget: string;
      travel_style: string;
      travel_desire_narrative: string;
      ai_qualification_confidence: number;
    }
  | { ok: false; error: string };

export async function runQualificationAgent(
  leadId: string,
): Promise<QualificationAgentResult> {
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: leadRaw, error: fetchErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchErr || !leadRaw) return { ok: false, error: "Lead introuvable." };
  const lead = leadRaw as unknown as Record<string, unknown>;

  if (lead.status !== "qualification") {
    return { ok: false, error: "Ce lead n'est pas à l'étape qualification." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Variable ANTHROPIC_API_KEY manquante." };
  }

  const transcript = Array.isArray(lead.conversation_transcript)
    ? (lead.conversation_transcript as { role: string; content: string }[])
        .map((m) => `${m.role === "user" ? "Voyageur" : "DA"}: ${m.content}`)
        .join("\n")
    : "Pas de transcription.";

  const systemPrompt = `Tu es un expert en qualification de leads voyage pour Direction l'Algérie.
Tu reçois la fiche brute d'un voyageur + la transcription de sa conversation.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après.
Structure exacte :
{
  "destination_main": "région ou destination principale",
  "trip_dates": "période et durée souhaitées",
  "travelers": "composition exacte du groupe",
  "budget": "fourchette budget",
  "travel_style": "styles séparés par virgule",
  "travel_desire_narrative": "paragraphe narratif 3-5 phrases. Ton chaleureux, subjectif, évocateur. PAS une liste. Capture le ressenti, le désir profond, la promesse implicite du voyage rêvé.",
  "confidence": 0.85
}`;

  const userMessage =
    `FICHE VOYAGEUR :\n` +
    `Nom : ${lead.traveler_name ?? "Inconnu"}\n` +
    `Résumé : ${lead.trip_summary ?? "—"}\n` +
    `Destination notée : ${lead.destination_main ?? "non renseignée"}\n` +
    `Style : ${lead.travel_style ?? "—"}\n` +
    `Groupe : ${lead.travelers ?? "—"}\n` +
    `Budget : ${lead.budget ?? "—"}\n` +
    `Dates : ${lead.trip_dates ?? "—"}\n\n` +
    `TRANSCRIPTION :\n${transcript}`;

  let parsed: {
    destination_main?: string;
    trip_dates?: string;
    travelers?: string;
    budget?: string;
    travel_style?: string;
    travel_desire_narrative?: string;
    confidence?: number;
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      return {
        ok: false,
        error: `API Anthropic ${response.status} : ${t.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const rawText: string = data?.content?.[0]?.text ?? "";
    parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
  } catch (err) {
    return { ok: false, error: `Erreur agent : ${String(err).slice(0, 200)}` };
  }

  const { error: updateErr } = await supabase
    .from("leads")
    .update({
      destination_main: parsed.destination_main ?? lead.destination_main,
      trip_dates: parsed.trip_dates ?? lead.trip_dates,
      travelers: parsed.travelers ?? lead.travelers,
      budget: parsed.budget ?? lead.budget,
      travel_style: parsed.travel_style ?? lead.travel_style,
      travel_desire_narrative: parsed.travel_desire_narrative ?? null,
      ai_qualification_payload: parsed as unknown as Record<string, unknown>,
      ai_qualification_confidence: parsed.confidence ?? null,
      qualification_validation_status: "pending",
    })
    .eq("id", leadId);

  if (updateErr)
    return { ok: false, error: `Erreur sauvegarde : ${updateErr.message}` };

  await logActivity(
    supabase,
    leadId,
    user.id,
    "ai_qualification_run",
    `Agent IA exécuté — confidence : ${parsed.confidence ?? "—"}`,
  );

  revalidatePath(`/leads/${leadId}`);

  return {
    ok: true,
    destination_main: parsed.destination_main ?? "",
    trip_dates: parsed.trip_dates ?? "",
    travelers: parsed.travelers ?? "",
    budget: parsed.budget ?? "",
    travel_style: parsed.travel_style ?? "",
    travel_desire_narrative: parsed.travel_desire_narrative ?? "",
    ai_qualification_confidence: parsed.confidence ?? 0,
  };
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export async function validateQualification(
  leadId: string,
): Promise<ValidationResult> {
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error } = await supabase
    .from("leads")
    .update({
      qualification_validation_status: "validated",
      qualification_validated_at: new Date().toISOString(),
      qualification_validated_by: user.id,
      status: "agency_assignment",
    })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  await logActivity(
    supabase,
    leadId,
    user.id,
    "qualification_validated",
    "Qualification validée — passage à Assignation agence.",
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  return { ok: true };
}

export type QualificationFields = {
  destination_main?: string;
  trip_dates?: string;
  travelers?: string;
  budget?: string;
  travel_style?: string;
  travel_desire_narrative?: string;
  qualification_notes?: string;
};

export async function saveQualificationFields(
  leadId: string,
  fields: QualificationFields,
): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error } = await supabase
    .from("leads")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────

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

// ─── Qualification Workspace v2 — Bloc Actions ───────────────────────────────

export type QualificationBlockResult =
  | { ok: true; blocks: QualificationBlocks }
  | { ok: false; error: string };

export async function runQualificationSuggestions(params: {
  leadId: string;
  blockId?: BlockId;
}): Promise<QualificationBlockResult> {
  const { leadId, blockId } = params;
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: leadRaw, error: fetchErr } = await supabase
    .from("leads")
    .select(
      "status, qualification_blocks, intake_payload, conversation_transcript, " +
      "destination_main, trip_dates, travelers, budget, travel_style, trip_summary, travel_desire_narrative"
    )
    .eq("id", leadId)
    .maybeSingle();

  if (fetchErr || !leadRaw) return { ok: false, error: "Lead introuvable." };

  const row = leadRaw as unknown as Record<string, unknown>;
  const currentBlocks = safeQualificationBlocks(row.qualification_blocks);

  const targetBlockIds: BlockId[] = blockId
    ? [blockId]
    : BLOCK_IDS.filter(id => currentBlocks[id].op_action === null);

  if (targetBlockIds.length === 0) {
    return { ok: true, blocks: currentBlocks };
  }

  // Mark blocks as in_progress
  const updatedBlocks = { ...currentBlocks };
  for (const id of targetBlockIds) {
    updatedBlocks[id] = { ...updatedBlocks[id], ai_status: 'in_progress' };
  }
  await supabase.from("leads").update({ qualification_blocks: updatedBlocks }).eq("id", leadId);

  const userPrompt = buildQualificationSuggestionsUserPrompt({
    blockIds: targetBlockIds,
    intakePayload: row.intake_payload ?? null,
    conversationTranscript: row.conversation_transcript ?? null,
    surfaceFields: {
      destination_main: row.destination_main != null ? String(row.destination_main) : null,
      trip_dates: row.trip_dates != null ? String(row.trip_dates) : null,
      travelers: row.travelers != null ? String(row.travelers) : null,
      budget: row.budget != null ? String(row.budget) : null,
      travel_style: row.travel_style != null ? String(row.travel_style) : null,
      trip_summary: row.trip_summary != null ? String(row.trip_summary) : null,
      travel_desire_narrative: row.travel_desire_narrative != null ? String(row.travel_desire_narrative) : null,
    },
  });

  const aiResult = await completeJson(QUALIFICATION_SUGGESTIONS_SYSTEM_PROMPT, userPrompt);

  if ("error" in aiResult) {
    // Revert to pending on AI failure
    for (const id of targetBlockIds) {
      updatedBlocks[id] = { ...updatedBlocks[id], ai_status: 'pending' };
    }
    await supabase.from("leads").update({ qualification_blocks: updatedBlocks }).eq("id", leadId);
    return { ok: false, error: aiResult.error };
  }

  const parsed = parseJsonObject<Record<string, { suggestions?: string[]; confidence?: number; missing?: string[] }>>(aiResult.raw);

  for (const id of targetBlockIds) {
    const aiBlock = parsed?.[id];
    const validOptionIds = getBlockOptionIds(id);
    const suggestions = Array.isArray(aiBlock?.suggestions)
      ? aiBlock.suggestions.filter((s: string) => validOptionIds.has(s))
      : [];
    const confidence = typeof aiBlock?.confidence === 'number'
      ? Math.min(1, Math.max(0, aiBlock.confidence))
      : null;
    const missing = Array.isArray(aiBlock?.missing) ? aiBlock.missing : [];

    updatedBlocks[id] = {
      ...updatedBlocks[id],
      ai_status: 'ready_for_review',
      ai_suggestions: suggestions,
      ai_confidence: confidence,
      ai_missing: missing,
    };
  }

  const { error: saveErr } = await supabase
    .from("leads")
    .update({ qualification_blocks: updatedBlocks })
    .eq("id", leadId);

  if (saveErr) return { ok: false, error: saveErr.message };

  await logActivity(
    supabase, leadId, user.id,
    "qualification_suggestions_run",
    `Suggestions IA générées pour : ${targetBlockIds.join(', ')}.`,
  );

  revalidatePath(`/leads/${leadId}`);
  return { ok: true, blocks: updatedBlocks };
}

export async function validateQualificationBlock(params: {
  leadId: string;
  blockId: BlockId;
  selections: string[];
  action: 'confirmed' | 'adjusted' | 'manual';
}): Promise<QualificationBlockResult> {
  const { leadId, blockId, selections, action } = params;
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: leadRaw, error: fetchErr } = await supabase
    .from("leads")
    .select("qualification_blocks")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchErr || !leadRaw) return { ok: false, error: "Lead introuvable." };

  const row = leadRaw as unknown as Record<string, unknown>;
  const blocks = safeQualificationBlocks(row.qualification_blocks);

  const validOptionIds = getBlockOptionIds(blockId);
  const validSelections = selections.filter(s => validOptionIds.has(s));

  blocks[blockId] = {
    ...blocks[blockId],
    op_selections: validSelections,
    op_action: action as OpAction,
    op_validated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("leads")
    .update({ qualification_blocks: blocks })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  await logActivity(
    supabase, leadId, user.id,
    "qualification_block_validated",
    `Bloc "${blockId}" validé (${action}).`,
  );

  revalidatePath(`/leads/${leadId}`);
  return { ok: true, blocks };
}

export async function updateBlockSelections(params: {
  leadId: string;
  blockId: BlockId;
  selections: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { leadId, blockId, selections } = params;
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: leadRaw, error: fetchErr } = await supabase
    .from("leads")
    .select("qualification_blocks")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchErr || !leadRaw) return { ok: false, error: "Lead introuvable." };

  const row = leadRaw as unknown as Record<string, unknown>;
  const blocks = safeQualificationBlocks(row.qualification_blocks);

  const validOptionIds = getBlockOptionIds(blockId);
  blocks[blockId] = {
    ...blocks[blockId],
    op_selections: selections.filter(s => validOptionIds.has(s)),
  };

  const { error } = await supabase
    .from("leads")
    .update({ qualification_blocks: blocks })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function reopenQualificationBlock(params: {
  leadId: string;
  blockId: BlockId;
}): Promise<{ ok: boolean; error?: string }> {
  const { leadId, blockId } = params;
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: leadRaw, error: fetchErr } = await supabase
    .from("leads")
    .select("qualification_blocks")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchErr || !leadRaw) return { ok: false, error: "Lead introuvable." };

  const row = leadRaw as unknown as Record<string, unknown>;
  const blocks = safeQualificationBlocks(row.qualification_blocks);

  blocks[blockId] = {
    ...blocks[blockId],
    op_action: null,
    op_validated_at: null,
  };

  const { error } = await supabase
    .from("leads")
    .update({ qualification_blocks: blocks })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  await logActivity(
    supabase, leadId, user.id,
    "qualification_block_reopened",
    `Bloc "${blockId}" rouvert pour modification.`,
  );

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Remet la qualification à zéro (blocs + statut), sans toucher au reste du lead. */
export async function resetQualification(leadId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: current } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    qualification_blocks: EMPTY_QUALIFICATION_BLOCKS,
    qualification_validation_status: "pending",
    qualification_validated_at: null,
    qualification_validated_by: null,
    qualification_summary: null,
  };
  // Si le lead était passé à agency_assignment suite à la qualification, on revient à qualification
  if (current?.status === "agency_assignment") {
    patch.status = "qualification";
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await logActivity(supabase, leadId, user.id, "qualification_reset", "Qualification remise à zéro manuellement.");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function finalizeQualification(params: {
  leadId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { leadId } = params;
  if (!isUuid(leadId)) return { ok: false, error: "ID invalide." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: leadRaw, error: fetchErr } = await supabase
    .from("leads")
    .select("qualification_blocks, status")
    .eq("id", leadId)
    .maybeSingle();

  if (fetchErr || !leadRaw) return { ok: false, error: "Lead introuvable." };

  const row = leadRaw as unknown as Record<string, unknown>;
  const blocks = safeQualificationBlocks(row.qualification_blocks);

  if (!allBlocksValidated(blocks)) {
    const missing = BLOCK_IDS.filter(id => blocks[id].op_action === null);
    return { ok: false, error: `Blocs non validés : ${missing.join(', ')}.` };
  }

  // Extraire le budget qualifié et mettre à jour les champs structurés
  const budgetSelections = blocks.budget?.op_selections ?? [];
  const BUDGET_RANGE_MAP: Record<string, { min: number; max: number | null; label: string }> = {
    budget_low:     { min: 0,    max: 1500, label: "Économique (< 1 500 €/pers.)" },
    budget_mid:     { min: 1500, max: 2500, label: "Moyen (1 500–2 500 €/pers.)" },
    budget_high:    { min: 2500, max: 4000, label: "Confort (2 500–4 000 €/pers.)" },
    budget_premium: { min: 4000, max: 7000, label: "Premium (4 000–7 000 €/pers.)" },
    budget_luxury:  { min: 7000, max: null, label: "Luxe (7 000 €+/pers.)" },
  };
  const rangeKey = budgetSelections.find((s) => s in BUDGET_RANGE_MAP);
  const qualifiedBudget = rangeKey ? BUDGET_RANGE_MAP[rangeKey] : null;

  const { error } = await supabase
    .from("leads")
    .update({
      status: "agency_assignment",
      qualification_validation_status: "validated",
      qualification_validated_at: new Date().toISOString(),
      // Écrase le budget intake avec le budget qualifié (si sélectionné)
      ...(qualifiedBudget ? {
        budget_min: qualifiedBudget.min,
        budget_max: qualifiedBudget.max,
        budget_unit: "per_person",
        budget: qualifiedBudget.label,
      } : {}),
      qualification_validated_by: user.id,
    })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };

  await logActivity(
    supabase, leadId, user.id,
    "qualification_finalized",
    "Qualification complète validée — passage à Assignation agence.",
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  return { ok: true };
}
