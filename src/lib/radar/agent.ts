import "server-only";
import type OpenAI from "openai";
import { BASES, ORDRE, type BaseKey } from "./bases";
import { chargerDetail } from "./donnees";
import { actives, dateDe, ficheEnTexte, ligneMeta, texteBrut, valeurTexte } from "./format";
import { champOuSpecial, normaliserChangements, sansTirets } from "./notion-map";
import type { Fiche, Proposition, Valeur } from "./types";

/**
 * Agent DA du module Radar : OpenAI côté serveur, avec des outils de lecture du radar
 * et des outils de proposition. Une proposition n'écrit rien : elle est montrée à la personne,
 * qui l'accepte ou la refuse (action serveur appliquerProposition, qui revalide tout).
 */

export type Evenement =
  | { t: "texte"; d: string }
  | { t: "outil"; l: string }
  | { t: "proposition"; p: Proposition }
  | { t: "erreur"; m: string }
  | { t: "fin" };

export type Tour = { role: "user" | "assistant"; content: string };

const REGLES = `Tu es l'agent DA, intégré au module Radar du Travel Lead Desk de Direction l'Algérie (DA). Tu travailles pour Mehdi (INSEN Studio, côté Algérie) et Houari Ayadi (porteur de DA, côté France) ; la personne qui t'écrit est un opérateur connecté au desk.

Ce que tu sais : (1) le contexte du projet ci-dessous (dépôts GitHub, modèle Supabase, Vercel, doctrine), instantané daté qui ne lit pas le code en direct : si un détail n'y est pas, dis-le et indique où regarder ; (2) l'état du radar, plus bas ; (3) un résumé chiffré du desk (projets par étape, agences) ; (4) avec tes outils, tu cherches et lis les fiches du radar, et tu proposes des modifications, des créations et des commentaires. Chaque proposition est montrée à la personne, qui l'accepte ou la refuse : ne la présente jamais comme faite. Une proposition acceptée est écrite tout de suite dans Notion.

Règles :
1. Réponds en français, phrases courtes, exemples plutôt qu'adjectifs. Pas de jargon creux, pas de superlatifs.
2. N'invente rien : nom, contact, chiffre, date, licence, audience. Si l'information n'est ni dans le contexte ni dans le radar, dis que tu ne sais pas. Distingue fait vérifié, incertitude et hypothèse.
3. Deux territoires jamais mélangés : le média (media.directionlalgerie.com, voix de Houari, journalistique, sans pitch) et la plateforme voyage (voix studio, claire, orientée décision). Quand tu écris pour l'un, respecte sa voix et la doctrine d'écriture : pas de tiret long en corps de texte, la virgule relie.
4. Aucun tarif, aucune commission chiffrée, aucune promesse de résultat chiffrée.
5. Le voyageur ne parle jamais directement à une agence : DA reste la seule interface.
6. Tu ne contactes personne et tu n'envoies rien. Tu rédiges messages, e-mails ou posts que la personne enverra elle-même.
7. Statut « Actionnable » seulement avec un interlocuteur nommé ou un geste qui ne dépend que de Mehdi ou Houari, une échéance réelle et une prochaine action exécutable telle quelle.
8. Sujets sensibles (Kabylie, M'zab, berbère, religion, mémoire de guerre, langues, diaspora) : rien de polémique ; pas d'alarmisme sur la sécurité.
9. Confidentialité : radar, desk et contexte sont internes. Tu n'as accès à aucun secret ni à aucune donnée personnelle de voyageur, et tu n'en demandes pas.
10. Pour un changement de code : décris le changement, les fichiers concernés et les risques, propose un patch indicatif si utile, et recommande de le faire dans une session de développement sur le dépôt. Tu ne déploies rien.
11. Mise en forme sobre : titres courts, listes quand on compare ou qu'on enchaîne des étapes. Cite les fiches par leur titre. Pour un texte à copier, donne-le sans commentaire autour.`;

