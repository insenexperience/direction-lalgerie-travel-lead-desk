/** Rendu Markdown du module Radar : structure et sûreté des liens. Lancer avec npx tsx --test. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Md } from "./md";

const rendu = (t: string) => renderToStaticMarkup(<Md texte={t} />);

describe("Md", () => {
  it("rend titres, listes imbriquées, tableaux et code", () => {
    const h = rendu("## Titre\n\n- un\n  - deux\n1. trois\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```\nx < y\n```");
    assert.match(h, /<h3>Titre<\/h3>/);
    assert.match(h, /<ul><li>un<\/li><li class="n1">deux<\/li><\/ul>/);
    assert.match(h, /<ol><li>trois<\/li><\/ol>/);
    assert.match(h, /<th>a<\/th><th>b<\/th><\/tr><tr><td>1<\/td>/);
    assert.match(h, /<pre><code>x &lt; y<\/code><\/pre>/);
  });

  it("ne rend cliquables que les liens http(s) et mailto", () => {
    const h = rendu("[ok](https://directionlalgerie.com) [piège](javascript:alert(1)) <script>alert(1)</script>");
    assert.match(h, /<a href="https:\/\/directionlalgerie.com" target="_blank" rel="noopener noreferrer">ok<\/a>/);
    assert.doesNotMatch(h, /href="javascript/);
    assert.doesNotMatch(h, /<script>/);
  });

  it("gère gras, italique, code et adresses nues", () => {
    const h = rendu("**gras** *ital* `code` voir https://example.org/page.");
    assert.match(h, /<strong>gras<\/strong> <em>ital<\/em> <code>code<\/code>/);
    assert.match(h, /<a href="https:\/\/example.org\/page"[^>]*>example.org\/page<\/a>\./);
  });

  it("dessine les cases à cocher", () => {
    assert.match(rendu("- [x] fait\n- [ ] à faire"), /rd-md__box on/);
  });
});
