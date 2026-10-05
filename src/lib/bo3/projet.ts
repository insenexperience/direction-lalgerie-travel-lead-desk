// Règles du back office v3 : horloges 48 h, prochaine action, files, routage, brief.
// Fonctions pures, utilisables côté serveur comme côté client. `now` est toujours passé.
import { LIEUX, ZONES, type Zone } from "./geo";
import type { Agence, BriefSection, Consultation, Manque, Projet, Trame } from "./types";
import { STATUT_LABEL } from "./types";

export const H = 36e5;
const TZ = "Africa/Algiers";

export const hrs = (a: string, b: string | number) => (new Date(b).getTime() - new Date(a).getTime()) / H;
export const r1 = (x: number) => Math.round(x);

const parts = (iso: string | number) => {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const o = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return o as Record<string, string>;
};
export const fmtD = (iso: string | number) => { const o = parts(iso); return `${o.day}/${o.month} ${o.hour}:${o.minute}`; };
export const fmtDay = (iso: string | number) => { const o = parts(iso); return `${o.day}/${o.month}`; };

// ---------------------------------------------------------------- horloges 48 h
export type Clock = { state: "" | "amber" | "red" | "green" | "off"; label: string; pct: number; sub: string; rem?: number };

/** Neutre par défaut ; ambre sous 12 h ; rouge sous 3 h ou dépassée ; vert quand tenue. */
export function clockState(start: string, done: string | null, now: number): Clock {
  if (done) {
    const h = hrs(start, done);
    return { state: h <= 48 ? "green" : "red", label: h <= 48 ? `Tenue · ${r1(h)} h` : `Dépassée · ${r1(h)} h`, pct: Math.min(100, (h / 48) * 100), sub: `réponse ${fmtD(done)}` };
  }
  const rem = 48 - hrs(start, now);
  const dl = fmtD(new Date(start).getTime() + 48 * H);
  if (rem < 0) return { state: "red", label: `Dépassée de ${r1(-rem)} h`, pct: 100, sub: `échéance ${dl}`, rem };
  return { state: rem < 3 ? "red" : rem < 12 ? "amber" : "", label: `Reste ${r1(rem)} h`, pct: ((48 - rem) / 48) * 100, sub: `échéance ${dl}`, rem };
}
export const travelerClock = (p: Projet, now: number) => clockState(p.recu, p.premiereReponse, now);
export function agencyClock(c: Consultation, now: number): Clock {
  if (!c.envoye) return { state: "off", label: "Brouillon", pct: 0, sub: "Délai démarré à l’envoi du brief" };
  if (c.refus) return { state: "off", label: "Refus", pct: 100, sub: fmtD(c.refus) };
  if (c.proposition) {
    const h = hrs(c.envoye, c.proposition.recu);
    return { state: h <= 48 ? "green" : "red", label: `Reçue à ${r1(h)} h`, pct: Math.min(100, (h / 48) * 100), sub: fmtD(c.proposition.recu) };
  }
  return clockState(c.envoye, null, now);
}

// ---------------------------------------------------------------- complétude
export function manqueDe(trame: Trame | null): Manque[] {
  if (!trame) return ["dates", "groupe", "budget", "lieux"];
  const m: Manque[] = [];
  if (!trame.cadre.mois.trim()) m.push("dates");
  if (!trame.groupe.type.trim() && !trame.groupe.nombre) m.push("groupe");
  if (trame.budget === null || !trame.budget.trim()) m.push("budget");
  if (!trame.jours.some((j) => j.lieux.length)) m.push("lieux");
  return m;
}
export const complet = (p: Projet) => !!p.trame && p.manque.length === 0;

// ---------------------------------------------------------------- routage par zone
export function zonesJours(trame: Trame | null): Partial<Record<Zone, number>> {
  const z: Partial<Record<Zone, number>> = {};
  if (!trame) return z;
  for (const j of trame.jours) {
    const zone = LIEUX[j.lieux[0]]?.zone;
    if (zone) z[zone] = (z[zone] ?? 0) + 1;
  }
  return z;
}
export type Suggestion = { a: Agence; jours: number; total: number };
/** Agences triées par nombre de jours de la trame dans leur zone ; à égalité, le choix du voyageur passe devant. */
export function suggestions(p: Projet, agences: Agence[]): Suggestion[] {
  const zj = zonesJours(p.trame);
  const total = p.trame ? p.trame.jours.length : 0;
  return agences
    .map((a) => ({ a, jours: a.zones.reduce((s, z) => s + (zj[z] ?? 0), 0), total }))
    .sort((x, y) => y.jours - x.jours || (y.a.id === p.agenceChoisie ? 1 : 0) - (x.a.id === p.agenceChoisie ? 1 : 0));
}
export function portionFor(p: Projet, a: Agence): string | null {
  if (!p.trame) return null;
  const js = p.trame.jours.filter((j) => a.zones.includes(LIEUX[j.lieux[0]]?.zone as Zone)).map((j) => j.n);
  if (!js.length) return null;
  return js.length === p.trame.jours.length ? "tout" : `J${js[0]}–J${js[js.length - 1]}`;
}
export const agenceById = (agences: Agence[], id: string | null | undefined) => agences.find((a) => a.id === id);
export const nomAgence = (agences: Agence[], id: string | null | undefined) => agenceById(agences, id)?.n ?? "Agence";

