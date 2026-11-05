/* eslint-disable @typescript-eslint/no-require-imports -- The queue, database, route and email transport are isolated. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.join(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id]
    : id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`, mocks, cache) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}

const EVENT = "11111111-1111-4111-8111-111111111111";
const LEAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = "ab".repeat(32), SECRET = "status-worker-secret", CRON = "production-cron-only-secret";
const TABLE = "project_status_email_outbox";
const totals = overrides => ({ claimed: 0, sent: 0, failed: 0, unknown: 0, skipped: 0, ...overrides });
const intake = () => ({
  notes_longues: "INTERNAL_NOTE", suivi_token_hash: TOKEN, partner: "INTERNAL_PARTNER",
  trame: {
    version: 1, type: "demande-projet-voyage", ou: { noms: ["Djanet"] },
    quand: { mode: "nsp" }, voyageurs: { adultes: 2 }, envies: {}, contact: {}, accord: { accepte: true },
  },
});
const lead = () => ({
  id: LEAD, traveler_name: "Lina", email: "lina@example.invalid", status: "qualification", intake_payload: intake(), deleted_at: null,
});
const event = () => ({
  id: EVENT, lead_id: LEAD, recipient: "lina@example.invalid", previous_status: "new", status: "qualification",
  state: "pending", claimed_at: null, attempts: 0, mail_payload: null,
});

/** Models only the service client's documented chain and atomic claim contract; never opens a connection. */
function app(options = {}) {
  const rows = structuredClone(options.events || [event()]);
  const currentLead = Object.hasOwn(options, "lead") ? structuredClone(options.lead) : lead();
  const seen = { clients: 0, rpc: [], selects: [], updates: [], activities: [], sent: [], operations: [] };
  let claimSequence = 0;
  const db = {
    rpc(name, args) {
      seen.rpc.push({ name, args });
      return { abortSignal: async signal => {
        assert(signal instanceof AbortSignal);
        seen.operations.push("claim");
        if (options.rpcError) return { data: null, error: { message: "PRIVATE_DB_ERROR" } };
        assert.equal(name, "claim_project_status_emails");
        assert.deepEqual(args, { batch_size: 2 });
        const claimed = rows.filter(row => ["pending", "failed"].includes(row.state) && row.attempts < 3
          && (!row.next_attempt_at || Date.parse(row.next_attempt_at) <= Date.now())).slice(0, args.batch_size);
        for (const row of claimed) {
          row.state = "sending"; row.claimed_at = new Date(Date.now() + claimSequence++).toISOString(); row.attempts++;
        }
        return { data: structuredClone(claimed), error: null };
      } };
    },
    from(table) {
      const filters = []; let selected, patch, inserted, signal, execution;
      const query = {
        select(columns) { selected = columns; seen.selects.push({ table, columns }); return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        is(key, value) { filters.push([key, value]); return query; },
        update(value) { patch = structuredClone(value); return query; },
        insert(value) { inserted = structuredClone(value); return query; },
        // maybeSingle returns the terminal builder: abortSignal must be configured first.
        maybeSingle() { return { then: query.then }; },
        abortSignal(value) { signal = value; return query; },
        then(resolve, reject) { return (execution ??= execute()).then(resolve, reject); },
      };
      async function execute() {
          assert(signal instanceof AbortSignal);
          if (table === "leads") {
            seen.operations.push("lead");
            assert.deepEqual(filters, [["id", LEAD]]);
            if (options.leadError) return { data: null, error: { message: "PRIVATE_LEAD_ERROR" } };
            return { data: structuredClone(currentLead), error: null };
          }
          if (table === "activities") {
            seen.activities.push(inserted); seen.operations.push("audit");
            if (options.auditThrows) throw Error("PRIVATE_AUDIT_ERROR");
            return { error: options.auditError ? { message: "PRIVATE_AUDIT_ERROR" } : null };
          }
          assert.equal(table, TABLE);
          const snapshot = Object.hasOwn(patch, "mail_payload");
          seen.operations.push(snapshot ? "snapshot" : "finish");
          seen.updates.push({ patch, filters: structuredClone(filters), selected });
          if (snapshot && options.snapshotError || !snapshot && options.finishError) return { data: null, error: { message: "PRIVATE_WRITE_ERROR" } };
          if (snapshot && options.snapshotMissing || !snapshot && options.finishMissing) return { data: null, error: null };
          const row = rows.find(row => filters.every(([key, value]) => row[key] === value));
          if (!row) return { data: null, error: null };
          // The SQL touch trigger, not the dispatcher, owns retry scheduling.
          if (patch.state === "failed" && row.state !== "failed") {
            row.next_attempt_at = new Date(Date.now() + 60_000 * 2 ** Math.max(0, row.attempts - 1)).toISOString();
          }
          Object.assign(row, patch);
          return { data: snapshot ? { mail_payload: structuredClone(row.mail_payload) } : { id: row.id }, error: null };
      }
      return query;
    },
  };
  const mocks = {
    "@/lib/supabase/admin": { createServiceRoleClient() { seen.clients++; return db; } },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/email/resend-client": { async sendTransactionalHtmlEmail(mail) {
      seen.sent.push(structuredClone(mail)); seen.operations.push("provider");
      assert(rows.some(row => row.state === "sending" && row.mail_payload?.idempotencyKey === mail.idempotencyKey), "Persist the payload before contacting provider");
      return options.sender ? options.sender(mail, rows) : { ok: true, providerId: "provider-accepted" };
    } },
  };
  const cache = new Map();
  const dispatcher = load("src/lib/email/project-status-dispatch.ts", mocks, cache);
  const route = load("src/app/api/project-status-emails/route.ts", mocks, cache);
  const post = (authorization = `Bearer ${SECRET}`) => route.POST(new Request("https://crm.invalid/api/project-status-emails", {
    method: "POST", headers: authorization === null ? {} : { Authorization: authorization },
  }));
  const get = (authorization = `Bearer ${CRON}`, extraHeaders = {}) => route.GET(new Request("https://crm.invalid/api/project-status-emails", {
    method: "GET", headers: { ...extraHeaders, ...(authorization === null ? {} : { Authorization: authorization }) },
  }));
  return { dispatch: () => dispatcher.dispatchProjectStatusEmails(db), post, get, rows, seen, currentLead };
}

