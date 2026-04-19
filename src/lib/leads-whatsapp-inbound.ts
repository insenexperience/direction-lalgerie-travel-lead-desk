import { completeJson } from "@/lib/ai/agent";
import { parseJsonObject } from "@/lib/ai/json-parse";
import { QUALIFICATION_SYSTEM_PROMPT } from "@/lib/ai/prompts/qualification";
import type { TranscriptEntry } from "@/lib/ai/types";
import { normalizeScoringWeights } from "@/lib/ai/utils";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/client";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalizePhoneKey(raw: string): string {
  return raw.replace(/\D/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function asTranscript(raw: unknown): TranscriptEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: TranscriptEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const ts = typeof o.ts === "string" ? o.ts : nowIso();
    const from =
      o.from === "traveler" || o.from === "ai" || o.from === "operator"
        ? o.from
        : "traveler";
    const text = typeof o.text === "string" ? o.text : "";
    if (text) out.push({ ts, from, text });
  }
  return out;
}

/**
 * Traitement message entrant WhatsApp (service role).
 * Met à jour conversation_transcript et champs IA si le modèle répond.
 */
export async function processTravelerWhatsAppMessage(
  supabase: SupabaseClient,
  leadId: string,
  travelerText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .select(
      "id, phone, whatsapp_phone_number, conversation_transcript, manual_takeover, ai_qualification_payload, scoring_weights",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    return { ok: false, error: "Lead introuvable." };
  }

  if (lead.manual_takeover === true) {
    return { ok: true };
  }

  const transcript = asTranscript(lead.conversation_transcript);
  transcript.push({
    ts: nowIso(),
    from: "traveler",
    text: travelerText.trim(),
  });

  const userPayload = JSON.stringify(
    {
      transcript,
      existing_qualification: lead.ai_qualification_payload ?? null,
      existing_weights: lead.scoring_weights ?? null,
    },
    null,
    0,
  );

  const aiResult = await completeJson(QUALIFICATION_SYSTEM_PROMPT, userPayload);
  if ("error" in aiResult) {
    await supabase
      .from("leads")
      .update({ conversation_transcript: transcript })
      .eq("id", leadId);
    return { ok: false, error: aiResult.error };
  }

  const parsed = parseJsonObject<{
    reply_to_traveler?: string;
    qualification?: Record<string, unknown>;
    scoring_weights?: unknown;
    confidence?: number;
  }>(aiResult.raw);

  if (!parsed?.reply_to_traveler) {
    await supabase
      .from("leads")
      .update({ conversation_transcript: transcript })
      .eq("id", leadId);
    return { ok: false, error: "Réponse IA invalide." };
  }

  transcript.push({
    ts: nowIso(),
    from: "ai",
    text: parsed.reply_to_traveler,
  });

  const weights = normalizeScoringWeights(parsed.scoring_weights);
  const conf =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : null;

  await supabase
    .from("leads")
    .update({
      conversation_transcript: transcript,
      ai_qualification_payload: parsed.qualification ?? null,
      scoring_weights: weights,
      ai_qualification_confidence: conf,
    })
    .eq("id", leadId);

  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: null,
    kind: "whatsapp_ai",
    detail: "Message voyageur traité — qualification IA mise à jour.",
  });

  const outPhone =
    (lead.whatsapp_phone_number && String(lead.whatsapp_phone_number).trim()) ||
    String(lead.phone ?? "").trim();
  if (outPhone) {
    await sendWhatsAppTextMessage(outPhone, parsed.reply_to_traveler);
  }

  return { ok: true };
}

export async function findLeadIdByWhatsAppPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<string | null> {
  const key = normalizePhoneKey(phone);
  if (!key) return null;

  const { data: rows } = await supabase
    .from("leads")
    .select("id, whatsapp_phone_number, phone")
    .not("whatsapp_phone_number", "is", null)
    .limit(500);

  for (const r of rows ?? []) {
    const w = normalizePhoneKey(String(r.whatsapp_phone_number ?? ""));
    if (w && (w === key || key.endsWith(w) || w.endsWith(key))) {
      return String(r.id);
    }
  }

  const { data: rows2 } = await supabase
    .from("leads")
    .select("id, phone")
    .not("phone", "is", null)
    .limit(500);

  for (const r of rows2 ?? []) {
    const p = normalizePhoneKey(String(r.phone ?? ""));
    if (p && (p === key || key.endsWith(p) || p.endsWith(key))) {
      return String(r.id);
    }
  }

  return null;
}

export { normalizePhoneKey };
