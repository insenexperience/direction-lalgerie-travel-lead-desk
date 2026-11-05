/* eslint-disable @typescript-eslint/no-require-imports -- Isolated routes with DB and notifications stubbed. */
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

const tracking = load("src/lib/traveler-project-tracking.ts");
const TOKEN = "bc".repeat(32), OTHER = "de".repeat(32);
const HASH = tracking.hashTrackingToken(TOKEN);
const SHARED = "server-only-test-secret";
const lead = (status = "new") => ({ id: "lead-test", status, intake_payload: { suivi_token_hash: HASH, secret_note: "never exposed" }, deleted_at: null });
const request = (body, secret = SHARED) => new Request("http://crm.invalid/api/test", {
  method: "POST", headers: { "Content-Type": "application/json", ...(secret ? { Authorization: `Bearer ${secret}` } : {}) }, body: JSON.stringify(body),
});
const envBefore = process.env.INTAKE_SHARED_SECRET;
test.beforeEach(() => { process.env.INTAKE_SHARED_SECRET = SHARED; });
test.after(() => { if (envBefore === undefined) delete process.env.INTAKE_SHARED_SECRET; else process.env.INTAKE_SHARED_SECRET = envBefore; });

function routes({ existing = null, lookups, insertError = null, error = null } = {}) {
  const seen = { selects: [], filters: [], inserts: [], notifications: [], lookups: 0 };
  const replies = lookups ? [...lookups] : null;
  const db = { from(table) {
    if (table === "activities") return { insert: () => ({ abortSignal: async () => ({ error: null }) }) };
    assert.equal(table, "leads");
    let excludesDeleted = false;
    const query = {
      select(columns) { seen.selects.push(columns); return query; },
      eq(key, value) { seen.filters.push([key, value]); return query; },
      is(key, value) { seen.filters.push([key, value]); if (key === "deleted_at" && value === null) excludesDeleted = true; return query; },
      maybeSingle: async () => { seen.lookups++; return replies?.length ? replies.shift() : { data: excludesDeleted && existing?.deleted_at ? null : existing, error }; },
      insert(row) { seen.inserts.push(row); return query; },
      single: async () => ({ data: insertError ? null : { id: "lead-created" }, error: insertError }),
    };
    return query;
  } };
  const mocks = {
    "@/lib/supabase/admin": { createServiceRoleClient: () => db },
    "@/lib/email/lead-notification": { notifierNouveauLead: async data => { seen.notifications.push(data); return { ok: true }; } },
    "next/cache": { revalidatePath() {} },
  };
  return {
    intake: load("src/app/api/intake/route.ts", mocks),
    status: load("src/app/api/traveler-project-status/route.ts", mocks), seen,
  };
}
const intakeBody = token => ({ full_name: "Test receipt", email: "receipt@example.invalid", submission_id: "submission-test", ...(token !== undefined ? { suivi_token: token } : {}) });
const statusBody = token => ({ submission_id: "submission-test", suivi_token: token });

test("proof validation is exact 256-bit hex and stores only SHA-256", () => {
  assert.match(HASH, /^[a-f0-9]{64}$/);
  assert.notEqual(HASH, TOKEN);
  assert.equal(tracking.hashTrackingToken(TOKEN.toUpperCase()), HASH);
  for (const bad of [null, {}, "", "a".repeat(63), "a".repeat(65), "g".repeat(64), ` ${TOKEN}`]) {
    assert.equal(tracking.hashTrackingToken(bad), null);
    assert.equal(tracking.verifyTrackingToken(bad, lead().intake_payload), false);
  }
  assert.equal(tracking.verifyTrackingToken(TOKEN, lead().intake_payload), true);
  assert.equal(tracking.verifyTrackingToken(OTHER, lead().intake_payload), false);
  assert.equal(tracking.verifyTrackingToken(TOKEN, { suivi_token_hash: "bad" }), false);
});

test("public mapping covers every CRM stage with no reservation or sent-quote claim", () => {
  const cases = { new: "recue", qualification: "precision", refinement: "precision", agency_assignment: "preparation", co_construction: "preparation", quote: "proposition", negotiation: "discussion", won: "acceptee", lost: "cloturee" };
  for (const [status, code] of Object.entries(cases)) {
    const value = tracking.travelerProjectTracking(status, new Date("2026-10-23T12:00:00.000Z"));
    assert.equal(value.code, code);
    assert.equal(value.verifieLe, "2026-10-23T12:00:00.000Z");
    assert.deepEqual(Object.keys(value).sort(), ["code", "description", "etape", "libelle", "termine", "verifieLe"]);
    assert.equal(value.termine, status === "won" || status === "lost");
  }
  assert.doesNotMatch(JSON.stringify(tracking.travelerProjectTracking("quote")), /envoy|disponible|réservé/i);
  assert.match(tracking.travelerProjectTracking("won").description, /réservations restent à confirmer/);
  for (const status of [null, "unexpected", "__proto__", "toString"]) assert.equal(tracking.travelerProjectTracking(status), null);
});