const envKeys = ["PROJECT_STATUS_EMAILS_ENABLED", "INTAKE_SHARED_SECRET", "CRON_SECRET", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "NEXT_PUBLIC_SITE_BASE_URL"];
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
test.beforeEach(() => {
  process.env.PROJECT_STATUS_EMAILS_ENABLED = "true"; process.env.INTAKE_SHARED_SECRET = SECRET;
  process.env.CRON_SECRET = CRON;
  process.env.RESEND_API_KEY = "test-resend-key"; process.env.RESEND_FROM_EMAIL = "team@example.invalid";
  delete process.env.NEXT_PUBLIC_SITE_BASE_URL;
});
test.after(() => { for (const key of envKeys) { if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key]; } });

test("feature disabled: dispatcher touches no DB and authorized route returns 503 without a client", async () => {
  for (const flag of [undefined, "", "false", "TRUE"]) {
    if (flag === undefined) delete process.env.PROJECT_STATUS_EMAILS_ENABLED; else process.env.PROJECT_STATUS_EMAILS_ENABLED = flag;
    const x = app();
    assert.deepEqual(await x.dispatch(), totals({ disabled: true }));
    const response = await x.post();
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { disabled: true });
    assert.equal(x.seen.clients, 0); assert.equal(x.seen.rpc.length, 0); assert.equal(x.seen.selects.length, 0);
    assert.equal(x.seen.sent.length, 0);
  }
});

test("missing server secret or invalid authorization returns 401 before DB access", async () => {
  for (const configured of [undefined, "", SECRET]) {
    if (configured === undefined) delete process.env.INTAKE_SHARED_SECRET; else process.env.INTAKE_SHARED_SECRET = configured;
    for (const auth of [null, "Bearer wrong", "Basic bad", ...(configured === SECRET ? [] : [`Bearer ${SECRET}`])]) {
      const x = app(), response = await x.post(auth);
      assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: "Unauthorized" });
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(x.seen.clients, 0); assert.equal(x.seen.rpc.length, 0); assert.equal(x.seen.sent.length, 0);
    }
  }
});

