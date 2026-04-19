/** Valeurs stockées en base (Postgres enums) — libellés FR côté UI. */

export type CrmCommercialPriority = "low" | "medium" | "high" | "critical";
export type CrmConversionBand = "low" | "medium" | "high";
export type CrmFeasibilityBand = "unlikely" | "possible" | "likely" | "clear";
export type CrmFollowUpStrategy = "nurture" | "push" | "pause" | "escalate" | "none";
export type CrmPrimaryObjection =
  | "none"
  | "price"
  | "timing"
  | "hesitation"
  | "confidence"
  | "other";

export const CRM_COMMERCIAL_PRIORITY_OPTIONS: {
  value: CrmCommercialPriority;
  label: string;
}[] = [
  { value: "low", label: "Priorité faible" },
  { value: "medium", label: "Priorité moyenne" },
  { value: "high", label: "Priorité haute" },
  { value: "critical", label: "Critique / à traiter vite" },
];

export const CRM_CONVERSION_OPTIONS: { value: CrmConversionBand; label: string }[] = [
  { value: "low", label: "Conversion — faible" },
  { value: "medium", label: "Conversion — moyenne" },
  { value: "high", label: "Conversion — forte" },
];

export const CRM_FEASIBILITY_OPTIONS: { value: CrmFeasibilityBand; label: string }[] = [
  { value: "unlikely", label: "Faisabilité — peu probable" },
  { value: "possible", label: "Faisabilité — possible" },
  { value: "likely", label: "Faisabilité — probable" },
  { value: "clear", label: "Faisabilité — claire" },
];

export const CRM_FOLLOW_UP_OPTIONS: { value: CrmFollowUpStrategy; label: string }[] = [
  { value: "none", label: "Relance — pas définie" },
  { value: "nurture", label: "Relance — nourrir (contenu / suivi doux)" },
  { value: "push", label: "Relance — pousser (rappel actif)" },
  { value: "pause", label: "Relance — pause (attente voyageur)" },
  { value: "escalate", label: "Relance — escalade interne" },
];

export const CRM_OBJECTION_OPTIONS: { value: CrmPrimaryObjection; label: string }[] = [
  { value: "none", label: "Objection — aucune / non applicable" },
  { value: "price", label: "Objection — prix" },
  { value: "timing", label: "Objection — timing" },
  { value: "hesitation", label: "Objection — hésitation" },
  { value: "confidence", label: "Objection — confiance" },
  { value: "other", label: "Objection — autre" },
];

export function labelCrmCommercialPriority(v: CrmCommercialPriority): string {
  return CRM_COMMERCIAL_PRIORITY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelCrmConversion(v: CrmConversionBand): string {
  return CRM_CONVERSION_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelCrmFeasibility(v: CrmFeasibilityBand): string {
  return CRM_FEASIBILITY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelCrmFollowUp(v: CrmFollowUpStrategy): string {
  return CRM_FOLLOW_UP_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelCrmObjection(v: CrmPrimaryObjection): string {
  return CRM_OBJECTION_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function parseCrmCommercialPriority(raw: string): CrmCommercialPriority | null {
  return CRM_COMMERCIAL_PRIORITY_OPTIONS.some((o) => o.value === raw)
    ? (raw as CrmCommercialPriority)
    : null;
}
export function parseCrmConversionBand(raw: string): CrmConversionBand | null {
  return CRM_CONVERSION_OPTIONS.some((o) => o.value === raw)
    ? (raw as CrmConversionBand)
    : null;
}
export function parseCrmFeasibilityBand(raw: string): CrmFeasibilityBand | null {
  return CRM_FEASIBILITY_OPTIONS.some((o) => o.value === raw)
    ? (raw as CrmFeasibilityBand)
    : null;
}
export function parseCrmFollowUpStrategy(raw: string): CrmFollowUpStrategy | null {
  return CRM_FOLLOW_UP_OPTIONS.some((o) => o.value === raw)
    ? (raw as CrmFollowUpStrategy)
    : null;
}
export function parseCrmPrimaryObjection(raw: string): CrmPrimaryObjection | null {
  return CRM_OBJECTION_OPTIONS.some((o) => o.value === raw)
    ? (raw as CrmPrimaryObjection)
    : null;
}
