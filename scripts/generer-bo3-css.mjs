// Génère src/styles/bo3.css depuis la feuille du prototype (handoff « back office v3 »).
// Tout est cloisonné sous `.bo3` : les écrans hors refonte gardent leur style, et les noms
// de variables (--ink, --bg…) ou d'animations (pulse…) ne débordent pas sur le reste de l'app.
// Usage : node scripts/generer-bo3-css.mjs "<chemin>/prototype/proto.css"
import fs from "node:fs";
import postcss from "postcss";

const source = process.argv[2];
if (!source) throw new Error("Chemin de proto.css attendu.");
const racine = postcss.parse(fs.readFileSync(source, "utf8"));
const ANIM = new Set();

racine.walkAtRules("keyframes", (at) => {
  ANIM.add(at.params);
  at.params = `bo3-${at.params}`;
});

// Les remises à zéro d'éléments (button, a, input…) ne touchent que les zones de la refonte :
// sinon elles l'emporteraient sur les classes Tailwind des écrans conservés (.legacy).
const ZONES_V3 = ":where(.sb,.top,.page,.ovl,.cmd,.toast)";
const ELEMENTS = /^(button|input|textarea|select|a|kbd|:focus-visible|::-webkit-scrollbar)/;

function scope(sel) {
  sel = sel.trim();
  if (ELEMENTS.test(sel)) return `.bo3 ${ZONES_V3} ${sel}`;
  if (sel === ":root" || sel === "html" || sel === "body") return ".bo3";
  if (sel === "html,body" || sel === "*") return sel === "*" ? ".bo3,.bo3 *" : ".bo3";
  if (sel.startsWith("[data-theme=dark]")) return `.bo3[data-theme=dark]${sel.slice("[data-theme=dark]".length)}`;
  if (sel.startsWith("*")) return `.bo3 ${sel}`;
  return `.bo3 ${sel}`;
}

racine.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && rule.parent.name === "keyframes") return;
  rule.selectors = [...new Set(rule.selectors.map(scope))];
});

racine.walkDecls(/^animation(-name)?$/, (d) => {
  d.value = d.value.replace(/\b([a-z]+)\b/g, (m) => (ANIM.has(m) ? `bo3-${m}` : m));
});

const entete = `/* GÉNÉRÉ par scripts/generer-bo3-css.mjs depuis le prototype du back office v3. Ne pas éditer à la main. */\n`;
const polices = `.bo3{--serif:var(--font-cormorant),'Cormorant Garamond',Georgia,serif;--sans:var(--font-poppins),Poppins,system-ui,sans-serif;min-height:100vh}\n`
  // Écrans hors refonte (contacts, devis, équipe, réglages, profil, fiche agence) : leurs couleurs et leur police d'avant.
  + `.bo3 .legacy{--ink:#0e1a21;--ink-2:#3a4a55;--ink-3:#6b7a85;--ink-4:#9aa7b0;--bg:#f6f7f8;--surface:#ffffff;--line:#e4e8eb;font-family:var(--font-inter),system-ui,sans-serif;font-size:14px;line-height:1.5;color:#0e1a21;background:#f6f7f8;padding:20px 32px 64px;min-width:0}\n`
  + `@media (max-width:760px){.bo3 .legacy{padding:16px}}\n`
  // Tableaux : utilisés par le prototype (.tbl) sans être définis dans sa feuille.
  + `.bo3 .tbl{width:100%;border-collapse:collapse;font-size:12.5px}.bo3 .tbl th{text-align:left;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2);padding:10px 14px;border-bottom:1px solid var(--line-2);white-space:nowrap}.bo3 .tbl td{padding:10px 14px;border-bottom:1px solid var(--line-2);vertical-align:top}.bo3 .tbl tr:last-child td{border-bottom:0}.bo3 .tbl tbody tr:hover td{background:var(--surface-2)}\n`
  + `.bo3 .agc{color:inherit;text-decoration:none;transition:border-color .15s,box-shadow .15s}.bo3 .agc:hover{border-color:var(--muted-2);box-shadow:var(--sh-2)}\n`
  + `.bo3 .field{display:flex;flex-direction:column;gap:4px;min-width:0}.bo3 .fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 12px}\n`;
fs.writeFileSync(new URL("../src/styles/bo3.css", import.meta.url), entete + racine.toString() + "\n" + polices);
console.log("bo3.css écrit :", racine.nodes.length, "blocs,", ANIM.size, "animations renommées");