test("unauthorized GET cannot dispatch and responses never expose a provider configuration failure", async () => {
  const x = app();
  assert.equal((await x.get(null)).status, 401); assert.equal(x.seen.clients, 0);
  for (const key of ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
    const old = process.env[key]; delete process.env[key];
    const y = app();
    await assert.rejects(y.dispatch(), /email_configuration_missing/);
    const response = await y.post();
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: "Email queue unavailable" });
    assert.equal(y.seen.rpc.length, 0); assert.equal(y.seen.sent.length, 0);
    process.env[key] = old;
  }
});

test("Cron GET fails closed when its secret is absent, including a literal undefined credential", async () => {
  for (const configured of [undefined, "", "   "]) {
    if (configured === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = configured;
    for (const auth of [null, "Bearer undefined", `Bearer ${SECRET}`, `Bearer ${CRON}`]) {
      const x = app(), response = await x.get(auth);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "Cron unavailable" });
      assert.equal(x.seen.clients, 0); assert.equal(x.seen.rpc.length, 0); assert.equal(x.seen.sent.length, 0);
    }
  }
});

test("Cron GET accepts only its exact Bearer secret, never the intake credential or dedicated header", async () => {
  for (const auth of [null, "Bearer wrong", `Bearer ${SECRET}`, `Basic ${CRON}`, `Bearer ${CRON}suffix`]) {
    const x = app(), response = await x.get(auth, { "X-Intake-Secret": CRON });
    assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: "Unauthorized" });
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(x.seen.clients, 0); assert.equal(x.seen.rpc.length, 0); assert.equal(x.seen.sent.length, 0);
  }
  const x = app(), response = await x.get();
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), totals({ claimed: 1, sent: 1 }));
  assert.equal(x.seen.sent.length, 1);
});

test("Cron and relay credentials remain independent and the feature flag guards both methods", async () => {
  const x = app();
  assert.equal((await x.post(`Bearer ${CRON}`)).status, 401);
  assert.equal(x.seen.clients, 0);
  delete process.env.INTAKE_SHARED_SECRET;
  const cronOnly = app();
  assert.equal((await cronOnly.get()).status, 200);
  assert.equal((await app().post()).status, 401);
  process.env.INTAKE_SHARED_SECRET = SECRET;
  process.env.PROJECT_STATUS_EMAILS_ENABLED = "false";
  for (const method of ["get", "post"]) {
    const disabled = app(), response = await disabled[method]();
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { disabled: true });
    assert.equal(disabled.seen.clients, 0); assert.equal(disabled.seen.sent.length, 0);
  }
});

test("claim failure is a safe 503 and cannot read leads or send mail", async () => {
  const x = app({ rpcError: true }), response = await x.post();
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: "Email queue unavailable" });
  assert.equal(x.seen.rpc.length, 1); assert.equal(x.seen.selects.length, 0); assert.equal(x.seen.sent.length, 0);
});

test("one claim RPC, durable snapshot, provider acceptance and guarded finalization occur in order", async () => {
  const x = app(), response = await x.post();
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), totals({ claimed: 1, sent: 1 }));
  assert.deepEqual(x.seen.rpc, [{ name: "claim_project_status_emails", args: { batch_size: 2 } }]);
  assert.deepEqual(x.seen.operations, ["claim", "lead", "snapshot", "provider", "finish", "audit"]);
  const [snapshot, final] = x.seen.updates;
  for (const update of [snapshot, final]) {
    assert(update.filters.some(([key, value]) => key === "id" && value === EVENT));
    assert(update.filters.some(([key, value]) => key === "state" && value === "sending"));
    assert(update.filters.some(([key, value]) => key === "claimed_at" && value === x.rows[0].claimed_at));
  }
  assert(snapshot.filters.some(([key, value]) => key === "mail_payload" && value === null));
  assert.equal(x.rows[0].state, "sent"); assert.equal(x.rows[0].provider_id, "provider-accepted");
  assert.match(x.rows[0].sent_at, /^\d{4}-/);
  assert.equal(final.patch.error_code, null);
  assert.equal(x.seen.activities[0].kind, "project_status_email");
  assert.deepEqual(JSON.parse(x.seen.activities[0].detail), { event_id: EVENT, etat: "sent", statut: "Étude de votre demande", provider_id: "provider-accepted" });
});

