/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the real BO3 loader at its database boundary. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(relative, mocks = {}, cache = new Map()) {
  const base = path.resolve(__dirname, '..', relative);
  const filename = [base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!filename) throw Error(`Module absent: ${relative}`);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}`, mocks, cache);
    if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), id)), mocks, cache);
    return require(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const stamp = '2026-10-31T10:00:00.000Z';
const manual = (stage, dbStatus) => ({ lead_id: id, kind: 'manual_stage_advanced', created_at: stamp,
  payload: { k: 'sys', stage, db_status: dbStatus, channel: 'whatsapp', s: 'Avancement manuel · WhatsApp', b: 'Traité lors de notre échange WhatsApp.' } });

function database({ status = 'agency_assignment', activities = [], lead = {}, role = 'lead_referent', user = { id: userId }, rpcError = null } = {}) {
  const row = { id, status, updated_at: stamp, referent_id: userId, deleted_at: null, traveler_name: 'Voyageuse test', created_at: stamp, ...lead };
  const calls = [];
  const tables = { leads: [row], activities, agencies: [], quotes: [], lead_circuit_proposals: [], profiles: [{ id: userId, role }] };
  const db = { auth: { getUser: async () => ({ data: { user } }) },
    from(table) {
      let rows = tables[table];
      assert(rows, table);
      const q = {
        select() { return q; }, eq(key, value) { rows = rows.filter(r => r[key] === value); return q; },
        is(key, value) { rows = rows.filter(r => (r[key] ?? null) === value); return q; },
        in(key, values) { rows = rows.filter(r => values.includes(r[key])); return q; },
        neq() { return q; }, not() { return q; }, order() { return q; }, or() { return q; },
        range: async () => ({ data: rows, error: null }), maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      }; return q;
    },
    rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError }; },
  };
  const mocks = { '@/lib/supabase/server': { createClient: async () => db }, 'next/cache': { revalidatePath() {} } };
  return { db, mocks, calls };
}

test('une étape traitée sur WhatsApp reste avancée après rechargement sans faux email ni consultation', async () => {
  const app = database({ activities: [manual('envoye', 'agency_assignment')] });
  const { chargerProjets } = load('src/lib/bo3/load.ts', app.mocks);
  const [p] = await chargerProjets({ supabase: app.db }, { id });
  assert.equal(p.statut, 'envoye');
  assert.equal(p.consultations.length, 0);
  assert.equal(p.devis, null);
  assert.equal(p.messages.length, 1);
  assert.match(p.messages[0].b, /WhatsApp/);
  assert.equal(p.premiereReponse, null);
});

test('le journal manuel ne fait pas régresser une proposition, une clôture ou un dossier réinitialisé', async () => {
  for (const [status, wanted] of [['quote', 'proposee'], ['won', 'clos'], ['lost', 'clos'], ['new', 'a_completer']]) {
    const app = database({ status, activities: [manual('envoye', 'agency_assignment')] });
    const [p] = await load('src/lib/bo3/load.ts', app.mocks).chargerProjets({ supabase: app.db }, { id });
    assert.equal(p.statut, wanted);
  }
});

test('des données de jalon invalides sont ignorées', async () => {
  const app = database({ activities: [manual('clos', 'agency_assignment'), manual('__proto__', 'agency_assignment')] });
  const [p] = await load('src/lib/bo3/load.ts', app.mocks).chargerProjets({ supabase: app.db }, { id });
  assert.equal(p.statut, 'brief_pret');
});

test('un ancien jalon ne se réactive pas quand un dossier réinitialisé revient au même statut', async () => {
  const old = manual('envoye', 'agency_assignment');
  const reset = { lead_id: id, kind: 'lead_reset', created_at: '2026-10-31T11:00:00.000Z', payload: {} };
  const first = { lead_id: id, kind: 'first_response', created_at: stamp, payload: { k: 'sys', s: 'Première réponse déclarée', b: 'Ancien échange' } };
  const app = database({ activities: [old, first, reset] });
  const [p] = await load('src/lib/bo3/load.ts', app.mocks).chargerProjets({ supabase: app.db }, { id });
  assert.equal(p.statut, 'brief_pret');
  assert.equal(p.premiereReponse, null);
  assert(p.messages.some(m => m.b === 'Ancien échange'), 'Historique conservé');
  const next = database({ activities: [old, first, reset, { ...manual('envoye', 'agency_assignment'), created_at: '2026-10-31T12:00:00.000Z' }] });
  const [advanced] = await load('src/lib/bo3/load.ts', next.mocks).chargerProjets({ supabase: next.db }, { id });
  assert.equal(advanced.statut, 'envoye');
});

const input = (extra = {}) => ({ stage: 'envoye', channel: 'whatsapp', note: '  Brief traité par WhatsApp.  ', expectedUpdatedAt: stamp, firstResponse: true, ...extra });

test('l’action transmet une déclaration explicite à une seule transaction et ne contacte aucun voyageur', async () => {
  const app = database();
  const { avancerEtapeManuellement } = load('src/app/(dashboard)/leads/manual-stage-actions.ts', app.mocks);
  const r = await avancerEtapeManuellement(id, input());
  assert.equal(r.ok, true, r.erreur);
  assert.deepEqual(app.calls, [{ name: 'advance_lead_manual_stage', args: {
    p_lead_id: id, p_stage: 'envoye', p_channel: 'whatsapp', p_note: 'Brief traité par WhatsApp.',
    p_expected_updated_at: stamp, p_first_response: true,
  } }]);
});

test('une session absente, un autre référent et une fiche périmée ne peuvent avancer', async () => {
  for (const opts of [{ user: null }, { lead: { referent_id: 'autre' } }, { lead: { updated_at: '2026-10-31T11:00:00.000Z' } }, { role: null }, { lead: { deleted_at: stamp } }]) {
    const app = database(opts);
    const r = await load('src/app/(dashboard)/leads/manual-stage-actions.ts', app.mocks).avancerEtapeManuellement(id, input());
    assert.equal(r.ok, false);
    assert.equal(app.calls.length, 0);
  }
});

test('la même étape, un retour arrière, une clôture implicite et une déclaration incomplète sont refusés', async () => {
  for (const extra of [{ stage: 'brief_pret' }, { stage: 'recu' }, { stage: 'clos' }, { stage: '__proto__' }, { channel: 'unexpected' }, { note: ' ' }, { note: 'x'.repeat(2001) }, { firstResponse: 'oui' }]) {
    const app = database();
    const r = await load('src/app/(dashboard)/leads/manual-stage-actions.ts', app.mocks).avancerEtapeManuellement(id, input(extra));
    assert.equal(r.ok, false);
    assert.equal(app.calls.length, 0);
  }
});

test('le refus transactionnel de la base remonte sans annoncer une réussite', async () => {
  const app = database({ rpcError: { code: 'P0001', message: 'Le dossier a été modifié entre-temps.' } });
  const r = await load('src/app/(dashboard)/leads/manual-stage-actions.ts', app.mocks).avancerEtapeManuellement(id, input());
  assert.equal(r.ok, false);
  assert.match(r.erreur, /modifié/);
});

test('le formulaire ne propose que les étapes suivantes et distingue une première réponse déjà connue', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { ManualStageDialog } = load('src/components/bo3/manual-stage-dialog.tsx', {
    '@/app/(dashboard)/leads/manual-stage-actions': {},
  });
  const p = { id, statut: 'envoye', canal: 'whatsapp', premiereReponse: null };
  const render = project => renderToStaticMarkup(React.createElement(ManualStageDialog, { p: project, updatedAt: stamp, onClose() {}, onSaved() {} }));
  const html = render(p);
  assert.match(html, /role="dialog"/);
  assert.match(html, /<textarea[^>]*required=""/);
  assert.match(html, /type="checkbox"/);
  assert.deepEqual([...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]), ['proposition','proposee','whatsapp','email','telephone','autre']);
  assert.doesNotMatch(render({ ...p, premiereReponse: stamp }), /type="checkbox"/);
});
