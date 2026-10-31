import { BASES, champDe, type Base, type BaseKey, type Champ } from "./bases";
import type { Commentaire, Fiche, Valeur } from "./types";

/**
 * Traduction entre l'API publique de Notion (version 2022-06-28) et le format du module.
 * Fonctions pures : aucun appel réseau, testées dans notion-map.test.ts.
 */

export type RichText = {
  type?: string;
  plain_text?: string;
  href?: string | null;
  annotations?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean };
  text?: { content: string; link?: { url: string } | null };
};

export type NotionProp = {
  type: string;
  title?: RichText[];
  rich_text?: RichText[];
  select?: { name: string } | null;
  status?: { name: string } | null;
  multi_select?: { name: string }[];
  number?: number | null;
  date?: { start: string; end?: string | null } | null;
  checkbox?: boolean;
  url?: string | null;
  relation?: { id: string }[];
  created_time?: string;
};

export type NotionPage = {
  id: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  properties: Record<string, NotionProp>;
};

export type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[];
  [k: string]: unknown;
};

export type NotionComment = {
  id: string;
  created_time: string;
  created_by?: { id: string; name?: string };
  display_name?: { resolved_name?: string } | null;
  rich_text: RichText[];
};

export const sansTirets = (id: string) => String(id || "").replace(/-/g, "").toLowerCase();
export function avecTirets(id: string): string {
  const h = sansTirets(id);
  return h.length === 32 ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : h;
}
export const estIdNotion = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{32}$/.test(sansTirets(id));

// ---------------------------------------------------------------- texte riche
export function richVersMd(rt: RichText[] | undefined): string {
  if (!rt?.length) return "";
  return rt
    .map((r) => {
      let t = r.plain_text ?? r.text?.content ?? "";
      if (!t) return "";
      const lien = r.href ?? r.text?.link?.url ?? null;
      const a = r.annotations ?? {};
      if (a.code) t = "`" + t + "`";
      else {
        if (a.bold && t.trim()) t = `**${t}**`;
        if (a.italic && t.trim() && !a.bold) t = `*${t}*`;
      }
      return lien ? `[${t}](${lien})` : t;
    })
    .join("");
}

export const richVersTexte = (rt: RichText[] | undefined) => (rt ?? []).map((r) => r.plain_text ?? r.text?.content ?? "").join("");

type RichReq = { type: "text"; text: { content: string; link?: { url: string } | null }; annotations?: { bold?: boolean } };

