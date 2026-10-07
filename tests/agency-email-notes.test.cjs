/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS runner transpiles TS modules without a build. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const cache = new Map();

function loadModule(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = id => id.startsWith("@/") ? loadModule(`src/${id.slice(2)}.ts`)
    : id.startsWith(".") ? loadModule(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(filename), `${id}.ts`)))
    : require(id);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { buildLeadEmailTemplate, agencyTravelNotes, isAgencyEmailKind } = loadModule("src/lib/email/lead-email-template.ts");
const { generateBrief } = loadModule("src/lib/brief/generate-brief.ts");
const { buildManualLeadInsert } = loadModule("src/lib/manual-lead-import.ts");

const lead = {
  traveler_name: "Jamie Hargreaves", email: "traveler@example.test", phone: "+447700900123",
  reference: "DA-TEST", travelers: "Solo — 1 voyageur", trip_dates: "Janvier–février 2027",
  budget: "À préciser", travel_style: "Unsupported foot traverse", trip_summary: "Étude de faisabilité Sahara",
  destination_main: "Djanet ou Tamanrasset", qualification_notes: null, qualification_blocks: null,
  project_description: "Demandeur : Jamie Hargreaves. Contact : traveler@example.test, +447700900123.\n" +
    "Expérience déclarée : 25 000 km à vélo et expéditions en Asie.\n" +
    "Option A : Djanet → Tamanrasset, 600 km. Option B : Tamanrasset → Tefedest → In Salah, 700–900 km.\n" +
    "Questions : visa ; autorisations militaires ; fiabilité des puits ; autonomie sans ravitaillement alimentaire.\n" +
    "Instagram communiqué : @explorer_private.\nInstagram : https://www.instagram.com/explorer_private",
};
const brief = generateBrief(lead);
for (const body of [brief, buildLeadEmailTemplate(lead, "agency_brief").bodyText]) {
  for (const fact of ["25 000 km", "Tefedest", "700–900 km", "visa", "autorisations militaires", "puits", "sans ravitaillement"]) {
    assert(body.includes(fact), `Agency content must retain ${fact}`);
  }
  for (const privateValue of [lead.traveler_name, "Jamie", "Hargreaves", lead.email, lead.phone, "explorer_private"]) {
    assert(!body.includes(privateValue), `Agency content leaked ${privateValue}`);
  }
}
assert(brief.includes("sous 48 h"));
const withGenerated = buildLeadEmailTemplate({ ...lead, generated_brief: brief }, "agency_brief").bodyText;
assert.equal(withGenerated.split("Expérience déclarée :").length - 1, 1, "Already included detailed notes must not be duplicated");
assert.equal(agencyTravelNotes({ ...lead, project_description: "", intake_payload: { notes_longues: lead.project_description } }), agencyTravelNotes(lead));

const imported = buildManualLeadInsert({ full_name: "Jamie Hargreaves", email: lead.email, language: "en", notes_longues: lead.project_description }, "Dear team, I would like to plan a traverse.", { submissionId: "00000000-0000-4000-8000-000000000001", channel: "email" });
assert.equal(imported.intake_payload.language, "en");
const welcome = buildLeadEmailTemplate(imported, "welcome");
assert.equal(welcome.language, "en");
assert(welcome.bodyText.startsWith("Dear Jamie,"));
assert.equal(buildLeadEmailTemplate(imported, "agency_brief").language, "fr");

assert.equal(isAgencyEmailKind("agency_feasibility"), true);
assert.equal(isAgencyEmailKind("agency_brief"), true);
for (const kind of ["welcome", "qualification", "feasibility", "", null, undefined, {}]) {
  assert.equal(isAgencyEmailKind(kind), false, `Unexpected agency kind: ${String(kind)}`);
}

