/* eslint-disable @typescript-eslint/no-require-imports -- Standalone server-action runner with an in-memory Supabase/provider boundary. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

const ids = {
  lead: "11111111-1111-4111-8111-111111111111", user: "22222222-2222-4222-8222-222222222222",
  agency: "33333333-3333-4333-8333-333333333333", otherAgency: "44444444-4444-4444-8444-444444444444",
  proposal: "55555555-5555-4555-8555-555555555555", otherUser: "66666666-6666-4666-8666-666666666666",
};
const stamp = "2026-10-07T10:00:00.000Z";
let state;
let nextId = 0;
const clone = value => JSON.parse(JSON.stringify(value));

function reset(overrides = {}) {
  state = {
    user: { id: ids.user }, configured: true, calls: [], providerCalls: [], rpcCalls: [],
    providerResult: { ok: true, providerId: "provider-test" }, claimConflict: false,
    tables: {
      leads: [{ id: ids.lead, referent_id: ids.user, status: "qualification", deleted_at: null,
        traveler_name: "Camille Exemple", email: "client@example.test", phone: "+33612345678",
        trip_summary: "Imaginer un parcours culturel à Alger et Tipaza", trip_dates: "À préciser", budget: "À préciser",
        project_description: "Le voyageur souhaite découvrir le patrimoine et les paysages. Dates et composition à préciser.",
        welcome_email_sent_at: null, intake_payload: { qualification_facts: { currency: null, budget_unit: null } },
      }],
      profiles: [{ id: ids.user, role: "lead_referent" }],
      agencies: [{ id: ids.agency, legal_name: "Agence partenaire", trade_name: "Dapaysement tour", email: "agency@example.test", status: "active" },
        { id: ids.otherAgency, legal_name: "Autre agence", trade_name: "Autre agence", email: "other@example.test", status: "active" }],
      lead_email_messages: [], lead_circuit_proposals: [], activities: [],
    }, ...overrides,
  };
}

class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = "select"; this.orders = []; this.maximum = Infinity; }
  select() { return this; }
  eq(key, value) { this.filters.push(row => row[key] === value); return this; }
  neq(key, value) { this.filters.push(row => row[key] !== value); return this; }
  is(key, value) { return this.eq(key, value); }
  order(key, options = {}) { this.orders.push({ key, ascending: options.ascending !== false }); return this; }
  limit(maximum) { this.maximum = maximum; return this; }
  insert(patch) { this.operation = "insert"; this.patch = patch; return this; }
  update(patch) { this.operation = "update"; this.patch = patch; return this; }
  execute(single = false) {
    state.calls.push({ table: this.table, operation: this.operation, patch: this.patch ? clone(this.patch) : null });
    let rows = state.tables[this.table].filter(row => this.filters.every(filter => filter(row)));
    if (this.operation === "insert") {
      const row = { id: `77777777-7777-4777-8777-${String(++nextId).padStart(12, "0")}`, created_at: stamp, updated_at: stamp, sent_at: null, error: null, ...clone(this.patch) };
      state.tables[this.table].push(row); rows = [row];
    } else if (this.operation === "update") {
      if (this.patch.status === "sending" && state.claimConflict) return { data: null, error: { code: "23505", message: "One dispatch" } };
      rows.forEach(row => Object.assign(row, clone(this.patch)));
    }
    for (const { key, ascending } of this.orders.toReversed()) rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1));
    rows = rows.slice(0, this.maximum);
    return { data: clone(single ? rows[0] ?? null : rows), error: null };
  }
  maybeSingle() { return Promise.resolve(this.execute(true)); }
  single() { return this.maybeSingle(); }
  then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
}
const supabase = {
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: table => new Query(table),
  rpc: async (name, input) => {
    assert.equal(name, "finalize_lead_email_message");
    state.rpcCalls.push(clone(input));
    const message = state.tables.lead_email_messages.find(row => row.id === input.message_id);
    assert(message);
    assert.equal(input.expected_updated_at, message.updated_at);
    message.status = input.delivery; message.sent_at = stamp;
    return { error: null };
  },
};
const cache = new Map();
function loadModule(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = id => {
    if (id === "next/cache") return { revalidatePath: () => {} };
    if (id === "@/lib/supabase/server") return { createClient: async () => supabase };
    if (id === "@/lib/email/workflow-email-config") return { isResendOutboundConfigured: () => state.configured };
    if (id === "@/lib/email/resend-client") return { sendTransactionalHtmlEmail: async input => { state.providerCalls.push(clone(input)); return state.providerResult; } };
    return id.startsWith("@/") ? loadModule(`src/${id.slice(2)}.ts`)
      : id.startsWith(".") ? loadModule(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(filename), `${id}.ts`))) : require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const actions = loadModule("src/app/(dashboard)/leads/email-actions.ts");
const { buildLeadEmailTemplate } = loadModule("src/lib/email/lead-email-template.ts");
const input = (overrides = {}) => ({ leadId: ids.lead, kind: "agency_feasibility", agencyId: ids.agency,
  language: "fr", subject: "Première étude de faisabilité — sans chiffrage",
  bodyText: "Bonjour,\n\nPourriez-vous étudier un parcours Alger et Tipaza et indiquer les adaptations nécessaires ? Aucun devis n’est demandé à ce stade.\n\nDirection l’Algérie", ...overrides });
const saved = async (overrides = {}) => {
  const result = await actions.saveLeadEmailDraft(input(overrides));
  assert.equal(result.ok, true, result.error); return result.draft;
};
const failure = (result, pattern) => { assert.equal(result.ok, false); assert.match(result.error, pattern); };

async function run() {
  reset();
  const analysis = buildLeadEmailTemplate(state.tables.leads[0], "agency_feasibility").analysis;
  assert.equal(analysis.readyForAgencyBrief, false, "Fixture must remain incomplete for priced consultation");
  const initialLead = clone(state.tables.leads[0]);
  const draft = await saved();
  assert.equal(draft.recipient, "agency@example.test"); assert.equal(draft.proposal_id, null);
  assert.equal(draft.kind, "agency_feasibility"); assert.equal(draft.status, "draft");
  const workspace = await actions.getLeadEmailWorkspace(ids.lead, "agency_feasibility", ids.agency);
  assert.equal(workspace.ok, true); assert.equal(workspace.draft.id, draft.id); assert.equal(workspace.feasibilityReady, true);
  assert.equal(workspace.proposalId, null); assert.equal(workspace.agencyFollowup, false);
  assert.equal((await actions.sendLeadEmailDraft(draft.id)).ok, true);
  assert.equal(state.providerCalls.length, 1); assert.equal(state.providerCalls[0].html, draft.html, "Dispatch must use reviewed stored HTML");
  assert.equal(state.providerCalls[0].idempotencyKey, `lead-email-${draft.id}`);
  assert.equal(state.rpcCalls[0].delivery, "sent");
  assert.deepEqual(state.tables.leads[0], initialLead, "Study must not update the lead in an action");
  assert(!state.calls.some(call => call.table === "lead_circuit_proposals"), "Study must not even require a proposal query");
  failure(await actions.sendLeadEmailDraft(draft.id), /déjà été traité/); assert.equal(state.providerCalls.length, 1);

  reset();
  const external = await saved();
  assert.equal((await actions.markLeadEmailSentExternally(external.id)).ok, true);
  assert.equal(state.providerCalls.length, 0); assert.equal(state.rpcCalls[0].delivery, "external");
  assert(!state.calls.some(call => call.table === "lead_circuit_proposals"));

  reset(); failure(await actions.saveLeadEmailDraft(input({ proposalId: ids.proposal })), /ne doit pas être liée/);
  reset(); failure(await actions.saveLeadEmailDraft(input({ agencyId: null })), /Choisissez l’agence/);
  reset(); failure(await actions.saveLeadEmailDraft(input({ bodyText: "Le projet de Camille Exemple, client@example.test" })), /données personnelles|nom ou des coordonnées/);
  reset(); failure(await actions.saveLeadEmailDraft(input({ subject: "Étude pour Camille Exemple" })), /nom ou des coordonnées/);
  reset(); state.tables.agencies[0].status = "suspended"; failure(await actions.saveLeadEmailDraft(input()), /suspendue/);
  reset(); state.tables.agencies[0].status = "pending_validation"; await saved();
  reset(); state.tables.agencies[0].email = "invalid"; failure(await actions.saveLeadEmailDraft(input()), /adresse email valide/);
  reset(); state.tables.leads[0].deleted_at = stamp; failure(await actions.saveLeadEmailDraft(input()), /archivé/);
  reset(); state.tables.leads[0].referent_id = ids.otherUser; failure(await actions.saveLeadEmailDraft(input()), /référent assigné/);
  reset(); state.tables.leads[0].referent_id = null; failure(await actions.saveLeadEmailDraft(input()), /Allouez/);
  reset({ user: null }); failure(await actions.saveLeadEmailDraft(input()), /Non authentifié/);
  reset(); state.tables.leads[0].referent_id = ids.otherUser; state.tables.profiles[0].role = "admin"; await saved();

  reset(); Object.assign(state.tables.leads[0], { trip_summary: "Projet de voyage sur mesure", project_description: null, destination_main: "À préciser", travel_desire_narrative: null });
  const emptyWorkspace = await actions.getLeadEmailWorkspace(ids.lead, "agency_feasibility", ids.agency);
  assert.equal(emptyWorkspace.feasibilityReady, false); failure(await actions.saveLeadEmailDraft(input()), /Renseignez les envies/);
  reset(); Object.assign(state.tables.leads[0], { trip_summary: "Projet de voyage — Camille Exemple", project_description: "Camille Exemple — client@example.test", destination_main: "À préciser" });
  failure(await actions.saveLeadEmailDraft(input()), /Renseignez les envies/);
  for (const field of ["destination_main", "project_description", "trip_summary"]) {
    reset(); Object.assign(state.tables.leads[0], { trip_summary: "Projet de voyage", project_description: null, destination_main: null, [field]: "Alger et Tipaza, patrimoine et paysages" }); await saved();
  }
  reset(); Object.assign(state.tables.leads[0], { trip_summary: "Projet de voyage", project_description: null });
  state.tables.leads[0].intake_payload.notes_longues = "Découverte du patrimoine de Tipaza"; await saved();

  for (const action of ["sendLeadEmailDraft", "markLeadEmailSentExternally"]) {
    reset(); const row = await saved(); row.body_text = "Camille Exemple, client@example.test";
    state.tables.lead_email_messages[0].body_text = row.body_text;
    failure(await actions[action](row.id), /données personnelles/); assert.equal(state.providerCalls.length, 0); assert.equal(state.rpcCalls.length, 0);
    reset(); const inactive = await saved(); state.tables.agencies[0].status = "suspended";
    failure(await actions[action](inactive.id), /suspendue/); assert.equal(state.providerCalls.length, 0); assert.equal(state.rpcCalls.length, 0);
    reset(); const linked = await saved(); state.tables.lead_email_messages[0].proposal_id = ids.proposal;
    failure(await actions[action](linked.id), /ne doit pas être liée/);
    reset(); const archived = await saved(); state.tables.leads[0].deleted_at = stamp;
    failure(await actions[action](archived.id), /archivé/);
  }

  reset(); const unresolved = await saved(); state.tables.lead_email_messages[0].status = "sending";
  const replacement = await saved();
  const blockedWorkspace = await actions.getLeadEmailWorkspace(ids.lead, "agency_feasibility", ids.agency);
  assert.equal(blockedWorkspace.unresolvedSending, true); assert.equal(blockedWorkspace.draft.id, replacement.id);
  for (const action of ["sendLeadEmailDraft", "markLeadEmailSentExternally"]) failure(await actions[action](replacement.id), /encore en cours de transmission/);
  assert.equal(state.providerCalls.length, 0);
  const other = await saved({ agencyId: ids.otherAgency });
  assert.equal((await actions.sendLeadEmailDraft(other.id)).ok, true, "A different agency has a separate delivery history");
  assert.equal(state.tables.lead_email_messages.find(row => row.id === unresolved.id).status, "sending");

  reset(); const conflict = await saved(); state.claimConflict = true;
  failure(await actions.sendLeadEmailDraft(conflict.id), /encore en cours de transmission/); assert.equal(state.providerCalls.length, 0);
  reset(); const changed = await saved();
  failure(await actions.saveLeadEmailDraft(input({ draftId: changed.id, expectedUpdatedAt: "2020-01-01T00:00:00.000Z" })), /modifié ou traité/);
  reset(); const pending = await saved(); state.providerResult = { ok: false, deliveryUnknown: true, error: "Provider confirmation unavailable" };
  failure(await actions.sendLeadEmailDraft(pending.id), /confirmation unavailable/);
  assert.equal(state.tables.lead_email_messages[0].status, "sending"); assert.equal(state.rpcCalls.length, 0);

  reset(); state.tables.lead_circuit_proposals.push({ id: ids.proposal, lead_id: ids.lead, agency_id: ids.agency, status: "pending_send", brief_sent_at: null, proposal_received_at: null, proposal_declined_at: null });
  const priced = await saved({ kind: "agency_brief", proposalId: ids.proposal });
  for (const action of ["sendLeadEmailDraft", "markLeadEmailSentExternally"]) failure(await actions[action](priced.id), /informations indispensables/);
  assert.equal(state.providerCalls.length, 0); assert.equal(state.rpcCalls.length, 0);
  console.log("Agency feasibility actions passed: incomplete travel ideas accepted, identity/delivery/assignment guards preserved, no priced consultation, and priced-brief completeness gate unchanged.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
