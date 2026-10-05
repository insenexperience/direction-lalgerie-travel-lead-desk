import { completeJson } from "@/lib/ai/agent";

export type ManualLeadAnalysisResult = { raw: string } | { error: string };
const UNAVAILABLE = "Analyse du message indisponible.";
const INVALID = "Réponse d’analyse inexploitable.";

function usableJson(raw: string): ManualLeadAnalysisResult {
  const normalized = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || typeof parsed.notes_longues !== "string" || !parsed.notes_longues.trim()) return { error: INVALID };
    return { raw: normalized };
  } catch {
    return { error: INVALID };
  }
}

/** Uses the provider already configured for qualification. Server actions only. */
export async function analyzeManualLeadJson(system: string, user: string): Promise<ManualLeadAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    try {
      const result = await completeJson(system, user);
      return "raw" in result ? usableJson(result.raw) : { error: UNAVAILABLE };
    } catch {
      return { error: UNAVAILABLE };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    // Never return provider bodies or caught exception messages: either can echo credentials.
    if (!response.ok) {
      console.warn("[manual-lead-analysis] Provider HTTP failure", response.status);
      return { error: UNAVAILABLE };
    }
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return { error: INVALID };
    const payload = data as Record<string, unknown>;
    if (payload.stop_reason === "max_tokens" || !Array.isArray(payload.content)) return { error: INVALID };
    const raw = payload.content.flatMap((block: unknown) => {
      if (!block || typeof block !== "object" || Array.isArray(block)) return [];
      const value = block as Record<string, unknown>;
      return value.type === "text" && typeof value.text === "string" ? [value.text] : [];
    }).join("").trim();
    const result = usableJson(raw);
    if ("error" in result) console.warn("[manual-lead-analysis] Invalid JSON transcript");
    return result;
  } catch {
    return { error: UNAVAILABLE };
  } finally {
    clearTimeout(timer);
  }
}
