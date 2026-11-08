import { colonnesDepuisTrame, trameDepuisSite, trameInterne, trameVide } from "@/lib/bo3/trame";
import { parseQualificationImport, qualificationLabels, type QualificationImport } from "@/lib/assistant/qualification";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function buildQualificationPatch(lead: {
  intake_payload?: unknown; ai_qualification_payload?: unknown; trip_summary?: string | null;
}, value: QualificationImport) {
  const intake = object(lead.intake_payload);
  const ai = object(lead.ai_qualification_payload);
  const trame = trameInterne(ai.trame_v3) ?? trameDepuisSite(intake.trame) ?? trameVide(lead.trip_summary || undefined);
  const facts: Record<string, unknown> = {};
  const columns: Record<string, unknown> = {};
  if (value.period) {
    trame.cadre.mois = value.period;
    facts.travel_period = value.period;
    Object.assign(columns, { travel_period: value.period, travel_start_date: null, travel_end_date: null });
  }
  if (value.flexibility) trame.cadre.souplesse = value.flexibility === "flexible" ? "flexibles" : "dates fixes";
  if (value.duration) { trame.cadre.duree = value.duration; facts.duration = value.duration; }
  if (value.accommodation) { trame.cadre.hebergement = value.accommodation; facts.accommodation = value.accommodation; }
  const compositionChanged = value.adults !== undefined || value.children !== undefined;
  const previousAdults = trame.groupe.nombre !== null && trame.groupe.enfants !== null
    ? trame.groupe.nombre - trame.groupe.enfants : undefined;
  const adults = value.adults ?? (compositionChanged ? previousAdults : undefined);
  const children = value.children ?? (compositionChanged ? trame.groupe.enfants ?? undefined : undefined);
  const total = value.travelers ?? (adults !== undefined && children !== undefined && adults + children > 0 ? adults + children : undefined);
  if (total !== undefined) {
    trame.groupe.nombre = total;
    facts.confirmed_travelers = total;
    facts.travelers_adults = value.adults ?? (value.children !== undefined ? total - value.children : trame.groupe.enfants === 0 ? total : null);
    facts.travelers_children = value.children ?? (value.adults !== undefined ? total - value.adults : trame.groupe.enfants === 0 ? 0 : null);
    trame.groupe.enfants = facts.travelers_children as number | null;
    if (facts.travelers_adults !== null) columns.travelers_adults = facts.travelers_adults;
    if (facts.travelers_children !== null) columns.travelers_children = facts.travelers_children;
  } else {
    if (value.adults !== undefined) { facts.travelers_adults = value.adults; columns.travelers_adults = value.adults; }
    if (value.children !== undefined) { facts.travelers_children = value.children; columns.travelers_children = value.children; trame.groupe.enfants = value.children; }
    if (compositionChanged) { facts.confirmed_travelers = null; trame.groupe.nombre = null; }
  }
  if (value.pendingTravelers !== undefined) facts.pending_travelers = value.pendingTravelers;
  if (value.domesticFlights) facts.domestic_flights = value.domesticFlights;
  if (value.formalities) facts.formalities = value.formalities;
  if (value.activities?.length) trame.envies.activites = [...new Set([...trame.envies.activites, ...value.activities])];
  const services = [value.domesticFlights, value.services, ...(value.activities ?? [])].filter(Boolean);
  if (services.length) {
    const existing = object(intake.qualification_facts).services;
    facts.services = [...new Set([...(typeof existing === "string" ? existing.split("\n").filter(Boolean) : []), ...services])].join("\n");
  }
  if (value.constraints) facts.constraints = value.constraints;
  if (value.budgetReference) facts.budget_reference = value.budgetReference;
  if (value.budgetStatus === "unknown") {
    trame.budget = null;
    Object.assign(facts, { budget_amount: null, budget_min: null, budget_max: null, currency: null, budget_unit: null, budget_includes_flights: null });
    Object.assign(columns, { budget: "", budget_min: null, budget_max: null, budget_unit: null });
  } else if (value.budgetStatus === "confirmed") {
    trame.budget = qualificationLabels(value).find(({ label }) => label === "Budget")?.value ?? null;
    Object.assign(facts, { budget_amount: value.budgetAmount, budget_min: null, budget_max: null, currency: value.budgetCurrency, budget_unit: value.budgetUnit });
    Object.assign(columns, { budget_min: value.budgetCurrency === "EUR" ? value.budgetAmount : null, budget_max: null, budget_unit: value.budgetUnit });
  }
  const previous = object(intake.qualification_facts);
  const previousImport: QualificationImport = parseQualificationImport(intake.da_sales_qualification) ?? {};
  const currentImport = { ...previousImport, ...value };
  if (total !== undefined) {
    currentImport.travelers = total;
    delete currentImport.adults;
    delete currentImport.children;
    if (typeof facts.travelers_adults === "number") currentImport.adults = facts.travelers_adults;
    if (typeof facts.travelers_children === "number") currentImport.children = facts.travelers_children;
  } else if (compositionChanged) delete currentImport.travelers;
  if (value.activities?.length) currentImport.activities = [...new Set([...(previousImport.activities ?? []), ...value.activities])].slice(0, 15);
  if (value.budgetStatus === "unknown") {
    delete currentImport.budgetAmount;
    delete currentImport.budgetCurrency;
    delete currentImport.budgetUnit;
  }
  const priorKeys = Array.isArray(previous.da_sales_confirmed_keys) ? previous.da_sales_confirmed_keys.filter((key) => typeof key === "string") : [];
  const legacy = colonnesDepuisTrame(trame);
  if ((value.period || value.flexibility) && legacy.trip_dates) columns.trip_dates = legacy.trip_dates;
  if ((total !== undefined || compositionChanged) && legacy.travelers) columns.travelers = legacy.travelers;
  if (value.budgetStatus === "confirmed" && legacy.budget) columns.budget = legacy.budget;
  return {
    ...columns,
    intake_payload: { ...intake, da_sales_qualification: currentImport, qualification_facts: {
      ...previous, ...facts, da_sales_confirmed_keys: [...new Set([...priorKeys, ...Object.keys(facts)])],
    } },
    ai_qualification_payload: { ...ai, trame_v3: trame },
  };
}