// ---------------------------------------------------------------- tri et files
/** Dépassés d'abord, puis temps restant croissant ; agences sans accusé > 24 h remontées ; dossiers répondus ensuite. */
export function urgency(p: Projet, now: number): number {
  if (p.statut === "clos") return 9e9;
  const t = travelerClock(p, now);
  // Première réponse faite, à l'heure ou en retard : plus d'urgence côté voyageur.
  let u = p.premiereReponse ? 5000 : t.rem ?? -1;
  const ag = p.consultations.filter((c) => c.envoye && !c.proposition && !c.refus).map((c) => 48 - hrs(c.envoye, now));
  if (ag.length) u = Math.min(u, Math.min(...ag) + 0.5);
  if (p.consultations.some((c) => !c.accuse && !c.proposition && !c.refus && hrs(c.envoye, now) > 24)) u = Math.min(u, 6);
  return u;
}

export type Filtre = { id: string; l: string; f: (p: Projet, now: number) => boolean };
export const FILTERS: Filtre[] = [
  { id: "tous", l: "Tous", f: (p) => p.statut !== "clos" },
  { id: "today", l: "À traiter aujourd'hui", f: (p, now) => p.statut !== "clos" && ((!p.premiereReponse && (travelerClock(p, now).rem ?? -1) < 24) || p.consultations.some((c) => !c.proposition && !c.refus && 48 - hrs(c.envoye, now) < 24)) },
  { id: "compl", l: "À compléter", f: (p) => p.statut === "a_completer" },
  { id: "agences", l: "Agences en retard", f: (p, now) => p.statut !== "clos" && p.consultations.some((c) => !c.proposition && !c.refus && ((!c.accuse && hrs(c.envoye, now) > 24) || hrs(c.envoye, now) > 48)) },
  { id: "sans", l: "Sans réponse voyageur", f: (p) => p.statut === "proposee" && p.relancesVoyageur.length > 0 },
  { id: "wa", l: "WhatsApp", f: (p) => p.source === "whatsapp" && p.statut !== "clos" },
];

// ---------------------------------------------------------------- prochaine action
export type Action =
  | "first" | "ask" | "complete" | "qualif" | "brief" | "scroll-brief" | "scroll-prop" | "scroll-devis"
  | "remind" | "proposal" | "remind-traveler" | "close" | null;
export type NextAction = { t: string; s: string; act: Action; a?: boolean; agence?: string };

