"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { appliquerProposition } from "@/app/(dashboard)/radar/actions";
import { Icon, useToast } from "@/components/bo3/ui";
import { BASES } from "@/lib/radar/bases";
import { aujourdhui } from "@/lib/radar/format";
import type { Proposition, Valeur } from "@/lib/radar/types";
import { copier, useRadar } from "./contexte";
import { Md } from "./md";

/**
 * Agent DA : bulle en bas à droite, pop-in de discussion.
 * L'agent lit le radar et le contexte du projet côté serveur ; il propose, la personne valide.
 */

type EtatProp = "attente" | "ok" | "refus" | "erreur";
type Prop = { p: Proposition; etat: EtatProp; msg?: string };
type Item =
  | { k: "user"; id: string; texte: string }
  | { k: "assistant"; id: string; texte: string; outils: string[]; props: Prop[]; erreur?: string; fini: boolean };

const CLE = "radar_agent_v1";
const SUGGESTIONS = [
  "Qu'est-ce qui est urgent cette semaine ?",
  "Passe en revue les signaux à trier et propose un statut pour chacun.",
  "Quels rendez-vous Houari devrait-il retenir côté France ?",
  "Rédige un premier message pour l'acteur prioritaire le mieux noté.",
  "Comment une demande WhatsApp arrive-t-elle dans le desk ?",
];

