/**
 * Tests des fonctions pures du module Radar (aucun appel réseau).
 * Lancer : npx tsx --test src/lib/radar/radar.test.ts src/components/radar/md.test.tsx
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASES } from "./bases";
import { actives, dateFr, joursAvant, ligneMeta, relatif, texteBrut } from "./format";
import { blocsVersMd, changementsVersProps, mdVersRich, normaliserChangements, pageVersFiche, richVersMd, type NotionBlock, type NotionPage } from "./notion-map";

const ID = "0123456789abcdef0123456789abcdef";

describe("normaliserChangements", () => {
  it("accepte le nom exact, le libellé et les alias titre / statut", () => {
    const { changes, erreurs } = normaliserChangements("signaux", { titre: "  Nouveau   vol  ", statut: "actionnable", "Usage pour DA": ["offre", "Distribution"], "Note DA /10": "8" });
    assert.deepEqual(erreurs, []);
    assert.deepEqual(changes, { Signal: "Nouveau vol", Statut: "Actionnable", "Usage DA": ["Offre", "Distribution"], "Note DA /10": 8 });
  });

  it("refuse une option inconnue, une date mal formée et une adresse non http", () => {
    const { changes, erreurs } = normaliserChangements("signaux", { Statut: "Urgent", "Fenêtre de tir": "12/11/2026", Source: "javascript:alert(1)" });
    assert.equal(Object.keys(changes).length, 0);
    assert.equal(erreurs.length, 3);
  });

  it("utilise le type status pour l'étape des partenariats", () => {
    const { changes } = normaliserChangements("partenariats", { étape: "en discussion" });
    assert.deepEqual(changementsVersProps("partenariats", changes), { "Étape": { status: { name: "En discussion" } } });
  });

  it("n'accepte les relations que du formulaire, jamais de l'agent", () => {
    const brut = { "Acteurs liés": [ID] };
    assert.equal(normaliserChangements("signaux", brut).erreurs.length, 1);
    const ok = normaliserChangements("signaux", brut, { relations: true });
    assert.deepEqual(ok.erreurs, []);
    assert.deepEqual(changementsVersProps("signaux", ok.changes), { "Acteurs liés": { relation: [{ id: "01234567-89ab-cdef-0123-456789abcdef" }] } });
  });

  it("refuse les propriétés remplies par Notion et les relations hors radar", () => {
    assert.equal(normaliserChangements("acteurs", { "Créé le": "2026-10-01" }).erreurs.length, 1);
    assert.equal(normaliserChangements("idees", { "Sujet créé": [ID] }, { relations: true }).erreurs.length, 1);
  });

  it("vide proprement une date, un choix et une note", () => {
    const { changes } = normaliserChangements("acteurs", { "Fenêtre de tir": "", Porteur: "", "Note DA /10": null });
    assert.deepEqual(changementsVersProps("acteurs", changes), { "Fenêtre de tir": { date: null }, Porteur: { select: null }, "Note DA /10": { number: null } });
  });
});

describe("texte riche", () => {
  it("garde liens, gras et italique dans les deux sens", () => {
    const md = richVersMd([
      { plain_text: "Voir ", annotations: {} },
      { plain_text: "le site", href: "https://example.org", annotations: {} },
      { plain_text: " et ", annotations: {} },
      { plain_text: "ceci", annotations: { bold: true } },
    ]);
    assert.equal(md, "Voir [le site](https://example.org) et **ceci**");
    const rt = mdVersRich(md);
    assert.equal(rt.length, 4);
    assert.deepEqual(rt[1].text.link, { url: "https://example.org" });
    assert.deepEqual(rt[3].annotations, { bold: true });
  });

  it("découpe les textes longs en morceaux de 2 000 caractères", () => {
    const rt = mdVersRich("a".repeat(4500));
    assert.deepEqual(rt.map((r) => r.text.content.length), [2000, 2000, 500]);
  });
});

describe("pageVersFiche", () => {
  it("lit titre, statut et propriétés typées", () => {
    const page = {
      id: "01234567-89ab-cdef-0123-456789abcdef",
      last_edited_time: "2026-10-30T08:00:00.000Z",
      properties: {
        Dossier: { type: "title", title: [{ plain_text: "Agence Tassili" }] },
        "Étape": { type: "status", status: { name: "Premier contact" } },
        Priorité: { type: "select", select: { name: "P1" } },
        Échéance: { type: "date", date: { start: "2026-11-15" } },
        Acteurs: { type: "relation", relation: [{ id: "fedcba98-7654-3210-fedc-ba9876543210" }] },
      },
    } as unknown as NotionPage;
    const f = pageVersFiche("partenariats", page);
    assert.equal(f.id, ID);
    assert.equal(f.titre, "Agence Tassili");
    assert.equal(f.statut, "Premier contact");
    assert.equal(f.props["Priorité"], "P1");
    assert.equal(f.props["Échéance"], "2026-11-15");
    assert.deepEqual(f.props.Acteurs, ["fedcba9876543210fedcba9876543210"]);
    assert.equal(f.props["Prochaine action"], "");
  });
});

describe("blocsVersMd", () => {
  it("convertit titres, listes, cases à cocher et citations", () => {
    const rt = (t: string) => ({ rich_text: [{ plain_text: t, annotations: {} }] });
    const blocs = [
      { id: "1", type: "heading_2", heading_2: rt("Contexte") },
      { id: "2", type: "bulleted_list_item", bulleted_list_item: rt("Point A"), has_children: true, children: [{ id: "3", type: "bulleted_list_item", bulleted_list_item: rt("Sous-point") }] },
      { id: "4", type: "to_do", to_do: { ...rt("Appeler"), checked: true } },
      { id: "5", type: "quote", quote: rt("Une citation") },
    ] as unknown as NotionBlock[];
    assert.equal(blocsVersMd(blocs), "## Contexte\n\n- Point A\n  - Sous-point\n- [x] Appeler\n> Une citation");
  });
});

describe("format", () => {
  const now = new Date("2026-10-31T10:00:00");
  it("compte les jours et les dit en français", () => {
    assert.equal(joursAvant("2026-11-03", now), 3);
    assert.equal(relatif(joursAvant("2026-10-30", now)), "Hier");
    assert.equal(relatif(0), "Aujourd'hui");
    assert.equal(relatif(5), "J-5");
    assert.equal(relatif(-4), "Il y a 4 j");
    assert.match(dateFr("2026-11-03", true), /3 nov/);
  });

  it("retire la mise en forme et garde les adresses si demandé", () => {
    assert.equal(texteBrut("**Gras** et [site](https://a.dz)"), "Gras et site");
    assert.equal(texteBrut("[site](https://a.dz)", true), "site (https://a.dz)");
  });

  it("masque les statuts archivés et compose la ligne de méta", () => {
    const f = (statut: string) => ({ id: ID, base: "signaux" as const, titre: "x", statut, props: { Type: "Événement", Région: "Sahara", Éditeur: "APS" }, modifie: "" });
    assert.equal(actives(BASES.signaux, [f("Suivi"), f("Archivé")]).length, 1);
    assert.equal(ligneMeta(BASES.signaux, f("Suivi")), "Événement · Sahara · APS");
  });
});