export function nextAction(p: Projet, agences: Agence[], now: number): NextAction {
  const pend = p.consultations.filter((c) => c.envoye && !c.proposition && !c.refus);
  const noAck = pend.find((c) => !c.accuse && hrs(c.envoye, now) > 24);
  const n = (id: string) => nomAgence(agences, id);
  switch (p.statut) {
    case "recu":
      return p.premiereReponse
        ? { t: "Générer le brief", s: "Le projet est complet. Le brief part de la trame.", act: "brief" }
        : { t: "Écrire la première réponse", s: "Un message d'une personne : chez qui part le projet, et quand. L'horloge 48 h s'arrête à l'envoi.", act: "first", a: true };
    case "a_completer":
      if (!p.trame)
        return p.premiereReponse
          ? { t: "Qualifier avec le voyageur", s: "Pas de trame : la qualification guidée la construit.", act: "qualif" }
          : { t: p.source === "whatsapp" ? "Répondre sur WhatsApp" : "Écrire la première réponse", s: "Première réponse et première question. L'horloge s'arrête.", act: "first", a: true };
      return p.premiereReponse
        ? { t: "Saisir les réponses du voyageur", s: `Il manque : ${p.manque.join(", ")}.`, act: "complete" }
        : { t: `Demander : ${p.manque.join(", ")}`, s: "Lien voyageur raccourci aux champs manquants. Ce message vaut première réponse.", act: "ask", a: true };
    case "brief_pret":
      return { t: "Relire et envoyer le brief", s: "Relecture obligatoire. L'horloge agence démarre à l'envoi.", act: "scroll-brief", a: true };
    case "envoye": {
      if (noAck) return { t: `Relancer ${n(noAck.agence)}`, s: `Sans accusé de réception depuis ${r1(hrs(noAck.envoye, now))} h.`, act: "remind", agence: noAck.agence, a: true };
      const got = p.consultations.filter((c) => c.proposition);
      if (got.length && !p.devis)
        return { t: `Convertir le devis de ${n(got[0].agence)}`, s: pend.length ? `Reçu. ${pend.map((c) => n(c.agence)).join(" et ")} n'a pas encore répondu : vous pouvez convertir sans attendre.` : "Reçu.", act: "scroll-prop", a: true };
      return { t: "Saisir la proposition reçue", s: pend.length ? `Réponse attendue de ${pend.map((c) => n(c.agence)).join(" et ")}.` : "Toutes les agences ont répondu.", act: "proposal" };
    }
    case "proposition": {
      const ret = p.consultations.find((c) => c.retenue);
      if (p.devis) return { t: "Envoyer la proposition au voyageur", s: `Proposition Direction l'Algérie${p.devis.source ? `, construite avec ${n(p.devis.source)}` : ""}.`, act: "scroll-devis", a: true };
      return ret
        ? { t: `Convertir le devis de ${n(ret.agence)}`, s: "Le devis agence devient une proposition Direction l'Algérie, avec ou sans mention du partenariat.", act: "scroll-prop", a: true }
        : { t: "Comparer et convertir une proposition", s: `${p.consultations.filter((c) => c.proposition).length} proposition(s) reçue(s). Retenez, puis convertissez en proposition DA.`, act: "scroll-prop", a: true };
    }
    case "proposee":
      return p.relancesVoyageur.length >= 2
        ? { t: "Clore ou marquer gagné", s: "Deux relances sans réponse.", act: "close" }
        : { t: `Relancer le voyageur (${p.relancesVoyageur.length + 1}/2)`, s: p.devis?.envoye ? `Proposition envoyée le ${fmtD(p.devis.envoye)}.` : "Proposition envoyée.", act: "remind-traveler" };
    default:
      return { t: p.issue === "gagne" ? "Dossier gagné" : "Dossier clos", s: p.motif ? `Motif : ${p.motif}` : "Fiche contact créée.", act: null };
  }
}

export const defaultTab = (p: Projet) =>
  ["proposition", "proposee", "clos"].includes(p.statut) ? "props" : ["brief_pret", "envoye"].includes(p.statut) ? "agences" : "trame";

export const statutLabel = (p: Projet) => (p.statut === "clos" ? (p.issue === "gagne" ? "Gagné" : "Perdu") : STATUT_LABEL[p.statut]);

// ---------------------------------------------------------------- textes
export const prenom = (p: Projet) => p.nom.split(/[ &]/)[0] ?? p.nom;

export function firstResponseText(p: Projet, agences: Agence[], now: number, signature: string): string {
  const s = suggestions(p, agences)[0];
  const d = now + 72 * H;
  const corps = complet(p)
    ? `Il est complet : il part aujourd'hui chez ${s && s.jours ? s.a.n : "notre agence partenaire"}, qui connaît ${s && s.jours ? ZONES[s.a.zones[0]].toLowerCase() : "la région"} mieux que personne. Vous aurez une première proposition d'ici le ${fmtDay(d)}.`
    : `Pour le transmettre à la bonne agence, il me manque : ${p.manque.join(", ")}. Vous pouvez me répondre ici.`;
  return `Bonjour ${prenom(p)},\n\nJ'ai bien votre projet${p.trame ? ` « ${p.trame.titre} »` : ""} sous les yeux. ${corps}\n\nJe reste votre seul interlocuteur, sur ce fil.\n\n${signature} — Direction l'Algérie`;
}

// ---------------------------------------------------------------- brief agence (docs §4)
const nomLieu = (id: string) => LIEUX[id]?.nom ?? id;
export const ATTENDU =
  "Une proposition, itinéraire et prix indicatif, sous 48 h. Si le circuit n'est pas adapté, dites-le sans attendre. Merci de ne pas contacter le voyageur : Direction l'Algérie est son seul interlocuteur.";

