import "server-only";
import { unstable_cache } from "next/cache";
import { BASES, ORDRE, type BaseKey } from "./bases";
import { blocsVersMd, commentaireVersItem, pageVersFiche, sansTirets } from "./notion-map";
import { blocsDePage, commentairesDePage, ErreurNotion, messageNotion, nomUtilisateur, notionConfigure, pagesDeBase } from "./notion-api";
import type { DetailFiche, DonneesRadar, Fiche } from "./types";

/** Étiquette de cache commune : toute écriture la purge (updateTag dans les actions). */
export const TAG_RADAR = "radar";
export const tagFiche = (id: string) => `radar-fiche-${sansTirets(id)}`;

/**
 * Page Notion « Contexte de l'agent DA », sous la page Radar. Le contexte du projet vit là et non
 * dans le dépôt (public) : seul l'identifiant figure ici, la page ne se lit qu'avec NOTION_TOKEN.
 */
const CONTEXTE_AGENT = () => process.env.NOTION_RADAR_CONTEXTE_PAGE_ID?.trim() || "40a73be62c5b81bfbc59c31df85e7ebc";

const lireBases = unstable_cache(
  async (): Promise<{ bases: Record<BaseKey, Fiche[]>; charge: string }> => {
    const listes = await Promise.all(ORDRE.map((k) => pagesDeBase(BASES[k].db)));
    const bases = Object.fromEntries(ORDRE.map((k, i) => [k, listes[i].map((p) => pageVersFiche(k, p))])) as Record<BaseKey, Fiche[]>;
    return { bases, charge: new Date().toISOString() };
  },
  ["radar-bases-v1"],
  { tags: [TAG_RADAR], revalidate: 60 },
);

/** Les cinq bases du radar, en cache 60 s ; les erreurs ne sont jamais mises en cache. */
export async function chargerRadar(): Promise<DonneesRadar> {
  if (!notionConfigure()) return { ok: false, raison: "config", message: "NOTION_TOKEN n'est pas encore configuré." };
  try {
    const d = await lireBases();
    return { ok: true, ...d };
  } catch (e) {
    const acces = e instanceof ErreurNotion && ["unauthorized", "restricted_resource", "object_not_found"].includes(e.code);
    return { ok: false, raison: acces ? "acces" : "erreur", message: messageNotion(e) };
  }
}

/** Contenu de la page et commentaires d'une fiche, en cache 5 min. */
export async function chargerDetail(id: string): Promise<DetailFiche> {
  const h = sansTirets(id);
  return unstable_cache(
    async () => {
      const [blocs, coms] = await Promise.all([blocsDePage(h), commentairesDePage(h).catch(() => [])]);
      const noms: Record<string, string> = {};
      for (const c of coms) if (c.created_by?.id && !c.display_name?.resolved_name && !(c.created_by.id in noms)) noms[c.created_by.id] = await nomUtilisateur(c.created_by.id);
      return { contenu: blocsVersMd(blocs), commentaires: coms.map((c) => commentaireVersItem(c, noms)) };
    },
    ["radar-detail-v1", h],
    { tags: [TAG_RADAR, tagFiche(h)], revalidate: 300 },
  )();
}

/** Contexte projet de l'agent : page Notion privée, en cache 1 h. Chaîne vide si absente. */
export async function chargerContexteAgent(): Promise<string> {
  const id = CONTEXTE_AGENT();
  if (!id || !notionConfigure()) return "";
  try {
    return await unstable_cache(async () => blocsVersMd(await blocsDePage(id)), ["radar-contexte-v1", id], { tags: [TAG_RADAR], revalidate: 3600 })();
  } catch {
    return "";
  }
}