const lire = (): Item[] => { try { const v = JSON.parse(localStorage.getItem(CLE) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const ecrire = (items: Item[]) => { try { localStorage.setItem(CLE, JSON.stringify(items.slice(-60))); } catch { /* stockage indisponible */ } };
const nid = () => Math.random().toString(36).slice(2, 10);

function enTours(items: Item[]): { role: "user" | "assistant"; content: string }[] {
  return items.map((it) => {
    if (it.k === "user") return { role: "user" as const, content: it.texte };
    const bilans = it.props.map(({ p, etat }) => `(Proposition « ${p.titre} » ${p.kind === "comment" ? "de commentaire" : p.kind === "create" ? "de création" : "de modification"} : ${etat === "ok" ? "acceptée et écrite dans Notion" : etat === "refus" ? "refusée par la personne" : etat === "erreur" ? "acceptée mais refusée par Notion" : "pas encore validée"})`);
    return { role: "assistant" as const, content: [it.texte, ...bilans].filter(Boolean).join("\n") || "(réponse vide)" };
  }).filter((t) => t.content.trim());
}

export function AgentRadar() {
  const { vue, ouverte, trouver, noter, ajouter, ouvrir } = useRadar();
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [texte, setTexte] = useState("");
  const [flux, setFlux] = useState(false);
  const [, demarrer] = useTransition();
  const abort = useRef<AbortController | null>(null);
  const bas = useRef<HTMLDivElement>(null);
  const saisie = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setItems(lire()); }, []);
  useEffect(() => { if (!flux) ecrire(items); }, [items, flux]);
  useEffect(() => { bas.current?.scrollIntoView({ block: "end" }); }, [items, ouvert]);
  useEffect(() => { if (ouvert) setTimeout(() => saisie.current?.focus(), 40); }, [ouvert]);

  const envoyer = useCallback(async (q: string) => {
    const question = q.trim();
    if (!question || flux) return;
    const idA = nid();
    const avant = [...items, { k: "user" as const, id: nid(), texte: question }];
    setItems([...avant, { k: "assistant", id: idA, texte: "", outils: [], props: [], fini: false }]);
    setTexte("");
    setFlux(true);
    const maj = (f: (a: Extract<Item, { k: "assistant" }>) => Extract<Item, { k: "assistant" }>) =>
      setItems((xs) => xs.map((x) => (x.id === idA && x.k === "assistant" ? f(x) : x)));
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/radar/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tours: enTours(avant), vue, ficheId: ouverte }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        maj((a) => ({ ...a, erreur: (j as { erreur?: string }).erreur || "L'agent ne répond pas.", fini: true }));
        return;
      }
      const lecteur = res.body.getReader();
      const dec = new TextDecoder();
      let reste = "";
      for (;;) {
        const { value, done } = await lecteur.read();
        if (done) break;
        reste += dec.decode(value, { stream: true });
        const lignes = reste.split("\n");
        reste = lignes.pop() ?? "";
        for (const l of lignes) {
          if (!l.trim()) continue;
          let e: { t: string; d?: string; l?: string; p?: Proposition; m?: string };
          try { e = JSON.parse(l); } catch { continue; }
          if (e.t === "texte" && e.d) { const d = e.d; maj((a) => ({ ...a, texte: a.texte + d })); }
          else if (e.t === "outil" && e.l) { const o = e.l; maj((a) => ({ ...a, outils: [...a.outils, o] })); }
          else if (e.t === "proposition" && e.p) { const p = e.p; maj((a) => ({ ...a, props: [...a.props, { p, etat: "attente" }] })); }
          else if (e.t === "erreur") { const m = e.m; maj((a) => ({ ...a, erreur: m || "Erreur." })); }
        }
      }
      maj((a) => ({ ...a, fini: true }));
    } catch (e) {
      maj((a) => ({ ...a, fini: true, erreur: (e as Error).name === "AbortError" ? "Réponse interrompue." : "Connexion perdue avec l'agent." }));
    } finally {
      abort.current = null;
      setFlux(false);
    }
  }, [items, flux, vue, ouverte]);

  useEffect(() => {
    const h = (e: Event) => { setOuvert(true); const t = (e as CustomEvent<string>).detail; if (t) setTexte(t); };
    window.addEventListener("radar:agent", h);
    return () => window.removeEventListener("radar:agent", h);
  }, []);

  const decider = (idA: string, pid: string, accepter: boolean) => {
    const changerEtat = (etat: EtatProp, msg?: string) =>
      setItems((xs) => xs.map((x) => (x.id === idA && x.k === "assistant" ? { ...x, props: x.props.map((pp) => (pp.p.id === pid ? { ...pp, etat, msg } : pp)) } : x)));
    const it = items.find((x) => x.id === idA);
    const pr = it?.k === "assistant" ? it.props.find((x) => x.p.id === pid) : null;
    if (!pr) return;
    if (!accepter) { changerEtat("refus"); return; }
    demarrer(async () => {
      const r = await appliquerProposition(pr.p);
      if (!r.ok) { changerEtat("erreur", r.erreur); toast("Notion a refusé la proposition"); return; }
      changerEtat("ok");
      const p = pr.p;
      if (p.kind === "update") {
        const f = trouver(p.ficheId);
        if (f) {
          const b = BASES[f.base];
          const props: Record<string, Valeur> = { ...f.props, ...p.changes };
          noter({ ...f, props, titre: String(props[b.titre] ?? f.titre) || f.titre, statut: String(props[b.statut] ?? f.statut), modifie: new Date().toISOString() });
        }
        toast("Fiche mise à jour dans Notion");
      } else if (p.kind === "create" && r.id) {
        const b = BASES[p.base];
        const props: Record<string, Valeur> = { ...p.changes };
        if (b.dateCreation && !props[b.dateCreation]) props[b.dateCreation] = aujourdhui();
        ajouter({ id: r.id, base: p.base, titre: p.titre, statut: String(props[b.statut] ?? b.statuts[0]), props, modifie: new Date().toISOString() });
        toast("Fiche créée dans Notion");
      } else toast("Commentaire publié dans Notion");
    });
  };

  const nouvelle = () => { if (flux) abort.current?.abort(); setItems([]); ecrire([]); setTexte(""); saisie.current?.focus(); };
  const ouvrirFiche = (id: string) => { ouvrir(id); if (window.matchMedia("(max-width: 760px)").matches) setOuvert(false); };
  const fiche = ouverte ? trouver(ouverte) : null;

  return (
    <div className={`rdag ${ouverte ? "decale" : ""}`}>
      {ouvert && (
        <section className="rdag__pop" role="dialog" aria-label="Agent DA" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setOuvert(false); } }}>
          <header className="rdag__hd">
            <span className="rdag__ic"><Icon n="sparkles" s={16} /></span>
            <div className="grow">
              <div className="rdag__t">Agent DA</div>
              <div className="rdag__s">Lit le radar, le desk et le contexte du projet. Propose, tu valides.</div>
            </div>
            <button className="ibtn" onClick={nouvelle} title="Nouvelle conversation" aria-label="Nouvelle conversation"><Icon n="refresh" s={15} /></button>
            <button className="ibtn" onClick={() => setOuvert(false)} title="Fermer (Échap)" aria-label="Fermer l'agent"><Icon n="x" s={15} /></button>
          </header>

          <div className="rdag__fil" aria-live="polite">
            {!items.length && (
              <div className="rdag__vide">
                <p>Pose une question sur Direction l&apos;Algérie, demande un tri, un message, un plan. Rien n&apos;est écrit dans Notion sans ton accord.</p>
                <div className="rdag__sugg">
                  {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => void envoyer(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {items.map((it) => it.k === "user" ? (
              <div key={it.id} className="rdag__moi">{it.texte}</div>
            ) : (
              <div key={it.id} className="rdag__lui">
                {it.outils.length > 0 && <div className="rdag__outils">{it.outils.map((o, i) => <span key={i}><Icon n="search" s={11} /> {o}</span>)}</div>}
                {it.texte ? <Md texte={it.texte} /> : !it.fini && !it.erreur ? <div className="rdag__pense" aria-label="L'agent réfléchit"><i /><i /><i /></div> : null}
                {it.props.map((pp) => <CarteProposition key={pp.p.id} pp={pp} onOpen={ouvrirFiche} onDecide={(a) => decider(it.id, pp.p.id, a)} />)}
                {it.erreur && <div className="excl">{it.erreur}</div>}
                {it.fini && it.texte && (
                  <div className="rdag__act">
                    <button type="button" onClick={async () => toast((await copier(it.texte)) ? "Réponse copiée" : "Copie impossible")}><Icon n="copy" s={11} /> Copier</button>
                  </div>
                )}
              </div>
            ))}
            <div ref={bas} />
          </div>

          <form className="rdag__in" onSubmit={(e) => { e.preventDefault(); void envoyer(texte); }}>
            {fiche && <div className="rdag__ctx">Fiche ouverte : <b>{fiche.titre}</b></div>}
            <div className="rdag__zone">
              <textarea
                ref={saisie}
                value={texte}
                rows={1}
                onChange={(e) => { setTexte(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(160, e.target.scrollHeight) + "px"; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void envoyer(texte); } }}
                placeholder="Écris à l'agent…"
                aria-label="Message à l'agent"
              />
              {flux
                ? <button type="button" className="rdag__go stop" onClick={() => abort.current?.abort()} aria-label="Arrêter"><span /></button>
                : <button type="submit" className="rdag__go" disabled={!texte.trim()} aria-label="Envoyer"><Icon n="send" s={15} /></button>}
            </div>
            <div className="rdag__pied">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</div>
          </form>
        </section>
      )}
      <button type="button" className={`rdag__bulle ${ouvert ? "on" : ""}`} onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} aria-label={ouvert ? "Fermer l'agent DA" : "Ouvrir l'agent DA"} title="Agent DA">
        <Icon n={ouvert ? "x" : "sparkles"} s={22} />
      </button>
    </div>
  );
}

