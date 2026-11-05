/* eslint-disable @typescript-eslint/no-require-imports -- Pure template tested without database or email provider. */
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

const { buildProjectStatusEmail: build } = load("src/lib/email/project-status-email.ts", {
  "@/lib/email/resend-client": { sendTransactionalHtmlEmail() { assert.fail("Template must never send email"); } },
});
const { travelerProjectTracking } = load("src/lib/traveler-project-tracking.ts");
const TOKEN = "ab".repeat(32);
const EVENT_ID = "11111111-aaaa-4111-8111-111111111111", LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fixture = () => ({
  eventId: EVENT_ID, leadId: LEAD_ID, fullName: "Lina Benali", email: "lina@example.invalid",
  previousStatus: "new", status: "qualification",
  intake: {
    full_name: "Ancien nom", email: "old@example.invalid", suivi_token: TOKEN, suivi_token_hash: "private-hash",
    notes_longues: "CRM_PRIVATE_NOTE", partner: { name: "PARTNER_PRIVATE_NAME" },
    trame: {
      version: 1, type: "demande-projet-voyage",
      ou: { nomsSuperRegions: ["Le Grand Sud"], noms: ["Djanet"] },
      quand: { mode: "nsp" }, voyageurs: { adultes: 2 },
      envies: { selection: [{ cle: "experiences:test", nom: "NOT_NEEDED_WISH" }], message: "NOT_NEEDED_TRAVELER_MESSAGE" },
      contact: { email: "contact-private@example.invalid", telephone: "PRIVATE_PHONE" },
      accord: { accepte: true, texte: "PRIVATE_CONSENT_TEXT" }, entree: { page: `https://private.invalid/?token=${TOKEN}` },
      agent: { nom: "PRIVATE_AGENT_NAME" },
    },
  },
});
const envKeys = ["NODE_ENV", "NEXT_PUBLIC_SITE_BASE_URL"];
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
test.beforeEach(() => { process.env.NODE_ENV = "test"; delete process.env.NEXT_PUBLIC_SITE_BASE_URL; });
test.after(() => { for (const key of envKeys) { if (previousEnv[key] === undefined) delete process.env[key]; else process.env[key] = previousEnv[key]; } });

test("public stage mail uses the tracking label, actual recipient, destination and browser-only project link", () => {
  const input = fixture(), mail = build(input);
  assert.equal(mail.to, input.email);
  assert.equal(mail.subject, `Direction l’Algérie — ${travelerProjectTracking(input.status).libelle}`);
  assert.match(mail.text, /Bonjour Lina Benali/);
  for (const content of ["État actuel : Étude de votre demande", "Le Grand Sud — Djanet", "même appareil et le même navigateur", "Vous pouvez répondre à cet email"]) assert(mail.text.includes(content));
  assert.match(mail.html, /href="https:\/\/www\.directionlalgerie\.com\/mes-voyages"/);
  assert.doesNotMatch(JSON.stringify(mail), /conseiller|qualification|agency_assignment/);
});

test("same public stages and all unknown statuses are silent", () => {
  for (const [previousStatus, status] of [["new", "new"], ["agency_assignment", "co_construction"], ["co_construction", "agency_assignment"], ["qualification", "refinement"], ["refinement", "qualification"], ["won", "won"], ["lost", "lost"]]) {
    assert.equal(build({ ...fixture(), previousStatus, status }), null);
  }
  for (const unknown of [null, undefined, "", "unknown", "QUOTE", "__proto__", "toString", {}]) {
    assert.equal(build({ ...fixture(), previousStatus: unknown }), null);
    assert.equal(build({ ...fixture(), status: unknown }), null);
  }
});

test("each allowed public stage renders a factual description and canonical label", () => {
  for (const status of ["new", "qualification", "refinement", "agency_assignment", "co_construction", "quote", "negotiation", "won", "lost"]) {
    const mail = build({ ...fixture(), previousStatus: status === "new" ? "qualification" : "new", status });
    assert(mail);
    assert(mail.text.includes(travelerProjectTracking(status).libelle));
    assert.match(mail.text, /notre équipe/i);
    assert.doesNotMatch(mail.text, /conseiller|agence|partenaire/i);
    if (status === "quote") assert.doesNotMatch(mail.text, /proposition (?:est )?(?:envoyée|disponible)/i);
    if (status === "won") assert.match(mail.text, /réservations restent à confirmer/);
    assert.match(mail.text, /ne confirme ni un itinéraire, ni un prix, ni une réservation/);
  }
});

test("closure and reopening never invent reasons, progress or a booking", () => {
  const closed = build({ ...fixture(), previousStatus: "quote", status: "lost" });
  assert.match(closed.text, /Le suivi de cette demande est clôturé/);
  assert.doesNotMatch(closed.text, /refus|annul|réservé|rembours|rouvert/i);
  const reopened = build({ ...fixture(), previousStatus: "lost", status: "qualification" });
  assert.match(reopened.text, /Le suivi de votre demande a été rouvert/);
  assert.match(reopened.text, /État actuel : Étude de votre demande/);
  const acceptedReconsidered = build({ ...fixture(), previousStatus: "won", status: "negotiation" });
  assert.doesNotMatch(acceptedReconsidered.text, /rouvert|annul|réservé/i);
});

