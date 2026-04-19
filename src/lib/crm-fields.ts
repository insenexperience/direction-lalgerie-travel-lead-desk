/** Valeurs stockées en base (Postgres enums) — libellés FR côté UI. */

export type CrmConversionBand = "low" | "medium" | "high";
export type CrmFollowUpStrategy = "nurture" | "push" | "pause" | "escalate" | "none";

export const CRM_CONVERSION_OPTIONS: { value: CrmConversionBand; label: string }[] = [
  { value: "low", label: "Conversion — faible" },
  { value: "medium", label: "Conversion — moyenne" },
  { value: "high", label: "Conversion — forte" },
];

export const CRM_FOLLOW_UP_OPTIONS: { value: CrmFollowUpStrategy; label: string }[] = [
  { value: "none", label: "Relance — pas définie" },
  { value: "nurture", label: "Relance — nourrir (contenu / suivi doux)" },
  { value: "push", label: "Relance — pousser (rappel actif)" },
  { value: "pause", label: "Relance — pause (attente voyageur)" },
  { value: "escalate", label: "Relance — escalade interne" },
];

export function labelCrmConversion(v: CrmConversionBand): string {
  return CRM_CONVERSION_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
export function labelCrmFollowUp(v: CrmFollowUpStrategy): string {
  return CRM_FOLLOW_UP_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function parseCrmConversionBand(raw: string): CrmConversionBand | null {
  return CRM_CONVERSION_OPTIONS.some((o) => o.value === raw)
    ? (raw as CrmConversionBand)
    : null;
}
export function parseCrmFollowUpStrategy(raw: string): CrmFollowUpStrategy | null {
  return CRM_FOLLOW_UP_OPTIONS.some((o) => o.value === raw)
    ? (raw as CrmFollowUpStrategy)
    : null;
}
