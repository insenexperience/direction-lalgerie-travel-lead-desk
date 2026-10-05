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

const { buildLeadEmailTemplate, agencyTravelNotes } = loadModule("src/lib/email/lead-email-template.ts");
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
console.log("Agency notes retain routes, experience and operational questions, redact identities and social contacts, avoid duplicates, and preserve traveler email language.");
