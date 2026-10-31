/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const { fontExtension, patchFontLoader } = require('../scripts/patch-next-font.cjs');

test('les URL Google Fonts sans extension utilisent la signature réelle du fichier', () => {
  const url = 'https://fonts.gstatic.com/l/font?kit=example&skey=example&v=v21';
  assert.equal(fontExtension(url, Buffer.from('wOF2font')), 'woff2');
  assert.equal(fontExtension(url, Buffer.from('wOFFfont')), 'woff');
  assert.equal(fontExtension(url, Buffer.from([0, 1, 0, 0, 0])), 'ttf');
  assert.equal(fontExtension(url, Buffer.from('OTTOfont')), 'otf');
  assert.equal(fontExtension('https://fonts.gstatic.com/font.woff2?version=2', Buffer.from('wOF2')), 'woff2');
  assert.throws(() => fontExtension(url, Buffer.from('<html>error')), /format/i);
});

test('le correctif remplace le chargeur vulnérable une fois et refuse une version inconnue', () => {
  const old = "const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];";
  const patched = patchFontLoader(old);
  const vm = require('node:vm');
  assert.equal(vm.runInNewContext(`${patched}\next`, { googleFontFileUrl: 'https://fonts.gstatic.com/l/font?kit=example', fontFileBuffer: Buffer.from('wOF2font'), URL }), 'woff2');
  assert.equal(patchFontLoader(patched), patched);
  assert.throws(() => patchFontLoader('a different loader'), /Next.js/);
});