test("only a complete v1 website request with explicit consent qualifies", () => {
  const mutations = [
    i => { delete i.intake.trame; }, i => { i.intake.trame = []; }, i => { i.intake.trame.type = "composer"; },
    i => { i.intake.trame.version = 2; }, i => { i.intake.trame.version = "1"; },
    i => { i.intake.trame.accord.accepte = false; }, i => { i.intake.trame.accord.accepte = "true"; },
    i => { delete i.intake.trame.accord; i.intake.consentement = { accepte: true }; },
    ...["ou", "quand", "voyageurs", "envies", "contact"].flatMap(key => [i => { delete i.intake.trame[key]; }, i => { i.intake.trame[key] = []; }]),
  ];
  for (const change of mutations) { const input = fixture(); change(input); assert.equal(build(input), null); }
});

test("one mailbox only and a valid event identity are required", () => {
  for (const email of ["", "not-email", "a@example.com,b@example.com", "a@example.com;b@example.com", "Name <a@example.com>", "a@example.com\r\nBcc:other@example.com", "a@example.com\n"]) {
    assert.equal(build({ ...fixture(), email }), null);
  }
  for (const invalidId of ["", "with spaces", "event\nHeader", "a".repeat(129), "event-1", null, `${EVENT_ID} `]) {
    assert.equal(build({ ...fixture(), eventId: invalidId }), null);
    assert.equal(build({ ...fixture(), leadId: invalidId }), null);
  }
  assert.equal(build({ ...fixture(), email: " lina@example.invalid " }).to, "lina@example.invalid");
});

test("dynamic name and destination are escaped in HTML while plain text remains readable", () => {
  const input = fixture();
  input.fullName = 'Lina <img src=x onerror="bad()"> & Amine';
  input.intake.trame.ou.noms = ['<script>alert("destination")</script>'];
  const mail = build(input);
  assert(mail.text.includes(input.fullName));
  assert(mail.text.includes(input.intake.trame.ou.noms[0]));
  assert.match(mail.html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt; &amp; Amine/);
  assert.match(mail.html, /&lt;script&gt;alert\(&quot;destination&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(mail.html, /<img|<script/);
  assert.doesNotMatch(mail.subject, /Lina|destination/);
});

test("private context, notes, partner names, contact details and access credentials never enter mail", () => {
  const serialized = JSON.stringify(build(fixture()));
  for (const privateValue of [TOKEN, "private-hash", "CRM_PRIVATE_NOTE", "PARTNER_PRIVATE_NAME", "PRIVATE_AGENT_NAME", "PRIVATE_PHONE", "PRIVATE_CONSENT_TEXT", "NOT_NEEDED_TRAVELER_MESSAGE", "NOT_NEEDED_WISH", "contact-private@example.invalid", "old@example.invalid", LEAD_ID, "private.invalid"]) {
    assert(!serialized.includes(privateValue), privateValue);
  }
  assert.doesNotMatch(serialized, /suivi_token|intake|notes_longues|\/q\//);
});

test("unknown or absent destinations stay useful without a counselor or empty placeholder", () => {
  const input = fixture(); input.intake.trame.ou = { jeNeSaisPas: true };
  assert.match(build(input).text, /Destination envisagée : À définir avec notre équipe/);
  input.intake.trame.ou = { superRegions: ["centre"], territoires: ["Le Djurdjura"] };
  assert.match(build(input).text, /Le Centre — Le Djurdjura/);
  input.intake.trame.ou = {};
  assert.doesNotMatch(build(input).text, /Destination envisagée/);
  input.fullName = " "; assert.match(build(input).text, /^Bonjour,/);
});

test("idempotency belongs to the transition event, including later returns to an earlier public stage", () => {
  const input = fixture(), copy = structuredClone(input), first = build(input);
  assert.deepEqual(input, copy);
  assert.equal(first.idempotencyKey, `project-status-${EVENT_ID}`);
  assert.deepEqual(build(input), first);
  assert.equal(build({ ...input, eventId: EVENT_ID.toUpperCase() }).idempotencyKey, first.idempotencyKey);
  const later = build({ ...input, eventId: "22222222-2222-4222-8222-222222222222", previousStatus: "quote" });
  assert.notEqual(first.idempotencyKey, later.idempotencyKey);
});

test("the shared site URL policy excludes credentials, proof and insecure remote links", () => {
  for (const base of ["https://user:password@example.invalid", `https://example.invalid?token=${TOKEN}`, "javascript:alert(1)", "http://example.invalid"]) {
    process.env.NEXT_PUBLIC_SITE_BASE_URL = base;
    const mail = build(fixture());
    assert.match(mail.text, /https:\/\/www\.directionlalgerie\.com\/mes-voyages/);
    assert(!JSON.stringify(mail).includes(TOKEN));
  }
  process.env.NEXT_PUBLIC_SITE_BASE_URL = "https://travel.example.invalid/";
  assert.match(build(fixture()).text, /https:\/\/travel\.example\.invalid\/mes-voyages/);
});
