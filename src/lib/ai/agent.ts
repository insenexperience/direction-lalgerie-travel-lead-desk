import OpenAI from "openai";

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function openaiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}

export async function completeJson(
  system: string,
  user: string,
): Promise<{ raw: string } | { error: string }> {
  const client = getOpenAIClient();
  if (!client) {
    return { error: "OPENAI_API_KEY manquant." };
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
