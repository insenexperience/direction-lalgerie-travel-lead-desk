// La trame : ce que le voyageur a composé sur le site (champ `trame` de POST /api/intake, contrat v1),
// ou ce que l'opérateur a construit pour un lead WhatsApp / saisi à la main.
import { LIEUX } from "./geo";
import type { Trame } from "./types";

type Brut = Record<string, unknown>;
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const obj = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const titreDe = (v: unknown) => (typeof v === "string" ? v.trim() : txt(obj(v).titre) || txt(obj(v).nom) || txt(obj(v).title) || txt(obj(v).id));
const liste = (v: unknown) => arr(v).map(titreDe).filter(Boolean);

/** Nombre de voyageurs lisible depuis un libellé du site (« 2 voyageurs », « En couple », « Solo »). */
export function nombreDepuis(libelle: string): number | null {
  const l = libelle.toLowerCase();
  if (/solo/.test(l)) return 1;
  if (/couple/.test(l)) return 2;
  const n = l.match(/\d+/);
  return n ? Number(n[0]) : null;
}

/** Trame v1 envoyée par le site → trame du back office. Retourne null si le contenu est inexploitable. */
export function trameDepuisSite(v: unknown): Trame | null {
  const t = obj(v);
  if (!Object.keys(t).length) return null;
  const cadre = obj(t.cadre);
  const groupe = obj(t.groupe);
  const budget = obj(t.budget);
  const envies = obj(t.envies);
  const circuit = t.circuit_depart;
  const jours = arr(t.jours)
    .map((j, i) => {
      const o = obj(j);
      const lieux = arr(o.lieux).map((l) => (typeof l === "string" ? l : txt(obj(l).id))).filter(Boolean);
      return { n: Number(o.num ?? o.n ?? i + 1) || i + 1, lieux, e: liste(o.envies).join(" · ") || txt(o.e) };
    })
    .filter((j) => j.lieux.length);
  const budgetTexte = txt(budget.par_personne_hors_vol) || (typeof t.budget === "string" ? t.budget : "");
  const typeGroupe = txt(groupe.type);
  const nombre = Number(groupe.nombre) || nombreDepuis(typeGroupe);
  return {
    titre: txt(t.nom) || titreDe(circuit) || "Mon voyage en Algérie",
    circuit: circuit ? titreDe(circuit) || null : null,
    cadre: { duree: txt(cadre.duree), rythme: txt(cadre.rythme), hebergement: txt(cadre.hebergement), mois: txt(cadre.mois), souplesse: txt(cadre.souplesse) },
    groupe: { type: typeGroupe, nombre: nombre || null, enfants: Number(groupe.enfants) || null },
    budget: !budgetTexte ? null : /d[ée]finir/i.test(budgetTexte) ? "À définir avec l'agence" : `${budgetTexte} par personne, hors vol`,
    envies: { grandes: liste(envies.grandes), experiences: liste(envies.experiences), activites: liste(envies.activites), pepites: liste(envies.pepites) },
    jours,
    ajuster: arr(t.a_ajuster).map(txt).filter(Boolean),
    precisions: txt(t.precisions),
  };
}

/** Trame stockée par le back office (déjà au format interne). */
export function trameInterne(v: unknown): Trame | null {
  const t = obj(v);
  if (!Object.keys(t).length || !Array.isArray(t.jours)) return null;
  const c = obj(t.cadre), g = obj(t.groupe), e = obj(t.envies);
  return {
    titre: txt(t.titre) || "Mon voyage en Algérie",
    circuit: txt(t.circuit) || null,
    cadre: { duree: txt(c.duree), rythme: txt(c.rythme), hebergement: txt(c.hebergement), mois: txt(c.mois), souplesse: txt(c.souplesse) },
    groupe: { type: txt(g.type), nombre: Number(g.nombre) || null, enfants: Number(g.enfants) || null },
    budget: txt(t.budget) || null,
    envies: { grandes: liste(e.grandes), experiences: liste(e.experiences), activites: liste(e.activites), pepites: liste(e.pepites) },
    jours: arr(t.jours).map((j, i) => { const o = obj(j); return { n: Number(o.n) || i + 1, lieux: arr(o.lieux).map(txt).filter(Boolean), e: txt(o.e) }; }),
    ajuster: arr(t.ajuster).map(txt).filter(Boolean),
    precisions: txt(t.precisions),
  };
}

/** Lieux connus du site, dans l'ordre alphabétique, pour les formulaires de l'opérateur. */
export const LIEUX_TRIES = Object.entries(LIEUX)
  .map(([id, l]) => ({ id, ...l }))
  .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

// ---------------------------------------------------------------- vocabulaire commun (opérateur et voyageur)
export const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const SOUPLESSES = ["dates fixes", "à quelques jours près", "flexibles"];
export const GROUPES = ["solo", "couple", "famille", "amis"];
export const BUDGETS = ["Moins de 800 €", "800 à 1 200 €", "1 200 à 1 800 €", "Plus de 1 800 €"];
export const DEFINIR = "À définir avec l'agence";
/** Valeur enregistrée pour une tranche de BUDGETS. */
export const budgetParPersonne = (tranche: string) => `${tranche} par personne, hors vol`;

export const trameVide = (titre = "Mon voyage en Algérie"): Trame => ({
  titre, circuit: null,
  cadre: { duree: "", rythme: "", hebergement: "", mois: "", souplesse: "" },
  groupe: { type: "", nombre: null, enfants: null },
  budget: null,
  envies: { grandes: [], experiences: [], activites: [], pepites: [] },
  jours: [], ajuster: [], precisions: "",
});

/** Colonnes historiques du lead tenues à jour depuis la trame (listes, recherche, anciens écrans). */
export function colonnesDepuisTrame(trame: Trame): Record<string, string> {
  const maj: Record<string, string> = {};
  if (trame.budget) maj.budget = trame.budget;
  if (trame.cadre.mois) maj.trip_dates = [trame.cadre.mois, trame.cadre.souplesse].filter(Boolean).join(", ");
  if (trame.groupe.type || trame.groupe.nombre) maj.travelers = [trame.groupe.type, trame.groupe.nombre ? `${trame.groupe.nombre} pers.` : ""].filter(Boolean).join(", ");
  return maj;
}