test("concurrent dispatchers rely on atomic claims and cannot both deliver the same event", async () => {
  const x = app(), results = await Promise.all([x.dispatch(), x.dispatch()]);
  assert.equal(results.reduce((sum, value) => sum + value.claimed, 0), 1);
  assert.equal(results.reduce((sum, value) => sum + value.sent, 0), 1);
  assert.equal(x.seen.rpc.length, 2); assert.equal(x.seen.sent.length, 1);
  assert.deepEqual(await x.dispatch(), totals());
  assert.equal(x.seen.sent.length, 1);
});

test("a provider rejection becomes failed with database-owned retry timing and no raw error", async () => {
  const x = app({ sender: async () => ({ ok: false, error: `PRIVATE_PROVIDER_ERROR ${TOKEN}` }) });
  const result = await x.dispatch();
  assert.deepEqual(result, totals({ claimed: 1, failed: 1 }));
  assert.equal(x.rows[0].state, "failed"); assert.equal(x.rows[0].error_code, "provider_rejected");
  assert(x.seen.updates.every(update => !Object.hasOwn(update.patch, "next_attempt_at")));
  assert.equal(x.rows[0].sent_at, undefined); assert.equal(x.rows[0].provider_id, null);
  assert.doesNotMatch(JSON.stringify([x.seen.updates, x.seen.activities]), /PRIVATE_PROVIDER_ERROR|suivi_token/);
  assert(!JSON.stringify([x.seen.updates, x.seen.activities]).includes(TOKEN));
  assert.deepEqual(await x.dispatch(), totals()); assert.equal(x.seen.sent.length, 1);
});

test("unknown delivery or success without provider ID is terminal and never automatically retried", async () => {
  for (const result of [{ ok: false, deliveryUnknown: true, error: "PRIVATE_PROVIDER_ERROR" }, { ok: true }]) {
    const x = app({ sender: async () => result });
    assert.deepEqual(await x.dispatch(), totals({ claimed: 1, unknown: 1 }));
    assert.equal(x.rows[0].state, "unknown"); assert.equal(x.rows[0].error_code, "provider_confirmation_unknown");
    assert.equal(x.rows[0].next_attempt_at, undefined);
    assert.deepEqual(await x.dispatch(), totals()); assert.equal(x.seen.sent.length, 1);
  }
});

test("provider exception keeps the claim locked and logs no payload or raw exception", async t => {
  const errors = []; t.mock.method(console, "error", (...values) => errors.push(values));
  const x = app({ sender: async () => { throw Error(`PRIVATE_PROVIDER_ERROR ${TOKEN}`); } });
  assert.deepEqual(await x.dispatch(), totals({ claimed: 1, unknown: 1 }));
  assert.equal(x.rows[0].state, "sending"); assert(x.rows[0].mail_payload);
  assert.equal(x.seen.activities.length, 0);
  assert.deepEqual(await x.dispatch(), totals()); assert.equal(x.seen.sent.length, 1);
  assert.doesNotMatch(JSON.stringify(errors), /PRIVATE_PROVIDER_ERROR|lina@example|suivi_token/);
  assert(!JSON.stringify(errors).includes(TOKEN));
});

test("failed or lost finalization keeps an accepted message claimed instead of releasing it for retry", async t => {
  t.mock.method(console, "error", () => {});
  for (const options of [{ finishError: true }, { finishMissing: true }]) {
    const x = app(options);
    assert.deepEqual(await x.dispatch(), totals({ claimed: 1, unknown: 1 }));
    assert.equal(x.rows[0].state, "sending"); assert.equal(x.seen.sent.length, 1);
    assert.equal(x.seen.activities.length, 0);
    assert.deepEqual(await x.dispatch(), totals()); assert.equal(x.seen.sent.length, 1);
  }
});

test("deleted, missing or changed recipient skips before snapshot and delivery", async () => {
  for (const current of [null, { ...lead(), deleted_at: "2026-10-23T10:00:00Z" }, { ...lead(), email: "other@example.invalid" }]) {
    const x = app({ lead: current });
    assert.deepEqual(await x.dispatch(), totals({ claimed: 1, skipped: 1 }));
    assert.equal(x.rows[0].error_code, "recipient_or_lead_changed");
    assert.equal(x.seen.sent.length, 0); assert.equal(x.rows[0].mail_payload, null);
  }
});