const METHODE = `Cinq bases Notion : Signaux (flux quotidien), Acteurs (la carte de l'écosystème), Rendez-vous (salons, festivals, événements), Partenariats (dossiers ouverts, 8 en cours au plus), Idées de contenu (boîte à sujets média et plateforme).
Routines (Claude, heure d'Alger) : passe quotidienne 07h24 ; idées le lundi 07h38 (5 média + 5 plateforme au plus) ; cartographie le mercredi 09h35 (un segment par semaine) ; bilan le 1er du mois 09h40.
Filtre de traitement : trois actions au plus par digest ; un signal sans contact attend ; un signal sans échéance passe après un signal daté ; huit dossiers de partenariat en cours au plus ; une idée « Retenue » est transmise par la routine à Sujets d'articles (média) ou au Backlog produit (plateforme).
Note DA /10 : utilité pour DA, critère par critère ; un critère non vérifié vaut 0. Porteurs : Houari côté France, Mehdi côté Algérie.
Règles absolues : pas de source, pas de ligne ; rien d'inventé ; dédoublonner avant d'écrire ; contacts professionnels et publics seulement ; aucune action sortante ; aucun tarif ni commission.`;

function schema(): string {
  return ORDRE.map((k) => {
    const b = BASES[k];
    const fs = b.champs.filter((f) => f.type !== "created").map((f) => {
      const t = ({ select: "choix", multi: "choix multiple", number: "nombre", date: "date AAAA-MM-JJ", checkbox: "oui/non", url: "adresse", relation: "lien vers d'autres fiches, non modifiable par l'agent", text: f.long ? "texte long" : "texte" } as Record<string, string>)[f.type] ?? f.type;
      return `  - ${f.k} (${t}${f.opts && f.type !== "relation" ? ` : ${f.opts.join(" | ")}` : ""})`;
    }).join("\n");
    return `base « ${k} » (${b.label}) : titre « ${b.titre} » ; ${b.statut} : ${b.statuts.join(" | ")}\n${fs}`;
  }).join("\n");
}

function ligne(r: Fiche): string {
  const b = BASES[r.base];
  const bits = [r.statut || "sans statut", ligneMeta(b, r)];
  if (b.echeance && dateDe(r, b.echeance)) bits.push(`${b.echeance} ${dateDe(r, b.echeance)}`);
  if (b.note && r.props[b.note] != null && r.props[b.note] !== "") bits.push(`note ${r.props[b.note]}`);
  return `- [${r.id}] ${r.titre} · ${bits.filter(Boolean).join(" · ")}`;
}

function etatRadar(bases: Record<BaseKey, Fiche[]>, charge: string): string {
  const out: string[] = [];
  for (const k of ORDRE) {
    const b = BASES[k];
    const rows = bases[k] ?? [];
    const n: Record<string, number> = {};
    rows.forEach((r) => { n[r.statut || "sans statut"] = (n[r.statut || "sans statut"] ?? 0) + 1; });
    out.push(`## ${b.label} : ${rows.length} fiches (${Object.entries(n).map(([s, x]) => `${s} ${x}`).join(", ")})`);
    let liste = actives(b, rows);
    if (k === "acteurs") liste = liste.slice().sort((x, y) => (Number(y.props["Note DA /10"]) || 0) - (Number(x.props["Note DA /10"]) || 0));
    const max = k === "acteurs" ? 45 : 35;
    liste.slice(0, max).forEach((r) => out.push(ligne(r)));
    if (liste.length > max) out.push(`- … et ${liste.length - max} autres (utilise chercher_fiches)`);
  }
  out.push(`Données lues dans Notion le ${charge}.`);
  return out.join("\n");
}

