import { NextResponse } from "next/server";
import { getOpenAIClient, openaiModel } from "@/lib/ai/agent";
import { contexteBo3 } from "@/lib/bo3/acces";
import { claudePrioritaire, modeleClaude } from "@/lib/ai/claude";
import { boucleAgent, boucleAgentClaude, messageSysteme, type Evenement, type Tour } from "@/lib/radar/agent";
import { chargerContexteAgent, chargerRadar } from "@/lib/radar/donnees";
import { resumeDesk } from "@/lib/radar/desk";
import { estIdNotion, sansTirets } from "@/lib/radar/notion-map";
import { BASES, ORDRE, estBase, type BaseKey } from "@/lib/radar/bases";
import { DESK_PROJECT_TABS, DESK_SURFACES, isDeskScope, projectDeskLink } from "@/lib/assistant/scope";
import { cleanDeskText } from "@/lib/assistant/desk-data";
import { donneesDossiersBo3 } from "@/lib/bo3/donnees";
import { deskGmailConfiguration } from "@/lib/email/gmail-sync";
import type { Fiche } from "@/lib/radar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Agent DA du Desk. Réponse en flux NDJSON : une ligne JSON par événement
 * ({ t: "texte" | "outil" | "proposition" | "erreur" | "fin" }).
 * Réservé aux opérateurs connectés ; l'agent ne fait que lire et proposer.
 * Claude si ANTHROPIC_API_KEY est posée (modèle RADAR_CLAUDE_MODEL, sinon DESK_CLAUDE_MODEL),
 * OpenAI sinon (RADAR_AGENT_MODEL, sinon OPENAI_MODEL). DESK_AI_PROVIDER=openai force OpenAI.
 */
export async function POST(request: Request) {
  const origine = request.headers.get("origin");
  if (origine) {
    const host = request.headers.get("host") ?? new URL(request.url).host;
    try {
      const url = new URL(origine);
      // Next peut normaliser l'hôte derrière son serveur local ou un proxy.
      // Le navigateur calcule Sec-Fetch-Site à partir de l'origine visible.
      const memeOrigine = request.headers.get("sec-fetch-site") === "same-origin";
      if (!["http:", "https:"].includes(url.protocol) || (!memeOrigine && url.host !== host)) throw new Error("Origine différente");
    } catch {
      return NextResponse.json({ erreur: "Origine refusée." }, { status: 403 });
    }
  }

  const ctx = await contexteBo3();
  if (!ctx || !ctx.userId || ctx.apercu || (ctx.role !== "admin" && ctx.role !== "lead_referent")) {
    return NextResponse.json({ erreur: "Session expirée : reconnecte-toi." }, { status: 401 });
  }
  const claude = claudePrioritaire();
  const client = claude ? null : getOpenAIClient();
  if (!claude && !client) return NextResponse.json({ erreur: "Aucune clé d'IA n'est configurée sur ce déploiement (ANTHROPIC_API_KEY ou OPENAI_API_KEY)." }, { status: 503 });

  let corps: { tours?: unknown; scope?: unknown; ficheId?: unknown };
  try {
    corps = await request.json();
    if (!corps || typeof corps !== "object") throw new Error("Requête invalide");
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const tours: Tour[] = (Array.isArray(corps.tours) ? corps.tours : [])
    .filter((t): t is Tour => !!t && typeof t === "object" && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim() !== "")
    .slice(-20)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));
  if (!tours.length || tours[tours.length - 1].role !== "user") {
    return NextResponse.json({ erreur: "Message vide." }, { status: 400 });
  }

  const scope = isDeskScope(corps.scope) ? corps.scope : undefined;
  const leadId = scope?.screen === "project" ? scope.leadId : undefined;
  const [radar, contexte, donneesDesk] = await Promise.all([
    chargerRadar(),
    chargerContexteAgent(),
    donneesDossiersBo3().catch(() => null),
  ]);

  const bases = radar.ok ? radar.bases : Object.fromEntries(ORDRE.map(k => [k, [] as Fiche[]])) as Record<BaseKey, Fiche[]>;
  const dossier = donneesDesk?.projets.find(p => p.id === leadId);
  const actif = scope?.screen === "project" && !dossier ? undefined : scope;
  const id = (!actif || actif.screen === "radar") && estIdNotion(corps.ficheId) ? sansTirets(corps.ficheId) : "";
  const fiche = id ? ORDRE.flatMap(k => bases[k]).find(r => r.id === id) ?? null : null;
  const vue = actif?.screen === "project" && dossier
    ? `Dossier ${dossier.ref} · ${DESK_PROJECT_TABS[actif.tab].label} · ${projectDeskLink(dossier.id, actif.tab)}`
    : actif?.screen === "radar" && actif.item && estBase(actif.item) ? `Radar · ${BASES[actif.item].label}`
      : actif && actif.screen !== "project" ? DESK_SURFACES[actif.screen].label : "Desk";
  const desk = donneesDesk ? resumeDesk(donneesDesk.projets, donneesDesk.agences) : "Résumé du Desk indisponible.";
  const boitePartagee = ctx.role === "admin" && deskGmailConfiguration() === "configured";
  const systeme = messageSysteme({ contexte, bases, charge: radar.ok ? radar.charge : "", desk, vue, fiche, boitePartagee });
  const toursMasques = tours.map(tour => ({ ...tour, content: cleanDeskText(tour.content, donneesDesk?.projets ?? []) }));
  const options = { systeme, tours: toursMasques, bases, contexteDesk: actif, boitePartagee, signal: request.signal };

  const enc = new TextEncoder();
  const flux = new ReadableStream<Uint8Array>({
    async start(c) {
      const envoyer = (e: Evenement) => c.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const boucle = claude
          ? boucleAgentClaude({ ...options, modele: modeleClaude(process.env.RADAR_CLAUDE_MODEL) })
          : boucleAgent({ ...options, client: client!, modele: process.env.RADAR_AGENT_MODEL?.trim() || openaiModel() });
        for await (const e of boucle) envoyer(e);
      } catch (e) {
        if (!request.signal.aborted) {
          console.error("[api/radar/agent]", e instanceof Error ? e.message : e);
          envoyer({ t: "erreur", m: "L'agent n'a pas pu répondre. Réessaie dans un instant." });
          envoyer({ t: "fin" });
        }
      } finally {
        try { c.close(); } catch { /* flux déjà fermé */ }
      }
    },
  });
  return new Response(flux, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
