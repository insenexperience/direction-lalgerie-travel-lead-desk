/* eslint-disable @typescript-eslint/no-require-imports -- Loads the TypeScript modules in the standalone test runner. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const modules = new Map();
function load(id, dependencies) {
  if (!dependencies && modules.has(id)) return modules.get(id);
  const file = path.join(__dirname, "..", "src", id + ".ts");
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => dependencies?.[name] ?? (name === "server-only" ? {} : name.startsWith("@/") ? load(name.slice(2))
      : name.startsWith(".") ? load(path.posix.normalize(path.posix.join(path.posix.dirname(id), name))) : require(name)),
    loaded, loaded.exports,
  );
  if (!dependencies) modules.set(id, loaded.exports);
  return loaded.exports;
}

test("Claude receives travel facts and missing questions, without traveler identity or notes", () => {
  const { assistantLeadContext } = load("lib/assistant/lead-context");
  const context = assistantLeadContext({
    traveler_name: "Camille Martin", email: "camille@example.test", phone: "+33612345678",
    destination_main: "Djanet", trip_dates: "avril 2027", travel_style: "Randonnée",
    project_description: "Une information interne confidentielle",
  });
  const text = JSON.stringify(context);
  assert.match(text, /Djanet/);
  assert.match(text, /avril 2027/);
  assert.match(text, /budget/);
  assert.doesNotMatch(text, /Camille|example\.test|33612345678|confidentielle/);
});

test("Claude output cannot request sending or inject destination identifiers", () => {
  const { parseAssistantAnswer } = load("lib/assistant/claude");
  assert.equal(parseAssistantAnswer('{"reply":"Envoyer","draftKind":"send"}'), null);
  assert.equal(parseAssistantAnswer('{"reply":"Brouillon","draftKind":"welcome","leadId":"other"}'), null);
  assert.deepEqual(parseAssistantAnswer('{"reply":"Voici une piste.","draftKind":"qualification","editKind":"none","editValue":""}'),
    { reply: "Voici une piste.", draftKind: "qualification", edit: null });
  assert.deepEqual(parseAssistantAnswer('{"reply":"Djanet.","draftKind":"none","editKind":"none","editValue":""}'),
    { reply: "Djanet.", draftKind: null, edit: null });
  assert.deepEqual(parseAssistantAnswer('{"reply":"Je propose une note.","draftKind":"none","editKind":"note","editValue":"Départ à confirmer."}')?.edit,
    { kind: "note", value: "Départ à confirmer." });
  assert.equal(parseAssistantAnswer('{"reply":"Je propose une suppression.","draftKind":"none","editKind":"delete","editValue":"all"}'), null);
});

test("Claude may propose a specific budget but cannot infer the basis or invert the range", () => {
  const { parseAssistantAnswer } = load("lib/assistant/claude");
  const proposal = { reply: "Je propose ce budget.", draftKind: "none", editKind: "budget",
    editValue: { min: 1500, max: 1800, currency: "EUR", unit: "total", includesFlights: false } };
  assert.deepEqual(parseAssistantAnswer(JSON.stringify(proposal))?.edit, { kind: "budget", value: proposal.editValue });
  assert.equal(parseAssistantAnswer(JSON.stringify({ ...proposal, editValue: { ...proposal.editValue, unit: "" } })), null);
  assert.equal(parseAssistantAnswer(JSON.stringify({ ...proposal, editValue: { ...proposal.editValue, max: 1200 } })), null);
});

const leadId = "00000000-0000-4000-8000-000000000001";
const agencyId = "00000000-0000-4000-8000-000000000002";

function fakeDesk() {
  const state = {
    enabled: false, role: "lead_referent", leadVisible: true, configured: true, connectionTests: 0,
    recipient: "camille@example.test", qualified: false, calls: 0, saved: [],
    edit: null, writes: [], audit: [],
    lead: { id: leadId, referent_id: leadId, updated_at: "2026-11-08T12:00:00Z", internal_notes: "Note existante.", priority: "normal" },
  };
  const tables = {
    profiles: () => ({ role: state.role }),
    desk_assistant_settings: () => ({ enabled: state.enabled, tested_at: state.enabled ? "2026-11-08T12:00:00Z" : null }),
    leads: () => state.leadVisible ? { ...state.lead, destination_main: "Djanet" } : null,
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: leadId } } }) },
    async rpc(name, args) {
      assert.equal(name, "apply_desk_assistant_edit");
      assert.equal(args.p_lead_id, leadId);
      assert.equal(args.p_expected_updated_at, state.lead.updated_at);
      const patch = args.p_action === "note"
        ? { internal_notes: [state.lead.internal_notes, args.p_changes.internal_notes].filter(Boolean).join("\n\n") }
        : args.p_changes;
      state.writes.push(patch);
      state.audit.push(args.p_action);
      state.lead = { ...state.lead, ...patch, updated_at: "2026-11-08T12:01:00Z" };
      return { data: true, error: null };
    },
    from(table) {
      let patch;
      let expectedVersion;
      return {
        select() { return this; }, is() { return this; }, abortSignal() { return this; },
        eq(key, value) { if (key === "updated_at") expectedVersion = value; return this; },
        update(value) { patch = value; return this; },
        async maybeSingle() {
          if (patch && table === "desk_assistant_settings") state.enabled = patch.enabled;
          if (patch && table === "leads") {
            assert.equal(expectedVersion, state.lead.updated_at);
            state.writes.push(patch);
            state.lead = { ...state.lead, ...patch, updated_at: "2026-11-08T12:01:00Z" };
          }
          return { data: tables[table](), error: null };
        },
      };
    },
  };
  const actions = load("app/(dashboard)/settings/assistant-actions", {
    "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/assistant/claude": {
      claudeConfigured: () => state.configured,
      testClaudeConnection: async () => { state.connectionTests++; },
      extractClaudeQualification: async () => ({ duration: "5 jours à une semaine", pendingTravelers: 1 }),
      askClaude: async () => { state.calls++; return { reply: "Djanet.", draftKind: null, edit: state.edit }; },
    },
    "@/app/(dashboard)/leads/email-actions": {
      getLeadEmailWorkspace: async () => ({
        ok: true, recipient: state.recipient, canEdit: true, storageReady: true,
        template: { subject: "Projet Djanet", bodyText: "Bonjour.", language: "fr", analysis: { readyForAgencyBrief: state.qualified } },
      }),
      saveLeadEmailDraft: async (draft) => {
        state.saved.push(draft);
        return { ok: true, draft: { id: leadId } };
      },
    },
  });
  return { actions, state };
}

test("disabled and inaccessible dossiers never reach Claude, and activation requires an admin", async () => {
  const { actions, state } = fakeDesk();
  const turns = [{ role: "user", content: "Résume le dossier" }];
  assert.equal((await actions.setAssistantEnabled(true)).ok, false);
  assert.equal((await actions.chatWithAssistant(leadId, turns)).ok, false);
  state.enabled = true;
  state.leadVisible = false;
  assert.equal((await actions.chatWithAssistant(leadId, turns)).ok, false);
  assert.equal(state.calls, 0);
  state.leadVisible = true;
  assert.equal((await actions.chatWithAssistant(leadId, turns)).ok, true);
  assert.equal(state.calls, 1);
});

test("an internal note is appended only after confirmation and replay cannot duplicate it", async () => {
  const { actions, state } = fakeDesk();
  state.enabled = true;
  state.edit = { kind: "note", value: "Budget à confirmer." };
  const { editPreview } = await actions.chatWithAssistant(leadId, [{ role: "user", content: "Ajoute une note sur le budget." }]);
  assert.equal(state.writes.length, 0);
  assert.equal((await actions.confirmAssistantEdit(editPreview)).ok, true);
  assert.equal(state.lead.internal_notes, "Note existante.\n\nBudget à confirmer.");
  assert.equal((await actions.confirmAssistantEdit(editPreview)).ok, false);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.audit, ["note"]);
});

test("a budget proposed in chat changes only the reviewed dossier and records the actor's confirmation", async () => {
  const { actions, state } = fakeDesk();
  state.enabled = true;
  state.lead.budget = "1 000 € pour le groupe";
  state.edit = { kind: "budget", value: { min: 1500, max: 1800, currency: "EUR", unit: "total", includesFlights: false } };
  const { editPreview } = await actions.chatWithAssistant(leadId, [{ role: "user", content: "Note 1 500–1 800 € pour le groupe, vols exclus." }]);
  assert.equal(editPreview.previous, state.lead.budget);
  assert.equal(state.writes.length, 0);
  assert.equal((await actions.confirmAssistantEdit(editPreview)).ok, true);
  assert.equal(state.lead.budget_min, 1500);
  assert.equal(state.lead.budget_max, 1800);
  assert.equal(state.lead.intake_payload.qualification_facts.budget_includes_flights, false);
  assert.deepEqual(state.audit, ["budget"]);
  assert.equal((await actions.confirmAssistantEdit(editPreview)).ok, false);
  assert.equal(state.writes.length, 1);
});

test("priority proposals cannot update a lead assigned to another operator or a closed lead", async () => {
  const { actions, state } = fakeDesk();
  state.enabled = true;
  state.edit = { kind: "priority", value: "high" };
  const { editPreview } = await actions.chatWithAssistant(leadId, [{ role: "user", content: "Passe la priorité à haute." }]);
  assert.equal(editPreview.previous, "normal");
  state.lead.referent_id = agencyId;
  assert.equal((await actions.confirmAssistantEdit(editPreview)).ok, false);
  state.lead.referent_id = leadId;
  state.lead.closed_at = "2026-11-08T12:10:00Z";
  assert.equal((await actions.confirmAssistantEdit(editPreview)).ok, false);
  assert.equal(state.writes.length, 0);
  state.lead.closed_at = null;
  assert.equal((await actions.confirmAssistantEdit(editPreview)).ok, true);
  assert.equal(state.lead.priority, "high");
});

test("a pasted qualification updates the working trame while keeping pending travelers and a web price unconfirmed", () => {
  const { parseQualificationImport } = load("lib/assistant/qualification");
  const { buildQualificationPatch } = load("lib/assistant/qualification-patch");
  const { analyzeLeadQualification } = load("lib/lead-qualification-completeness");
  const originalRequest = { original: true };
  const oldTrame = {
    titre: "Djanet", jours: [{ n: 1, lieux: ["djanet"], e: "Arrivée" }],
    cadre: { mois: "15–21 novembre 2026", duree: "Quelques jours", hebergement: "Simple" },
    groupe: { type: "amis", nombre: 3, enfants: 0 },
    envies: { activites: ["Randonnée"] },
  };
  const lead = {
    intake_payload: { trame: originalRequest }, ai_qualification_payload: { trame_v3: oldTrame, preserved: true },
    traveler_responses: { qualification_facts: { travelers_adults: 3, travel_period: "15–21 novembre 2026" } },
  };
  const parsed = parseQualificationImport({
    travelers: 2, pendingTravelers: 1, duration: "5 jours à une semaine",
    period: "À partir du 13 novembre 2026 et jusqu’à la fin novembre", flexibility: "flexible",
    domesticFlights: "A/R Alger–Djanet", accommodation: "Bivouac",
    activities: ["Circuits d’excursion inclus"], formalities: "Passeports algériens à jour",
    budgetStatus: "unknown", budgetReference: "Offre web autour de 70 000 DZD par personne",
    budgetAmount: 70000,
  });
  assert.equal(parsed.budgetAmount, undefined);
  const patch = buildQualificationPatch(lead, parsed);
  assert.deepEqual(patch.intake_payload.trame, originalRequest);
  assert.equal(patch.ai_qualification_payload.preserved, true);
  assert.deepEqual(patch.ai_qualification_payload.trame_v3.jours, oldTrame.jours);
  assert.deepEqual(patch.ai_qualification_payload.trame_v3.envies.activites, ["Randonnée", "Circuits d’excursion inclus"]);
  assert.equal(patch.ai_qualification_payload.trame_v3.cadre.duree, "5 jours à une semaine");
  assert.equal(patch.ai_qualification_payload.trame_v3.groupe.nombre, 2);
  assert.equal(patch.intake_payload.qualification_facts.pending_travelers, 1);
  assert.equal(patch.intake_payload.qualification_facts.domestic_flights, "A/R Alger–Djanet");
  assert.equal(patch.intake_payload.qualification_facts.formalities, "Passeports algériens à jour");
  assert.equal(patch.budget, "");
  assert.equal(patch.budget_min, null);
  assert.match(patch.intake_payload.qualification_facts.budget_reference, /70 000 DZD/);
  const analysis = analyzeLeadQualification({ ...lead, ...patch });
  assert.match(analysis.checklist.find(({ id }) => id === "dates").value, /13 novembre 2026/);
  assert.equal(analysis.checklist.find(({ id }) => id === "budget").status, "missing");
  assert.match(analysis.questions.find(({ id }) => id === "participants").question, /supplémentaire/);
  assert.equal(analysis.readyForAgencyBrief, false);
});

test("qualification import writes only the reviewed version of the dossier", async () => {
  const { actions, state } = fakeDesk();
  state.enabled = true;
  const first = await actions.previewAssistantQualification(leadId, "Durée : 5 jours à une semaine.");
  assert.equal(first.ok, true);
  assert.equal(state.writes.length, 0);
  state.lead.updated_at = "2026-11-08T12:00:30Z";
  assert.equal((await actions.confirmAssistantQualification(first.preview)).ok, false);
  assert.equal(state.writes.length, 0);
  const next = await actions.previewAssistantQualification(leadId, "Durée : 5 jours à une semaine.");
  assert.equal((await actions.confirmAssistantQualification(next.preview)).ok, true);
  assert.equal(state.writes.length, 1);
  assert.equal(state.lead.ai_qualification_payload.trame_v3.cadre.duree, "5 jours à une semaine");
});

test("the admin activation tests Claude only when configured and disabling makes no provider call", async () => {
  const { actions, state } = fakeDesk();
  state.role = "admin";
  state.configured = false;
  assert.equal((await actions.getAssistantStatus()).status.state, "unconfigured");
  assert.equal((await actions.setAssistantEnabled(true)).ok, false);
  assert.equal(state.connectionTests, 0);
  state.configured = true;
  assert.equal((await actions.setAssistantEnabled(true)).status.state, "connected");
  assert.equal(state.connectionTests, 1);
  assert.equal((await actions.setAssistantEnabled(false)).status.state, "disabled");
  assert.equal(state.connectionTests, 1);
});

test("previews are read-only, reject a changed recipient and save through the Desk only after validation", async () => {
  const { actions, state } = fakeDesk();
  state.enabled = true;
  assert.equal((await actions.prepareAssistantDraft(leadId, "agency_brief", agencyId)).ok, false);
  const { preview } = await actions.prepareAssistantDraft(leadId, "welcome", null);
  assert.equal(preview.recipient, "camille@example.test");
  assert.equal(state.saved.length, 0);
  state.recipient = "new@example.test";
  assert.equal((await actions.confirmAssistantDraft(preview)).ok, false);
  assert.equal(state.saved.length, 0);
  const fresh = await actions.prepareAssistantDraft(leadId, "welcome", null);
  assert.equal((await actions.confirmAssistantDraft(fresh.preview)).ok, true);
  assert.equal(state.saved.length, 1);
  assert.equal(state.saved[0].expectedRecipient, "new@example.test");
});
