/* eslint-disable @typescript-eslint/no-require-imports -- Isolated TypeScript loader; no DB or notifications. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

function load(relative) {
  const filename = path.join(__dirname, "..", relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = id => id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const { readDemandeProjet } = load("src/lib/demande-projet-intake.ts");
const { buildIntakeRecordFromBody, buildLeadInsertFromIntake } = load("src/lib/intake-lead-insert.ts");
const { analyzeLeadQualification } = load("src/lib/lead-qualification-completeness.ts");
const body = () => ({
  full_name: "Essai parcours", email: "essai@example.invalid", submission_id: "test-demande",
  group_type: "En famille", travellers_count: "4", dates_mode: "flexible",
  flex_month: "novembre ou décembre 2026 ou jan", flex_duration: "Dix jours",
  vision: "Nature & grand air · Culture & patrimoine", hebergements: "Bon confort",
  page_origin: "/demande-projet?depuis=envies", notes_longues: "Ancien résumé partiel",
  trame: {
    version: 1, type: "demande-projet-voyage", creeLe: "2026-10-23T12:00:00.000Z",
    entree: { depuis: "envies:djanet", page: "/demande-projet?depuis=envies" },
    ou: { jeNeSaisPas: false, superRegions: ["grand-sud"], territoires: ["djanet"], noms: ["Djanet"] },
    quand: { mode: "mois", mois: ["2026-11", "2026-12", "2027-01", "2027-02"], dates: null, duree: "Dix jours" },
    voyageurs: { type: "En famille", adultes: 2, enfants: 2 },
    envies: {
      selection: [
        { cle: "villes:djanet", nom: "Djanet" }, { cle: "experiences:sebeiba", nom: "La Sebeiba" },
        { cle: "activites:plongee", nom: "Plongée" }, { cle: "circuits:grand-sud", nom: "Voyage au Grand Sud" },
      ],
      manieres: ["nature", "culture"], libelles: ["Nature & grand air", "Culture & patrimoine"],
      confort: "Bon confort", message: "Nous souhaitons adapter le rythme aux enfants.",
    },
    contact: { prenom: "Essai", nom: "parcours", email: "essai@example.invalid", paysResidence: "France", canal: "WhatsApp" },
    accord: { accepte: true, texte: "Accord de contact", horodatage: "2026-10-23T12:00:01.000Z" },
    futur: { garde: "champ inconnu à conserver" },
  },
});
const lead = input => buildLeadInsertFromIntake(buildIntakeRecordFromBody(input));

test("all mixed wishlist choices, original fields and consent survive unchanged", () => {
  const input = body(), before = JSON.stringify(input), row = lead(input);
  assert.deepEqual(row.intake_payload.trame, input.trame);
  assert.equal(JSON.stringify(input), before);
  assert.equal(row.intake_payload.trame.envies.selection.length, 4);
  for (const wish of input.trame.envies.selection) {
    assert(row.project_description.includes(wish.nom));
    assert(row.project_description.includes(wish.cle));
    assert(row.travel_desire_narrative.includes(wish.nom));
  }
  assert.equal(row.destination_main, "Djanet");
  assert.equal(row.budget, "—");
  assert.equal(row.planning_stage, null);
  assert.equal(row.preferred_channel, "whatsapp");
});

test("complete month/year calendar wins over the relay's truncated flat summary", () => {
  const row = lead(body());
  assert.equal(row.travel_period, "novembre 2026 ou décembre 2026 ou janvier 2027 ou février 2027");
  assert.equal(row.trip_dates, `${row.travel_period} · Dix jours`);
  assert.equal(row.travel_start_date, null);
  assert.equal(row.travel_end_date, null);
  assert.equal(row.intake_payload.qualification_facts.travel_period, row.travel_period);
});

test("explicit group composition and preferences become qualification facts", () => {
  const row = lead(body());
  assert.equal(row.travelers_adults, 2);
  assert.equal(row.travelers_children, 2);
  assert.equal(row.travelers, "En famille · 2 adultes · 2 enfants");
  assert.deepEqual(row.intake_payload.qualification_facts, {
    travelers_adults: 2, travelers_children: 2, duration: "Dix jours",
    travel_period: row.travel_period, accommodation: "Bon confort",
  });
  assert.equal(row.travel_style, "Nature & grand air · Culture & patrimoine");
  assert(row.qualification_summary.includes("Hébergements : Bon confort"));
});

test("exact dates preserve approximate-day intent and duration", () => {
  const input = body();
  input.trame.quand = { mode: "dates", mois: [], dates: { arrivee: "2027-02-20", depart: "2027-03-02", aQuelquesJoursPres: true }, duree: "Dix jours" };
  const row = lead(input);
  assert.equal(row.travel_start_date, "2027-02-20");
  assert.equal(row.travel_end_date, "2027-03-02");
  assert.equal(row.travel_period, null);
  assert.equal(row.trip_dates, "2027-02-20 → 2027-03-02, à quelques jours près · Dix jours");
});

test("an undecided request keeps wishes without inventing destination, date or qualification", () => {
  const input = body();
  input.trame.ou = { jeNeSaisPas: true, superRegions: [], territoires: [], noms: [] };
  input.trame.quand = { mode: "nsp", mois: [], dates: null, duree: "Je ne sais pas encore" };
  input.trame.envies.confort = "Je ne sais pas encore";
  const row = lead(input);
  assert.equal(row.destination_main, null);
  assert.equal(row.travel_start_date, null);
  assert.equal(row.travel_period, null);
  assert(!("duration" in row.intake_payload.qualification_facts));
  assert(!("itinerary" in row.intake_payload.qualification_facts));
  assert(!("accommodation" in row.intake_payload.qualification_facts));
  assert.equal(row.intake_payload.trame.envies.selection.length, 4);
});

test("region-only requests retain geographic context including older trames", () => {
  const input = body();
  input.trame.ou = { jeNeSaisPas: false, superRegions: ["centre", "grand-sud"], territoires: [], noms: [] };
  let row = lead(input);
  assert.equal(row.destination_main, "Le Centre");
  assert(row.project_description.includes("Le Centre · Le Grand Sud"));
  input.trame.ou.nomsSuperRegions = ["Libellé exact du catalogue", "Le Grand Sud"];
  row = lead(input);
  assert.equal(row.destination_main, "Libellé exact du catalogue");
  input.trame.ou = { jeNeSaisPas: false, territoires: ["ancien-territoire"] };
  assert.equal(lead(input).destination_main, "ancien-territoire");
});

test("historical flat and composeur payloads keep their existing mapping", () => {
  const input = { full_name: "Ancien formulaire", email: "ancien@example.invalid", submission_id: "ancien", dates_mode: "flexible", flex_period: "Printemps", vision: "Randonnée", group_type: "Entre amis", travellers_count: "3", trame: { type: "composeur", ou: { noms: ["Alger"] } } };
  const row = lead(input);
  assert.equal(readDemandeProjet(input), null);
  assert.equal(row.travel_style, "Randonnée");
  assert.equal(row.travelers, "Entre amis · 3 voyageur(s)");
  assert.equal(row.trip_dates, "Printemps");
  assert.equal(row.destination_main, "Alger");
  assert.equal(row.project_description, null);
  assert.deepEqual(row.intake_payload.trame, input.trame);
});

test("malformed optional objects cannot create invalid typed DB values", () => {
  const input = body();
  input.trame.quand = { mode: "dates", dates: { arrivee: "2027-02-30", depart: "invalid" } };
  input.trame.voyageurs = { adultes: -3, enfants: "2" };
  input.trame.envies = { selection: [null, 7, {}, { cle: "ancienne:inconnue" }, { nom: "Envie conservée sans clé" }], libelles: {}, manieres: null };
  const projection = readDemandeProjet(input), row = lead(input);
  assert.equal(projection.timing.start, null);
  assert.equal(projection.travelers.adults, null);
  assert.equal(projection.travelers.children, null);
  assert.equal(projection.wishes.selection.length, 2);
  assert.equal(row.travel_start_date, null);
  assert.equal(row.travel_end_date, null);
  assert.deepEqual(row.intake_payload.trame, input.trame);
  input.trame.quand.dates = { arrivee: "2027-05-10", depart: "2027-05-01" };
  assert.equal(lead(input).travel_start_date, null);
});

test("the reader does not silently truncate long wish lists", () => {
  const input = body();
  input.trame.envies.selection = Array.from({ length: 301 }, (_, i) => ({ cle: `lieux:essai-${i}`, nom: `Envie ${i}` }));
  const row = lead(input), projection = readDemandeProjet(row.intake_payload);
  assert.equal(projection.wishes.selection.length, 301);
  assert(row.project_description.includes("Envie 300 (lieux:essai-300)"));
});

test("unknown request versions retain added fields; unrelated payloads are not interpreted", () => {
  const input = body(); input.trame.version = 2;
  assert.equal(lead(input).intake_payload.trame.futur.garde, "champ inconnu à conserver");
  for (const value of [null, [], {}, { trame: [] }, { trame: { type: "autre" } }]) assert.equal(readDemandeProjet(value), null);
});

test("qualification uses known request answers without repeating group, calendar or comfort questions", () => {
  // Also covers previously stored requests before the new scalar mapping existed.
  const analysis = analyzeLeadQualification({ intake_payload: body() });
  const questions = analysis.questions.map(q => q.id);
  for (const id of ["participants", "dates", "duration", "accommodation"]) assert(!questions.includes(id), id);
  assert(questions.includes("children_ages"));
  assert(questions.includes("budget"));
  assert.equal(analysis.readyForAgencyBrief, false);
});

test("unknown request period, duration and comfort remain to qualify", () => {
  const input = body();
  input.trame.quand = { mode: "nsp", mois: [], dates: null, duree: "Je ne sais pas encore" };
  input.trame.envies.confort = "Je ne sais pas encore";
  input.hebergements = "Je ne sais pas encore";
  input.flex_duration = "Je ne sais pas encore";
  input.flex_month = "";
  const analysis = analyzeLeadQualification(lead(input));
  assert(analysis.questions.some(q => q.id === "dates"));
  assert(analysis.questions.some(q => q.id === "accommodation"));
  assert.notEqual(analysis.checklist.find(q => q.id === "duration").status, "complete");
  assert(!analysis.questions.find(q => q.id === "dates").question.includes("déjà indiquées"));
  input.trame.quand = { mode: "mois", mois: ["2027-05"], dates: null, duree: "Je ne sais pas encore" };
  const knownMonths = analyzeLeadQualification(lead(input));
  assert(knownMonths.questions.some(q => q.id === "duration"));
  assert(!knownMonths.questions.some(q => q.id === "dates"));
});

test("operator and traveler refinements take precedence over original request unknowns", () => {
  const input = body();
  input.trame.quand = { mode: "nsp", mois: [], dates: null, duree: "Je ne sais pas encore" };
  input.trame.envies.confort = "Je ne sais pas encore";
  const row = lead(input);
  row.traveler_responses = { qualification_facts: { duration: "8 jours", accommodation: "Maisons d’hôtes", travel_period: "Mai 2027", travelers_adults: 3, travelers_children: 0 } };
  const analysis = analyzeLeadQualification(row);
  for (const id of ["participants", "dates", "duration", "accommodation"]) assert(!analysis.questions.some(q => q.id === id), id);
  assert.equal(row.intake_payload.trame.quand.mode, "nsp");
  assert.equal(row.intake_payload.trame.envies.confort, "Je ne sais pas encore");
});

test("qualification behavior of historical flat sources is unchanged", () => {
  const analysis = analyzeLeadQualification({ intake_payload: { flex_month: "Mai 2027", flex_duration: "Je ne sais pas encore", hebergements: "Je ne sais pas encore" } });
  for (const id of ["dates", "duration", "accommodation"]) assert.equal(analysis.checklist.find(q => q.id === id).status, "complete");
});

test("cleared calendar facts do not revive the original request's dates", () => {
  const input = body();
  input.trame.quand = { mode: "dates", mois: [], dates: { arrivee: "2027-02-20", depart: "2027-03-02" }, duree: "Dix jours" };
  const row = lead(input);
  row.intake_payload.qualification_facts.travel_period = "";
  row.travel_start_date = null; row.travel_end_date = null; row.travel_period = null; row.trip_dates = "—";
  const analysis = analyzeLeadQualification(row);
  assert(analysis.questions.some(q => q.id === "dates"));
  assert.equal(row.intake_payload.trame.quand.dates.arrivee, "2027-02-20");
});


test("production flat fallbacks retain project notes, flexible period and total budget", () => {
  const row = lead({ full_name: "Historical", email: "historical@example.invalid", submission_id: "legacy", flex_period: "Printemps 2027", budget_total: "2000 EUR total", notes_longues: "Message complet", trame: { nom: "Circuit historique" } });
  assert.equal(row.trip_summary, "Circuit historique");
  assert.equal(row.project_description, "Message complet");
  assert.equal(row.trip_dates, "Printemps 2027");
  assert.equal(row.budget, "2000 EUR total");
  assert.equal(row.internal_notes, "");
  const bounded = buildIntakeRecordFromBody({ trame: { contenu: "x".repeat(60001) } });
  assert.equal(bounded.trame, null);
});

test("new request defaults do not override later BO3 operator trame or cleared canonical facts", () => {
  const input = body();
  const analysis = analyzeLeadQualification({ intake_payload: input, ai_qualification_payload: { trame_v3: {
    jours: [], groupe: { type: "amis", nombre: 3, enfants: 0 }, cadre: { mois: "mars 2028", duree: "8 jours", hebergement: "Maison d’hôtes" },
  } } });
  assert.match(analysis.checklist.find(q => q.id === "participants").value, /3 adulte/);
  assert.equal(analysis.checklist.find(q => q.id === "dates").value, "mars 2028");
  assert.equal(analysis.checklist.find(q => q.id === "accommodation").value, "Maison d’hôtes");
  input.qualification_facts = { travelers_adults: null, travelers_children: null, accommodation: "", travel_period: "", duration: "" };
  const cleared = analyzeLeadQualification({ intake_payload: input });
  for (const id of ["participants", "dates", "accommodation"]) assert(cleared.missingRequired.includes(id), id);
});
