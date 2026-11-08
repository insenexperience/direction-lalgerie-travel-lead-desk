/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Desk tests. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(id) {
  const file = path.join(__dirname, "..", "src", id + ".ts");
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => name.startsWith("@/") ? load(name.slice(2))
      : name.startsWith(".") ? load(path.posix.normalize(path.posix.join(path.posix.dirname(id), name))) : require(name),
    loaded, loaded.exports,
  );
  return loaded.exports;
}

const now = Date.parse("2026-11-08T19:30:00Z");
const lead = {
  id: "0d7e429e-09e6-49ac-979a-a5c0309dab2b", ref: "DA-0D7E429E",
  nom: "Mélissa Exemple", email: "melissa@example.com", tel: "+213555123456",
  canal: "email", source: "manuel", statut: "envoye", dbStatus: "agency_assignment",
  recu: "2026-11-01T10:00:00Z", premiereReponse: null, updatedAt: "2026-11-08T18:00:00Z",
  agenceChoisie: null, trame: null, texte: "", manque: [], brief: null,
  consultations: [], devis: null, relancesVoyageur: [], messages: [],
  issue: null, motif: null, closedAt: null, notesInternes: "", qualification: [],
};

test("an agency send declared in the journal remains pending even without consultation rows", () => {
  const { buildDeskProject, projectPrompt } = load("lib/assistant/project-readout");
  const readout = buildDeskProject(lead, [], {
    activities: [{ kind: "manual_stage_advanced", created_at: "2026-11-02T14:12:38Z", payload: { stage: "envoye", db_status: "agency_assignment" } }],
  }, now);
  assert.equal(readout.agencyState, "declared_waiting");
  assert.match(readout.summary, /envoi.*déclaré/i);
  assert.match(readout.next.label, /retours d.agence/i);
  assert.doesNotMatch(JSON.stringify(projectPrompt(readout)), /Mélissa|melissa@example|555123456/);
});

test("latest confirmed qualification and traveler response stay distinct from original intake", () => {
  const { buildDeskProject, projectPrompt } = load("lib/assistant/project-readout");
  const readout = buildDeskProject({ ...lead, statut: "brief_pret" }, [], {
    activities: [
      { kind: "traveler_answers", created_at: "2026-11-08T19:15:13Z", payload: { b: "Budget : à définir avec le conseiller" } },
      { kind: "assistant_qualification_saved", created_at: "2026-11-08T19:00:00Z", payload: {} },
    ],
    facts: [{ label: "Groupe", value: "4 confirmés" }],
  }, now);
  assert.deepEqual(readout.timeline.slice(0, 2).map(({ title }) => title), ["Réponses du voyageur", "Qualification enregistrée par DA Sales"]);
  assert.deepEqual(projectPrompt(readout).faitsActuels, [{ label: "Groupe", value: "4 confirmés" }]);
});

test("accent-insensitive client lookup reports ambiguities rather than guessing a dossier", () => {
  const { findDeskProjects } = load("lib/assistant/scope");
  const second = { ...lead, id: "b", ref: "DA-ABCDEF01", nom: "Melissa Autre" };
  assert.deepEqual(findDeskProjects("Où en est Melissa ?", [lead, second]).map(p => p.id), [lead.id, second.id]);
  assert.deepEqual(findDeskProjects("Mélissa Exemple", [lead, second]).map(p => p.id), [lead.id]);
  assert.deepEqual(findDeskProjects("Vérifie DA-ABCDEF01", [lead, second]).map(p => p.id), [second.id]);
});

test("qualification preview shows the exact date fields that a free-form period will clear", () => {
  const { qualificationChanges } = load("lib/assistant/qualification-patch");
  const rows = qualificationChanges({ travel_start_date: "2026-11-15", travel_end_date: "2026-11-20", budget: "1 200 € / pers." },
    { period: "Décembre", budgetStatus: "unknown" });
  assert.deepEqual(rows.find(row => row.label === "Dates enregistrées"), { label: "Dates enregistrées", before: "2026-11-15 → 2026-11-20", after: null });
  assert.deepEqual(rows.find(row => row.label === "Budget"), { label: "Budget", before: "1 200 € / pers.", after: "À définir" });
});

test("Gmail proposal prefill requires a clear EUR per-person price and a trip duration", () => {
  const { prefillGmailProposal } = load("lib/email/gmail-intake");
  assert.deepEqual(prefillGmailProposal("Circuit de 8 jours, 1 250,50 € par personne. Offre valable 15 jours."), { price: 1250.5, days: 8 });
  assert.deepEqual(prefillGmailProposal("75 000 DZD par personne, total de 600 € et validité 10 jours."), { price: null, days: null });
  assert.deepEqual(prefillGmailProposal("1.250 EUR / pers. en standard ou 1.450 EUR / pers. en confort."), { price: null, days: null });
});
