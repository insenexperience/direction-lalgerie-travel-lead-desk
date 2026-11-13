import { cache } from "react";
import { contexteBo3 } from "./acces";
import { chargerAgences, chargerProjets, chargerProjetsListe, resoudreAgenceChoisie } from "./load";

export const maintenantBo3 = cache(() => Date.now());

export const agencesBo3 = cache(async () => {
  const ctx = await contexteBo3();
  return ctx ? chargerAgences(ctx) : [];
});

/** La coque et les listes partagent un seul chargement de résumés par requête. */
export const donneesBo3 = cache(async () => {
  const ctx = await contexteBo3();
  if (!ctx) return null;
  const [agences, projets] = await Promise.all([agencesBo3(), chargerProjetsListe(ctx)]);
  return { ctx, agences, projets: resoudreAgenceChoisie(projets, agences), now: maintenantBo3() };
});

/** DA Sales lit les dossiers complets pour les rapprochements et les résumés détaillés. */
export const donneesDossiersBo3 = cache(async () => {
  const ctx = await contexteBo3();
  if (!ctx?.userId || ctx.apercu || !["admin", "lead_referent"].includes(ctx.role ?? "")) return null;
  const [agences, projets] = await Promise.all([chargerAgences(ctx), chargerProjets(ctx)]);
  return { ctx, agences, projets: resoudreAgenceChoisie(projets, agences), now: maintenantBo3() };
});
