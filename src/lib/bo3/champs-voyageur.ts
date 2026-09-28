// Formulaire voyageur raccourci (`/q/<token>?champs=dates,budget`) : le voyageur ne répond qu'à ce qui
// manque à sa trame. Ce module lit sa réponse sans lui faire confiance et la verse dans la trame.
import { LIEUX } from "./geo";
import { BUDGETS, budgetParPersonne, DEFINIR, GROUPES, MOIS, SOUPLESSES } from "./trame";
import { MANQUES, type Manque, type Trame } from "./types";

export type ReponsesChamps = {
  dates?: { mois: string; souplesse: string };
  groupe?: { type: string; nombre: number | null; enfants: number | null };
  budget?: string;
  lieux?: string[];
  precisions?: string;
};

type Brut = Record<string, unknown>;
const obj = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const parmi = (v: unknown, liste: string[]) => (liste.includes(txt(v)) ? txt(v) : "");
const entier = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** `?champs=dates,budget` → champs connus, sans doublon, dans l'ordre du formulaire. */
export function champsDepuis(param: string | string[] | undefined): Manque[] {
  const demandes = (Array.isArray(param) ? param.join(",") : param ?? "").split(",").map((c) => c.trim());
  return MANQUES.filter((m) => demandes.includes(m));
}

/** Tranches proposées au voyageur, et la valeur enregistrée pour chacune. */
export const BUDGETS_VOYAGEUR = [...BUDGETS.map((b) => ({ label: b, valeur: budgetParPersonne(b) })), { label: "Je préfère en parler avec vous", valeur: DEFINIR }];

/** Ne garde que les champs demandés, et seulement des valeurs du vocabulaire attendu. */
export function lireReponsesChamps(corps: unknown, champs: Manque[]): ReponsesChamps {
  const b = obj(corps);
  const r: ReponsesChamps = {};
  if (champs.includes("dates")) {
    const d = obj(b.dates);
    const mois = parmi(d.mois, MOIS);
    if (mois) r.dates = { mois, souplesse: parmi(d.souplesse, SOUPLESSES) };
  }
  if (champs.includes("groupe")) {
    const g = obj(b.groupe);
    const type = parmi(g.type, GROUPES);
    const nombre = entier(g.nombre, 1, 40);
    if (type || nombre) r.groupe = { type, nombre, enfants: entier(g.enfants, 0, 20) };
  }
  if (champs.includes("budget")) {
    const budget = parmi(b.budget, BUDGETS_VOYAGEUR.map((x) => x.valeur));
    if (budget) r.budget = budget;
  }
  if (champs.includes("lieux")) {
    const lieux = (Array.isArray(b.lieux) ? b.lieux : []).map(txt).filter((id, i, t) => Object.hasOwn(LIEUX, id) && t.indexOf(id) === i).slice(0, 15);
    if (lieux.length) r.lieux = lieux;
  }
  const precisions = txt(b.precisions).slice(0, 1000);
  if (precisions) r.precisions = precisions;
  return r;
}

/** Verse les réponses dans la trame, sans toucher au reste. Les lieux deviennent une étape chacun, dans l'ordre choisi. */
export function completerTrame(t: Trame, r: ReponsesChamps): Trame {
  const suite = structuredClone(t);
  if (r.dates) suite.cadre = { ...suite.cadre, mois: r.dates.mois, souplesse: r.dates.souplesse || suite.cadre.souplesse };
  if (r.groupe) suite.groupe = { type: r.groupe.type || suite.groupe.type, nombre: r.groupe.nombre ?? suite.groupe.nombre, enfants: r.groupe.enfants ?? suite.groupe.enfants };
  if (r.budget) suite.budget = r.budget;
  if (r.lieux) {
    // Un itinéraire existe déjà (l'opérateur a demandé les lieux quand même) : on ne l'écrase pas, on le signale.
    if (suite.jours.some((j) => j.lieux.length)) suite.ajuster = [...suite.ajuster, `Lieux souhaités par le voyageur : ${r.lieux.map((id) => LIEUX[id]?.nom ?? id).join(", ")}`];
    else suite.jours = r.lieux.map((id, i) => ({ n: i + 1, lieux: [id], e: "" }));
  }
  if (r.precisions) suite.precisions = [suite.precisions, `Réponse au lien : ${r.precisions}`].filter(Boolean).join("\n");
  return suite;
}

/** Une ligne lisible par l'opérateur, pour le fil du projet. */
export function resumeReponses(r: ReponsesChamps): string {
  const parts: string[] = [];
  if (r.dates) parts.push(`Dates : ${[r.dates.mois, r.dates.souplesse].filter(Boolean).join(", ")}`);
  if (r.groupe) parts.push(`Groupe : ${[r.groupe.type, r.groupe.nombre ? `${r.groupe.nombre} pers.` : "", r.groupe.enfants ? `dont ${r.groupe.enfants} enfant${r.groupe.enfants > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")}`);
  if (r.budget) parts.push(`Budget : ${r.budget}`);
  if (r.lieux) parts.push(`Lieux : ${r.lieux.map((id) => LIEUX[id]?.nom ?? id).join(", ")}`);
  if (r.precisions) parts.push(`Précisions : ${r.precisions}`);
  return parts.join(" · ");
}