test("obsolete pending steps skip, while an equivalent internal current stage remains eligible", async () => {
  const x = app({ lead: { ...lead(), status: "quote" } });
  assert.deepEqual(await x.dispatch(), totals({ claimed: 1, skipped: 1 }));
  assert.equal(x.rows[0].error_code, "status_superseded"); assert.equal(x.seen.sent.length, 0);
  const y = app({ events: [{ ...event(), status: "agency_assignment" }], lead: { ...lead(), status: "co_construction" } });
  assert.deepEqual(await y.dispatch(), totals({ claimed: 1, sent: 1 }));
});

test("unchanged public stage and invalid request payload are skipped without emailing", async () => {
  const invalidIntake = intake(); invalidIntake.trame.accord.accepte = false;
  for (const options of [
    { events: [{ ...event(), previous_status: "agency_assignment", status: "co_construction" }], lead: { ...lead(), status: "co_construction" } },
    { lead: { ...lead(), intake_payload: invalidIntake } },
    { lead: { ...lead(), intake_payload: {} } },
    { lead: { ...lead(), intake_payload: null } },
  ]) {
    const x = app(options);
    assert.deepEqual(await x.dispatch(), totals({ claimed: 1, skipped: 1 }));
    assert.equal(x.rows[0].error_code, "request_not_eligible"); assert.equal(x.seen.sent.length, 0);
  }
});

test("snapshot write failure never contacts provider and records a retryable preparation failure", async () => {
  for (const options of [{ snapshotError: true }, { snapshotMissing: true }]) {
    const x = app(options);
    assert.deepEqual(await x.dispatch(), totals({ claimed: 1, failed: 1 }));
    assert.equal(x.rows[0].error_code, "email_snapshot_unavailable");
    assert.equal(x.seen.sent.length, 0); assert.equal(x.rows[0].mail_payload, null);
  }
});

test("lead read failure is retryable without creating or sending a message", async () => {
  const x = app({ leadError: true });
  assert.deepEqual(await x.dispatch(), totals({ claimed: 1, failed: 1 }));
  assert.equal(x.rows[0].error_code, "lead_read_unavailable"); assert.equal(x.seen.sent.length, 0);
});

test("retry uses the frozen payload even when name, destination, current stage and URL changed", async () => {
  const x = app({ sender: async () => ({ ok: false, error: "rejected" }) });
  await x.dispatch();
  const frozen = structuredClone(x.rows[0].mail_payload);
  const changedLead = lead(); changedLead.traveler_name = "Nouveau nom"; changedLead.status = "quote";
  changedLead.intake_payload.trame.ou.noms = ["Oran"];
  process.env.NEXT_PUBLIC_SITE_BASE_URL = "https://new-site.example.invalid";
  const retry = app({ events: [{ ...x.rows[0], next_attempt_at: "2020-01-01T00:00:00Z" }], lead: changedLead });
  assert.deepEqual(await retry.dispatch(), totals({ claimed: 1, sent: 1 }));
  assert.deepEqual(retry.seen.sent[0], { ...frozen, timeoutMs: 5000 });
  assert.equal(retry.seen.updates.filter(update => Object.hasOwn(update.patch, "mail_payload")).length, 0);
  assert.equal(retry.rows[0].attempts, 2);
  assert.doesNotMatch(retry.seen.sent[0].html, /Nouveau nom|Oran|new-site/);
});

test("frozen recipient or idempotency mismatch is quarantined as unknown, without provider call", async () => {
  const original = app(); await original.dispatch();
  for (const changes of [{ to: "other@example.invalid" }, { idempotencyKey: "different-event" }]) {
    const x = app({ events: [{ ...event(), mail_payload: { ...original.rows[0].mail_payload, ...changes } }] });
    assert.deepEqual(await x.dispatch(), totals({ claimed: 1, unknown: 1 }));
    assert.equal(x.rows[0].error_code, "email_snapshot_mismatch"); assert.equal(x.seen.sent.length, 0);
  }
});

