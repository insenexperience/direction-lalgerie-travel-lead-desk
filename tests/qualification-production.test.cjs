/* eslint-disable @typescript-eslint/no-require-imports -- Run production qualification regressions with the same isolated TS loader. */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function load(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  const localRequire = id => id.startsWith("@/") ? load(path.join(root, "src", `${id.slice(2)}.ts`)) : id.startsWith(".") ? load(path.resolve(path.dirname(filename), `${id}.ts`)) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
load(path.join(root, "src/lib/lead-qualification-completeness.test.ts"));