/** Markdown léger (liens et gras) → texte riche Notion, découpé en morceaux de 2 000 caractères. */
export function mdVersRich(md: string): RichReq[] {
  const out: RichReq[] = [];
  const pousser = (content: string, url?: string, gras?: boolean) => {
    for (let i = 0; i < content.length; i += 2000) {
      const morceau = content.slice(i, i + 2000);
      const it: RichReq = { type: "text", text: { content: morceau, link: url ? { url } : null } };
      if (gras) it.annotations = { bold: true };
      out.push(it);
    }
  };
  const re = /\[([^\]]+)\]\(((?:https?|mailto):[^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  const s = String(md ?? "");
  while ((m = re.exec(s))) {
    if (m.index > dernier) pousser(s.slice(dernier, m.index));
    if (m[1]) pousser(m[1], m[2]);
    else pousser(m[3], undefined, true);
    dernier = re.lastIndex;
  }
  if (dernier < s.length) pousser(s.slice(dernier));
  return out.slice(0, 100);
}

// ---------------------------------------------------------------- pages → fiches
function lire(f: Champ, p: NotionProp | undefined): Valeur {
  if (!p) return f.type === "multi" || f.type === "relation" ? [] : f.type === "checkbox" ? false : f.type === "number" ? null : "";
  switch (f.type) {
    case "text": return richVersMd(p.rich_text ?? p.title);
    case "select": return p.select?.name ?? p.status?.name ?? "";
    case "multi": return (p.multi_select ?? []).map((o) => o.name);
    case "number": return typeof p.number === "number" ? p.number : null;
    case "date": return p.date?.start ?? "";
    case "checkbox": return !!p.checkbox;
    case "url": return p.url ?? "";
    case "relation": return (p.relation ?? []).map((r) => sansTirets(r.id));
    case "created": return p.created_time ?? "";
  }
}

export function pageVersFiche(base: BaseKey, page: NotionPage): Fiche {
  const b = BASES[base];
  const props: Record<string, Valeur> = {};
  const titre = richVersTexte(page.properties[b.titre]?.title).trim();
  const st = page.properties[b.statut];
  const statut = st?.status?.name ?? st?.select?.name ?? "";
  props[b.titre] = titre;
  props[b.statut] = statut;
  for (const f of b.champs) props[f.k] = lire(f, page.properties[f.k]);
  return { id: sansTirets(page.id), base, titre: titre || "Sans titre", statut, props, modifie: page.last_edited_time ?? "" };
}

// ---------------------------------------------------------------- changements → propriétés Notion
export type ChampOuSpecial = Champ | { k: string; label: string; type: "title" | "statut"; opts?: string[] };

export function champOuSpecial(b: Base, k: string): ChampOuSpecial | null {
  if (k === b.titre) return { k, label: "Titre", type: "title" };
  if (k === b.statut) return { k, label: b.statut, type: "statut", opts: b.statuts };
  return champDe(b, k);
}

export function changementsVersProps(base: BaseKey, changes: Record<string, Valeur>): Record<string, unknown> {
  const b = BASES[base];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    const f = champOuSpecial(b, k);
    if (!f) continue;
    switch (f.type) {
      case "title": out[k] = { title: [{ type: "text", text: { content: String(v ?? "").slice(0, 2000) || "Sans titre" } }] }; break;
      case "statut": out[k] = b.statutType === "status" ? { status: v ? { name: String(v) } : null } : { select: v ? { name: String(v) } : null }; break;
      case "text": out[k] = { rich_text: mdVersRich(String(v ?? "")) }; break;
      case "select": out[k] = { select: v ? { name: String(v) } : null }; break;
      case "multi": out[k] = { multi_select: (Array.isArray(v) ? v : []).map((name) => ({ name })) }; break;
      case "number": out[k] = { number: typeof v === "number" && Number.isFinite(v) ? v : null }; break;
      case "date": out[k] = { date: v ? { start: String(v).slice(0, 10) } : null }; break;
      case "checkbox": out[k] = { checkbox: !!v }; break;
      case "url": out[k] = { url: v ? String(v) : null }; break;
      case "relation": out[k] = { relation: (Array.isArray(v) ? v : []).filter(estIdNotion).map((id) => ({ id: avecTirets(id) })) }; break;
      case "created": break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- validation (formulaires et agent)
const egalOption = (opts: string[] | undefined, v: string) => {
  if (!opts) return v;
  if (opts.includes(v)) return v;
  const lv = v.toLowerCase();
  return opts.find((o) => o.toLowerCase() === lv) ?? null;
};

/**
 * Normalise et valide des changements avant écriture. Accepte le nom exact de la propriété
 * ou son libellé, rejette les options inconnues et les types incohérents.
 */
export function normaliserChangements(
  base: BaseKey,
  brut: unknown,
  opts: { relations?: boolean } = {},
): { changes: Record<string, Valeur>; erreurs: string[] } {
  const b = BASES[base];
  const changes: Record<string, Valeur> = {};
  const erreurs: string[] = [];
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return { changes, erreurs: ["Changements attendus sous la forme propriété → valeur."] };
  for (const [k0, v] of Object.entries(brut as Record<string, unknown>)) {
    const lk = k0.trim().toLowerCase();
    let k: string | null = null;
    if (k0 === b.titre || ["titre", "title", "nom"].includes(lk)) k = b.titre;
    else if (k0 === b.statut || ["statut", "status", "étape", "etape"].includes(lk)) k = b.statut;
    else k = b.champs.find((f) => f.k.toLowerCase() === lk || f.label.toLowerCase() === lk)?.k ?? null;
    if (!k) { erreurs.push(`« ${k0} » n'est pas une propriété de la base ${b.label}.`); continue; }
    const f = champOuSpecial(b, k)!;
    if (f.type === "created") { erreurs.push(`${f.label} est rempli par Notion.`); continue; }
    if (f.type === "relation" && (!opts.relations || !(f as Champ).cible)) { erreurs.push(`${f.label} se modifie dans Notion.`); continue; }
    const vide = v === null || v === undefined || v === "";
    switch (f.type) {
      case "title": {
        const t = String(v ?? "").replace(/\s+/g, " ").trim();
        if (!t) { erreurs.push("Le titre ne peut pas être vide."); continue; }
        changes[k] = t.slice(0, 2000);
        break;
      }
      case "statut": case "select": {
        if (vide) { if (f.type === "statut") { erreurs.push("Le statut ne peut pas être vide."); continue; } changes[k] = ""; break; }
        const o = egalOption(f.opts, String(v));
        if (!o) { erreurs.push(`${f.label} : « ${v} » n'est pas une option (${(f.opts ?? []).join(", ")}).`); continue; }
        changes[k] = o;
        break;
      }
      case "multi": {
        const liste = vide ? [] : Array.isArray(v) ? v : String(v).split(",");
        const ok: string[] = [];
        const inconnues: string[] = [];
        for (const x of liste) {
          const s = String(x).trim();
          if (!s) continue;
          const o = egalOption(f.opts, s);
          if (o) { if (!ok.includes(o)) ok.push(o); } else inconnues.push(s);
        }
        if (inconnues.length) { erreurs.push(`${f.label} : options inconnues ${inconnues.join(", ")}.`); continue; }
        changes[k] = ok;
        break;
      }
      case "number": {
        if (vide) { changes[k] = null; break; }
        const n = Number(v);
        if (!Number.isFinite(n)) { erreurs.push(`${f.label} : nombre attendu.`); continue; }
        changes[k] = n;
        break;
      }
      case "date": {
        if (vide) { changes[k] = ""; break; }
        const d = String(v).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d + "T12:00:00").getTime())) { erreurs.push(`${f.label} : date attendue au format AAAA-MM-JJ.`); continue; }
        changes[k] = d;
        break;
      }
      case "checkbox": changes[k] = v === true || /^(oui|true|vrai|1|yes)$/i.test(String(v)); break;
      case "url": {
        if (vide) { changes[k] = ""; break; }
        const u = String(v).trim();
        if (!/^(https?:\/\/|mailto:)/i.test(u)) { erreurs.push(`${f.label} : adresse http(s) attendue.`); continue; }
        changes[k] = u;
        break;
      }
      case "relation": {
        const ids = (Array.isArray(v) ? v : []).map((x) => sansTirets(String(x)));
        if (ids.some((id) => !estIdNotion(id))) { erreurs.push(`${f.label} : identifiants de fiches invalides.`); continue; }
        changes[k] = Array.from(new Set(ids));
        break;
      }
      default: changes[k] = String(v ?? "").slice(0, 10_000);
    }
  }
  return { changes, erreurs };
}

// ---------------------------------------------------------------- contenu des pages
function texteBloc(b: NotionBlock): string {
  const v = b[b.type] as { rich_text?: RichText[]; checked?: boolean; language?: string; url?: string; title?: string; caption?: RichText[] } | undefined;
  return richVersMd(v?.rich_text);
}

export function blocsVersMd(blocs: NotionBlock[]): string {
  return versLignes(blocs, 0).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function versLignes(blocs: NotionBlock[], profondeur: number): string[] {
  const lignes: string[] = [];
  const ret = "  ".repeat(profondeur);
  for (const b of blocs) {
    const v = (b[b.type] ?? {}) as { rich_text?: RichText[]; checked?: boolean; language?: string; url?: string; title?: string; icon?: { emoji?: string } };
    const t = texteBloc(b);
    switch (b.type) {
      case "paragraph": lignes.push(ret + t, ""); break;
      case "heading_1": lignes.push(`# ${t}`, ""); break;
      case "heading_2": lignes.push(`## ${t}`, ""); break;
      case "heading_3": lignes.push(`### ${t}`, ""); break;
      case "bulleted_list_item": lignes.push(`${ret}- ${t}`); break;
      case "numbered_list_item": lignes.push(`${ret}1. ${t}`); break;
      case "to_do": lignes.push(`${ret}- [${v.checked ? "x" : " "}] ${t}`); break;
      case "quote": case "callout": lignes.push(`> ${v.icon?.emoji ? v.icon.emoji + " " : ""}${t}`, ""); break;
      case "toggle": lignes.push(`${ret}- **${t}**`); break;
      case "code": lignes.push("```" + (v.language ?? ""), richVersTexte(v.rich_text), "```", ""); break;
      case "divider": lignes.push("---", ""); break;
      case "bookmark": case "embed": case "link_preview": if (v.url) lignes.push(`[${v.url}](${v.url})`, ""); break;
      case "child_page": lignes.push(`Page : ${v.title ?? ""}`, ""); break;
      case "child_database": lignes.push(`Base : ${v.title ?? ""}`, ""); break;
      case "table": {
        const rangs = (b.children ?? []).filter((r) => r.type === "table_row");
        rangs.forEach((r, i) => {
          const cells = ((r.table_row as { cells?: RichText[][] })?.cells ?? []).map((c) => richVersMd(c).replace(/\|/g, "/"));
          lignes.push(`| ${cells.join(" | ")} |`);
          if (i === 0) lignes.push(`|${cells.map(() => " --- ").join("|")}|`);
        });
        lignes.push("");
        continue;
      }
      case "image": case "video": case "file": case "pdf": case "audio": lignes.push(`(${b.type === "image" ? "image" : "fichier"} dans la page Notion)`, ""); break;
      default: if (t) lignes.push(ret + t, "");
    }
    if (b.children?.length && b.type !== "table") lignes.push(...versLignes(b.children, b.type.endsWith("list_item") || b.type === "to_do" || b.type === "toggle" ? profondeur + 1 : profondeur));
  }
  return lignes;
}

export function commentaireVersItem(c: NotionComment, noms: Record<string, string> = {}): Commentaire {
  const qui = c.display_name?.resolved_name || c.created_by?.name || (c.created_by?.id ? noms[c.created_by.id] : "") || "";
  return { id: c.id, qui, quand: c.created_time, texte: richVersMd(c.rich_text) };
}
