import OpenAI from "openai";
import { appelClaude, claudePrioritaire, texteClaude } from "./claude";

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function openaiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}

/** Retire un éventuel bloc ```json … ``` autour d'une réponse JSON. */
function sansClotures(texte: string): string {
  const m = texte.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (m ? m[1] : texte).trim();
}

/**
 * Appel JSON des fonctions d'IA du Desk (qualification, scoring d'agences, comparaison,
 * WhatsApp). Claude en priorité si ANTHROPIC_API_KEY est posée, OpenAI sinon ou en secours.
 */
export async function completeJson(
  system: string,
  user: string,
): Promise<{ raw: string } | { error: string }> {
  if (claudePrioritaire()) {
    try {
      const r = await appelClaude({
        max_tokens: 4000,
        temperature: 0.3,
        system: system + "\n\nRéponds uniquement par l'objet JSON demandé, sans texte autour.",
        messages: [{ role: "user", content: user }],
      }, { timeoutMs: 50_000, journal: "IA Desk" });
      const raw = r.stop_reason === "refusal" ? "" : sansClotures(texteClaude(r));
      if (raw) return { raw };
    } catch {
      /* Claude indisponible : bascule sur OpenAI si configuré. */
    }
  }
  const client = getOpenAIClient();
  if (!client) {
    return { error: claudePrioritaire() ? "Claude n'a pas répondu." : "Aucun fournisseur d'IA configuré (ANTHROPIC_API_KEY ou OPENAI_API_KEY)." };
  }
  try {
    const res = await client.chat.completions.create({
      model: openaiModel(),
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) return { error: "Réponse vide du modèle." };
    return { raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur OpenAI.";
    return { error: msg };
  }
}