const generatedSalesBrief = "DEVIS EXISTANT : prix 9 999 EUR, retour sous 48 h, CIRCUIT COMMERCIAL OBSOLÈTE.";
const feasibility = buildLeadEmailTemplate({ ...lead, generated_brief: generatedSalesBrief, preferred_language: "en" }, "agency_feasibility", { language: "en" });
assert.equal(feasibility.language, "fr", "Agency studies remain in French even for English-language travelers");
assert(feasibility.subject.includes("Étude de faisabilité non chiffrée"));
assert(feasibility.subject.includes(lead.reference));
assert(feasibility.html.includes("Étude de faisabilité non chiffrée"), "The email masthead must identify the study stage");
assert(feasibility.html.includes('alt="Direction l’Algérie"'), "The study uses the Direction l’Algérie logo");
for (const content of [feasibility.bodyText, feasibility.html]) {
  for (const fact of ["25 000 km", "Tefedest", "700–900 km", "visa", "autorisations militaires", "puits", "sans ravitaillement"]) {
    assert(content.includes(fact), `Feasibility content must retain ${fact}`);
  }
  for (const privateValue of [lead.traveler_name, "Jamie", "Hargreaves", lead.email, lead.phone, "explorer_private"]) {
    assert(!content.includes(privateValue), `Feasibility content leaked ${privateValue}`);
  }
  for (const staleSalesText of ["DEVIS EXISTANT", "9 999", "sous 48 h", "CIRCUIT COMMERCIAL OBSOLÈTE"]) {
    assert(!content.includes(staleSalesText), `First study must not reuse a generated sales brief: ${staleSalesText}`);
  }
}
for (const expectation of ["faisabilité du projet sur le terrain", "étapes, ordre des visites", "temps de déplacement estimés", "rythme adapté", "contraintes de saison", "d’autorisations", "alternatives concrètes", "points à clarifier", "délai nécessaire", "après validation du parcours", "fiabilité de l’eau", "solutions de repli"]) {
  assert(feasibility.bodyText.includes(expectation), `First study must request ${expectation}`);
}
assert(feasibility.bodyText.includes("Informations inconnues ou restant à confirmer"));
assert(feasibility.bodyText.includes("Budget : à confirmer"), "Unknown budget is explicitly labeled instead of inferred");
assert.equal(feasibility.analysis.readyForAgencyBrief, false, "An incomplete lead can already have a first feasibility draft");
assert(!feasibility.html.includes("Écrire à notre équipe"), "Agency emails do not inherit the traveler contact CTA");

const culturalStudy = buildLeadEmailTemplate({
  traveler_name: "Malika Achoui", email: "malika@example.test", phone: "0612345678", reference: "DA-CULTURE",
  trip_summary: "Alger, Tipaza et les sites antiques", destination_main: "Alger et Tipaza", travel_style: "Culture",
  project_description: "Malika Achoui souhaite découvrir les sites antiques avec deux adultes. Garder du temps libre pour les promenades.",
  generated_brief: generatedSalesBrief,
  intake_payload: { qualification_facts: { adults: 2, children: 0, budget_amount: 2000, currency: "EUR", budget_unit: "per_person", budget_includes_flights: false } },
}, "agency_feasibility");
assert(culturalStudy.bodyText.includes("2000 EUR par personne"), "A confirmed traveler budget remains a planning constraint in readable French");
assert(culturalStudy.bodyText.includes("Périmètre du budget : Hors vols"));
assert(culturalStudy.bodyText.includes("sert uniquement de contrainte de conception"));
assert(culturalStudy.bodyText.includes("aucune offre tarifaire n’est attendue"));
assert(culturalStudy.bodyText.includes("Précisions confirmées dans le dossier"));
assert(culturalStudy.bodyText.includes("Répartition des chambres : à confirmer"), "Missing room allocation is marked as unknown");
assert(!culturalStudy.bodyText.includes("Pour ce projet d’expédition"), "Expedition instructions are conditional");
assert(culturalStudy.bodyText.includes("temps libre"), "Specific traveler wishes survive the summarized project");
assert(!culturalStudy.bodyText.includes("Malika"));

const sourceOnlyStudy = buildLeadEmailTemplate({
  traveler_name: "Jamie Hargreaves", email: lead.email, reference: "DA-SOURCE",
  intake_payload: { source_message: `Bonjour, Jamie Hargreaves ici (${lead.email}). Je voudrais découvrir Tipaza et garder une journée de repos.` },
}, "agency_feasibility");
assert(sourceOnlyStudy.bodyText.includes("une journée de repos"), "The original message is retained if no reformatted notes exist yet");
assert(!sourceOnlyStudy.bodyText.includes(lead.email));
assert(!sourceOnlyStudy.bodyText.includes("Jamie"));
const editedStudy = buildLeadEmailTemplate(lead, "agency_feasibility", { bodyText: `Bonjour, étudiez Tefedest pour Jamie Hargreaves (${lead.email}). <script>alert(1)</script>` });
assert(!editedStudy.bodyText.includes("Jamie"), "Edited feasibility text remains anonymized");
assert(!editedStudy.html.includes("<script>"), "Operator text stays escaped in the HTML email");
assert(editedStudy.html.includes("&lt;script&gt;"));

const pricedBrief = buildLeadEmailTemplate({ ...lead, generated_brief: generatedSalesBrief }, "agency_brief");
assert(pricedBrief.bodyText.includes("9 999 EUR"), "The existing commercial agency brief remains unchanged");
assert(pricedBrief.bodyText.includes("sous 48 h"));
console.log("Agency templates retain and anonymize full traveler notes; the distinct non-priced feasibility study ignores sales briefs, asks for an adapted route and terrain constraints, marks unknown facts, and preserves the later priced brief.");
