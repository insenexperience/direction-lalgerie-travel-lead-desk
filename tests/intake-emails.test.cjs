/* eslint-disable @typescript-eslint/no-require-imports -- Provider and database are isolated; no real emails. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.join(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} };
  const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`, mocks, cache) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  cache.set(filename, loaded.exports); return loaded.exports;
}

const PROOF = "ab".repeat(32), SHARED = "test-server-only", TEAM = "team@example.invalid";
const receipt = load("src/lib/email/demande-receipt.ts");
const fixture = () => ({
  full_name: 'Voyageur <img src=x onerror="alert(1)">', email: "voyageur@example.invalid", submission_id: "request-test", suivi_token: PROOF,
  notes_longues: "Ancien résumé incomplet", flex_period: "novembre", group_type: "En famille", travellers_count: "4",
  trame: {
    version: 1, type: "demande-projet-voyage", ou: { superRegions: ["grand-sud"], nomsSuperRegions: ["Le Grand Sud"], noms: ["Djanet"] },
    quand: { mode: "mois", mois: ["2026-11", "2026-12", "2027-01"], duree: "Dix jours" },
    voyageurs: { type: "En famille", adultes: 2, enfants: 2 },
    envies: { selection: [{ cle: "villes:djanet", nom: "Djanet" }, { cle: "experiences:sebeiba", nom: "La Sebeïba" }, { cle: "activites:test", nom: "<script>activité</script>" }], libelles: ["Rencontres et traditions"], confort: "Bon confort", message: "Un rythme calme & une soirée <familiale>." },
    contact: { email: "voyageur@example.invalid", canal: "E-mail" }, accord: { accepte: true },
  },
});
const envKeys = ["TRAVELER_ACK_ENABLED", "NODE_ENV", "INTAKE_SHARED_SECRET", "NEXT_PUBLIC_SITE_BASE_URL", "LEAD_NOTIFY_EMAIL", "NEXT_PUBLIC_DA_CONTACT_EMAIL", "RESEND_API_KEY", "RESEND_FROM_EMAIL"];
const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
test.beforeEach(() => { delete process.env.TRAVELER_ACK_ENABLED; process.env.NODE_ENV = "test"; process.env.INTAKE_SHARED_SECRET = SHARED; process.env.LEAD_NOTIFY_EMAIL = TEAM; delete process.env.NEXT_PUBLIC_SITE_BASE_URL; });
test.after(() => { for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });

test("receipt includes every wish, calendar, group and comfort as escaped HTML and complete plain text", () => {
  const intake = fixture(); intake.suivi_token_hash = "hash-must-not-appear";
  const mail = receipt.buildDemandeReceiptEmail({ leadId: "lead-test", intake });
  assert.equal(mail.to, intake.email);
  assert.equal(mail.idempotencyKey, "intake-receipt-lead-test");
  for (const value of ["novembre 2026 ou décembre 2026 ou janvier 2027", "Dix jours", "2 adultes", "2 enfants", "Bon confort", "Djanet", "La Sebeïba"]) {
    assert(mail.text.includes(value)); assert(mail.html.includes(value));
  }
  assert(mail.text.includes("<script>activité</script>"));
  assert(mail.html.includes("&lt;script&gt;activité&lt;/script&gt;"));
  assert.doesNotMatch(mail.html, /<script>|<img src=x/);
  assert(mail.html.includes("&lt;familiale&gt;"));
  assert.match(mail.text, /même appareil et le même navigateur/);
  assert.match(mail.text, /ne confirme ni un itinéraire, ni un prix, ni une réservation/);
  assert.doesNotMatch(JSON.stringify(mail), /suivi_token|hash-must-not-appear|Ancien résumé incomplet/);
  assert(!JSON.stringify(mail).includes(PROOF));
});

test("all 300 wishes survive the email summary", () => {
  const intake = fixture(); intake.trame.envies.selection = Array.from({ length: 300 }, (_, i) => ({ cle: `villes:envie-${i}`, nom: `Envie ${i}` }));
  const mail = receipt.buildDemandeReceiptEmail({ leadId: "lead-test", intake });
  assert.equal((mail.html.match(/<li>/g) || []).length, 300);
  for (const { nom } of intake.trame.envies.selection) assert(mail.text.includes(`- ${nom}\n`) || mail.text.includes(`- ${nom}\n\n`));
});

test("explicit dates, flexible dates, unknown timing and region-only requests remain readable", () => {
  const intake = fixture(); intake.trame.ou.noms = [];
  intake.trame.quand = { mode: "dates", dates: { arrivee: "2027-01-15", depart: "2027-01-25", aQuelquesJoursPres: true }, duree: "Dix jours" };
  let mail = receipt.buildDemandeReceiptEmail({ leadId: "lead-test", intake });
  assert.match(mail.text, /2027-01-15 → 2027-01-25, à quelques jours près/);
  assert.match(mail.text, /Le Grand Sud/);
  intake.trame.quand = { mode: "nsp" }; intake.trame.ou.jeNeSaisPas = true;
  mail = receipt.buildDemandeReceiptEmail({ leadId: "lead-test", intake });
  assert.match(mail.text, /À définir avec votre conseiller/);
});

test("receipt is limited to a complete v1 request with explicit consent and one valid mailbox", () => {
  for (const email of ["", "invalid", "a@example.com,b@example.com", "a@example.com;b@example.com", "Name <a@example.com>", "a@example.com\r\nBcc:b@example.com", "a@example.com\n"]) {
    const intake = fixture(); intake.email = email;
    assert.equal(receipt.buildDemandeReceiptEmail({ leadId: "lead-test", intake }), null);
  }
  for (const change of [i => { delete i.trame; }, i => { i.trame.type = "composer"; }, i => { i.trame.version = 2; }, i => { i.trame.accord.accepte = false; }, i => { delete i.trame.accord.accepte; }, i => { i.trame.voyageurs = []; }]) {
    const intake = fixture(); change(intake); assert.equal(receipt.buildDemandeReceiptEmail({ leadId: "lead-test", intake }), null);
  }
});

test("traveler link only uses a safe site base, with HTTP loopback restricted to development", () => {
  assert.equal(receipt.travelerProjectsUrl(), "https://www.directionlalgerie.com/mes-voyages");
  for (const base of ["javascript:alert(1)", "https://user:password@example.com", "https://example.com?token=secret", "https://example.com#secret", "http://example.com", "not a URL"]) {
    process.env.NEXT_PUBLIC_SITE_BASE_URL = base;
    assert.equal(receipt.travelerProjectsUrl(), "https://www.directionlalgerie.com/mes-voyages");
  }
  process.env.NEXT_PUBLIC_SITE_BASE_URL = "https://travel.example.com/";
  assert.equal(receipt.travelerProjectsUrl(), "https://travel.example.com/mes-voyages");
  process.env.NEXT_PUBLIC_SITE_BASE_URL = "http://127.0.0.1:3562/";
  assert.equal(receipt.travelerProjectsUrl(), "http://127.0.0.1:3562/mes-voyages");
  process.env.NODE_ENV = "production";
  assert.equal(receipt.travelerProjectsUrl(), "https://www.directionlalgerie.com/mes-voyages");
});

function app({ existing = null, insertError = null, lookups, sender, auditError = null, auditThrows = false, auditPending = false } = {}) {
  const seen = { inserted: [], sent: [], activities: [], operations: [], auditAborted: false };
  const replies = lookups ? [...lookups] : null;
  const db = { from(table) {
    if (table === "activities") return { insert: rows => ({ abortSignal: async signal => {
      assert(signal instanceof AbortSignal); seen.activities.push(...rows);
      if (auditThrows) throw Error("audit unavailable");
      if (auditPending) return new Promise(resolve => signal.addEventListener("abort", () => { seen.auditAborted = true; resolve({ error: { message: "aborted" } }); }, { once: true }));
      return { error: auditError };
    } }) };
    assert.equal(table, "leads");
    const query = {
      select() { return query; }, eq() { return query; },
      maybeSingle: async () => replies?.length ? replies.shift() : { data: existing, error: null },
      insert(row) { seen.inserted.push(row); seen.operations.push("insert"); return query; },
      single: async () => ({ data: insertError ? null : { id: "lead-created" }, error: insertError }),
    }; return query;
  } };
  const mocks = {
    "@/lib/supabase/admin": { createServiceRoleClient: () => db }, "next/cache": { revalidatePath() {} },
    "@/lib/email/resend-client": { sendTransactionalHtmlEmail: async input => { seen.sent.push(input); seen.operations.push("send"); return sender ? sender(input) : { ok: true, providerId: input.to === TEAM ? "provider-team" : "provider-receipt" }; } },
  };
  const route = load("src/app/api/intake/route.ts", mocks);
  const post = body => route.POST(new Request("http://crm.invalid/api/intake", { method: "POST", headers: { Authorization: `Bearer ${SHARED}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  return { post, seen };
}

test("successful intake sends two distinct idempotent messages after insertion and audits provider acceptance", async () => {
  const x = app(), result = await x.post(fixture());
  assert.equal(result.status, 201);
  assert.deepEqual(await result.json(), { status: "created", id: "lead-created", notified: true, receipt_sent: true, suivi_disponible: true });
  assert.deepEqual(x.seen.operations, ["insert", "send", "send"]);
  assert.deepEqual(x.seen.sent.map(mail => mail.to), [TEAM, "voyageur@example.invalid"]);
  assert.deepEqual(x.seen.sent.map(mail => mail.idempotencyKey), ["intake-team-lead-created", "intake-receipt-lead-created"]);
  for (const mail of x.seen.sent) {
    assert.equal(mail.timeoutMs, 5000);
    assert(mail.text.includes("janvier 2027")); assert(mail.html.includes("La Sebeïba"));
    assert.doesNotMatch(JSON.stringify(mail), /suivi_token/); assert(!JSON.stringify(mail).includes(PROOF));
  }
  assert.equal(x.seen.inserted[0].status, "new");
  assert.equal(x.seen.inserted[0].welcome_email_sent_at, undefined);
  assert.deepEqual(x.seen.activities.map(a => a.kind), ["intake_team_email", "intake_receipt_email"]);
  assert.deepEqual(x.seen.activities.map(a => JSON.parse(a.detail).provider_id), ["provider-team", "provider-receipt"]);
  assert.doesNotMatch(JSON.stringify(x.seen.activities), /voyageur@example|suivi_token|Voyageur/);
});

test("legacy intake sends team notification only and never automatic welcome", async () => {
  const intake = fixture(); delete intake.trame;
  const x = app(), result = await x.post(intake), body = await result.json();
  assert.equal(body.notified, true); assert.equal(body.receipt_sent, undefined);
  assert.equal(x.seen.sent.length, 1); assert.equal(x.seen.sent[0].to, TEAM);
  assert.equal(x.seen.activities.length, 1);
});

test("duplicate requests and insertion races send no messages or email audit", async () => {
  for (const options of [{ existing: { id: "previous", intake_payload: {}, deleted_at: null } }, { lookups: [{ data: null, error: null }, { data: { id: "previous", intake_payload: {}, deleted_at: null }, error: null }], insertError: { code: "23505" } }]) {
    const x = app(options), result = await x.post(fixture());
    assert.equal(result.status, 200); assert.equal((await result.json()).status, "already_received");
    assert.equal(x.seen.sent.length, 0); assert.equal(x.seen.activities.length, 0);
  }
});

test("failed insertion never sends either message", async () => {
  const x = app({ insertError: { code: "failure" } }), result = await x.post(fixture());
  assert.equal(result.status, 500); assert.equal(x.seen.sent.length, 0); assert.equal(x.seen.activities.length, 0);
});

test("one provider failure does not block the other message or lose the saved lead", async () => {
  for (const failTeam of [true, false]) {
    const x = app({ sender: async input => (input.to === TEAM) === failTeam ? { ok: false, error: "private provider error " + PROOF } : { ok: true, providerId: "sent-id" } });
    const result = await x.post(fixture()), body = await result.json();
    assert.equal(result.status, 201); assert.equal(body.notified, !failTeam); assert.equal(body.receipt_sent, failTeam);
    assert.equal(x.seen.sent.length, 2); assert.equal(x.seen.inserted.length, 1);
    assert.equal(JSON.parse(x.seen.activities[failTeam ? 0 : 1].detail).etat, "echec");
    assert(!JSON.stringify(x.seen.activities).includes(PROOF));
    assert.doesNotMatch(JSON.stringify(x.seen.activities), /private provider error/);
  }
});

test("provider exceptions are recorded as unknown delivery without claiming receipt failure", async () => {
  const x = app({ sender: async () => { throw Error("connection lost " + PROOF); } });
  const result = await x.post(fixture()), body = await result.json();
  assert.equal(result.status, 201); assert.equal(body.notified, false); assert.equal(body.receipt_sent, false);
  assert(x.seen.activities.every(a => JSON.parse(a.detail).etat === "confirmation_inconnue"));
  assert(!JSON.stringify(x.seen.activities).includes(PROOF));
});

test("missing configuration and audit failures keep the lead and successful HTTP acknowledgment", async () => {
  for (const failure of [{ auditError: { message: "unavailable" } }, { auditThrows: true }]) {
    const x = app({ ...failure, sender: async () => ({ ok: false, error: "RESEND_API_KEY n'est pas configuré." }) });
    const result = await x.post(fixture());
    assert.equal(result.status, 201); assert.equal((await result.json()).notified, false);
    assert(x.seen.activities.every(a => JSON.parse(a.detail).motif === "configuration_email_absente"));
  }
});

test("a pending activity write is aborted without turning a saved request into an HTTP failure", async () => {
  const keepAlive = setTimeout(() => {}, 2500);
  try {
    const x = app({ auditPending: true }), result = await x.post(fixture());
    assert.equal(x.seen.auditAborted, true);
    assert.equal(result.status, 201);
    assert.equal((await result.json()).receipt_sent, true);
  } finally { clearTimeout(keepAlive); }
});

test("shared Resend client sends text, reply address and provider idempotency key", async () => {
  process.env.RESEND_API_KEY = "test-provider-key"; process.env.RESEND_FROM_EMAIL = "noreply@example.invalid"; process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL = "contact@example.invalid";
  const calls = [];
  const client = load("src/lib/email/resend-client.ts", { resend: { Resend: class { constructor(key) { assert.equal(key, "test-provider-key"); this.emails = { send: async (...args) => { calls.push(args); return { data: { id: "provider-test" }, error: null }; } }; } } } });
  assert.deepEqual(await client.sendTransactionalHtmlEmail({ to: "traveler@example.invalid", subject: "Receipt", html: "<p>Hi</p>", text: "Hi", idempotencyKey: "receipt-unique" }), { ok: true, providerId: "provider-test" });
  assert.deepEqual(calls[0][1], { idempotencyKey: "receipt-unique" });
  assert.equal(calls[0][0].text, "Hi"); assert.equal(calls[0][0].replyTo, "contact@example.invalid");
  delete process.env.RESEND_API_KEY;
  assert.equal((await client.sendTransactionalHtmlEmail({ to: "traveler@example.invalid", subject: "Receipt", html: "<p>Hi</p>" })).ok, false);
  assert.equal(calls.length, 1);
});

test("intake provider timeout reaches the real SDK fetch and aborts the network request", async () => {
  process.env.RESEND_API_KEY = "test-provider-key"; process.env.RESEND_FROM_EMAIL = "noreply@example.invalid";
  const originalFetch = globalThis.fetch; let active = 0, aborted = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers.get("Idempotency-Key"), "bounded-intake");
    assert(options.signal instanceof AbortSignal); active++;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => { active--; aborted++; reject(new DOMException("Aborted", "AbortError")); }, { once: true }));
  };
  try {
    const client = load("src/lib/email/resend-client.ts");
    const result = await client.sendTransactionalHtmlEmail({ to: "traveler@example.invalid", subject: "Receipt", html: "<p>Hi</p>", idempotencyKey: "bounded-intake", timeoutMs: 10 });
    assert.equal(result.ok, false); assert.equal(result.deliveryUnknown, true);
    assert.equal(aborted, 1); assert.equal(active, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("bounded provider success retains the provider id and cancels its timeout timer", async () => {
  process.env.RESEND_API_KEY = "test-provider-key"; process.env.RESEND_FROM_EMAIL = "noreply@example.invalid";
  const originalFetch = globalThis.fetch; let signal;
  globalThis.fetch = async (_url, options) => { signal = options.signal; return new Response(JSON.stringify({ id: "provider-fast" }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  try {
    const client = load("src/lib/email/resend-client.ts");
    const result = await client.sendTransactionalHtmlEmail({ to: "traveler@example.invalid", subject: "Receipt", html: "<p>Hi</p>", idempotencyKey: "bounded-success", timeoutMs: 10 });
    assert.deepEqual(result, { ok: true, providerId: "provider-fast" });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(signal.aborted, false);
  } finally { globalThis.fetch = originalFetch; }
});


test("production legacy acknowledgement remains opt-in and cannot bypass new-request consent", async () => {
  process.env.TRAVELER_ACK_ENABLED = "1";
  const legacy = fixture(); delete legacy.trame;
  const x = app(); const response = await x.post(legacy);
  assert.equal(response.status, 201);
  assert.equal(x.seen.sent.length, 2);
  assert.equal(x.seen.sent[1].subject, "Votre projet est bien arrivé");
  assert.equal(x.seen.activities[1].kind, "ack_sent");
  assert.match(x.seen.activities[1].payload.b, /sous 48 h/);
  for (const change of [() => {}, i => { i.trame.accord.accepte = false; }, i => { i.trame.envies.message = "x".repeat(60001); }]) {
    const request = fixture(); change(request);
    const current = app(); assert.equal((await current.post(request)).status, 201);
    assert.equal(current.seen.sent.filter(mail => mail.subject === "Votre projet est bien arrivé").length, 0);
  }
});
