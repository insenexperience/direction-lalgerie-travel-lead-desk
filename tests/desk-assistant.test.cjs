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
  assert.deepEqual(parseAssistantAnswer('{"reply":"Voici une piste.","draftKind":"qualification"}'),
    { reply: "Voici une piste.", draftKind: "qualification" });
  assert.deepEqual(parseAssistantAnswer('{"reply":"Djanet.","draftKind":"none"}'),
    { reply: "Djanet.", draftKind: null });
});

const leadId = "00000000-0000-4000-8000-000000000001";
const agencyId = "00000000-0000-4000-8000-000000000002";

function fakeDesk() {
  const state = {
    enabled: false, role: "lead_referent", leadVisible: true, configured: true, connectionTests: 0,
    recipient: "camille@example.test", qualified: false, calls: 0, saved: [],
  };
  const tables = {
    profiles: () => ({ role: state.role }),
    desk_assistant_settings: () => ({ enabled: state.enabled, tested_at: state.enabled ? "2026-11-08T12:00:00Z" : null }),
    leads: () => state.leadVisible ? { id: leadId, destination_main: "Djanet" } : null,
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: leadId } } }) },
    from(table) {
      return {
        select() { return this; }, eq() { return this; }, is() { return this; }, abortSignal() { return this; },
        update(patch) { assert.equal(table, "desk_assistant_settings"); state.enabled = patch.enabled; return this; },
        async maybeSingle() { return { data: tables[table](), error: null }; },
      };
    },
  };
  const actions = load("app/(dashboard)/settings/assistant-actions", {
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/assistant/claude": {
      claudeConfigured: () => state.configured,
      testClaudeConnection: async () => { state.connectionTests++; },
      askClaude: async () => { state.calls++; return { reply: "Djanet.", draftKind: null }; },
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
