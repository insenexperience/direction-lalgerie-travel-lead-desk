export type QualificationBudget = {
  min: number | null;
  max: number | null;
  currency: string | null;
  unit: "per_person" | "total" | null;
  includesFlights: boolean | null;
};

export type QualificationBudgetInput = {
  budget_min: string;
  budget_max: string;
  currency: string;
  budget_unit: string;
  budget_includes_flights: string;
};

const budgetKeys = ["budget_amount", "budget_min", "budget_max", "currency", "budget_unit", "budget_includes_flights"] as const;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function parseQualificationBudget(input: unknown, requireComplete = false):
  { ok: true; value: QualificationBudget } | { ok: false; error: string } {
  const { budget_min, budget_max, currency, budget_unit, budget_includes_flights } = object(input);
  if (
    typeof budget_min !== "string" || typeof budget_max !== "string" ||
    typeof currency !== "string" || !/^(?:[A-Z]{3})?$/.test(currency) ||
    (budget_unit !== "" && budget_unit !== "per_person" && budget_unit !== "total") ||
    (budget_includes_flights !== "" && budget_includes_flights !== "yes" && budget_includes_flights !== "no")
  ) return { ok: false, error: "Vérifiez la devise, la base du budget et les vols." };

  const amount = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!/^(?:\d+|\d{1,3}(?:[\u00a0\u202f ]\d{3})+)(?:[,.]\d{1,2})?$/.test(trimmed)) return NaN;
    const normalized = trimmed.replace(/[\u00a0\u202f ]/g, "").replace(",", ".");
    return /^\d{1,8}(?:\.\d{1,2})?$/.test(normalized) && Number(normalized) > 0 ? Number(normalized) : NaN;
  };
  const min = amount(budget_min);
  const max = amount(budget_max);
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return { ok: false, error: "Saisissez un montant positif, avec au plus deux décimales et huit chiffres avant la virgule." };
  }
  if (min !== null && max !== null && max < min) {
    return { ok: false, error: "Le maximum doit être supérieur ou égal au budget indicatif." };
  }
  if (requireComplete && ((min === null && max === null) || !currency || !budget_unit)) {
    return { ok: false, error: "Saisissez un montant ou un maximum, puis choisissez la devise et la base du budget." };
  }
  return {
    ok: true,
    value: {
      min, max, currency: currency || null, unit: budget_unit || null,
      includesFlights: budget_includes_flights === "" ? null : budget_includes_flights === "yes",
    },
  };
}

export function formatQualificationBudget(value: QualificationBudget, language: "fr" | "en" = "fr"): string {
  const { min, max, currency, unit, includesFlights } = value;
  if (min === null && max === null) return "";
  const amounts = min === null ? `${language === "en" ? "Up to" : "Jusqu’à"} ${max}`
    : max !== null && max !== min ? `${min}–${max}` : String(min);
  if (language === "en") {
    const basis = unit === "total" ? "total" : unit === "per_person" ? "per person" : "basis to confirm";
    const flights = includesFlights === null ? "" : includesFlights ? ", flights included" : ", excluding flights";
    return `${amounts} ${currency || "currency to confirm"} ${basis}${flights}`;
  }
  const basis = unit === "total" ? "total" : unit === "per_person" ? "par personne" : "base à préciser";
  const flights = includesFlights === null ? "" : includesFlights ? ", vols inclus" : ", hors vols";
  return `${amounts} ${currency || "devise à confirmer"} ${basis}${flights}`;
}

export function confirmedQualificationBudgetFacts(intakePayload: unknown): Record<string, unknown> {
  const facts = object(object(intakePayload).qualification_facts);
  if (typeof facts.budget_confirmed_at !== "string") return {};
  return Object.fromEntries(budgetKeys.map(key => [key, facts[key]]));
}

export function readConfirmedQualificationBudget(intakePayload: unknown): QualificationBudget | null {
  if (!Object.keys(confirmedQualificationBudgetFacts(intakePayload)).length) return null;
  const parsed = parseQualificationBudget(qualificationBudgetInput({ intake_payload: intakePayload }));
  return parsed.ok ? parsed.value : null;
}

export function buildQualificationBudgetPatch(
  intakePayload: unknown,
  value: QualificationBudget,
  confirmation?: { confirmedBy?: string; confirmedAt?: string },
) {
  const intake = object(intakePayload);
  const imported = object(intake.manual_qualification);
  const salesImport = { ...object(intake.da_sales_qualification) };
  for (const key of ["budgetStatus", "budgetAmount", "budgetCurrency", "budgetUnit", "budgetReference"]) delete salesImport[key];
  const { min, max, currency, unit, includesFlights } = value;
  const legacy = { budget_ideal: min === null ? "" : String(min), budget_max: max === null ? "" : String(max), currency: currency || "", budget_unit: unit || "" };
  return {
    intake_payload: {
      ...intake,
      ...legacy,
      budget_total: unit === "total" ? String(min ?? max ?? "") : "",
      ...(Object.keys(imported).length ? { manual_qualification: {
        ...imported, ...legacy, budget_includes_flights: includesFlights === null ? "" : includesFlights ? "yes" : "no",
      } } : {}),
      ...(intake.da_sales_qualification ? { da_sales_qualification: salesImport } : {}),
      qualification_facts: {
        ...object(intake.qualification_facts),
        budget_amount: null,
        budget_min: min,
        budget_max: max,
        currency,
        budget_unit: unit,
        budget_includes_flights: includesFlights,
        ...(confirmation?.confirmedBy ? { budget_confirmed_by: confirmation.confirmedBy } : {}),
        ...(confirmation?.confirmedAt ? { budget_confirmed_at: confirmation.confirmedAt } : {}),
      },
    },
    budget: formatQualificationBudget(value),
    budget_min: currency === "EUR" ? min : null,
    budget_max: currency === "EUR" ? max : null,
    budget_unit: unit,
    // The legacy financial columns are restricted to EUR.
    currency: "EUR",
  };
}

export function qualificationBudgetInput(lead: {
  intake_payload?: unknown;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_unit?: string | null;
  currency?: string | null;
}): QualificationBudgetInput {
  const intake = object(lead.intake_payload);
  const facts = object(intake.qualification_facts);
  const imported = object(intake.manual_qualification);
  const recorded = (key: string, fallback: unknown) => Object.hasOwn(facts, key) ? facts[key] : fallback;
  const str = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "";
  const total = imported.budget_total ?? intake.budget_total;
  const confirmedMin = facts.budget_min ?? facts.budget_amount;
  const min = Object.hasOwn(facts, "budget_min") || Object.hasOwn(facts, "budget_amount")
    ? confirmedMin
    : [imported.budget_ideal, intake.budget_ideal, total, lead.budget_min].find(value => Number(value) > 0);
  const legacyCurrency = lead.budget_min != null || lead.budget_max != null ? lead.currency : "";
  const scope = facts.budget_includes_flights;
  return {
    budget_min: str(min),
    budget_max: str(recorded("budget_max", imported.budget_max ?? intake.budget_max ?? lead.budget_max)),
    currency: str(recorded("currency", imported.currency ?? intake.currency ?? legacyCurrency)),
    budget_unit: str(recorded("budget_unit", imported.budget_unit ?? intake.budget_unit ?? lead.budget_unit ?? (Number(total) > 0 ? "total" : ""))),
    budget_includes_flights: scope === true ? "yes" : scope === false ? "no" : "",
  };
}
