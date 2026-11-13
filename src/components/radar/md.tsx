import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { adresseSure } from "@/lib/radar/format";

/**
 * Rendu Markdown léger et sûr (contenu des pages Notion, commentaires, réponses de l'agent).
 * Produit des éléments React, jamais de HTML brut ; seuls les liens http(s) et mailto sont cliquables.
 */

const INLINE = /(`[^`]+`)|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*([^*\s][^*]*?)\*(?!\w)|(?<![\w_])_([^_\s][^_]*?)_(?![\w])|(https?:\/\/[^\s)<\]]+)/g;

function lienInterne(href: string) {
  return /^\/(?:leads|inbox|agencies|radar|quotes|dashboard|metrics|contacts|settings|users)(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i.test(href)
    && !/[\\\u0000-\u0020\u007f]|%(?:2f|5c|00)/i.test(href)
    && !href.split(/[/?#]/).some(segment => /^(?:\.|%2e){1,2}$/i.test(segment));
}

export function enLigne(s: string, cle = "i", liensDesk = false): ReactNode[] {
  const out: ReactNode[] = [];
  let dernier = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE.source, "g");
  while ((m = re.exec(s))) {
    if (m.index > dernier) out.push(s.slice(dernier, m.index));
    const k = `${cle}-${n++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{enLigne(m[2], k, liensDesk)}</strong>);
    else if (m[3]) {
      const u = adresseSure(m[4]);
      if (liensDesk && lienInterne(m[4])) out.push(<Link key={k} href={m[4]} prefetch={false}>{m[3]}</Link>);
      else out.push(u ? <a key={k} href={u} target="_blank" rel="noopener noreferrer">{m[3]}</a> : <Fragment key={k}>{m[3]}</Fragment>);
    } else if (m[5]) out.push(<em key={k}>{m[5]}</em>);
    else if (m[6]) out.push(<em key={k}>{m[6]}</em>);
    else if (m[7]) {
      const u = m[7].replace(/[.,;:!?]+$/, "");
      out.push(<a key={k} href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^https?:\/\/(www\.)?/, "")}</a>);
      if (u.length < m[7].length) out.push(m[7].slice(u.length));
    }
    dernier = re.lastIndex;
  }
  if (dernier < s.length) out.push(s.slice(dernier));
  return out;
}

type Bloc =
  | { t: "p"; l: string[] }
  | { t: "h"; n: number; s: string }
  | { t: "ul" | "ol"; items: { s: string; niv: number; coche?: boolean | null }[] }
  | { t: "q"; l: string[] }
  | { t: "code"; s: string }
  | { t: "hr" }
  | { t: "table"; rangs: string[][] };

function blocs(md: string): Bloc[] {
  const out: Bloc[] = [];
  const lignes = md.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const brut = l.trim();
    if (!brut) continue;
    if (brut.startsWith("```")) {
      const corps: string[] = [];
      for (i++; i < lignes.length && !lignes[i].trim().startsWith("```"); i++) corps.push(lignes[i]);
      out.push({ t: "code", s: corps.join("\n") });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(brut);
    if (h) { out.push({ t: "h", n: h[1].length, s: h[2] }); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(brut)) { out.push({ t: "hr" }); continue; }
    if (brut.startsWith(">")) {
      const q: string[] = [];
      for (; i < lignes.length && lignes[i].trim().startsWith(">"); i++) q.push(lignes[i].trim().replace(/^>\s?/, ""));
      i--;
      out.push({ t: "q", l: q });
      continue;
    }
    if (brut.startsWith("|")) {
      const rangs: string[][] = [];
      for (; i < lignes.length && lignes[i].trim().startsWith("|"); i++) {
        const cells = lignes[i].trim().replace(/^\||(?<!\\)\|$/g, "").split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, "|").trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        rangs.push(cells);
      }
      i--;
      out.push({ t: "table", rangs });
      continue;
    }
    const li = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(l);
    if (li) {
      const type = /\d/.test(li[2]) ? "ol" : "ul";
      const items: { s: string; niv: number; coche?: boolean | null }[] = [];
      for (; i < lignes.length; i++) {
        const m = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(lignes[i]);
        if (!m || (items.length && !m[1] && (/\d/.test(m[2]) ? "ol" : "ul") !== type)) break;
        const c = /^\[( |x|X)\]\s+(.*)$/.exec(m[3]);
        items.push({ s: c ? c[2] : m[3], niv: Math.min(3, Math.floor(m[1].replace(/\t/g, "  ").length / 2)), coche: c ? c[1] !== " " : null });
      }
      i--;
      out.push({ t: type, items });
      continue;
    }
    const p: string[] = [];
    for (; i < lignes.length; i++) {
      const x = lignes[i].trim();
      if (!x || /^(#{1,4}\s|```|>|\||(-{3,}|\*{3,})$)/.test(x) || /^([-*•]|\d+[.)])\s+/.test(x)) break;
      p.push(x);
    }
    if (!p.length) { p.push(brut); i++; }
    i--;
    out.push({ t: "p", l: p });
  }
  return out;
}

export function Md({ texte, className = "", liensDesk = false }: { texte: string; className?: string; liensDesk?: boolean }) {
  if (!texte?.trim()) return null;
  const inline = (text: string, key: string) => enLigne(text, key, liensDesk);
  return (
    <div className={`rd-md ${className}`}>
      {blocs(texte).map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case "h": return b.n <= 2 ? <h3 key={k}>{inline(b.s, k)}</h3> : <h4 key={k}>{inline(b.s, k)}</h4>;
          case "hr": return <hr key={k} />;
          case "code": return <pre key={k}><code>{b.s}</code></pre>;
          case "q": return <blockquote key={k}>{b.l.map((x, j) => <p key={j}>{inline(x, `${k}-${j}`)}</p>)}</blockquote>;
          case "table": {
            const [entetes, ...rangs] = b.rangs;
            if (!entetes) return null;
            return (
              <div key={k} className="rd-md__tbl" tabIndex={liensDesk ? 0 : undefined} role={liensDesk ? "region" : undefined} aria-label={liensDesk ? "Tableau de la réponse" : undefined}>
                <table>
                  <thead><tr>{entetes.map((cell, n) => <th key={n} scope="col">{inline(cell, `${k}-h-${n}`)}</th>)}</tr></thead>
                  <tbody>{rangs.map((rang, j) => <tr key={j}>{rang.map((cell, n) => <td key={n}>{inline(cell, `${k}-${j}-${n}`)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          }
          case "ul": case "ol": {
            const Liste = b.t;
            return (
              <Liste key={k}>
                {b.items.map((it, j) => (
                  <li key={j} className={it.niv ? `n${it.niv}` : undefined}>
                    {it.coche != null && <span className={`rd-md__box ${it.coche ? "on" : ""}`} aria-label={it.coche ? "fait" : "à faire"} />}
                    {inline(it.s, `${k}-${j}`)}
                  </li>
                ))}
              </Liste>
            );
          }
          default: return <p key={k}>{b.l.map((x, j) => <Fragment key={j}>{j > 0 && <br />}{inline(x, `${k}-${j}`)}</Fragment>)}</p>;
        }
      })}
    </div>
  );
}
