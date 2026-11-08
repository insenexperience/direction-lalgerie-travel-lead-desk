/* eslint-disable @typescript-eslint/no-require-imports -- Standalone tests for the Gmail adapter. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const ts = require("typescript");

function load(name, dependencies = {}) {
  const file = join(__dirname, "..", "src", "lib", "email", name + ".ts");
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", source)(
    (id) => dependencies[id] ?? (id === "server-only" ? {} : id.startsWith("./") ? load(id.slice(2)) : require(id)),
    loaded, loaded.exports,
  );
  return loaded.exports;
}

test("only inbound messages with a single Desk reference and sender are eligible", () => {
  const { identifyGmailMessage } = load("gmail-intake");
  const input = {
    labelIds: ["INBOX"], internalDate: "1794153600000", threadId: "abc123",
    payload: { headers: [
      { name: "From", value: '"Agence Exemple" <AGENCE@example.com>' },
      { name: "Subject", value: "Re: Brief agence DA-9CAE27D3" },
    ] },
  };
  assert.deepEqual(identifyGmailMessage(input), {
    sender: "agence@example.com", reference: "DA-9CAE27D3", subject: "Re: Brief agence DA-9CAE27D3",
    receivedAt: new Date(Number(input.internalDate)).toISOString(), threadId: "abc123",
  });
  assert.equal(identifyGmailMessage({ ...input, labelIds: ["SENT"] }), null);
  assert.equal(identifyGmailMessage({ ...input, payload: { headers: [
    input.payload.headers[0], { name: "Subject", value: "Re: DA-2026-0021" },
  ] } })?.reference, "DA-2026-0021");
  assert.equal(identifyGmailMessage({ ...input, payload: { headers: [
    input.payload.headers[0], { name: "Subject", value: "DA-9CAE27D3 et DA-C2FE8DCE" },
  ] } }), null);
});

test("a partial history batch never advances past the messages it processed", () => {
  const { gmailHistoryBatch } = load("gmail-sync");
  const history = [
    { id: "9007199254741001", messagesAdded: [{ message: { id: "aa" } }] },
    { id: "9007199254741002", messagesAdded: [{ message: { id: "aa" } }, { message: { id: "ab" } }] },
  ];
  const historyId = "9007199254749999";
  assert.deepEqual(gmailHistoryBatch({ historyId, history, nextPageToken: "another-page" }),
    { checkpoint: "9007199254741002", ids: ["aa", "ab"] });
  assert.deepEqual(gmailHistoryBatch({ historyId, history }), { checkpoint: historyId, ids: ["aa", "ab"] });
  assert.throws(() => gmailHistoryBatch({ historyId, nextPageToken: "unexpected-empty-page" }));
});

test("the mail shortcut opens a reading action without diverting compose requests", () => {
  const { isGmailReadRequest } = load("gmail-intake");
  assert.equal(isGmailReadRequest("Lis les derniers e-mails de ce dossier"), true);
  assert.equal(isGmailReadRequest("Rédige un brouillon avec les derniers e-mails"), false);
});

test("a quoted offer and an acknowledgment remain an agency reply", () => {
  const { readGmailContent, classifyGmailReply } = load("gmail-intake");
  const data = Buffer.from("Merci, nous revenons vers vous demain.\n\nLe 7 nov., A a écrit :\n> Voici notre devis à 1400 €").toString("base64url");
  const content = readGmailContent({ payload: { mimeType: "text/plain", body: { data } } });
  assert.equal(content.excerpt, "Merci, nous revenons vers vous demain.");
  assert.equal(classifyGmailReply("agency", content), "agency_reply");
});

test("a named proposal attachment or a price in the new reply is detected", () => {
  const { readGmailContent, classifyGmailReply } = load("gmail-intake");
  const content = readGmailContent({ payload: { mimeType: "multipart/mixed", parts: [
    { mimeType: "text/plain", body: { data: Buffer.from("Voici notre retour.").toString("base64url") } },
    { mimeType: "application/pdf", filename: "Devis Djanet.pdf", body: { attachmentId: "unused" } },
  ] } });
  assert.deepEqual(content.attachments, ["Devis Djanet.pdf"]);
  assert.equal(classifyGmailReply("agency", content), "agency_proposal");
  assert.equal(classifyGmailReply("agency", { excerpt: "Notre tarif est de 1450 EUR", attachments: [] }), "agency_proposal");
  assert.equal(classifyGmailReply("traveler", content), "traveler_reply");
});