test("provider and activity projections exclude all raw queue and CRM fields", async () => {
  const original = app(); await original.dispatch();
  const x = app({ events: [{ ...event(), internal: "QUEUE_PRIVATE", mail_payload: { ...original.rows[0].mail_payload, raw: "PAYLOAD_PRIVATE", intake: intake() } }] });
  await x.dispatch();
  assert.deepEqual(Object.keys(x.seen.sent[0]).sort(), ["to", "subject", "html", "text", "idempotencyKey", "timeoutMs"].sort());
  assert.equal(x.seen.sent[0].timeoutMs, 5000);
  assert.doesNotMatch(JSON.stringify([x.seen.sent, x.seen.activities]), /QUEUE_PRIVATE|PAYLOAD_PRIVATE|INTERNAL_NOTE|INTERNAL_PARTNER|suivi_token/);
  assert(!JSON.stringify([x.seen.sent, x.seen.activities]).includes(TOKEN));
  assert.doesNotMatch(JSON.stringify(x.seen.activities), /lina@example|Lina|Djanet/);
});

test("restored production keepalive requires its Cron secret before any database call", async () => {
  let clients = 0;
  const keepalive = load("src/app/api/cron/keepalive/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/supabase/admin": { createServiceRoleClient() { clients++; throw Error("Unexpected DB access"); } },
  });
  for (const secret of [undefined, "", CRON]) {
    if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
    const request = new Request("https://crm.invalid/api/cron/keepalive", { headers: { Authorization: `Bearer ${SECRET}` } });
    assert.equal((await keepalive.GET(request)).status, 401);
  }
  assert.equal(clients, 0);
});

test("restored production keepalive performs its minimal head query when authorized", async () => {
  let clients = 0;
  const keepalive = load("src/app/api/cron/keepalive/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/supabase/admin": { createServiceRoleClient() {
      clients++; return { from(table) {
        assert.equal(table, "leads"); return { select(columns, options) {
          assert.equal(columns, "id"); assert.deepEqual(options, { count: "exact", head: true });
          return Promise.resolve({ count: 1, error: null });
        } };
      } };
    } },
  });
  const response = await keepalive.GET(new Request("https://crm.invalid/api/cron/keepalive", { headers: { Authorization: `Bearer ${CRON}` } }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, leads: 1 });
  assert.equal(clients, 1);
});

test("public token routes and secret-protected workers do not depend on CRM session refresh", async () => {
  let sessions = 0;
  const middleware = load("middleware.ts", {
    "next/server": { NextResponse: { next: () => "continue" } },
    "@/lib/supabase/middleware": { updateSession: async () => { sessions++; return "session"; } },
  });
  for (const pathname of ["/q", "/q/token", "/api/q/token", "/api/traveler-project-status", "/api/project-status-emails", "/api/cron/keepalive"]) {
    assert.equal(await middleware.middleware({ nextUrl: { pathname } }), "continue", pathname);
  }
  assert.equal(sessions, 0);
  for (const pathname of ["/dashboard", "/leads/one", "/api/project-status-emails/other", "/api/cron/keepalive-other"]) {
    assert.equal(await middleware.middleware({ nextUrl: { pathname } }), "session", pathname);
  }
  assert.equal(sessions, 4);
});

test("the existing external relecture rewrite avoids CRM session refresh at the matcher", () => {
  const middleware = load("middleware.ts", {
    "next/server": {}, "@/lib/supabase/middleware": {},
  });
  const matches = pathname => middleware.config.matcher.some(pattern => new RegExp(`^${pattern}$`).test(pathname));
  for (const pathname of ["/relecture", "/relecture/fiche", "/_next/static/chunk.js", "/favicon.ico"]) assert.equal(matches(pathname), false, pathname);
  for (const pathname of ["/leads", "/dashboard", "/api/project-status-emails", "/api/cron/keepalive"]) assert.equal(matches(pathname), true, pathname);
});

test("activity audit failure does not undo durable sent state or cause a retry", async () => {
  for (const options of [{ auditError: true }, { auditThrows: true }]) {
    const x = app(options);
    assert.deepEqual(await x.dispatch(), totals({ claimed: 1, sent: 1 }));
    assert.equal(x.rows[0].state, "sent"); assert.equal(x.rows[0].provider_id, "provider-accepted");
    assert.deepEqual(await x.dispatch(), totals()); assert.equal(x.seen.sent.length, 1);
  }
});
