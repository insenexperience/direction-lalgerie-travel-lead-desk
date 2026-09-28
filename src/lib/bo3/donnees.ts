import { cache } from "react";
import { contexteBo3 } from "./acces";
import { chargerAgences, chargerProjets, resoudreAgenceChoisie } from "./load";

/** Une seule lecture par requête, partagée entre la coque (compteurs, palette) et la page. */
export const donneesBo3 = cache(async () => {
  const ctx = await contexteBo3();
  if (!ctx) return null;
  const agences = await chargerAgences(ctx);
  const projets = resoudreAgenceChoisie(await chargerProjets(ctx), agences);
  return { ctx, agences, projets, now: Date.now() };
});