export function messageSysteme(o: { contexte: string; bases: Record<BaseKey, Fiche[]>; charge: string; desk: string; vue: string; fiche: Fiche | null }): string {
  const now = new Date();
  const noms = nomsFiches(o.bases);
  return [
    "# Consignes", REGLES,
    "# Contexte du projet", o.contexte || "(Page de contexte non disponible : réponds à partir du radar et dis-le si une question porte sur le code.)",
    "# Méthode du radar", METHODE,
    "# Schéma des bases", schema(),
    `# État du radar le ${now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Algiers" })}`, etatRadar(o.bases, o.charge),
    "# Le desk (chiffres agrégés, sans données de voyageurs)", o.desk,
    "# Ce que la personne regarde", o.vue + (o.fiche ? `\nFiche ouverte : [${o.fiche.id}]\n${ficheEnTexte(o.fiche, noms).slice(0, 3500)}` : ""),
  ].join("\n\n");
}

export function nomsFiches(bases: Record<BaseKey, Fiche[]>): Record<string, string> {
  const n: Record<string, string> = {};
  for (const k of ORDRE) for (const r of bases[k] ?? []) n[r.id] = r.titre;
  return n;
}

function trouver(bases: Record<BaseKey, Fiche[]>, id: unknown): Fiche | null {
  const h = sansTirets(String(id ?? ""));
  for (const k of ORDRE) { const r = (bases[k] ?? []).find((x) => x.id === h); if (r) return r; }
  return null;
}

const montrer = (v: Valeur | undefined) => (Array.isArray(v) ? (v.length ? v.join(", ") : "vide") : v === true ? "oui" : v === false ? "non" : v == null || v === "" ? "vide" : texteBrut(v).slice(0, 160));

