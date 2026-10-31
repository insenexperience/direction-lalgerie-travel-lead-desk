/* eslint-disable @typescript-eslint/no-require-imports -- Build-time compatibility patch for pinned Next.js 16.2.4. */
// Google can return extensionless /l/font?kit= URLs. The pinned webpack loader
// dereferences a failed extension regex: https://github.com/vercel/next.js/issues/99114
const fs = require('node:fs');

function fontExtension(url, buffer) {
  const extension = /\.(woff|woff2|eot|ttf|otf)$/.exec(new URL(url).pathname)?.[1];
  if (extension) return extension;
  const signature = buffer.subarray(0, 4).toString('latin1');
  if (signature === 'wOF2') return 'woff2';
  if (signature === 'wOFF') return 'woff';
  if (signature === 'OTTO') return 'otf';
  if (signature === '\x00\x01\x00\x00' || signature === 'true') return 'ttf';
  throw new Error('Format de police Google non reconnu.');
}

function patchFontLoader(source) {
  const marker = '/* Google Fonts extensionless URL compatibility */';
  if (source.includes(marker)) return source;
  const original = 'const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];';
  if (source.split(original).length !== 2) throw new Error('Chargeur Next.js inattendu : réévaluer le correctif Google Fonts.');
  return source.replace(original, `${marker}\n            const ext = (${fontExtension.toString()})(googleFontFileUrl, fontFileBuffer);`);
}

if (require.main === module) {
  const filename = require.resolve('next/dist/compiled/@next/font/dist/google/loader.js');
  const source = fs.readFileSync(filename, 'utf8');
  const patched = patchFontLoader(source);
  if (patched !== source) fs.writeFileSync(filename, patched);
}
module.exports = { fontExtension, patchFontLoader };
