/* eslint-disable @typescript-eslint/no-require-imports -- Real intake route; only external I/O is replaced. */
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

function load(relative, mocks, cache = new Map()) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id]
    : id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`, mocks, cache) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, loaded, loaded.exports);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}

const TOKEN = "72".repeat(32);
const HASH = createHash("sha256").update(TOKEN).digest("hex");
const fixture = () => ({
  full_name: "Essai carte", email: "carte@example.invalid", submission_id: "audit-map-request",
  suivi_token: TOKEN, suivi_token_hash: "untrusted-client-hash", page_origin: "/demande-projet",
  trame: {
    version: 1, type: "demande-projet-voyage",
    ou: { superRegions: ["centre", "est"], nomsSuperRegions: ["Le Centre", "L’Est"],
      territoires: ["alger", "kabylie", "constantine", "aures", "setif", "jijel"],
      noms: ["Alger", "Kabylie", "Constantine", "Aurès", "Sétif", "Jijel"] },
    quand: { mode: "dates", dates: { arrivee: "2027-04-10", depart: "2027-04-20", aQuelquesJoursPres: true }, duree: "Dix jours" },
    voyageurs: { type: "En couple", adultes: 2, enfants: 0 },
    envies: { libelles: ["Culture & patrimoine"], confort: "Bon confort", message: "Préserver toutes mes destinations.",
      selection: [{ cle: "villes:alger", nom: "Alger" }, { cle: "experiences:casbah", nom: "Casbah d’Alger" }] },
    contact: { prenom: "Essai", nom: "carte", email: "carte@example.invalid", canal: "E-mail" },
    accord: { accepte: true }, extension: { nouveauChamp: "à conserver" },
  },
});

function app(existing = null) {
  const seen = { rows: [], notifications: [], receipts: [] };
  const db = { from(table) {
    if (table === "activities") return { insert: () => ({ abortSignal: async () => ({ error: null }) }) };
    const query = { select() { return query; }, eq() { return query; },
      maybeSingle: async () => ({ data: existing, error: null }),
      insert(row) { seen.rows.push(row); return query; },
      single: async () => ({ data: { id: "audit-lead" }, error: null }),
    };
    return query;
  } };
  const route = load("src/app/api/intake/route.ts", {
    "@/lib/supabase/admin": { createServiceRoleClient: () => db },
    "next/cache": { revalidatePath() {} },
    "@/lib/email/lead-notification": { notifierNouveauLead: async input => { seen.notifications.push(input); return { ok: true }; } },
    "@/lib/email/demande-receipt": { envoyerAccuseDemande: async input => { seen.receipts.push(input); return { ok: true }; } },
    "@/lib/email/traveler-ack": { accuseReceptionActif: () => false },
  });
  return { seen, post: body => route.POST(new Request("https://crm.invalid/api/intake", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Intake-Secret": "audit-secret" }, body: JSON.stringify(body),
  })) };
}

test("a complete map request keeps every choice and stores only the server-generated tracking hash", async () => {
  const previous = process.env.INTAKE_SHARED_SECRET;
  process.env.INTAKE_SHARED_SECRET = "audit-secret";
  try {
    const body = fixture(), original = structuredClone(body), { seen, post } = app();
    const response = await post(body), result = await response.json();
    assert.equal(response.status, 201);
    assert.equal(result.suivi_disponible, true);
    assert.deepEqual(seen.rows[0].intake_payload.trame, original.trame);
    assert.equal(seen.rows[0].intake_payload.suivi_token_hash, HASH);
    assert.equal(seen.rows[0].travel_start_date, "2027-04-10");
    assert.equal(seen.rows[0].travelers_adults, 2);
    assert.equal(seen.rows[0].travelers_children, 0);
    for (const name of original.trame.ou.noms) assert(seen.rows[0].project_description.includes(name), name);
    assert(!JSON.stringify(seen.rows).includes(TOKEN));
    assert(!JSON.stringify(result).includes(HASH));
    assert(!JSON.stringify([...seen.notifications, ...seen.receipts]).includes("suivi_token"));
    assert.deepEqual(body, original);
  } finally {
    if (previous === undefined) delete process.env.INTAKE_SHARED_SECRET; else process.env.INTAKE_SHARED_SECRET = previous;
  }
});

test("replaying a saved map request grants tracking only to its original proof and sends nothing twice", async () => {
  const previous = process.env.INTAKE_SHARED_SECRET;
  process.env.INTAKE_SHARED_SECRET = "audit-secret";
  try {
    for (const [token, available] of [[TOKEN, true], ["83".repeat(32), undefined]]) {
      const { seen, post } = app({ id: "saved-lead", intake_payload: { suivi_token_hash: HASH }, deleted_at: null });
      const response = await post({ ...fixture(), suivi_token: token }), result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(result.status, "already_received");
      assert.equal(result.suivi_disponible, available);
      assert.equal(seen.rows.length, 0);
      assert.equal(seen.notifications.length + seen.receipts.length, 0);
      assert(!JSON.stringify(result).includes(HASH));
    }
  } finally {
    if (previous === undefined) delete process.env.INTAKE_SHARED_SECRET; else process.env.INTAKE_SHARED_SECRET = previous;
  }
});