// ---------------------------------------------------------------- outils
export const OUTILS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "chercher_fiches", description: "Cherche dans les cinq bases du radar. Renvoie au plus 25 fiches : id, base, titre, statut et champs clés. À utiliser avant de citer, lire ou modifier une fiche.", parameters: { type: "object", properties: { base: { type: "string", enum: ["toutes", ...ORDRE] }, texte: { type: "string", description: "mots qui doivent tous apparaître ; vide pour tout lister" }, statut: { type: "string" }, limite: { type: "integer" } } } } },
  { type: "function", function: { name: "lire_fiche", description: "Lit une fiche complète par son id (32 caractères hexadécimaux) : propriétés, contenu de sa page Notion, commentaires.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } } },
  { type: "function", function: { name: "proposer_modification", description: "Propose de modifier des propriétés d'une fiche. La personne voit la proposition et l'accepte ou la refuse. Noms de propriétés exacts du schéma, dates AAAA-MM-JJ, choix parmi les options, chaîne vide pour effacer.", parameters: { type: "object", properties: { id: { type: "string" }, changements: { type: "object", additionalProperties: true }, raison: { type: "string" } }, required: ["id", "changements"] } } },
  { type: "function", function: { name: "proposer_creation", description: "Propose de créer une fiche. La personne valide avant la création. Jamais de fiche Signaux ou Acteurs sans source vérifiable.", parameters: { type: "object", properties: { base: { type: "string", enum: ORDRE }, titre: { type: "string" }, proprietes: { type: "object", additionalProperties: true }, raison: { type: "string" } }, required: ["base", "titre"] } } },
  { type: "function", function: { name: "proposer_commentaire", description: "Propose de publier un commentaire sur la page Notion d'une fiche. La personne valide avant publication.", parameters: { type: "object", properties: { id: { type: "string" }, texte: { type: "string" } }, required: ["id", "texte"] } } },
];

type Execution = { resultat: string; evenements: Evenement[] };
let seq = 0;
const idProp = () => `p${Date.now().toString(36)}${(++seq).toString(36)}`;

export async function executerOutil(nom: string, args: Record<string, unknown>, bases: Record<BaseKey, Fiche[]>): Promise<Execution> {
  const noms = nomsFiches(bases);
  switch (nom) {
    case "chercher_fiches": {
      const cles: BaseKey[] = typeof args.base === "string" && (ORDRE as string[]).includes(args.base) ? [args.base as BaseKey] : ORDRE;
      const q = String(args.texte ?? "").toLowerCase().trim();
      const st = String(args.statut ?? "").trim();
      const lim = Math.max(1, Math.min(25, Number(args.limite) || 12));
      const res: Record<string, unknown>[] = [];
      for (const k of cles) {
        const b = BASES[k];
        for (const r of bases[k] ?? []) {
          if (st && r.statut !== st) continue;
          if (q) {
            const hay = (r.titre + " " + Object.values(r.props).map((v) => (Array.isArray(v) ? v.join(" ") : String(v ?? ""))).join(" ")).toLowerCase();
            if (q.split(/\s+/).some((w) => !hay.includes(w))) continue;
          }
          const o: Record<string, unknown> = { id: r.id, base: k, titre: r.titre, statut: r.statut, resume: ligneMeta(b, r) };
          if (b.echeance && dateDe(r, b.echeance)) o[b.echeance] = dateDe(r, b.echeance);
          if (b.note && r.props[b.note] != null && r.props[b.note] !== "") o[b.note] = r.props[b.note];
          if (r.props[b.suite]) o[b.suite] = texteBrut(r.props[b.suite]).slice(0, 220);
          res.push(o);
        }
      }
      return { resultat: JSON.stringify({ total: res.length, fiches: res.slice(0, lim) }), evenements: [{ t: "outil", l: `Recherche dans le radar${q ? ` : « ${q.slice(0, 40)} »` : ""}` }] };
    }
    case "lire_fiche": {
      const r = trouver(bases, args.id);
      if (!r) return { resultat: "Erreur : fiche introuvable, utilise chercher_fiches pour obtenir son id.", evenements: [] };
      const b = BASES[r.base];
      const props: Record<string, unknown> = { [b.statut]: r.statut };
      for (const f of b.champs) {
        const v = r.props[f.k];
        if (v == null || v === "" || v === false || (Array.isArray(v) && !v.length)) continue;
        props[f.k] = f.type === "relation" ? (v as string[]).map((id) => `${noms[id] ?? "fiche"} [${id}]`) : valeurTexte(f, v, noms);
      }
      let detail = { contenu: "", commentaires: [] as { qui: string; texte: string }[] };
      try { detail = await chargerDetail(r.id); } catch { /* contenu indisponible : propriétés seules */ }
      return {
        resultat: JSON.stringify({ id: r.id, base: r.base, titre: r.titre, lien_notion: `https://app.notion.com/p/${r.id}`, proprietes: props, contenu: detail.contenu.slice(0, 6000), commentaires: detail.commentaires.slice(-10).map((c) => (c.qui ? `${c.qui} : ` : "") + c.texte) }),
        evenements: [{ t: "outil", l: `Lecture de « ${r.titre} »` }],
      };
    }
    case "proposer_modification": {
      const r = trouver(bases, args.id);
      if (!r) return { resultat: "Erreur : fiche introuvable.", evenements: [] };
      const b = BASES[r.base];
      const { changes, erreurs } = normaliserChangements(r.base, args.changements);
      if (erreurs.length) return { resultat: "Erreur : " + erreurs.join(" "), evenements: [] };
      if (!Object.keys(changes).length) return { resultat: "Erreur : aucun changement valide.", evenements: [] };
      const lignes = Object.entries(changes).map(([k, v]) => ({ champ: champOuSpecial(b, k)?.label ?? k, avant: montrer(r.props[k]), apres: montrer(v) }));
      const p: Proposition = { id: idProp(), kind: "update", base: r.base, ficheId: r.id, titre: r.titre, changes, lignes, raison: args.raison ? String(args.raison) : undefined };
      return { resultat: "Proposition affichée à la personne, en attente de sa validation. Ne la présente pas comme faite.", evenements: [{ t: "proposition", p }] };
    }
    case "proposer_creation": {
      const k = String(args.base ?? "");
      if (!(ORDRE as string[]).includes(k)) return { resultat: "Erreur : base inconnue.", evenements: [] };
      const base = k as BaseKey;
      const b = BASES[base];
      const brut: Record<string, unknown> = { ...((args.proprietes as Record<string, unknown>) ?? {}), [b.titre]: args.titre };
      const { changes, erreurs } = normaliserChangements(base, brut);
      if (erreurs.length) return { resultat: "Erreur : " + erreurs.join(" "), evenements: [] };
      if (!changes[b.statut]) changes[b.statut] = b.statuts[0];
      const lignes = Object.entries(changes).filter(([kk]) => kk !== b.titre).map(([kk, v]) => ({ champ: champOuSpecial(b, kk)?.label ?? kk, avant: "", apres: montrer(v) }));
      const p: Proposition = { id: idProp(), kind: "create", base, titre: String(changes[b.titre]), changes, lignes, raison: args.raison ? String(args.raison) : undefined };
      return { resultat: "Proposition de création affichée à la personne, en attente de sa validation.", evenements: [{ t: "proposition", p }] };
    }
    case "proposer_commentaire": {
      const r = trouver(bases, args.id);
      const texte = String(args.texte ?? "").trim();
      if (!r || !texte) return { resultat: "Erreur : fiche introuvable ou commentaire vide.", evenements: [] };
      const p: Proposition = { id: idProp(), kind: "comment", base: r.base, ficheId: r.id, titre: r.titre, texte: texte.slice(0, 4000) };
      return { resultat: "Proposition de commentaire affichée à la personne, en attente de sa validation.", evenements: [{ t: "proposition", p }] };
    }
  }
  return { resultat: "Erreur : outil inconnu.", evenements: [] };
}

/** Boucle de l'agent : réponses en flux, outils exécutés côté serveur, 5 tours au plus. */
export async function* boucleAgent(o: {
  client: OpenAI;
  modele: string;
  systeme: string;
  tours: Tour[];
  bases: Record<BaseKey, Fiche[]>;
  signal?: AbortSignal;
}): AsyncGenerator<Evenement> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: "system", content: o.systeme }, ...o.tours.map((t) => ({ role: t.role, content: t.content }))];
  for (let tour = 0; tour < 5; tour++) {
    const dernier = tour === 4;
    const flux = await o.client.chat.completions.create(
      { model: o.modele, messages, tools: OUTILS, tool_choice: dernier ? "none" : "auto", temperature: 0.3, stream: true },
      { signal: o.signal },
    );
    let texte = "";
    const appels: { id: string; nom: string; args: string }[] = [];
    for await (const morceau of flux) {
      const d = morceau.choices[0]?.delta;
      if (!d) continue;
      if (d.content) { texte += d.content; yield { t: "texte", d: d.content }; }
      for (const tc of d.tool_calls ?? []) {
        const a = (appels[tc.index] ??= { id: "", nom: "", args: "" });
        if (tc.id) a.id = tc.id;
        if (tc.function?.name) a.nom += tc.function.name;
        if (tc.function?.arguments) a.args += tc.function.arguments;
      }
    }
    const valides = appels.filter((a) => a && a.nom);
    if (!valides.length) break;
    if (texte) yield { t: "texte", d: "\n\n" };
    messages.push({ role: "assistant", content: texte || null, tool_calls: valides.map((a) => ({ id: a.id, type: "function", function: { name: a.nom, arguments: a.args || "{}" } })) });
    for (const a of valides) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(a.args || "{}"); } catch { /* arguments illisibles : l'outil répond par une erreur */ }
      const ex = await executerOutil(a.nom, args, o.bases);
      for (const ev of ex.evenements) yield ev;
      messages.push({ role: "tool", tool_call_id: a.id, content: ex.resultat.slice(0, 24_000) });
    }
  }
  yield { t: "fin" };
}

