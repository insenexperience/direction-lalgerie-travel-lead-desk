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
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => dependencies?.[name] ?? (name === "server-only" ? {} : name.startsWith("@/") ? load(name.slice(2)) : require(name)),
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

const leadId = "00000000-0000-4000-8000-000000000001";
const agencyId = "00000000-0000-4000-8000-000000000002";

function fakeDesk() {
  const state = {
    enabled: false, role: "lead_referent", leadVisible: true, configured: true, connectionTests: 0,
    recipient: "camille@example.test", qualified: false, calls: 0, saved: [],
    edit: null, writes: [],
    lead: { id: leadId, referent_id: leadId, updated_at: "2026-11-08T12:00:00Z", internal_notes: "Note existante.", priority: "normal" },
  };
  const tables = {
    profiles: () => ({ role: state.role }),
    desk_assistant_settings: () => ({ enabled: state.enabled, tested_at: state.enabled ? "2026-11-08T12:00:00Z" : null }),
    leads: () => state.leadVisible ? { ...state.lead, destination_main: "Djanet" } : null,
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: leadId } } }) },
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
