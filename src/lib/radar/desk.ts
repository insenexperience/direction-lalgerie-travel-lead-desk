import "server-only";
import type { Bo3Contexte } from "@/lib/bo3/acces";
import { LIEUX, ZONES, type Zone } from "@/lib/bo3/geo";
import { chargerAgences, chargerProjets } from "@/lib/bo3/load";
import { SOURCES, STATUTS, STATUT_LABEL } from "@/lib/bo3/types";

/**
 * Résumé du desk pour l'agent : uniquement des chiffres agrégés et la liste des agences partenaires.
 * Aucun nom, e-mail, téléphone ni message de voyageur ne sort d'ici.
 */
export async function resumeDesk(ctx: Bo3Contexte): Promise<string> {
  const [projets, agences] = await Promise.all([chargerProjets(ctx), chargerAgences(ctx)]);
  const ouverts = projets.filter((p) => p.statut !== "clos");
  const parStatut = STATUTS.map((s) => `${STATUT_LABEL[s]} ${projets.filter((p) => p.statut === s).length}`).join(", ");
  const parSource = (Object.keys(SOURCES) as (keyof typeof SOURCES)[]).map((s) => `${SOURCES[s]} ${projets.filter((p) => p.source === s).length}`).join(", ");
  const gagnes = projets.filter((p) => p.issue === "gagne").length;
  const perdus = projets.filter((p) => p.issue === "perdu").length;

  const zones: Record<Zone, number> = { nord: 0, kabylie: 0, est: 0, ouest: 0, sahara: 0 };
  for (const p of ouverts) {
    const touchees = new Set<Zone>();
    for (const j of p.trame?.jours ?? []) for (const l of j.lieux) if (LIEUX[l]) touchees.add(LIEUX[l].zone);
    touchees.forEach((z) => { zones[z]++; });
  }
  const couverture = (Object.keys(ZONES) as Zone[]).map((z) => `${ZONES[z]} : ${agences.filter((a) => a.zones.includes(z)).length} agence(s), ${zones[z]} projet(s) ouvert(s)`).join(" ; ");

  return [
    `Projets : ${projets.length} au total, ${ouverts.length} ouverts. Par étape : ${parStatut}. Clos : ${gagnes} gagné(s), ${perdus} perdu(s).`,
    `Origine des projets : ${parSource}.`,
    `Zones (agences actives et projets ouverts qui y passent) : ${couverture}.`,
    `Agences partenaires actives (${agences.length}) : ${agences.map((a) => `${a.n}${a.ville ? ` (${a.ville})` : ""}${a.zones.length ? ` [${a.zones.map((z) => ZONES[z]).join(", ")}]` : ""}`).join(" ; ") || "aucune"}.`,
  ].join("\n");
}
