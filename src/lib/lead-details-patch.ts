/** Patch only edited fields; preserve the original message and detailed qualification facts. */
export function buildLeadDetailsPatch(current: Record<string, unknown>, formData: FormData):
  { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const get = (key: string) => typeof formData.get(key) === "string" ? String(formData.get(key)).trim() : "";
  const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const intake = { ...object(current.intake_payload) };
  const facts = { ...object(intake.qualification_facts) };
  const manual = { ...object(intake.manual_qualification) };
  const hasManual = Boolean(intake.manual_qualification);
  const patch: Record<string, unknown> = {};
  let payloadChanged = false;
  const setIntake = (key: string, value: unknown) => { intake[key] = value; payloadChanged = true; };
  const setFact = (key: string, value: unknown) => { facts[key] = value; payloadChanged = true; };
  const setManual = (key: string, value: string) => { if (hasManual) { manual[key] = value; payloadChanged = true; } };

  const name = get("traveler_name");
  if (!name) return { ok: false, error: "Le nom du voyageur est obligatoire." };
  patch.traveler_name = name;
  for (const key of ["email", "phone"] as const) if (formData.has(key)) patch[key] = get(key);
  if (formData.has("whatsapp_phone_number")) patch.whatsapp_phone_number = get("whatsapp_phone_number") || null;
  if (formData.has("priority")) patch.priority = get("priority") === "high" ? "high" : "normal";
  if (["manual", "email", "whatsapp", "web_form"].includes(get("intake_channel"))) patch.intake_channel = get("intake_channel");
  if (formData.has("planning_stage")) {
    const value = get("planning_stage");
    if (value && !["ideas", "planning", "ready"].includes(value)) return { ok: false, error: "Maturité du projet invalide." };
    patch.planning_stage = value || null; setIntake("planning_stage", value); setManual("planning_stage", value);
  }

  if (formData.has("people") || formData.has("groupe")) {
    const previousGroup = String(intake.group_type || current.travelers || "").split(/\s+[·—]\s+/)[0];
    const group = formData.has("groupe") ? get("groupe") : previousGroup;
    const countRaw = formData.has("people") ? get("people") : String(intake.travellers_count || "");
    if (countRaw && (!/^\d+$/.test(countRaw) || Number(countRaw) < 1 || Number(countRaw) > 500)) return { ok: false, error: "Le nombre de participants doit être un entier positif." };
    if (countRaw && typeof facts.travelers_adults === "number" && typeof facts.travelers_children === "number" && Number(countRaw) !== facts.travelers_adults + facts.travelers_children) {
      return { ok: false, error: "Le total diffère de la composition adultes/enfants confirmée. Ajustez d’abord cette composition dans la fiche logistique." };
    }
    patch.travelers = [group, countRaw ? `${countRaw} voyageur(s)` : ""].filter(Boolean).join(" — ") || "—";
    setIntake("group_type", group); setManual("group_type", group);
    if (formData.has("people")) { setIntake("travellers_count", countRaw); setManual("travellers_count", countRaw); }
    // A total count never says how many adults and children there are.
  }

  if (formData.has("dates_mode")) {
    const exact = ["Dates précises", "exact"].includes(get("dates_mode"));
    const start = get("date_start"), end = get("date_end");
    const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (exact && (!validDate(start) || !validDate(end) || start && end && start > end)) return { ok: false, error: "Vérifiez les dates du voyage, avec l’année." };
    const period = get("flex_month"), duration = get("flex_duration");
    patch.travel_start_date = exact ? start || null : null;
    patch.travel_end_date = exact ? end || null : null;
    patch.trip_dates = exact ? [start, end].filter(Boolean).join(" → ") || "—" : [period, duration].filter(Boolean).join(" · ") || "—";
    patch.travel_period = exact ? null : period || null;
    setIntake("dates_mode", exact ? "Dates précises" : "Dates flexibles");
    setIntake("date_start", exact ? start : ""); setIntake("date_end", exact ? end : "");
    setIntake("flex_month", exact ? "" : period); setIntake("flex_period", exact ? "" : period);
    setIntake("flex_duration", duration); setFact("travel_period", exact ? [start, end].filter(Boolean).join(" → ") : period); setFact("duration", duration);
    setManual("date_start", exact ? start : ""); setManual("date_end", exact ? end : "");
    setManual("flex_period", exact ? "" : period); setManual("flex_duration", duration);
  }

  if (formData.has("project_title")) {
    patch.trip_summary = get("project_title"); setIntake("project_notes_short", get("project_title")); setManual("project_title", get("project_title"));
  }
  if (formData.has("notes")) {
    patch.project_description = get("notes") || null; setIntake("notes_longues", get("notes")); setManual("notes_longues", get("notes"));
  }
  if (formData.has("vision")) {
    patch.travel_style = get("vision") || "—"; patch.travel_desire_narrative = get("vision") || null;
    setIntake("vision", get("vision")); setManual("vision", get("vision"));
  }
  if (formData.has("hebergements")) {
    const value = get("hebergements");
    const oldLines = String(current.qualification_summary || "").split("\n").filter(line => !line.startsWith("Hébergements :"));
    patch.qualification_summary = [...oldLines, value ? `Hébergements : ${value}` : ""].filter(Boolean).join("\n") || "—";
    setIntake("hebergements", value); setFact("accommodation", value); setManual("hebergements", value);
  }

  if (formData.has("budget_ideal") || formData.has("budget_max_field")) {
    const ideal = get("budget_ideal"), maximum = get("budget_max_field");
    const validAmount = (value: string) => !value || /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0;
    if (!validAmount(ideal) || !validAmount(maximum) || ideal && maximum && Number(ideal) > Number(maximum)) return { ok: false, error: "Vérifiez la fourchette de budget." };
    const currency = get("budget_currency"), unit = get("budget_unit");
    if (currency && !["EUR", "USD", "DZD", "GBP"].includes(currency)) return { ok: false, error: "Devise invalide." };
    if (unit && !["per_person", "total"].includes(unit)) return { ok: false, error: "Unité de budget invalide." };
    patch.currency = "EUR"; // Constraint in the legacy financial columns.
    patch.budget_min = currency === "EUR" && ideal ? Number(ideal) : null;
    patch.budget_max = currency === "EUR" && maximum ? Number(maximum) : null;
    patch.budget_unit = unit || null;
    const amountText = [ideal, maximum].filter(Boolean).join("–");
    patch.budget = amountText ? `${amountText} ${currency || "devise à confirmer"} ${unit === "per_person" ? "/ pers." : unit === "total" ? "au total" : "(unité à confirmer)"}` : "—";
    setFact("budget_min", ideal ? Number(ideal) : null); setFact("budget_max", maximum ? Number(maximum) : null);
    setFact("currency", currency); setFact("budget_unit", unit);
    setIntake("budget_ideal", ideal); setIntake("budget_max", maximum); setIntake("currency", currency);
    setIntake("budget_total", unit === "total" ? ideal || maximum : "");
    setManual("budget_ideal", ideal); setManual("budget_max", maximum); setManual("currency", currency); setManual("budget_unit", unit);
  }

  if (payloadChanged) {
    intake.qualification_facts = facts;
    if (hasManual) intake.manual_qualification = manual;
    patch.intake_payload = intake; // source_message is copied unchanged, never taken from FormData.
  }
  return { ok: true, patch };
}
