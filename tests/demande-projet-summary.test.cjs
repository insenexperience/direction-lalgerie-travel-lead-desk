/* eslint-disable @typescript-eslint/no-require-imports -- Standalone runner renders the real TSX component. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadModule(relative) {
  const filename = path.join(__dirname, "..", relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = id => id.startsWith("@/") ? loadModule(`src/${id.slice(2)}.ts`) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

const { LeadDemandeProjetProfile, LeadDemandeProjetSummary } = loadModule("src/components/leads/lead-demande-projet-summary.tsx");
const { readDemandeProjet } = loadModule("src/lib/demande-projet-intake.ts");
const render = intakePayload => {
  const demande = readDemandeProjet(intakePayload);
  return renderToStaticMarkup(React.createElement(React.Fragment, null,
    demande && React.createElement(LeadDemandeProjetProfile, { demande, email: "voyageur@example.invalid", phone: null }),
    React.createElement(LeadDemandeProjetSummary, { demande }),
  ));
};
const request = () => ({
  trame: {
    type: "demande-projet-voyage", version: 1,
    ou: { jeNeSaisPas: false, superRegions: ["grand-sud"], territoires: ["djanet"], noms: ["Djanet"] },
    quand: { mode: "mois", mois: ["2026-11", "2027-01"], duree: "Dix jours" },
    voyageurs: { type: "En famille", adultes: 2, enfants: 1 },
    envies: {
      selection: [
        { cle: "villes:djanet", nom: "Djanet" },
        { cle: "activites:plongee", nom: "Plongée" },
        { cle: "experiences:sebeiba", nom: "La Sebeiba" },
        { cle: "circuits:grand-sud", nom: "Escapade dans le Grand Sud" },
      ],
      libelles: ["Nature et grands espaces", "Rencontres"], confort: "Bon confort", message: "Une nuit en bivouac.\nPas de longues marches.",
    },
    contact: { paysResidence: "France", canal: "Téléphone" },
  },
});

test("la fiche montre chaque envie et les cinq dimensions de la demande initiale", () => {
  const payload = request();
  const html = render(payload);
  for (const envie of payload.trame.envies.selection) assert(html.includes(envie.nom), envie.nom);
  assert.equal((html.match(/<li /g) || []).length, 4);
  for (const value of ["novembre 2026", "janvier 2027", "Dix jours", "En famille", "2 adultes", "1 enfant", "Nature et grands espaces", "Rencontres", "Bon confort", "Téléphone", "France", "Une nuit en bivouac.\nPas de longues marches."]) {
    assert(html.includes(value), value);
  }
});

test("la liste ne coupe pas les envies au-delà des premières cartes", () => {
  const payload = request();
  payload.trame.envies.selection = Array.from({ length: 300 }, (_, n) => ({ cle: `lieux:envie-${n}`, nom: `Envie choisie ${n}` }));
  const html = render(payload);
  assert.equal((html.match(/<li /g) || []).length, 300);
  assert(html.includes("Envie choisie 299"));
});

test("la demande sans destination choisie ou envies reste lisible", () => {
  const payload = request();
  payload.trame.ou = { jeNeSaisPas: true, noms: [] };
  payload.trame.envies.selection = [];
  payload.trame.quand = { mode: "nsp", duree: "Je ne sais pas encore" };
  const html = render(payload);
  assert(html.includes("À définir avec le voyageur"));
  assert(html.includes("Aucune envie ajoutée depuis le guide."));
  assert(html.includes("À définir avec votre conseiller"));
});

test("une grande région sans territoire précis et les dates flexibles restent visibles", () => {
  const payload = request();
  payload.trame.ou = { jeNeSaisPas: false, superRegions: ["grand-sud"], nomsSuperRegions: ["Le Grand Sud"], territoires: [], noms: [] };
  payload.trame.quand = { mode: "dates", dates: { arrivee: "2027-02-10", depart: "2027-02-20", aQuelquesJoursPres: true }, duree: "Dix jours" };
  const html = render(payload);
  assert(html.includes("Le Grand Sud"));
  assert(html.includes("2027-02-10"));
  assert(html.includes("2027-02-20"));
  assert(html.includes("à quelques jours près"));
});

test("les anciens composeurs et les dossiers sans trame n’ajoutent pas de bloc vide", () => {
  for (const intake of [null, {}, { trame: [] }, { trame: { type: "composeur" } }]) assert.equal(render(intake), "");
});

test("le texte voyageur est échappé et une trame incomplète ne casse pas le dossier", () => {
  const payload = request();
  payload.trame.envies.selection[0].nom = '<script>alert("envie")</script>';
  const html = render(payload);
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(render({ trame: { type: "demande-projet-voyage", envies: { selection: [null, 42, {}] } } }).includes("Non renseigné"));
});


test("les catégories et régions inconnues restent lisibles et ne lisent pas le prototype", () => {
  const payload = request();
  payload.trame.ou = { superRegions: ["__proto__", "constructor", "grand-sud"] };
  payload.trame.envies.selection = [{ cle: "__proto__:x", nom: "Futur choix" }, { cle: "constructor:y", nom: "Autre choix" }];
  const html = render(payload);
  for (const text of ["Futur choix", "Autre choix", "__proto__", "constructor", "Le Grand Sud"]) assert(html.includes(text), text);
  assert(!html.includes("[object Object]"));
});
