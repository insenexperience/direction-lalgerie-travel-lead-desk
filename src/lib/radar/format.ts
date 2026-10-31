import { BASES, champDe, type Base, type Champ } from "./bases";
import type { Fiche, Valeur } from "./types";

/** Fonctions pures partagées par les écrans, l'agent et les tests. */

export const aujourdhui = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

export function joursAvant(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  const t = new Date(aujourdhui(now) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

export function relatif(d: number | null): string {
  if (d == null) return "";
  if (d < 0) return d === -1 ? "Hier" : `Il y a ${-d} j`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  return `J-${d}`;
}

export function dateFr(iso: string | null | undefined, sansAnnee = false): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", sansAnnee ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

export const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Texte Markdown léger → texte brut (liens « libellé (adresse) » si demandé). */
export function texteBrut(s: Valeur | undefined, garderAdresses = false): string {
  if (s == null) return "";
  if (Array.isArray(s)) return s.join(", ");
  return String(s)
    .replace(/\[([^\]]+)\]\(((?:https?|mailto):[^)\s]+)\)/g, (_m, l: string, u: string) => {
      const nu = u.replace(/^mailto:/, "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      const nl = l.replace(/^https?:\/\//, "").replace(/\/$/, "");
      return garderAdresses && nl !== nu ? `${l} (${u})` : l;
    })
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\\([_*[\]()#`>~])/g, "$1");
}

export function liensDe(s: Valeur | undefined): { u: string; t: string }[] {
  const out: { u: string; t: string }[] = [];
  const vus = new Set<string>();
  const re = /\[([^\]]+)\]\(((?:https?|mailto):[^)\s]+)\)|(https?:\/\/[^\s)\]]+)/g;
  const txt = typeof s === "string" ? s : "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const u = m[2] || m[3];
    if (!u || vus.has(u)) continue;
    vus.add(u);
    let t = (m[1] || m[3]).replace(/^mailto:/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    if (t.length > 38) t = t.slice(0, 36) + "…";
    out.push({ u, t });
  }
  return out;
}

export const adresseSure = (u: string | null | undefined): string | null => (u && /^(https?:\/\/|mailto:)/i.test(u) ? u : null);

export function valeurTexte(f: Champ, v: Valeur | undefined, noms?: Record<string, string>): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return f.type === "relation" ? v.map((id) => noms?.[id] ?? id).join(", ") : v.join(", ");
  if (f.type === "date" || f.type === "created") return dateFr(String(v));
  if (f.type === "checkbox") return v ? "Oui" : "Non";
  return typeof v === "string" ? texteBrut(v, true) : String(v);
}

export const dateDe = (f: Fiche, k: string | null | undefined): string => (k && typeof f.props[k] === "string" ? (f.props[k] as string) : "");

/** Fiches actives : sans les statuts masqués par défaut (archivé, écarté…). */
export const actives = (b: Base, rows: Fiche[]) => rows.filter((r) => !b.masques.includes(r.statut));

export function ligneMeta(b: Base, r: Fiche): string {
  return b.meta
    .map((k) => {
      const f = champDe(b, k);
      const v = r.props[k];
      if (!f) return "";
      if (f.type === "date") return dateFr(typeof v === "string" ? v : "");
      return Array.isArray(v) ? v.join(", ") : v == null ? "" : texteBrut(v);
    })
    .filter(Boolean)
    .join(" · ");
}

/** Fiche entière en texte, pour « Copier la fiche ». */
export function ficheEnTexte(r: Fiche, noms: Record<string, string>, contenu?: string): string {
  const b = BASES[r.base];
  const lignes = [`# ${r.titre}`, "", `${b.statut} : ${r.statut || "—"}`];
  for (const f of b.champs) {
    const v = r.props[f.k];
    if (v == null || v === "" || v === false || (Array.isArray(v) && !v.length)) continue;
    lignes.push(`${f.label} : ${valeurTexte(f, v, noms)}`);
  }
  if (contenu) lignes.push("", texteBrut(contenu, true).trim());
  lignes.push("", `Notion : https://app.notion.com/p/${r.id}`);
  return lignes.join("\n");
}
