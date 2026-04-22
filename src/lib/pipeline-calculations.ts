/**
 * Module centralisé pour tous les calculs financiers du pipeline.
 * Aucun calcul financier ne doit exister en dehors de ce fichier.
 *
 * Modèle business : Direction l'Algérie perçoit 10 % du CA voyage.
 * KPI 1 — Pipeline pondéré : Σ(budget voyage × poids étape) → CA voyage potentiel
 * KPI 2 — CA réalisé       : Σ(commission DA) sur leads won → 10 % du voyage gagné
 * KPI 3 — Volume DA        : Σ(commission DA × poids étape) → prix du lead pondéré
 */

export const CHILD_COEFFICIENT = 0.5;
export const DA_COMMISSION_RATE = 0.10;
/** @deprecated Utiliser DA_COMMISSION_RATE */
export const INSEN_COMMISSION_RATE = DA_COMMISSION_RATE;

export type PipelineStage = {
  code: string;
  weight: number;
  is_closed: boolean;
  is_won: boolean;
};

export type PipelineStages = Record<string, PipelineStage>;

export type LeadForCalc = {
  budget_min: number | null;
  budget_unit: "per_person" | "total" | null;
  travelers_adults: number;
  travelers_children: number;
  status: string;
  deleted_at: string | null;
  referent_id?: string | null;
};

/**
 * Budget total du voyage en EUR (fourchette basse).
 *
 * per_person : (adultes × budget_min) + (enfants × budget_min × 0,5)
 * total      : budget_min directement
 */
export function calculateLeadBudget(lead: LeadForCalc): number {
  const min = lead.budget_min ?? 0;
  if (min <= 0) return 0;

  if (lead.budget_unit === "per_person") {
    const adults = Math.max(0, lead.travelers_adults ?? 0);
    const children = Math.max(0, lead.travelers_children ?? 0);
    return adults * min + children * min * CHILD_COEFFICIENT;
  }

  if (lead.budget_unit === "total") {
    return min;
  }

  return 0;
}

/** Commission Direction l'Algérie = 10 % du budget voyage. */
export function calculateLeadCommission(lead: LeadForCalc): number {
  return calculateLeadBudget(lead) * DA_COMMISSION_RATE;
}
/** @alias calculateLeadCommission */
export const calculateDaCommission = calculateLeadCommission;

/**
 * Revenu INSEN pondéré par la probabilité de closing de l'étape.
 * Retourne 0 si l'étape n'est pas dans la table pipeline_stages.
 */
export function calculateWeightedRevenue(
  lead: LeadForCalc,
  stages: PipelineStages
): number {
  const stage = stages[lead.status];
  if (!stage) return 0;
  return calculateLeadCommission(lead) * stage.weight;
}

/**
 * CA Voyage brut : somme des budgets réels des leads actifs (sans pondération).
 * Utilisé pour le KPI "Pipeline pondéré (CA du voyage)".
 * Exclut : leads clos (won/lost) + leads soft-deleted.
 */
export function calculateRawPipeline(
  leads: LeadForCalc[],
  stages: PipelineStages
): number {
  return leads
    .filter((l) => {
      if (l.deleted_at) return false;
      const stage = stages[l.status];
      return stage ? !stage.is_closed : (l.status !== "won" && l.status !== "lost");
    })
    .reduce((sum, l) => sum + calculateLeadBudget(l), 0);
}

/**
 * Volume DA brut : Σ(commission 10 %) sur leads actifs, sans pondération.
 * Utilisé pour le KPI "Volume Direction l'Algérie".
 * Exclut : leads clos (won/lost) + leads soft-deleted.
 */
export function calculateRawDaRevenue(
  leads: LeadForCalc[],
  stages: PipelineStages
): number {
  return leads
    .filter((l) => {
      if (l.deleted_at) return false;
      const stage = stages[l.status];
      return stage ? !stage.is_closed : (l.status !== "won" && l.status !== "lost");
    })
    .reduce((sum, l) => sum + calculateLeadCommission(l), 0);
}

/**
 * Pipeline pondéré DA : somme des revenus pondérés des leads actifs.
 * Exclut : leads clos (won/lost) + leads soft-deleted.
 */
export function calculatePipelineTotal(
  leads: LeadForCalc[],
  stages: PipelineStages
): number {
  return leads
    .filter((l) => {
      if (l.deleted_at) return false;
      const stage = stages[l.status];
      return stage ? !stage.is_closed : false;
    })
    .reduce((sum, l) => sum + calculateWeightedRevenue(l, stages), 0);
}

/**
 * CA INSEN réalisé : somme des commissions des leads en statut "won".
 * Exclut les leads soft-deleted.
 */
export function calculateClosedRevenue(
  leads: LeadForCalc[],
  stages: PipelineStages
): number {
  return leads
    .filter((l) => {
      if (l.deleted_at) return false;
      const stage = stages[l.status];
      return stage ? stage.is_won : false;
    })
    .reduce((sum, l) => sum + calculateLeadCommission(l), 0);
}

/**
 * Volume voyages pondéré pour Direction Algérie (CA voyage, pas commission INSEN).
 * Utile pour estimer le volume transmis aux agences partenaires.
 * Exclut : leads clos + soft-deleted.
 */
export function calculateTravelVolume(
  leads: LeadForCalc[],
  stages: PipelineStages
): number {
  return leads
    .filter((l) => {
      if (l.deleted_at) return false;
      const stage = stages[l.status];
      return stage ? !stage.is_closed : false;
    })
    .reduce((sum, l) => {
      const stage = stages[l.status];
      if (!stage) return sum;
      return sum + calculateLeadBudget(l) * stage.weight;
    }, 0);
}

/** Formate un montant EUR pour l'affichage. Abrège seulement à partir de 10 000 €. */
export function formatEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 10_000) return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}
