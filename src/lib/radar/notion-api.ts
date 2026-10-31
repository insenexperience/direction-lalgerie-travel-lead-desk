import "server-only";
import { avecTirets, type NotionBlock, type NotionComment, type NotionPage, type RichText } from "./notion-map";

/**
 * Client minimal de l'API publique Notion, côté serveur uniquement.
 * Clé : NOTION_TOKEN (intégration interne Notion, partagée avec la page « Radar Direction l'Algérie »).
 * NOTION_API_URL ne sert qu'aux tests locaux contre un faux serveur.
 */

const VERSION = "2022-06-28";
const base = () => (process.env.NOTION_API_URL || "https://api.notion.com/v1").replace(/\/$/, "");

export const notionConfigure = () => !!process.env.NOTION_TOKEN?.trim();

export class ErreurNotion extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/** Message lisible par l'équipe, à partir d'une erreur Notion. */
export function messageNotion(e: unknown): string {
  if (e instanceof ErreurNotion) {
    switch (e.code) {
      case "unauthorized": return "La clé Notion du desk est refusée. Vérifie NOTION_TOKEN dans Vercel.";
      case "restricted_resource": case "object_not_found": return "Notion ne donne pas accès à cette page : la page « Radar Direction l'Algérie » doit être partagée avec l'intégration du desk.";
      case "rate_limited": return "Notion limite le nombre de requêtes. Réessaie dans un instant.";
      case "validation_error": return `Notion a refusé la valeur : ${e.message}`;
      case "conflict_error": return "Conflit d'écriture dans Notion. Réessaie.";
      case "config": return e.message;
      default: return `Notion ne répond pas correctement (${e.status || "réseau"}). Réessaie dans un instant.`;
    }
  }
  return "Échange avec Notion impossible. Réessaie dans un instant.";
}

async function appel<T>(chemin: string, init: { method?: string; body?: unknown } = {}, essai = 0): Promise<T> {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) throw new ErreurNotion(0, "config", "NOTION_TOKEN manquant.");
  let res: Response;
  try {
    res = await fetch(base() + chemin, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ErreurNotion(0, "reseau", "Réseau indisponible.");
  }
  if (res.status === 429 && essai < 2) {
    const attente = Math.min(3, Number(res.headers.get("retry-after")) || 1);
    await new Promise((r) => setTimeout(r, attente * 1000));
    return appel<T>(chemin, init, essai + 1);
  }
  const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (!res.ok) throw new ErreurNotion(res.status, json.code ?? "erreur", json.message ?? res.statusText);
  return json as T;
}

type Liste<T> = { results: T[]; has_more: boolean; next_cursor: string | null };

/** Toutes les pages d'une base (pagination complète, 1 000 fiches au plus). */
export async function pagesDeBase(databaseId: string): Promise<NotionPage[]> {
  const out: NotionPage[] = [];
  let curseur: string | null = null;
  for (let i = 0; i < 10; i++) {
    const r: Liste<NotionPage> = await appel<Liste<NotionPage>>(`/databases/${avecTirets(databaseId)}/query`, {
      method: "POST",
      body: { page_size: 100, ...(curseur ? { start_cursor: curseur } : {}) },
    });
    out.push(...r.results.filter((p) => !p.archived && !p.in_trash));
    if (!r.has_more || !r.next_cursor) break;
    curseur = r.next_cursor;
  }
  return out;
}

/** Blocs d'une page, avec leurs enfants jusqu'à deux niveaux (400 blocs au plus). */
export async function blocsDePage(id: string, profondeur = 0, compteur = { n: 0 }): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let curseur: string | null = null;
  for (let i = 0; i < 4 && compteur.n < 400; i++) {
    const q = `?page_size=100${curseur ? `&start_cursor=${encodeURIComponent(curseur)}` : ""}`;
    const r: Liste<NotionBlock> = await appel<Liste<NotionBlock>>(`/blocks/${avecTirets(id)}/children${q}`);
    for (const b of r.results) {
      compteur.n++;
      if (b.has_children && profondeur < 2 && b.type !== "child_page" && b.type !== "child_database") {
        b.children = await blocsDePage(b.id, profondeur + 1, compteur);
      }
      out.push(b);
    }
    if (!r.has_more || !r.next_cursor) break;
    curseur = r.next_cursor;
  }
  return out;
}

export async function commentairesDePage(id: string): Promise<NotionComment[]> {
  const r = await appel<Liste<NotionComment>>(`/comments?block_id=${avecTirets(id)}&page_size=100`);
  return r.results;
}

const nomsUtilisateurs = new Map<string, string>();
export async function nomUtilisateur(id: string): Promise<string> {
  if (nomsUtilisateurs.has(id)) return nomsUtilisateurs.get(id)!;
  try {
    const u = await appel<{ name?: string; type?: string }>(`/users/${id}`);
    const nom = u.type === "bot" ? "Radar" : u.name ?? "";
    nomsUtilisateurs.set(id, nom);
    return nom;
  } catch {
    nomsUtilisateurs.set(id, "");
    return "";
  }
}

export const majPage = (id: string, properties: Record<string, unknown>) =>
  appel<NotionPage>(`/pages/${avecTirets(id)}`, { method: "PATCH", body: { properties } });

export const creerPage = (databaseId: string, properties: Record<string, unknown>) =>
  appel<NotionPage>(`/pages`, { method: "POST", body: { parent: { database_id: avecTirets(databaseId) }, properties } });

export const creerCommentaire = (pageId: string, rich_text: RichText[] | object[]) =>
  appel<NotionComment>(`/comments`, { method: "POST", body: { parent: { page_id: avecTirets(pageId) }, rich_text } });
