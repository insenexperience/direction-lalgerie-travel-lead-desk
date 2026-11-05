/* eslint-disable @typescript-eslint/no-require-imports -- Exercises real TS adapters and BO3 SSR markup. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} };
  cache.set(filename, loaded);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = id => {
    if (id.endsWith(".css")) return {};
    if (id.includes("external-exchange-dialog")) return { ExternalExchangeDialog: () => null };
    if (id.includes("manual-stage-dialog")) return { ManualStageDialog: () => null };
    if (id === "next/navigation") return { useRouter: () => ({}), useSearchParams: () => new URLSearchParams() };
    if (id === "next/link") return ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
    if (id.includes("/projet-actions")) return {};
    if (id === "@/components/leads/lead-email-composer") return { LeadEmailComposer: () => null };
    if (id === "@/components/leads/qualification/lead-logistics-editor") return { LeadLogisticsEditor: () => null };
    if (!id.startsWith("@/") && !id.startsWith(".")) return require(id);
    const base = id.startsWith("@/") ? path.resolve(__dirname, "../src", id.slice(2)) : path.resolve(path.dirname(filename), id);
    const file = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    if (!file) throw new Error(`Unresolved test import: ${id}`);
    return load(path.relative(path.resolve(__dirname, ".."), file));
  };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const { trameDepuisSite, dureeTrame, trameInterne } = load("src/lib/bo3/trame.ts");
const { buildBrief } = load("src/lib/bo3/projet.ts");
const request = () => ({
  version: 1, type: "demande-projet-voyage",
  ou: { superRegions: ["ouest"], nomsSuperRegions: ["L’Ouest"], territoires: ["monts-des-ksour"], noms: ["Monts des Ksour"] },
  quand: { mode: "dates", dates: { arrivee: "2027-02-10", depart: "2027-02-20", aQuelquesJoursPres: true }, duree: "Dix jours" },
  voyageurs: { type: "En famille", adultes: 2, enfants: 1 },
  envies: { selection: [
    { cle: "villes:oran", nom: "Oran" }, { cle: "lieux:tiout", nom: "Gravures de Tiout" },
    { cle: "experiences:randonnee-djebel-aissa", nom: "Djebel Aïssa" },
    { cle: "experiences:train-de-nuit-oran-bechar", nom: "Train Oran–Béchar" },
    { cle: "activites:randonnee", nom: "Randonnée" }, { cle: "circuits:ouest", nom: "Voyage dans l’Ouest" },
  ], libelles: ["Nature", "Rencontres"], confort: "Bon confort", message: "Une nuit en bivouac.\nPas de longues marches." },
  contact: { prenom: "Ada", nom: "Voyageuse", email: "ada@example.invalid", telephone: "+33 612345678", paysResidence: "France", canal: "Téléphone" },
  accord: { accepte: true },
});

function projet(trame) {
  return { id: "test-lead", ref: "QA-BO3", nom: "Ada Voyageuse", email: "ada@example.invalid", tel: "+33 612345678",
    canal: "email", source: "demande-projet", statut: "a_completer", dbStatus: "new", recu: "2026-10-23T10:00:00.000Z",
    premiereReponse: null, agenceChoisie: null, trame, texte: "", manque: ["budget", "lieux"], brief: null,
    consultations: [], devis: null, relancesVoyageur: [], messages: [], issue: null, motif: null, closedAt: null,
    notesInternes: "", qualification: [] };
}

test("nouvelle demande : période, groupe et envies conservés sans inventer de journées ni budget", () => {
  const raw = request(), before = JSON.stringify(raw), t = trameDepuisSite(raw);
  assert.equal(t.cadre.duree, "Dix jours");
  assert.match(t.cadre.mois, /2027-02-10.*2027-02-20/);
  assert.match(t.cadre.mois, /à quelques jours près/);
  assert.equal(t.groupe.nombre, 3);
  assert.equal(t.groupe.enfants, 1);
  assert.equal(t.cadre.hebergement, "Bon confort");
  assert.deepEqual(t.envies.grandes, ["Nature", "Rencontres"]);
  assert.deepEqual(t.envies.experiences, ["Djebel Aïssa", "Train Oran–Béchar"]);
  assert.deepEqual(t.envies.activites, ["Randonnée"]);
  for (const wish of raw.envies.selection) assert(t.precisions.includes(wish.nom), wish.nom);
  assert(t.precisions.includes(raw.envies.message));
  assert(t.precisions.includes("Monts des Ksour"));
  assert.equal(t.budget, null);
  assert.equal(t.circuit, null);
  assert.deepEqual(t.jours, []);
  assert.equal(JSON.stringify(raw), before, "intake source stays immutable");
  assert.equal(dureeTrame(t), "Dix jours");
});

test("le brief conserve toutes les envies et exclut les coordonnées privées", () => {
  const raw = request(), t = trameDepuisSite(raw);
  const brief = buildBrief(projet(t)).map(s => s.text).join("\n");
  for (const wish of raw.envies.selection) assert(brief.includes(wish.nom), wish.nom);
  assert(brief.includes("Dix jours"));
  assert(!brief.includes("0 jours"));
  for (const value of [raw.contact.email, raw.contact.telephone, raw.contact.nom, raw.contact.prenom]) assert(!brief.includes(value), value);
});

test("mois multiples, inconnues et versions futures restent distingués", () => {
  const raw = request();
  raw.quand = { mode: "mois", mois: ["2026-11", "2027-01"], duree: "Une semaine" };
  raw.voyageurs = { type: "En couple", adultes: 2, enfants: 0 };
  const t = trameDepuisSite(raw);
  assert.equal(t.cadre.mois, "novembre 2026 ou janvier 2027");
  assert.equal(t.groupe.nombre, 2);
  assert.equal(t.groupe.enfants, 0);
  raw.quand = { mode: "nsp" };
  assert.equal(trameDepuisSite(raw).cadre.mois, "");
  assert.equal(dureeTrame(trameDepuisSite(raw)), "Durée à préciser");
  assert.equal(trameDepuisSite({ ...raw, version: 2 }), null);
});

test("les trames historiques et les journées saisies restent intactes", () => {
  const t = trameDepuisSite({ nom: "Circuit historique", cadre: { mois: "novembre", duree: "Deux semaines" },
    groupe: { type: "couple", nombre: 2 }, budget: { par_personne_hors_vol: "1 200 €" },
    envies: { experiences: [{ nom: "Bivouac" }] }, jours: [{ num: 1, lieux: ["alger"], envies: ["Casbah"] }, { num: 2, lieux: ["djanet"] }], precisions: "Sans marche longue" });
  assert.equal(t.titre, "Circuit historique");
  assert.equal(t.budget, "1 200 € par personne, hors vol");
  assert.deepEqual(t.jours, [{ n: 1, lieux: ["alger"], e: "Casbah" }, { n: 2, lieux: ["djanet"], e: "" }]);
  assert.deepEqual(trameInterne(t), t);
  assert.equal(dureeTrame(t), "2 jours", "composed route length takes precedence in existing listings");
});

test("la fiche BO3 affiche le récap initial complet, même après une correction opérateur", () => {
  const raw = request();
  raw.envies.selection = Array.from({ length: 120 }, (_, i) => ({ cle: `lieux:envie-${i}`, nom: `Envie reçue ${i}` }));
  const t = trameDepuisSite(raw);
  const p = projet({ ...t, titre: "Projet retravaillé", precisions: "Qualification opérateur", envies: { grandes: [], experiences: [], activites: [], pepites: [] } });
  const lead = { id: p.id, traveler_name: p.nom, email: p.email, phone: p.tel, status: "new", intake_payload: { trame: raw }, updated_at: p.recu };
  const { FicheView } = load("src/components/bo3/fiche.tsx");
  const markup = renderToStaticMarkup(React.createElement(FicheView, { p, lead, agences: [], now: Date.parse(p.recu), signature: "Équipe" }));
  for (const value of ["Demande initiale du voyageur", "Envie reçue 0", "Envie reçue 119", "Téléphone", "France", "2027-02-10", "2027-02-20", "2 adultes", "1 enfant", "Bon confort", "ada@example.invalid", "+33 612345678", raw.envies.message]) assert(markup.includes(value), value);
  const overview = markup.match(/<section[^>]*aria-label="Coordonnées et profil du voyageur"[^>]*>(.*?)<\/section>/s);
  assert(overview, "les coordonnées et le profil sont réunis dans le bandeau");
  assert(markup.indexOf(overview[0]) < markup.indexOf('class="stepper"'), "le bandeau est visible avant les étapes");
  assert.match(markup, /class="meta"[^>]*>[^]*?<span>Téléphone<\/span><\/div>/, "l’en-tête indique le canal déclaré");
  for (const value of ['href="mailto:ada@example.invalid"', 'href="tel:+33612345678"', "2 adultes", "1 enfant", "Téléphone", "France", "Bon confort"]) {
    assert(overview[1].includes(value), value);
  }
  assert(!markup.includes("0 jours"));
  assert(markup.includes("Échange déjà effectué"), "production contact actions remain present");
  assert(markup.includes("Préparer un email"), "production email dialog entry remains present");
});


test("les six territoires de la carte restent visibles sans journées ni trajet inventés", () => {
  const raw = request();
  raw.ou = { superRegions: ["est", "ouest", "grand-sud"], nomsSuperRegions: ["L’Est", "L’Ouest", "Le Grand Sud"], territoires: ["skikda", "parc-national-del-kala", "setif", "ain-temouchent", "mascara", "tamanrasset"], noms: ["Skikda", "Parc national d’El Kala", "Sétif", "Aïn Témouchent", "Mascara", "Tamanrasset"] };
  const t = trameDepuisSite(raw);
  assert.deepEqual(t.jours, []);
  const { manqueDe } = load("src/lib/bo3/projet.ts");
  assert.deepEqual(manqueDe(t), ["budget"]);
  const { TrameMap } = load("src/components/bo3/trame-map.tsx");
  const markup = renderToStaticMarkup(React.createElement(TrameMap, { trame: t }));
  for (const name of raw.ou.noms) assert(markup.includes(name), name);
  assert.equal((markup.match(/data-destination=/g) || []).length, 6);
  assert(!markup.includes("<polyline"));
  assert(!markup.includes("0 jours"));
  assert(!markup.includes("J1"));
  assert(markup.includes("Destinations souhaitées"));
  assert.deepEqual(trameInterne(t), t, "operator saves preserve the geographical selection");
});

test("une grande région sélectionnée compte comme destination sans faux itinéraire", () => {
  const raw = request();
  raw.ou = { superRegions: ["grand-sud"], nomsSuperRegions: ["Le Grand Sud"], territoires: [], noms: [] };
  const t = trameDepuisSite(raw);
  const { manqueDe } = load("src/lib/bo3/projet.ts");
  assert(!manqueDe(t).includes("lieux"));
  const { TrameMap } = load("src/components/bo3/trame-map.tsx");
  const markup = renderToStaticMarkup(React.createElement(TrameMap, { trame: t }));
  assert(markup.includes("Le Grand Sud"));
  assert(!markup.includes("<polyline"));
});

test("les coordonnées inconnues conservent leurs libellés lisibles", () => {
  const raw = request();
  raw.ou = { territoires: ["territoire-futur"], noms: ["Territoire transmis futur"] };
  const t = trameDepuisSite(raw);
  const { TrameMap } = load("src/components/bo3/trame-map.tsx");
  const markup = renderToStaticMarkup(React.createElement(TrameMap, { trame: t }));
  assert(markup.includes("Territoire transmis futur"));
  assert(!markup.includes("Aucun lieu placé"));
});


test("le chargement reconnaît la demande et garde les corrections opérateur prioritaires", async () => {
  const { chargerProjets } = load("src/lib/bo3/load.ts");
  const initial = trameDepuisSite(request());
  const operator = { ...initial, titre: "Trame corrigée", cadre: { ...initial.cadre, mois: "mars 2028" }, jours: [{ n: 1, lieux: ["alger"], e: "Visite validée" }], destinations: [], regions: [] };
  const rows = [{ id: "map-lead", created_at: "2026-11-05T16:00:00Z", status: "new", intake_channel: "web_form", intake_payload: { trame: request() }, ai_qualification_payload: { trame_v3: operator } }];
  const ctx = { supabase: { from(table) { const q = {}; for (const method of ["select", "is", "order", "eq", "in", "not"]) q[method] = () => q; q.range = () => Promise.resolve({ data: table === "leads" ? rows : [], error: null }); return q; } } };
  const [p] = await chargerProjets(ctx);
  assert.equal(p.source, "demande-projet");
  assert.equal(p.trame.cadre.mois, "mars 2028");
  assert.equal(p.trame.titre, "Trame corrigée");
  assert.deepEqual(p.trame.destinations, []);
  assert.deepEqual(p.trame.jours, operator.jours);
});


test("la carte écarte les clés héritées et garde les vraies coordonnées", () => {
  const raw = request();
  raw.ou = { superRegions: ["__proto__", "constructor", "est"], territoires: ["constructor", "__proto__", "skikda"], noms: ["Territoire A", "Territoire B", "Skikda"] };
  const t = trameDepuisSite(raw);
  const { TrameMap } = load("src/components/bo3/trame-map.tsx");
  const html = renderToStaticMarkup(React.createElement(TrameMap, { trame: t }));
  assert.equal((html.match(/data-destination=/g) || []).length, 1);
  assert.equal((html.match(/<path /g) || []).length, 2, "contour du pays et de la vraie région");
  assert(html.includes('data-destination="skikda" transform="translate(744.35 31.13)"'));
  for (const text of ["Territoire A", "Territoire B", "Skikda", "L’Est"]) assert(html.includes(text), text);
});


test("le formulaire affiche les valeurs de période, durée et confort reçues", () => {
  const { TrameForm } = load("src/components/bo3/trame-form.tsx");
  const exact = request();
  const flexible = request();
  flexible.quand = { mode: "mois", mois: ["2026-11", "2027-01"], duree: "Plus de deux semaines" };
  for (const raw of [exact, flexible]) {
    const initiale = trameDepuisSite(raw);
    const html = renderToStaticMarkup(React.createElement(TrameForm, { initiale, champs: "tout", titre: "Modifier la trame", onClose() {}, onSave() {}, pending: false }));
    for (const value of [initiale.cadre.mois, initiale.cadre.duree, initiale.cadre.hebergement]) {
      assert(html.includes('<option selected="">' + value + '</option>'), value);
    }
    assert(html.includes("Période"));
  }
});
