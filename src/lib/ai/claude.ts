import "server-only";

/**
 * Accès partagé à Claude (API Messages d'Anthropic), côté serveur uniquement.
 * Utilisé par l'agent DA du Radar, DA Sales (assistant du Desk) et les appels JSON
 * de qualification. La clé ne sort jamais du serveur.
 */

const VERSION = "2026-10-21";
const URL_MESSAGES = "https://api.anthropic.com/v1/messages";

export function claudeDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Fournisseur des fonctions d'IA du Desk : Claude dès que sa clé est posée, sauf DESK_AI_PROVIDER=openai. */
export function claudePrioritaire(): boolean {
  return claudeDisponible() && process.env.DESK_AI_PROVIDER?.trim().toLowerCase() !== "openai";
}

export function modeleClaude(surcharge?: string): string {
  return surcharge?.trim() || process.env.DESK_CLAUDE_MODEL?.trim() || "claude-sonnet-5-5";
}

function entetes(): Record<string, string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("Claude n’est pas configuré.");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return {
    "x-api-key": key,
    "anthropic-version": VERSION,
    "content-type": "application/json",
    ...(workspace ? { "anthropic-workspace-id": workspace } : {}),
  };
}

export type ReponseClaude = {
  content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
  stop_reason?: string;
};

/** Appel non diffusé. `payload` reçoit le modèle par défaut s'il n'en précise pas. */
export async function appelClaude(payload: Record<string, unknown>, o: { timeoutMs?: number; signal?: AbortSignal; journal?: string } = {}): Promise<ReponseClaude> {
  const signaux = [AbortSignal.timeout(o.timeoutMs ?? 30_000), ...(o.signal ? [o.signal] : [])];
  const response = await fetch(URL_MESSAGES, {
    method: "POST",
    headers: entetes(),
    body: JSON.stringify({ model: modeleClaude(), ...payload }),
    cache: "no-store",
    signal: AbortSignal.any(signaux),
  });
  if (!response.ok) {
    console.warn(`[${o.journal ?? "Claude"}] HTTP`, response.status, response.headers.get("request-id"));
    throw new Error("Claude est indisponible.");
  }
  return response.json() as Promise<ReponseClaude>;
}

export function texteClaude(r: ReponseClaude): string {
  return (r.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
}

export type EvenementFlux = {
  type: string;
  index?: number;
  content_block?: {
    type: string;
    id?: string;
    name?: string;
    text?: string;
    input?: unknown;
    thinking?: string;
    signature?: string;
    data?: string;
  };
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
    thinking?: string;
    signature?: string;
  };
};

/** Appel diffusé (SSE). Renvoie les événements bruts de l'API, dans l'ordre. */
export async function* fluxClaude(payload: Record<string, unknown>, signal?: AbortSignal): AsyncGenerator<EvenementFlux> {
  const response = await fetch(URL_MESSAGES, {
    method: "POST",
    headers: entetes(),
    body: JSON.stringify({ model: modeleClaude(), ...payload, stream: true }),
    cache: "no-store",
    signal,
  });
  if (!response.ok || !response.body) {
    console.warn("[agent DA] Claude HTTP", response.status, response.headers.get("request-id"));
    throw new Error("Claude est indisponible.");
  }
  const lecteur = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let reste = "";
  try {
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      reste += value;
      const blocs = reste.split(/\r?\n\r?\n/);
      reste = blocs.pop() ?? "";
      for (const bloc of blocs) {
        const lignes = bloc.split(/\r?\n/);
        if (lignes.some((ligne) => /^event: ?error$/.test(ligne))) {
          throw new Error("Claude a interrompu la réponse.");
        }
        const donnees = lignes.filter((ligne) => ligne.startsWith("data:")).map((ligne) => ligne.replace(/^data: ?/, "")).join("\n");
        if (!donnees) continue;
        const ev = JSON.parse(donnees) as EvenementFlux;
        if (ev.type === "error") throw new Error("Claude a interrompu la réponse.");
        yield ev;
      }
    }
  } finally {
    await lecteur.cancel().catch(() => undefined);
    lecteur.releaseLock();
  }
}
