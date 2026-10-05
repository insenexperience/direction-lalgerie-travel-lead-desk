/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS runner transpiles TS modules without a build. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

function loadModule(relative) {
  const filename = path.join(__dirname, "..", relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = id => id.startsWith("@/") ? loadModule(`src/${id.slice(2)}.ts`) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { normalizeManualLeadDraft, extractManualLeadFallback, buildManualLeadInsert, manualLeadUnknownFields } = loadModule("src/lib/manual-lead-import.ts");
const { buildLeadDetailsPatch } = loadModule("src/lib/lead-details-patch.ts");

const friends = extractManualLeadFallback("Prénom : Malika ACHOUI\nVoyageurs : Entre amis\nMois : Octobre\nDates : 7 au 11\nDurée : 2–4 jours");
assert.equal(friends.full_name, "Malika ACHOUI");
assert.equal(friends.travellers_count, "");
assert.equal(friends.travelers_adults, "");
assert.equal(friends.travelers_children, "");
assert.equal(friends.date_start, "");
assert.equal(friends.language, "fr");
assert(manualLeadUnknownFields(friends).includes("Participants"));

const solo = extractManualLeadFallback("Expedition leader: Jamie Hargreaves\nSolo foot travel\nProposed dates: Late January – February 2027");
assert.equal(solo.travellers_count, "1");
assert.equal(solo.travelers_children, "0");
assert.equal(solo.language, "en");
assert.equal(extractManualLeadFallback("Prénom : Jamie\nJe suis britannique et je souhaite visiter le Sahara.").language, "fr");
assert(!manualLeadUnknownFields(solo).includes("Participants"));
assert(!manualLeadUnknownFields(solo).includes("Âge des enfants"));

const invalid = normalizeManualLeadDraft({ date_start: "2027-02-30", date_end: "7 octobre", travelers_adults: "4 à 6", budget_ideal: "non indiqué", flights: "oui" });
assert.equal(invalid.date_start, "");
assert.equal(invalid.date_end, "");
assert.equal(invalid.travelers_adults, "");
assert.equal(invalid.budget_ideal, "");
assert.equal(invalid.flights, "");
assert.equal(normalizeManualLeadDraft({ budget_includes_flights: "unknown" }).budget_includes_flights, "");

for (const [source, expected] of [
  ["Budget : 2 000 € par personne, hors vols", "no"],
  ["Mon budget est 2000 euros sans les vols.", "no"],
  ["Budget: GBP 2000 per person, not including flights", "no"],
  ["Budget: USD 3000 total including flights", "yes"],
  ["Budget : 2500 €, vols inclus", "yes"],
  ["Budget : 2500 €, vols inclus ou hors vols ?", ""],
  ["Budget : 2500 €, hors vols, à confirmer", ""],
  ["Les vols sont inclus.\nBudget : à définir", ""],
]) {
  const fallback = extractManualLeadFallback(source);
  assert.equal(fallback.budget_includes_flights, expected, source);
  assert.equal(fallback.flights, "", "Budget scope must never decide who books flights");
}

for (const [scope, expected] of [["yes", true], ["no", false], ["", null]]) {
  const scopedDraft = normalizeManualLeadDraft({ ...friends, budget_ideal: "2000", budget_max: "2400", budget_unit: "total", currency: "USD", budget_includes_flights: scope });
  const scopedRow = buildManualLeadInsert(scopedDraft, "Original", { submissionId: "00000000-0000-4000-8000-000000000002", channel: "email" });
  assert.equal(scopedRow.intake_payload.qualification_facts.budget_includes_flights, expected);
  assert.equal(scopedRow.intake_payload.manual_qualification.budget_includes_flights, scope);
  assert.equal(scopedRow.intake_payload.qualification_facts.budget_min, 2000);
  assert.equal(scopedRow.intake_payload.qualification_facts.budget_max, 2400);
  assert.equal(scopedRow.intake_payload.qualification_facts.budget_unit, "total");
  assert.equal(scopedRow.intake_payload.qualification_facts.currency, "USD");
  assert.equal(manualLeadUnknownFields(scopedDraft).includes("Périmètre du budget"), scope === "");
}

const raw = "Full source\r\nAll original questions?\r\nOptions A and B.\r\n";
const row = buildManualLeadInsert({ ...friends, notes_longues: "Retranscription complète", budget_ideal: "3 000", currency: "USD", budget_unit: "total" }, raw, { submissionId: "00000000-0000-4000-8000-000000000001", channel: "email" });
assert.equal(row.intake_payload.source_message, raw);
assert.equal(row.intake_channel, "email");
assert.equal(row.intake_payload.language, "fr");
assert.equal(row.source, "Import manuel — email");
assert(row.project_description.includes("Retranscription complète"));
assert.equal(row.project_description, "Retranscription complète");
assert(!row.project_description.includes("À CLARIFIER"));
assert.equal(row.intake_payload.qualification_facts.travelers_adults, null);
assert.equal(row.intake_payload.qualification_facts.travelers_children, null);
assert.equal(row.travelers_adults, 0);
assert.equal(row.budget_min, null); // EUR-only columns must not receive an unconverted USD amount.
assert.equal(row.intake_payload.qualification_facts.budget_min, 3000);
assert.equal(row.intake_payload.qualification_facts.currency, "USD");
assert.equal(row.currency, "EUR");
assert(row.budget.includes("USD"));

const current = {
  travelers: "Entre amis — 3 voyageurs", travelers_adults: 1, travelers_children: 0,
  trip_summary: "Titre court", project_description: "Notes initiales", qualification_summary: "Patrimoine antique",
  intake_payload: { source_message: raw, notes_longues: "Notes initiales", qualification_facts: { travelers_adults: null, travelers_children: null, flight_mode: "already_booked", room_distribution: "1 twin, 1 single" } },
};
const contactOnly = new FormData();
contactOnly.set("traveler_name", "Malika ACHOUI"); contactOnly.set("phone", "+33600000000");
const unchanged = buildLeadDetailsPatch(current, contactOnly);
assert(unchanged.ok);
assert(!("intake_payload" in unchanged.patch));
assert(!("travelers_adults" in unchanged.patch));
assert(!("budget" in unchanged.patch));

const edited = new FormData();
edited.set("traveler_name", "Malika ACHOUI"); edited.set("notes", "Notes aérées et complètes");
edited.set("project_title", "Titre corrigé"); edited.set("people", "4");
edited.set("budget_ideal", "150000"); edited.set("budget_max_field", "200000");
edited.set("budget_currency", "DZD"); edited.set("budget_unit", "total");
const updated = buildLeadDetailsPatch(current, edited);
assert(updated.ok);
assert.equal(updated.patch.project_description, "Notes aérées et complètes");
assert.equal(updated.patch.trip_summary, "Titre corrigé");
assert.equal(updated.patch.intake_payload.source_message, raw);
assert.equal(updated.patch.intake_payload.qualification_facts.flight_mode, "already_booked");
assert.equal(updated.patch.intake_payload.qualification_facts.room_distribution, "1 twin, 1 single");
assert.equal(updated.patch.intake_payload.travellers_count, "4");
assert(!("travelers_adults" in updated.patch));
assert(!("travelers_children" in updated.patch));
assert.equal(updated.patch.intake_payload.qualification_facts.travelers_children, null);
assert.equal(updated.patch.budget_min, null);
assert.equal(updated.patch.budget_max, null);
assert.equal(updated.patch.budget_unit, "total");
assert.equal(updated.patch.intake_payload.qualification_facts.budget_min, 150000);
assert.equal(updated.patch.intake_payload.qualification_facts.currency, "DZD");
assert.equal(updated.patch.budget, "150000–200000 DZD au total");

const conflict = buildLeadDetailsPatch({ ...current, intake_payload: { qualification_facts: { travelers_adults: 2, travelers_children: 1 } } }, edited);
assert(!conflict.ok);

const exactDates = new FormData();
exactDates.set("traveler_name", "Malika ACHOUI"); exactDates.set("dates_mode", "exact");
exactDates.set("date_start", "2027-10-07"); exactDates.set("date_end", "2027-10-11");
const dated = buildLeadDetailsPatch(current, exactDates);
assert(dated.ok);
assert.equal(dated.patch.intake_payload.qualification_facts.travel_period, "2027-10-07 → 2027-10-11");
const { analyzeLeadQualification } = loadModule("src/lib/lead-qualification-completeness.ts");
assert(!analyzeLeadQualification({ ...current, ...dated.patch }).questions.some(q => q.id === "dates"));

console.log("Manual import and edits: unknown group/year, solo counts, source retention, unchanged facts, participant totals and currency preservation passed.");
