import type { ScoringWeights } from "@/lib/ai/types";

export function normalizeScoringWeights(raw: unknown): ScoringWeights | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: ScoringWeights = {};
  for (const k of ["price", "activities", "coverage", "response_speed"] as const) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function sumWeights(w: ScoringWeights): number {
  return Object.values(w).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
}