test("tracking relay authentication is fail-closed and accepts only exact configured server proof", async () => {
  for (const configured of [undefined, "", SHARED]) {
    if (configured === undefined) delete process.env.INTAKE_SHARED_SECRET; else process.env.INTAKE_SHARED_SECRET = configured;
    for (const secret of [null, "wrong"]) {
      const app = routes({ existing: lead() });
      const result = await app.status.POST(request(statusBody(TOKEN), secret));
      assert.equal(result.status, 401);
      assert.equal(app.seen.lookups, 0);
      assert.match(result.headers.get("cache-control"), /no-store/);
    }
  }
  delete process.env.INTAKE_SHARED_SECRET;
  assert.equal(tracking.verifyTrackingRelaySecret(request(statusBody(TOKEN))), false);
  process.env.INTAKE_SHARED_SECRET = SHARED;
  assert.equal(tracking.verifyTrackingRelaySecret(request(statusBody(TOKEN))), true);
  assert.equal(tracking.verifyTrackingRelaySecret(new Request("http://crm.invalid", { headers: { "X-Intake-Secret": SHARED } })), true);
});

test("status responds with only an allowlisted summary after both proofs validate", async () => {
  const app = routes({ existing: lead("co_construction") });
  const result = await app.status.POST(request(statusBody(TOKEN)));
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(Object.keys(body).sort(), ["ok", "suivi"]);
  assert.equal(body.suivi.code, "preparation");
  assert.doesNotMatch(JSON.stringify(body), /secret_note|never exposed|lead-test|suivi_token|intake_payload/);
  assert.deepEqual(app.seen.selects, ["status,intake_payload"]);
  assert(app.seen.filters.some(([key, value]) => key === "deleted_at" && value === null));
  assert.match(result.headers.get("cache-control"), /no-store/);
});

test("unknown request, wrong proof, legacy request and invalid proof have the same 404", async () => {
  let expected;
  for (const [existing, token] of [[null, TOKEN], [lead(), OTHER], [{ ...lead(), intake_payload: {} }, TOKEN], [{ ...lead(), deleted_at: "2026-10-22T00:00:00Z" }, TOKEN], [lead(), "invalid"]]) {
    const app = routes({ existing });
    const result = await app.status.POST(request(statusBody(token)));
    assert.equal(result.status, 404);
    const body = await result.text();
    expected ??= body;
    assert.equal(body, expected);
  }
});

test("unknown CRM state or DB failure never fabricates progress or exposes DB data", async () => {
  for (const options of [{ existing: lead("future-status") }, { error: { message: "private database detail" } }]) {
    const result = await routes(options).status.POST(request(statusBody(TOKEN)));
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { error: "Suivi temporairement indisponible" });
  }
});

test("status refuses GET and malformed or oversized request bodies", async () => {
  const app = routes();
  assert.equal((await app.status.GET()).status, 405);
  assert.equal((await app.status.POST(request(null))).status, 400);
  assert.equal((await app.status.POST(request({ pad: "x".repeat(4100) }))).status, 413);
  assert.equal(app.seen.lookups, 0);
});

test("intake persists hash, confirms tracking, and never sends raw proof/hash to notification", async () => {
  const app = routes();
  const result = await app.intake.POST(request({ ...intakeBody(TOKEN), suivi_token_hash: "attacker-selected" }));
  assert.equal(result.status, 201);
  const body = await result.json();
  assert.equal(body.suivi_disponible, true);
  const row = app.seen.inserts[0];
  assert.equal(row.intake_payload.suivi_token_hash, HASH);
  assert.doesNotMatch(JSON.stringify(row), new RegExp(TOKEN));
  assert.doesNotMatch(JSON.stringify(app.seen.notifications), /suivi_token/);
  assert.doesNotMatch(JSON.stringify(body), /suivi_token/);
  assert.match(result.headers.get("cache-control"), /no-store/);
});

test("an idempotent receipt only confirms tracking for its original browser proof", async () => {
  for (const [token, available] of [[TOKEN, true], [OTHER, false], [undefined, false]]) {
    const app = routes({ existing: lead() });
    const result = await app.intake.POST(request(intakeBody(token)));
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.status, "already_received");
    assert.equal(body.suivi_disponible, available ? true : undefined);
    assert.equal(app.seen.inserts.length, 0);
    assert.equal(app.seen.notifications.length, 0);
  }
});

test("old and deleted requests never gain tracking through a retry", async () => {
  for (const existing of [{ ...lead(), intake_payload: {} }, { ...lead(), deleted_at: "2026-10-20T00:00:00Z" }]) {
    const app = routes({ existing });
    const body = await (await app.intake.POST(request(intakeBody(TOKEN)))).json();
    assert.equal(body.suivi_disponible, undefined);
    assert.equal(app.seen.inserts.length, 0);
  }
});

test("concurrent duplicate insert race remains idempotent and checks browser ownership", async () => {
  for (const [token, available] of [[TOKEN, true], [OTHER, false]]) {
    const app = routes({ lookups: [{ data: null, error: null }, { data: lead(), error: null }], insertError: { code: "23505" } });
    const result = await app.intake.POST(request(intakeBody(token)));
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.status, "already_received");
    assert.equal(body.suivi_disponible, available ? true : undefined);
    assert.equal(app.seen.notifications.length, 0);
  }
});

test("legacy intake still works; malformed provided receipt proof fails before DB", async () => {
  const legacy = routes();
  assert.equal((await legacy.intake.POST(request(intakeBody()))).status, 201);
  assert.equal(Object.hasOwn(legacy.seen.inserts[0].intake_payload, "suivi_token_hash"), false);
  for (const token of [null, "", "short", "g".repeat(64)]) {
    const app = routes();
    assert.equal((await app.intake.POST(request(intakeBody(token)))).status, 422);
    assert.equal(app.seen.lookups, 0);
    assert.equal(app.seen.inserts.length, 0);
  }
});
