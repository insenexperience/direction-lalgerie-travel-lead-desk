/* eslint-disable @typescript-eslint/no-require-imports -- Real TS modules, with only the database/session boundary replaced. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(relative, mocks = {}, cache = new Map()) {
  const base = path.resolve(__dirname, '..', relative);
  const filename = [base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!filename) throw Error(`Missing module: ${relative}`);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const localRequire = id => Object.hasOwn(mocks, id) ? mocks[id]
    : id.startsWith('@/') ? load(`src/${id.slice(2)}`, mocks, cache)
    : id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), id)), mocks, cache) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const id = '11111111-1111-4111-8111-111111111111', userId = '22222222-2222-4222-8222-222222222222';
const stamp = '2026-10-31T10:00:00.000Z', exchanged = '2026-10-28T09:30:00.000Z';
function app({ activities = [], proposals = [], lead = {}, user = { id: userId }, role = 'lead_referent', rpcError = null } = {}) {
  const row = { id, updated_at: stamp, status: 'new', created_at: '2026-10-27T08:08:00.000Z', deleted_at: null, referent_id: userId, traveler_name: 'Voyageuse test', ...lead };
  const tables = { leads: [row], profiles: [{ id: userId, role }], agencies: [], quotes: [], lead_circuit_proposals: proposals, activities };
  const calls = [];
  const db = { auth: { getUser: async () => ({ data: { user } }) }, from(table) {
    let rows = tables[table]; assert(rows, table);
    const q = { select() { return q; }, eq(k, v) { rows = rows.filter(r => r[k] === v); return q; },
      in(k, values) { rows = rows.filter(r => values.includes(r[k])); return q; },
      is(k, v) { rows = rows.filter(r => (r[k] ?? null) === v); return q; },
      neq() { return q; }, not(k, op, v) { rows = rows.filter(r => (r[k] ?? null) !== v); return q; }, or() { return q; }, order() { return q; },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }), range: async () => ({ data: rows, error: null }) };
    return q;
  }, rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; } };
  const mocks = { '@/lib/supabase/server': { createClient: async () => db }, 'next/cache': { revalidatePath() {} } };
  return { db, mocks, calls };
}

test('un premier échange WhatsApp arrête le compteur à sa date réelle et laisse le dossier à compléter', async () => {
  const a = app({ activities: [{ lead_id: id, kind: 'first_response', created_at: stamp,
    payload: { k: 'sys', channel: 'whatsapp', occurred_at: exchanged, s: 'Premier échange · WhatsApp', b: 'Projet encore à préciser.' } }] });
  const [p] = await load('src/lib/bo3/load.ts', a.mocks).chargerProjets({ supabase: a.db }, { id });
  assert.equal(p.statut, 'a_completer');
  assert.equal(p.premiereReponse, exchanged);
  assert.equal(p.brief, null);
  assert.equal(p.consultations.length, 0);
  const clock = load('src/lib/bo3/projet.ts', a.mocks).travelerClock(p, Date.parse(stamp));
  assert.equal(clock.state, 'green');
});

test('un email réellement envoyé ou déclaré externe compte comme contact sans valider la qualification', async () => {
  for (const kind of ['email_sent', 'email_sent_externally']) {
    const a = app({ activities: [{ lead_id: id, kind, created_at: stamp,
      payload: { k: 'out', email_kind: 'qualification', s: 'Questions voyage', b: 'Précisons le projet.' } }] });
    const [p] = await load('src/lib/bo3/load.ts', a.mocks).chargerProjets({ supabase: a.db }, { id });
    assert.equal(p.premiereReponse, stamp);
    assert.equal(p.statut, 'a_completer');
  }
});

test('un échange complémentaire figure dans le journal sans inventer une première réponse', async () => {
  const a = app({ activities: [{ lead_id: id, kind: 'external_exchange', created_at: stamp,
    payload: { k: 'sys', channel: 'telephone', occurred_at: exchanged, s: 'Échange · Téléphone', b: 'Un point complémentaire.' } }] });
  const [p] = await load('src/lib/bo3/load.ts', a.mocks).chargerProjets({ supabase: a.db }, { id });
  assert.equal(p.premiereReponse, null);
  assert(p.messages.some(m => m.b === 'Un point complémentaire.'));
});

const input = (extra = {}) => ({ channel: 'whatsapp', note: 'Premier échange, qualification à poursuivre.', occurredAt: exchanged, firstResponse: true, expectedUpdatedAt: stamp, ...extra });
test('enregistrer un échange utilise une transaction dédiée, sans mise à jour de statut ni prestataire email', async () => {
  const a = app();
  const r = await load('src/app/(dashboard)/leads/exchange-actions.ts', a.mocks).enregistrerEchangeExterne(id, input());
  assert.equal(r.ok, true, r.erreur);
  assert.deepEqual(a.calls, [{ name: 'record_lead_external_exchange', args: { p_lead_id: id, p_channel: 'whatsapp', p_note: input().note,
    p_occurred_at: exchanged, p_first_response: true, p_expected_updated_at: stamp } }]);
});

test('un échange sans accès, sur une fiche modifiée ou avec des données invalides est refusé', async () => {
  const invoke = a => load('src/app/(dashboard)/leads/exchange-actions.ts', a.mocks).enregistrerEchangeExterne;
  for (const options of [{ user: null }, { role: null }, { lead: { referent_id: 'other' } }, { lead: { deleted_at: stamp } }, { lead: { status: 'won' } }, { lead: { updated_at: exchanged } }]) {
    const a = app(options); assert.equal((await invoke(a)(id, input())).ok, false); assert.equal(a.calls.length, 0);
  }
  for (const extra of [{ note: ' ' }, { note: 'x'.repeat(2001) }, { channel: 'invalid' }, { occurredAt: 'not-a-date' }, { occurredAt: '2999-01-01T00:00:00.000Z' }, { firstResponse: 'oui' }]) {
    const a = app(); assert.equal((await invoke(a)(id, input(extra))).ok, false); assert.equal(a.calls.length, 0);
  }
});

test('le formulaire de contact ne demande pas de terminer une étape', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { ExternalExchangeDialog } = load('src/components/bo3/external-exchange-dialog.tsx', { '@/app/(dashboard)/leads/exchange-actions': {} });
  const html = renderToStaticMarkup(React.createElement(ExternalExchangeDialog, {
    p: { id, statut: 'a_completer', canal: 'whatsapp', premiereReponse: null }, updatedAt: stamp, now: Date.parse(stamp), onClose() {}, onSaved() {},
  }));
  assert.match(html, /type="datetime-local"/);
  assert.match(html, /type="checkbox"[^>]*checked=""/);
  assert.doesNotMatch(html, /Étape atteinte|qualification faite/);
  assert.match(html, /étape actuelle est conservée/i);
});

test('un brief en brouillon ne devient ni une agence consultée ni un jalon envoyé', async () => {
 const a = app({ lead: { status: 'agency_assignment' }, proposals: [{ id:'draft', lead_id:id, agency_id:'agency', status:'pending_send', brief_sent_at:null, agency_proposal_payload:{} }] });
 const [p] = await load('src/lib/bo3/load.ts', a.mocks).chargerProjets({supabase:a.db}, {id});
 assert.equal(p.statut,'brief_pret'); assert.equal(p.consultations.length,0);
});
