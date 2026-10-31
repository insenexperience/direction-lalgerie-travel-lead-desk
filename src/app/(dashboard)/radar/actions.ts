"use server";

import { updateTag } from "next/cache";
import { contexteBo3 } from "@/lib/bo3/acces";
import { BASES, estBase, type BaseKey } from "@/lib/radar/bases";
import { chargerDetail, TAG_RADAR, tagFiche } from "@/lib/radar/donnees";
import { creerCommentaire, creerPage, majPage, messageNotion } from "@/lib/radar/notion-api";
import { changementsVersProps, estIdNotion, mdVersRich, normaliserChangements, sansTirets } from "@/lib/radar/notion-map";
import { aujourdhui } from "@/lib/radar/format";
import type { DetailFiche, Proposition, ResultatAction, Valeur } from "@/lib/radar/types";

/** Réservé aux opérateurs connectés du desk (admin ou référent). */
async function operateur(): Promise<{ nom: string } | null> {
  const ctx = await contexteBo3();
  if (!ctx || !ctx.userId) return null;
  if (ctx.role !== "admin" && ctx.role !== "lead_referent") return null;
  return { nom: ctx.nom };
}

const refuse = (erreur: string): ResultatAction => ({ ok: false, erreur });

export async function modifierFiche(base: string, id: string, brut: Record<string, Valeur>): Promise<ResultatAction> {
  if (!(await operateur())) return refuse("Session expirée : reconnecte-toi.");
  if (!estBase(base) || !estIdNotion(id)) return refuse("Fiche inconnue.");
  const { changes, erreurs } = normaliserChangements(base, brut, { relations: true });
  if (erreurs.length) return refuse(erreurs.join(" "));
  if (!Object.keys(changes).length) return { ok: true, id: sansTirets(id) };
  try {
    await majPage(id, changementsVersProps(base, changes));
  } catch (e) {
    return refuse(messageNotion(e));
  }
  updateTag(TAG_RADAR);
  return { ok: true, id: sansTirets(id) };
}

export async function creerFiche(base: string, brut: Record<string, Valeur>): Promise<ResultatAction> {
  if (!(await operateur())) return refuse("Session expirée : reconnecte-toi.");
  if (!estBase(base)) return refuse("Base inconnue.");
  const b = BASES[base];
  const { changes, erreurs } = normaliserChangements(base, brut, { relations: true });
  if (erreurs.length) return refuse(erreurs.join(" "));
  if (!changes[b.titre]) return refuse("Le titre est obligatoire.");
  if (!changes[b.statut]) changes[b.statut] = b.statuts[0];
  if (b.dateCreation && !changes[b.dateCreation]) changes[b.dateCreation] = aujourdhui();
  try {
    const page = await creerPage(b.db, changementsVersProps(base, changes));
    updateTag(TAG_RADAR);
    return { ok: true, id: sansTirets(page.id) };
  } catch (e) {
    return refuse(messageNotion(e));
  }
}

export async function commenterFiche(id: string, texte: string): Promise<ResultatAction> {
  const op = await operateur();
  if (!op) return refuse("Session expirée : reconnecte-toi.");
  const t = String(texte ?? "").trim();
  if (!estIdNotion(id) || !t) return refuse("Commentaire vide.");
  try {
    await creerCommentaire(id, mdVersRich(`${op.nom} (via le desk) : ${t.slice(0, 4000)}`));
  } catch (e) {
    return refuse(messageNotion(e));
  }
  updateTag(tagFiche(id));
  return { ok: true, id: sansTirets(id) };
}

export async function lireDetail(id: string): Promise<{ ok: true; detail: DetailFiche } | { ok: false; erreur: string }> {
  if (!(await operateur())) return { ok: false, erreur: "Session expirée : reconnecte-toi." };
  if (!estIdNotion(id)) return { ok: false, erreur: "Fiche inconnue." };
  try {
    return { ok: true, detail: await chargerDetail(id) };
  } catch (e) {
    return { ok: false, erreur: messageNotion(e) };
  }
}

/** Applique une proposition de l'agent que la personne vient d'accepter. Tout est revalidé ici. */
export async function appliquerProposition(p: Proposition): Promise<ResultatAction> {
  if (!p || !estBase(p.base)) return refuse("Proposition invalide.");
  const base: BaseKey = p.base;
  if (p.kind === "update") {
    const { changes, erreurs } = normaliserChangements(base, p.changes);
    if (erreurs.length) return refuse(erreurs.join(" "));
    return modifierFiche(base, p.ficheId, changes);
  }
  if (p.kind === "create") {
    const { changes, erreurs } = normaliserChangements(base, p.changes);
    if (erreurs.length) return refuse(erreurs.join(" "));
    return creerFiche(base, changes);
  }
  if (p.kind === "comment") return commenterFiche(p.ficheId, p.texte);
  return refuse("Proposition invalide.");
}
