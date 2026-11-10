export const QUALIFICATION_TEXT_FIELDS = {
  period: "Période de voyage",
  duration: "Durée",
  accommodation: "Hébergement",
  domesticFlights: "Vols intérieurs",
  formalities: "Formalités déclarées",
  services: "Prestations demandées",
  constraints: "Autres contraintes",
  budgetReference: "Repère de prix, hors budget confirmé",
} as const;

type TextField = keyof typeof QUALIFICATION_TEXT_FIELDS;
export type QualificationImport = Partial<Record<TextField, string>> & {
  travelers?: number;
  adults?: number;
  children?: number;
  pendingTravelers?: number;
  flexibility?: "flexible" | "fixed";
  activities?: string[];
  budgetStatus?: "unknown" | "confirmed";
  budgetAmount?: number;
  budgetCurrency?: string;
  budgetUnit?: "per_person" | "total";
};
export type QualificationChange = { label: string; before: string | null; after: string | null };
export type QualificationPreview = { leadId: string; updatedAt: string; qualification: QualificationImport; changes?: QualificationChange[] };

const textKeys = Object.keys(QUALIFICATION_TEXT_FIELDS) as TextField[];
const countKeys = ["travelers", "adults", "children", "pendingTravelers"] as const;
const keys = new Set([...textKeys, ...countKeys, "flexibility", "activities", "budgetStatus", "budgetAmount", "budgetCurrency", "budgetUnit"]);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function parseQualificationImport(input: unknown): QualificationImport | null {
  const data = object(input);
  if (Object.keys(data).some((key) => !keys.has(key))) return null;
  const result: QualificationImport = {};
  for (const key of textKeys) {
    const value = data[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || value.length > 600) return null;
    if (value.trim()) result[key] = value.trim();
  }
  for (const key of countKeys) {
    const value = data[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1000 || (key === "travelers" && value === 0)) return null;
    result[key] = value;
  }
  if (result.adults !== undefined && result.children !== undefined) {
    const total = result.adults + result.children;
    if (total === 0 || total > 1000 || (result.travelers !== undefined && result.travelers !== total)) return null;
  }
  if (result.travelers !== undefined && ((result.adults ?? 0) > result.travelers || (result.children ?? 0) > result.travelers)) return null;
  if (Array.isArray(data.activities) && data.activities.length) {
    if (data.activities.length > 15 || data.activities.some((value) => typeof value !== "string" || !value.trim() || value.length > 160)) return null;
    result.activities = [...new Set(data.activities.map((value: string) => value.trim()))];
  } else if (data.activities != null && !Array.isArray(data.activities)) return null;
  if (data.flexibility === "flexible" || data.flexibility === "fixed") result.flexibility = data.flexibility;
  else if (data.flexibility != null && data.flexibility !== "") return null;
  if (data.budgetStatus === "unknown") result.budgetStatus = "unknown";
  else if (data.budgetStatus === "confirmed") {
    if (typeof data.budgetAmount !== "number" || data.budgetAmount <= 0 || data.budgetAmount > 99999999.99 || Number(data.budgetAmount.toFixed(2)) !== data.budgetAmount ||
        typeof data.budgetCurrency !== "string" || !/^[A-Z]{3}$/.test(data.budgetCurrency) ||
        (data.budgetUnit !== "per_person" && data.budgetUnit !== "total")) return null;
    Object.assign(result, { budgetStatus: "confirmed", budgetAmount: data.budgetAmount, budgetCurrency: data.budgetCurrency, budgetUnit: data.budgetUnit });
  } else if (data.budgetStatus != null && data.budgetStatus !== "") return null;
  return Object.keys(result).length ? result : null;
}

export function qualificationLabels(value: QualificationImport): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const key of textKeys) {
    const entry = value[key];
    if (entry) rows.push({ label: QUALIFICATION_TEXT_FIELDS[key], value: entry });
  }
  if (value.travelers !== undefined) rows.push({ label: "Voyageurs confirmés", value: String(value.travelers) });
  if (value.adults !== undefined) rows.push({ label: "Adultes", value: String(value.adults) });
  if (value.children !== undefined) rows.push({ label: "Enfants", value: String(value.children) });
  if (value.pendingTravelers !== undefined) rows.push({ label: "Voyageurs à confirmer", value: String(value.pendingTravelers) });
  if (value.flexibility) rows.push({ label: "Flexibilité", value: value.flexibility === "flexible" ? "Dates flexibles" : "Dates fixes" });
  if (value.activities?.length) rows.push({ label: "Activités", value: value.activities.join(" · ") });
  if (value.budgetStatus) rows.push({ label: "Budget", value: value.budgetStatus === "unknown" ? "À définir"
    : `${value.budgetAmount} ${value.budgetCurrency}${value.budgetUnit === "per_person" ? " par personne" : " pour le groupe"}` });
  return rows;
}
