import type { BaseKey } from "./bases";

/** Valeur d'une propriété telle que le module la manipule (texte en Markdown léger, dates AAAA-MM-JJ). */
export type Valeur = string | number | boolean | string[] | null;

export type Fiche = {
  /** Identifiant Notion sans tirets (32 caractères). */
  id: string;
  base: BaseKey;
  titre: string;
  statut: string;
  props: Record<string, Valeur>;
  /** Dernière modification dans Notion (ISO). */
  modifie: string;
};

export type Commentaire = { id: string; qui: string; quand: string; texte: string };

export type DetailFiche = { contenu: string; commentaires: Commentaire[] };

export type DonneesRadar =
  | { ok: true; bases: Record<BaseKey, Fiche[]>; charge: string }
  | { ok: false; raison: "config" | "acces" | "erreur"; message: string };

export type ResultatAction = { ok: true; id?: string } | { ok: false; erreur: string };

/** Proposition de l'agent, appliquée seulement après validation de la personne. */
export type Proposition =
  | { id: string; kind: "update"; base: BaseKey; ficheId: string; titre: string; changes: Record<string, Valeur>; lignes: { champ: string; avant: string; apres: string }[]; raison?: string }
  | { id: string; kind: "create"; base: BaseKey; titre: string; changes: Record<string, Valeur>; lignes: { champ: string; avant: string; apres: string }[]; raison?: string }
  | { id: string; kind: "comment"; base: BaseKey; ficheId: string; titre: string; texte: string };