export function buildBrief(p: Projet): BriefSection[] {
  const t = p.trame;
  if (!t) return [];
  const g = t.groupe;
  const nb = g.nombre ?? 0;
  const pers = nb ? `${nb} ${nb > 1 ? "voyageurs" : "voyageur"}` : g.type || "groupe à préciser";
  return [
    { id: "voyage", title: "Le voyage en une ligne", text: `« ${t.titre} » · ${t.jours.length} jours · ${t.cadre.mois || "mois à préciser"} · ${pers}${g.enfants ? ` dont ${g.enfants} enfants` : ""}` },
    { id: "itin", title: "Itinéraire jour par jour, composé par le voyageur", text: t.jours.map((j) => `J${j.n} ${j.lieux.map(nomLieu).join(" · ")}${j.e ? ` : ${j.e}` : ""}`).join("\n") || "—" },
    { id: "cadre", title: "Cadre", text: [t.cadre.rythme && `Rythme ${t.cadre.rythme}`, t.cadre.hebergement, [t.cadre.mois, t.cadre.souplesse].filter(Boolean).join(", "), t.cadre.duree && `Durée souhaitée : ${t.cadre.duree}`].filter(Boolean).join(" · ") + "." },
    { id: "groupe", title: "Groupe", text: `${[g.type, nb ? `${nb} personne${nb > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")}${g.enfants ? `, dont ${g.enfants} enfants` : ""}.` },
    { id: "budget", title: "Budget", text: t.budget ? `${t.budget}.` : "À définir avec vous : merci de proposer une fourchette." },
    { id: "envies", title: "Envies et incontournables", text: (Object.entries(t.envies) as [keyof Trame["envies"], string[]][]).filter(([, v]) => v.length).map(([k, v]) => `${{ grandes: "Grandes envies", experiences: "Expériences", activites: "Activités", pepites: "Pépites" }[k]} : ${v.join(", ")}`).join("\n") || "—" },
    { id: "precisions", title: "Précisions du voyageur", text: t.precisions ? `« ${t.precisions} »` : "—" },
    { id: "ajuster", title: "Points à ajuster", text: t.ajuster.length ? t.ajuster.map((a) => `• ${a}`).join("\n") : "—" },
    { id: "attendu", title: "Ce que nous attendons", text: ATTENDU },
  ];
}

/** Le brief est stocké en Markdown (`leads.generated_brief`) : une section par titre de niveau 2. */
export const briefToMarkdown = (sections: BriefSection[]) => sections.map((s) => `## ${s.title}\n${s.text}`).join("\n\n");
export function briefFromMarkdown(md: string): BriefSection[] {
  const ids = Object.fromEntries(buildBriefTitles().map(([id, title]) => [title, id]));
  return md
    .split(/^## /m)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b, i) => {
      const [title, ...rest] = b.split("\n");
      return { id: ids[title.trim()] ?? `s${i}`, title: title.trim(), text: rest.join("\n").trim() };
    });
}
function buildBriefTitles(): [string, string][] {
  return [
    ["voyage", "Le voyage en une ligne"], ["itin", "Itinéraire jour par jour, composé par le voyageur"], ["cadre", "Cadre"], ["groupe", "Groupe"],
    ["budget", "Budget"], ["envies", "Envies et incontournables"], ["precisions", "Précisions du voyageur"], ["ajuster", "Points à ajuster"], ["attendu", "Ce que nous attendons"],
  ];
}

/** Le brief ne doit rien contenir qui identifie le voyageur : prénom, nom, e-mail, téléphone. */
export function fuitesBrief(sections: BriefSection[], p: { nom: string; email: string | null; tel: string | null }): string[] {
  const texte = sections.filter((s) => s.id !== "attendu").map((s) => s.text).join("\n");
  const fuites: string[] = [];
  const echap = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Le prénom et le nom complet, pas chaque mot du nom : « Lina Oran » ne doit pas bloquer un brief qui passe par Oran.
  const prenomVoyageur = p.nom.trim().split(/[\s&,]+/)[0] ?? "";
  for (const mot of [prenomVoyageur, p.nom.trim()].filter((m, i) => m.length >= 3 && (i === 0 || m.includes(" ")))) {
    if (new RegExp(`(^|[^\\p{L}])${echap(mot)}([^\\p{L}]|$)`, "iu").test(texte)) fuites.push(mot);
  }
  if (p.email && texte.toLowerCase().includes(p.email.toLowerCase())) fuites.push(p.email);
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(texte)) fuites.push("une adresse e-mail");
  const chiffres = (p.tel ?? "").replace(/\D/g, "");
  if (chiffres.length >= 8 && texte.replace(/\D/g, "").includes(chiffres.slice(-8))) fuites.push("le téléphone");
  return [...new Set(fuites)];
}
