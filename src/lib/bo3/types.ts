import type { Zone } from "./geo";

/** Les 7 étapes vues par l'opérateur (docs refonte v3, §1.1). La base garde ses statuts. */
export type Statut =
  | "recu"
  | "a_completer"
  | "brief_pret"
  | "envoye"
  | "proposition"
  | "proposee"
  | "clos";

export const STATUTS: Statut[] = [
  // Ordre de progression : un projet incomplet est complété (Reçu) avant que son brief parte.
  "a_completer",
  "recu",
  "brief_pret",
  "envoye",
  "proposition",
  "proposee",
  "clos",
];

export const STATUT_LABEL: Record<Statut, string> = {
  recu: "Reçu",
  a_completer: "À compléter",
  brief_pret: "Brief prêt",
  envoye: "Envoyé aux agences",
  proposition: "Proposition reçue",
  proposee: "Proposée au voyageur",
  clos: "Gagné / Perdu",
};

export type Source = "composer" | "mon-projet" | "whatsapp" | "manuel";

export const SOURCES: Record<Source, string> = {
  composer: "Composer",
  "mon-projet": "Mon projet",
  whatsapp: "WhatsApp",
  manuel: "Saisie manuelle",
};

export type Canal = "whatsapp" | "email";

/** Ce qu'il faut pour qu'une agence puisse travailler (garde-fou Reçu → Brief prêt). */
export type Manque = "dates" | "groupe" | "budget" | "lieux";
export const MANQUES: Manque[] = ["dates", "groupe", "budget", "lieux"];

export type Trame = {
  titre: string;
  circuit: string | null;
  cadre: { duree: string; rythme: string; hebergement: string; mois: string; souplesse: string };
  groupe: { type: string; nombre: number | null; enfants: number | null };
  /** null = manquant ; « À définir avec l'agence » = posé explicitement. */
  budget: string | null;
  envies: { grandes: string[]; experiences: string[]; activites: string[]; pepites: string[] };
  /** lieux = identifiants de LIEUX (geo.ts). */
  jours: { n: number; lieux: string[]; e: string }[];
  ajuster: string[];
  precisions: string;
};

export type Proposition = {
  recu: string;
  prix: number | null;
  duree: number | null;
  resume: string;
  ecarts: string;
};

/** Une agence consultée sur un projet (table lead_circuit_proposals). */
export type Consultation = {
  id: string;
  agence: string;
  portion: string;
  envoye: string;
  statut?: string;
  accuse: string | null;
  proposition: Proposition | null;
  refus: string | null;
  relances: string[];
  retenue: boolean;
  quoteId: string | null;
};

export type Mention = "visible" | "discrete" | "aucune";

/** Proposition Direction l'Algérie envoyée au voyageur (table quotes, kind = da_traveler). */
export type DevisDA = {
  id: string;
  source: string | null;
  mention: Mention;
  prix: number;
  titre: string;
  lignes: string[];
  validite: number;
  note: string;
  converti: string;
  envoye: string | null;
  canal: string | null;
};

export type Message = { t: string; k: "auto" | "in" | "out" | "sys"; s: string; b: string };

export type Agence = {
  id: string;
  slug: string;
  n: string;
  ville: string;
  zones: Zone[];
  contact: string;
  tel: string;
};

export type Projet = {
  id: string;
  ref: string;
  nom: string;
  email: string | null;
  tel: string | null;
  canal: Canal;
  source: Source;
  statut: Statut;
  dbStatus: string;
  recu: string;
  premiereReponse: string | null;
  agenceChoisie: string | null;
  trame: Trame | null;
  /** Texte d'origine quand il n'y a pas de trame (lead WhatsApp, saisie). */
  texte: string;
  manque: Manque[];
  brief: { sections: BriefSection[]; editedAt: string | null } | null;
  consultations: Consultation[];
  devis: DevisDA | null;
  relancesVoyageur: string[];
  messages: Message[];
  issue: "gagne" | "perdu" | null;
  motif: string | null;
  closedAt: string | null;
  notesInternes: string;
  qualification: number[];
};

export type BriefSection = { id: string; title: string; text: string };
