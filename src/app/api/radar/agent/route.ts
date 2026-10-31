import { NextResponse } from "next/server";
import { getOpenAIClient, openaiModel } from "@/lib/ai/agent";
import { contexteBo3 } from "@/lib/bo3/acces";
import { boucleAgent, messageSysteme, type Evenement, type Tour } from "@/lib/radar/agent";
import { chargerContexteAgent, chargerRadar } from "@/lib/radar/donnees";
import { resumeDesk } from "@/lib/radar/desk";
import { estIdNotion, sansTirets } from "@/lib/radar/notion-map";
import { ORDRE } from "@/lib/radar/bases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Agent DA du module Radar. Réponse en flux NDJSON : une ligne JSON par événement
 * ({ t: "texte" | "outil" | "proposition" | "erreur" | "fin" }).
 * Réservé aux opérateurs connectés ; l'agent ne fait que lire et proposer.
 */
export async function POST(request: Request) {
  const origine = request.headers.get("origin");
  if (origine && new URL(origine).host !== new URL(request.url).host) {
    return NextResponse.json({ erreur: "Origine refusée." }, { status: 403 });
  }

  const ctx = await contexteBo3();
  if (!ctx || !ctx.userId || (ctx.role !== "admin" && ctx.role !== "lead_referent")) {
    return NextResponse.json({ erreur: "Session expirée : reconnecte-toi." }, { status: 401 });
  }
  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ erreur: "OPENAI_API_KEY n'est pas configurée sur ce déploiement." }, { status: 503 });

  let corps: { tours?: unknown; vue?: unknown; ficheId?: unknown };
  try {
    corps = await request.json();
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

  const radar = await chargerRadar();
  if (!radar.ok) return NextResponse.json({ erreur: radar.message }, { status: 503 });
  const [contexte, desk] = await Promise.all([
    chargerContexteAgent(),
    resumeDesk(ctx).catch(() => "Résumé du desk indisponible pour le moment."),
  ]);

  const vue = typeof corps.vue === "string" ? corps.vue.slice(0, 200) : "Radar";
  const id = estIdNotion(corps.ficheId) ? sansTirets(corps.ficheId) : "";
  const fiche = id ? ORDRE.flatMap((k) => radar.bases[k]).find((r) => r.id === id) ?? null : null;
  const systeme = messageSysteme({ contexte, bases: radar.bases, charge: radar.charge, desk, vue, fiche });

  const enc = new TextEncoder();
  const flux = new ReadableStream<Uint8Array>({
    async start(c) {
      const envoyer = (e: Evenement) => c.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const e of boucleAgent({ client, modele: process.env.RADAR_AGENT_MODEL?.trim() || openaiModel(), systeme, tours, bases: radar.bases, signal: request.signal })) envoyer(e);
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
