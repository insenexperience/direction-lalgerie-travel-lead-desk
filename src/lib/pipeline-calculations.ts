/**
 * Module centralisé pour tous les calculs financiers du pipeline.
 * Aucun calcul financier ne doit exister en dehors de ce fichier.
 *
 * Modèle business : INSEN vend un lead à Direction Algérie = 10% du CA voyage.
 */

export const CHILD_COEFFICIENT = 0.5;
export const INSEN_COMMISSION_RATE = 0.10;

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

/** Commission INSEN = 10 % du budget voyage. */
export function calculateLeadCommission(lead: LeadForCalc): number {
  return calculateLeadBudget(lead) * INSEN_COMMISSION_RATE;
}

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
 * Pipeline pondéré INSEN : somme des revenus pondérés des leads actifs.
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

/** Formate un montant EUR pour l'affichage. */
export function formatEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return `${Math.round(n)} €`;
}
