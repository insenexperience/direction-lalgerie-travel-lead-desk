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

const naturalMessage = "Bonjour, je suis Camille Exemple (camille@example.test). Nous souhaitons visiter Alger et Tipaza du 7 au 11 octobre 2027 : 2 adultes et 2 enfants de 6 et 9 ans, 2 chambres doubles, hôtels 4 étoiles. Budget 2000 € par personne hors vols. Nous réserverons nos vols nous-mêmes. Merci.";
const natural = extractManualLeadFallback(naturalMessage);
assert.equal(natural.full_name, "Camille Exemple");
assert.equal(natural.email, "camille@example.test");
assert.equal(natural.travelers_adults, "2");
assert.equal(natural.travelers_children, "2");
assert.equal(natural.travellers_count, "4");
assert.equal(natural.children_ages, "6, 9");
assert.equal(natural.rooms, "2 chambres doubles");
assert.equal(natural.date_start, "2027-10-07");
assert.equal(natural.date_end, "2027-10-11");
assert.equal(natural.flex_period, "du 7 au 11 octobre 2027");
assert.equal(natural.budget_ideal, "2000");
assert.equal(natural.budget_max, "", "Do not invent a maximum from a stated budget");
assert.equal(natural.currency, "EUR");
assert.equal(natural.budget_unit, "per_person");
assert.equal(natural.budget_includes_flights, "no");
assert.equal(natural.flights, "excluded");
assert.equal(natural.hebergements, "hôtels 4 étoiles");
assert.equal(natural.destination_main, "Alger et Tipaza");
assert.equal(natural.notes_longues.replace(/\s+/g, " "), naturalMessage);
assert(natural.notes_longues.includes("\n\n"), "Every original sentence is retained in airy paragraphs");
const naturalRow = buildManualLeadInsert(natural, naturalMessage, { submissionId: "00000000-0000-4000-8000-000000000003", channel: "email" });
assert.equal(naturalRow.intake_payload.source_message, naturalMessage);
assert.equal(naturalRow.project_description, natural.notes_longues);
assert.equal(naturalRow.intake_payload.qualification_facts.room_distribution, "2 chambres doubles");

const noYear = extractManualLeadFallback("Nous souhaitons visiter Alger du 7 au 11 octobre. Nous serons 2 adultes.");
assert.equal(noYear.flex_period, "du 7 au 11 octobre");
assert.equal(noYear.date_start, "");
assert.equal(noYear.date_end, "");
assert.equal(noYear.travelers_adults, "2");
assert.equal(noYear.travelers_children, "", "Adults alone never imply zero children");
assert.equal(noYear.travellers_count, "");
for (const ambiguous of [
  "Nous serons 2 ou 3 adultes et 2 enfants de 6 à 9 ans, 2 chambres doubles ou triples. Budget 2000 ou 3000 € par personne ?",
  "Peut-être 2 adultes et 2 enfants, 2 chambres doubles. Budget 2000 € par personne à confirmer.",
  "Nous envisageons entre 2 et 3 adultes. Souhaitez-vous 2 chambres doubles ? Budget non indiqué pour 2 adultes.",
  "Nous ne souhaitons pas 2 chambres doubles, hôtels 4 étoiles. Budget : pas 2000 €."
]) {
  const parsed = extractManualLeadFallback(ambiguous);
  assert.equal(parsed.travelers_adults, "", ambiguous);
  assert.equal(parsed.travelers_children, "", ambiguous);
  assert.equal(parsed.children_ages, "", ambiguous);
  assert.equal(parsed.rooms, "", ambiguous);
  assert.equal(parsed.budget_ideal, "", ambiguous);
  assert.equal(parsed.hebergements, "", ambiguous);
  assert.equal(parsed.notes_longues.replace(/\s+/g, " "), ambiguous);
}
const ageMismatch = extractManualLeadFallback("Nous serons 2 adultes et 2 enfants de 6 ans, 1 chambre familiale.");
assert.equal(ageMismatch.children_ages, "", "One age does not complete two children");
const conflictingCounts = extractManualLeadFallback("Nous serons 2 adultes. Nous serons 3 adultes.");
assert.equal(conflictingCounts.travelers_adults, "", "Conflicting declarations remain unresolved");
assert.equal(extractManualLeadFallback("Nous serons 2 adultes du 7 au 11 février 2027.").date_start, "2027-02-07");
assert.equal(extractManualLeadFallback("Nous serons 2 adultes du 30 au 31 février 2027.").date_start, "");
const conflictingRooms = extractManualLeadFallback("Nous souhaitons 1 chambre double et 1 single. Finalement 2 doubles.");
assert.equal(conflictingRooms.rooms, "", "Do not merge contradictory room counts into a confirmed allocation");
assert.equal(conflictingRooms.notes_longues.replace(/\s+/g, " "), "Nous souhaitons 1 chambre double et 1 single. Finalement 2 doubles.");
assert.equal(extractManualLeadFallback("Nous souhaitons 2 chambres doubles. Deux adultes partageront les 2 doubles.").rooms, "2 chambres doubles", "Repeating the same allocation must not double its capacity");
assert.equal(extractManualLeadFallback("Budget 2.000 € par personne.").budget_ideal, "", "Never read a partial amount from an ambiguous numeric format");
assert.equal(extractManualLeadFallback("Budget 2 millions DZD.").budget_ideal, "", "Magnitude words must not be discarded");
const longMessage = "Je souhaite organiser un voyage dont toutes les nombreuses conditions et options doivent rester conservées ".repeat(4) + ". Une autre phrase utile.";
const longFallback = extractManualLeadFallback(longMessage);
assert(longFallback.project_title.length <= 120);
assert.equal(longFallback.notes_longues.replace(/\s+/g, " "), longMessage);

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