function CarteProposition({ pp, onOpen, onDecide }: { pp: Prop; onOpen: (id: string) => void; onDecide: (accepter: boolean) => void }) {
  const { p, etat, msg } = pp;
  const b = BASES[p.base];
  const titre = p.kind === "create" ? `Créer ${b.unite} · ${b.label}` : p.kind === "comment" ? "Commenter la fiche" : "Modifier la fiche";
  return (
    <div className={`rdag__prop e-${etat}`}>
      <div className="rdag__prop-hd">
        <span className="lbl">{titre}</span>
        {etat === "ok" && <span className="ok"><Icon n="check" s={11} /> Écrit dans Notion</span>}
        {etat === "refus" && <span className="tag mute">Ignorée</span>}
      </div>
      {p.kind !== "create"
        ? <button type="button" className="rdag__prop-t" onClick={() => onOpen(p.ficheId)}>{p.titre}</button>
        : <div className="rdag__prop-t">{p.titre}</div>}
      {p.kind === "comment" ? <div className="rdag__com"><Md texte={p.texte} /></div> : (
        <table className="rdag__diff">
          <tbody>
            {p.lignes.map((l, i) => (
              <tr key={i}><th>{l.champ}</th><td>{p.kind === "update" && <><s>{l.avant}</s> <Icon n="arrowR" s={10} /> </>}<b>{l.apres}</b></td></tr>
            ))}
          </tbody>
        </table>
      )}
      {p.kind !== "comment" && p.raison && <div className="mt">{p.raison}</div>}
      {etat === "erreur" && <div className="excl">{msg}</div>}
      {(etat === "attente" || etat === "erreur") && (
        <div className="rdag__prop-b">
          <button type="button" className="btn s xs" onClick={() => onDecide(false)}>Ignorer</button>
          <button type="button" className="btn p xs" onClick={() => onDecide(true)}><Icon n="check" s={11} /> {etat === "erreur" ? "Réessayer" : "Appliquer"}</button>
        </div>
      )}
    </div>
  );
}
