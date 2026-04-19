import type { LeadStatus } from "@/lib/mock-leads";
import { LEAD_PIPELINE } from "@/lib/mock-leads";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

export type ScoringWeights = {
  budget: number;
  dates: number;
  travelers: number;
  adn: number;
  engagement: number;
  conversation: number;
};

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  budget: 25,
  dates: 20,
  travelers: 10,
  adn: 20,
  engagement: 15,
  conversation: 10,
};

function mergeWeights(raw: unknown): ScoringWeights {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCORING_WEIGHTS };
  const o = raw as Record<string, unknown>;
  const n = (k: keyof ScoringWeights, d: number) => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d;
  };
  return {
    budget: n("budget", DEFAULT_SCORING_WEIGHTS.budget),
    dates: n("dates", DEFAULT_SCORING_WEIGHTS.dates),
    travelers: n("travelers", DEFAULT_SCORING_WEIGHTS.travelers),
    adn: n("adn", DEFAULT_SCORING_WEIGHTS.adn),
    engagement: n("engagement", DEFAULT_SCORING_WEIGHTS.engagement),
    conversation: n("conversation", DEFAULT_SCORING_WEIGHTS.conversation),
  };
}

function payloadNum(payload: Record<string, unknown> | null, key: string): number | null {
  if (!payload) return null;
  const v = payload[key];
  if (typeof v === "number" && Number.isFinite(v)) return Math.min(1, Math.max(0, v));
  return null;
}

function pipelineIndex(status: LeadStatus): number {
  return LEAD_PIPELINE.indexOf(status);
}

/**
 * Score 0–100 à partir du lead et des pondérations (PRD §5 — heuristiques défensives).
 */
export function computeScoreFromWeights(
  lead: Pick<
    SupabaseLeadRow,
    | "budget"
    | "trip_dates"
    | "travelers"
    | "status"
    | "conversation_transcript"
    | "ai_qualification_payload"
    | "ai_qualification_confidence"
    | "scoring_weights"
  >,
): number {
  const w = mergeWeights(lead.scoring_weights);
  const payload =
    lead.ai_qualification_payload &&
    typeof lead.ai_qualification_payload === "object" &&
    !Array.isArray(lead.ai_qualification_payload)
      ? (lead.ai_qualification_payload as Record<string, unknown>)
      : null;

  let acc = 0;
  let wsum = 0;

  const add = (weight: number, fraction: number | null) => {
    if (fraction == null || Number.isNaN(fraction)) return;
    wsum += weight;
    acc += weight * Math.min(1, Math.max(0, fraction));
  };

  add(w.budget, payloadNum(payload, "budget_confidence"));
  add(w.dates, payloadNum(payload, "dates_confidence"));
  add(w.travelers, lead.travelers.trim().length > 0 ? 1 : 0);

  const coIdx = pipelineIndex("co_construction");
  const curIdx = pipelineIndex(lead.status as LeadStatus);
  const adnFrac =
    curIdx < 0
      ? null
      : curIdx >= coIdx
        ? 1
        : curIdx === coIdx - 1
          ? 0.35
          : 0.1;
  add(w.adn, adnFrac);

  const transcript = Array.isArray(lead.conversation_transcript)
    ? lead.conversation_transcript.length
    : 0;
  add(w.engagement, Math.min(1, transcript / 6));

  const rawC = Number(lead.ai_qualification_confidence);
  const confFrac =
    lead.ai_qualification_confidence != null && Number.isFinite(rawC)
      ? Math.min(1, Math.max(0, rawC > 1 ? rawC / 100 : rawC))
      : 0;
  add(w.conversation, confFrac);

  if (wsum <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (acc / wsum) * 100)));
}

export function displayLeadScore(lead: SupabaseLeadRow): number | null {
  const v =
    lead.lead_score_override != null
      ? lead.lead_score_override
      : lead.lead_score != null
        ? lead.lead_score
        : null;
  return v;
}

export type ScoreTier = "cold" | "tepid" | "warm" | "hot";

export function scoreTier(score: number | null): ScoreTier {
  if (score == null || Number.isNaN(score)) return "cold";
  if (score <= 40) return "cold";
  if (score <= 60) return "tepid";
  if (score <= 80) return "warm";
  return "hot";
}
