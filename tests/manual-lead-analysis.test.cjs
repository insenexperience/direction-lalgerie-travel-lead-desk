/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS runner transpiles a server helper with mocked providers. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

const filename = path.join(__dirname, "..", "src/lib/ai/manual-lead-analysis.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
let openAiCalls = 0;
let openAiResponse = { raw: JSON.stringify({ notes_longues: "Source retranscrite", full_name: "Jamie" }) };
const mockedRequire = (id) => {
  assert.equal(id, "@/lib/ai/agent");
  return { completeJson: async () => { openAiCalls++; return openAiResponse; } };
};
vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(mockedRequire, loaded, loaded.exports);
const { analyzeManualLeadJson } = loaded.exports;

const originalFetch = global.fetch;
const originalTimer = global.setTimeout;
const originalKey = process.env.ANTHROPIC_API_KEY;
const response = (content, extra = {}) => ({ ok: true, json: async () => ({ content, stop_reason: "end_turn", ...extra }) });

async function run() {
  try {
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    let request;
    global.fetch = async (url, options) => {
      request = { url, options };
      return response([{ type: "text", text: '{"full_name":"Jamie",' }, { type: "thinking", text: "This is not JSON" }, { type: "text", text: '"notes_longues":"Source complète"}' }]);
    };
    const success = await analyzeManualLeadJson("System qualification rules", '{"source_message":"Original"}');
    assert.equal(JSON.parse(success.raw).notes_longues, "Source complète");
    assert.equal(openAiCalls, 0, "Configured qualification provider must be used first");
    assert.equal(request.url, "https://api.anthropic.com/v1/messages");
    assert.equal(request.options.headers["x-api-key"], "test-only-key");
    assert.equal(request.options.headers["anthropic-version"], "2023-06-01");
    assert(request.options.signal instanceof AbortSignal);
    const body = JSON.parse(request.options.body);
    assert.equal(body.model, "claude-haiku-4-5-20251001");
    assert.equal(body.max_tokens, 8192);
    assert.equal(body.system, "System qualification rules");
    assert.deepEqual(body.messages, [{ role: "user", content: '{"source_message":"Original"}' }]);

    global.fetch = async () => response([{ type: "text", text: '```json\n{"notes_longues":"Retranscription"}\n```' }]);
    assert.equal(JSON.parse((await analyzeManualLeadJson("system", "source")).raw).notes_longues, "Retranscription");

    for (const content of [[], [{ type: "text", text: "" }], [{ type: "text", text: "{}" }], [{ type: "text", text: "null" }], [{ type: "text", text: "[]" }], [{ type: "text", text: "not-json" }]]) {
      global.fetch = async () => response(content);
      assert("error" in await analyzeManualLeadJson("system", "source"));
    }
    global.fetch = async () => response([{ type: "text", text: '{"notes_longues":"Partial source"}' }], { stop_reason: "max_tokens" });
    assert("error" in await analyzeManualLeadJson("system", "source"), "A token-limited transcript must not look complete");

    let errorBodyRead = false;
    global.fetch = async () => ({ ok: false, status: 403, text: async () => { errorBodyRead = true; return "test-only-key"; } });
    const statusError = await analyzeManualLeadJson("system", "source");
    assert("error" in statusError);
    assert(!JSON.stringify(statusError).includes("test-only-key"));
    assert.equal(errorBodyRead, false);

    global.fetch = async () => { throw new Error("Secret could appear here: test-only-key"); };
    const thrown = await analyzeManualLeadJson("system", "source");
    assert("error" in thrown);
    assert(!JSON.stringify(thrown).includes("test-only-key"));

    let configuredTimeout;
    global.setTimeout = (callback, delay) => { configuredTimeout = delay; return originalTimer(callback, 1); };
    global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("Timed out")), { once: true });
    });
    assert("error" in await analyzeManualLeadJson("system", "source"));
    assert.equal(configuredTimeout, 60000);
    global.setTimeout = originalTimer;

    delete process.env.ANTHROPIC_API_KEY;
    global.fetch = async () => { throw new Error("Should not call Anthropic when absent"); };
    assert.equal(JSON.parse((await analyzeManualLeadJson("system", "source")).raw).full_name, "Jamie");
    assert.equal(openAiCalls, 1);
    openAiResponse = { error: "Provider error could echo credentials" };
    assert("error" in await analyzeManualLeadJson("system", "source"));
    openAiResponse = { raw: "{}" };
    assert("error" in await analyzeManualLeadJson("system", "source"));
    console.log("Manual lead analysis: configured provider, multi-block JSON, empty/partial results, timeout, safe errors and OpenAI fallback passed.");
  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalTimer;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
