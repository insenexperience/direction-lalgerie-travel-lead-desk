// Parcours complet de l'opérateur sur un lead de test, dans Chrome (protocole DevTools), contre le CRM local.
// Usage : node tester-parcours-bo3.mjs <leadId>
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LEAD = process.argv[2];
const HOTE = "http://127.0.0.1:3010";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const env = Object.fromEntries(readFileSync("C:/dev/da-bo3/.env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
async function base(chemin) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${chemin}`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
  return r.json();
}
const etatBase = async () => {
  const [l] = await base(`leads?id=eq.${LEAD}&select=status,generated_brief,retained_agency_id`);
  const props = await base(`lead_circuit_proposals?lead_id=eq.${LEAD}&select=status,brief_sent_at,proposal_received_at,agency_proposal_price,agency_proposal_payload,converted_quote_id`);
  const quotes = await base(`quotes?lead_id=eq.${LEAD}&select=kind,workflow_status,sent_at,items`);
  const acts = await base(`activities?lead_id=eq.${LEAD}&select=kind&order=created_at`);
  return { statut: l.status, brief: !!l.generated_brief, props: props.map((p) => `${p.status}${p.proposal_received_at ? ` ${p.agency_proposal_price}€` : ""}${p.agency_proposal_payload?.acknowledged_at ? " accusé" : ""}`), devis: quotes.map((q) => `${q.kind}/${q.workflow_status}${q.sent_at ? " envoyé" : ""}`), journal: acts.map((a) => a.kind).join(",") };
};

const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9334", `--user-data-dir=${mkdtempSync(join(tmpdir(), "cdp-"))}`, "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
let cible;
for (let i = 0; i < 40 && !cible; i++) { await pause(250); try { cible = (await (await fetch("http://127.0.0.1:9334/json/list")).json()).find((t) => t.type === "page"); } catch {} }
const ws = new WebSocket(cible.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0; const attente = new Map(), erreurs = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && attente.has(m.id)) { attente.get(m.id)(m); attente.delete(m.id); } if (m.method === "Runtime.exceptionThrown") erreurs.push(m.params.exceptionDetails.exception?.description?.slice(0, 200)); });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; attente.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cdp("Runtime.enable");
// window.open (WhatsApp, mailto) est neutralisé : on teste le back office, pas l'envoi réel.
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "window.open = () => null;" });

const ouvrir = async () => { await cdp("Page.navigate", { url: `${HOTE}/leads/${LEAD}` }); for (let i = 0; i < 80; i++) { await pause(500); if (await ev('(() => { const b = document.querySelector(".next button, .next"); return !!b && Object.keys(b).some(k => k.startsWith("__reactProps")); })()')) break; } await pause(600); };
const clic = (texte, sel = "button, a") => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(texte)}) && !x.disabled); if (!b) return 'INTROUVABLE : ' + ${JSON.stringify(texte)}; b.click(); return 'ok'; })()`);
const remplir = (sel, valeur) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'champ introuvable'; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(valeur)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
const toast = () => ev('document.querySelector(".toast")?.textContent || ""');
const etape = async (nom, fn) => { const r = await fn(); await pause(4500); const t = await toast(); console.log(`— ${nom} : ${r} | toast « ${t} »`); console.log("   base :", JSON.stringify(await etatBase())); await ouvrir(); };

await ouvrir();
console.log("départ :", await ev('document.querySelector(".stepper__t b")?.textContent'), "|", await ev('document.querySelector(".next__t")?.textContent'));
await etape("première réponse", async () => { await clic("Écrire la première réponse", ".next button"); await pause(500); return clic("Envoyer par", ".mod__ft button"); });
await etape("générer le brief", () => clic("Générer le brief", ".next button"));
await etape("envoyer le brief", async () => { await clic("Brief & agences", ".seg button"); await pause(400); const fuite = await ev('document.querySelector(".warn")?.textContent || "aucune fuite"'); console.log("   contrôle du brief :", fuite); return clic("Marquer envoyé", ".card button"); });
await etape("accusé de réception", async () => { await clic("Brief & agences", ".seg button"); await pause(400); return clic("Accusé reçu", ".agcard button"); });
await etape("saisir la proposition", async () => { await clic("Brief & agences", ".seg button"); await pause(400); await clic("Saisir la proposition", ".agcard button"); await pause(400); await remplir('.mod input[type=number]', "1450"); await remplir('.mod textarea', "Alger · Djanet · Essendilène · Tadrart · bivouacs"); return clic("Enregistrer", ".mod__ft button"); });
await etape("convertir en proposition DA", async () => { await clic("Propositions & devis", ".seg button"); await pause(400); await clic("Convertir en proposition DA", ".propcard button"); await pause(500); return clic("Convertir", ".mod__ft button"); });
await etape("envoyer au voyageur", async () => { await clic("Propositions & devis", ".seg button"); await pause(400); return clic("Envoyer par", ".card button"); });
await etape("relancer le voyageur", () => clic("Relancer le voyageur", ".next button"));
await etape("marquer gagné", async () => { await clic("Actions", ".menu button"); await pause(300); return clic("Marquer gagné", ".menu__list button"); });
console.log("fin :", await ev('document.querySelector(".stepper__t b")?.textContent'), "|", await ev('document.querySelector(".next__t")?.textContent'));
console.log("erreurs JS :", erreurs.length ? erreurs : "aucune");
ws.close(); chrome.kill(); process.exit(0);
