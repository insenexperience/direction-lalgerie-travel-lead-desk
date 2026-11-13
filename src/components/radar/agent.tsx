"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUp, Check, Copy, FolderOpen, Mail, MapPin, Maximize2, Minimize2, Plus, Search, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { appliquerProposition } from "@/app/(dashboard)/radar/actions";
import { confirmAssistantDeskAction, confirmAssistantDraft, confirmAssistantEdit } from "@/app/(dashboard)/settings/assistant-actions";
import { useToast } from "@/components/bo3/ui";
import { ASSISTANT_DRAFT_SAVED, ASSISTANT_OPEN_COMPOSER } from "@/lib/assistant/types";
import { DESK_PROJECT_TABS, DESK_SURFACES, projectDeskLink, type DeskScope } from "@/lib/assistant/scope";
import type { Evenement, Tour } from "@/lib/radar/agent";
import { BASES } from "@/lib/radar/bases";
import type { Proposition } from "@/lib/radar/types";
import { copier, useRadarAgentContext } from "./contexte";
import { Md } from "./md";

type Etat = "attente" | "enCours" | "ok" | "refus" | "erreur";
type Carte = { p: Proposition; etat: Etat; message?: string; href?: string; url?: string };
type Reponse = { role: "assistant"; id: string; texte: string; outils: string[]; cartes: Carte[]; erreur?: string; fini: boolean };
type Message = { role: "user"; id: string; texte: string } | Reponse;

type Props = {
  scope: DeskScope;
  referenceDossier?: string;
  dossierFerme?: boolean;
  onNewProject: () => void;
  projectActions?: ReactNode;
};

const suggestionGlobale = [
  { icon: FolderOpen, label: "Demandes entrantes", question: "Quels leads sont arrivés récemment, par quel canal et lesquels faut-il traiter en premier ? Donne-moi les liens." },
  { icon: Mail, label: "E-mails et offres reçues", question: "Quels e-mails d’agence et offres sont arrivés cette semaine sur les dossiers ? Présente les résultats dans un tableau." },
  { icon: Search, label: "Réseau d’agences", question: "Compare les agences par zone et indique lesquelles ont des réponses en attente." },
  { icon: MapPin, label: "Catalogue de lieux", question: "Quels lieux et expériences du catalogue recommandes-tu pour un circuit dans les Aurès ? Donne les liens des fiches." },
];

const actionDetail = {
  claim: "Ton compte deviendra le référent de ce dossier.",
  brief: "Le brief sera généré depuis la trame du dossier et enregistré pour relecture.",
  link: "Le Desk prépare un lien pour compléter la qualification du voyageur.",
};

function enTours(messages: Message[]): Tour[] {
  return messages.flatMap((message): Tour[] => {
    if (message.role === "user") return [{ role: "user", content: message.texte }];
    const actions = message.cartes.map(({ p, etat }) => {
      const statut = { attente: "à valider", enCours: "en cours de validation", ok: "appliquée", refus: "ignorée", erreur: "écriture refusée" }[etat];
      return `Proposition « ${p.titre} » : ${statut}.`;
    });
    const content = [message.texte, ...actions].filter(Boolean).join("\n");
    return content ? [{ role: "assistant", content }] : [];
  }).slice(-20);
}

export function AgentRadar({ scope, referenceDossier, dossierFerme, onNewProject, projectActions }: Props) {
  const radar = useRadarAgentContext();
  const toast = useToast();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [large, setLarge] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [texte, setTexte] = useState("");
  const [flux, setFlux] = useState(false);
  const [enBas, setEnBas] = useState(true);
  const [pleinEcran, setPleinEcran] = useState(false);
  const requete = useRef<AbortController | null>(null);
  const confirmations = useRef(new Set<string>());
  const fil = useRef<HTMLDivElement>(null);
  const saisie = useRef<HTMLTextAreaElement>(null);
  const panneau = useRef<HTMLElement>(null);
  const lanceur = useRef<HTMLButtonElement>(null);
  const scopeActif = scope;
  const fiche = radar?.ouverte ? radar.trouver(radar.ouverte) : null;
  const contexte = scopeActif.screen === "project"
    ? `Dossier ${referenceDossier ?? ""} · ${DESK_PROJECT_TABS[scopeActif.tab].label}`
    : fiche?.titre ?? radar?.vue ?? DESK_SURFACES[scopeActif.screen].label;

  useEffect(() => {
    function ouvrirAgent(event: Event) {
      setOuvert(true);
      const prompt = (event as CustomEvent<string>).detail;
      if (typeof prompt === "string") setTexte(prompt);
    }
    const ouvrirComposeur = () => setOuvert(false);
    window.addEventListener("radar:agent", ouvrirAgent);
    window.addEventListener(ASSISTANT_OPEN_COMPOSER, ouvrirComposeur);
    return () => {
      window.removeEventListener("radar:agent", ouvrirAgent);
      window.removeEventListener(ASSISTANT_OPEN_COMPOSER, ouvrirComposeur);
      requete.current?.abort();
    };
  }, []);

  useEffect(() => { if (ouvert) saisie.current?.focus(); }, [ouvert]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const actualiser = () => setPleinEcran(media.matches);
    actualiser();
    media.addEventListener("change", actualiser);
    return () => media.removeEventListener("change", actualiser);
  }, []);
  useEffect(() => {
    if (!ouvert || !pleinEcran || !panneau.current) return;
    const racine = panneau.current.closest(".bo3");
    if (!racine) return;
    const voisins: HTMLElement[] = [];
    for (let noeud: HTMLElement | null = panneau.current; noeud && noeud !== racine; noeud = noeud.parentElement) {
      for (const voisin of Array.from(noeud.parentElement?.children ?? [])) {
        if (voisin !== noeud && voisin instanceof HTMLElement && !voisin.inert) voisins.push(voisin);
      }
    }
    voisins.forEach(voisin => { voisin.inert = true; });
    return () => voisins.forEach(voisin => { voisin.inert = false; });
  }, [ouvert, pleinEcran]);
  useEffect(() => {
    if (ouvert && enBas && fil.current) fil.current.scrollTop = fil.current.scrollHeight;
  }, [messages, ouvert, enBas]);
  useEffect(() => {
    if (!saisie.current) return;
    saisie.current.style.height = "auto";
    saisie.current.style.height = Math.min(144, saisie.current.scrollHeight) + "px";
  }, [texte, ouvert]);

  function fermer(rendreFocus = true) {
    setOuvert(false);
    if (rendreFocus) requestAnimationFrame(() => lanceur.current?.focus());
  }

  function nouvelleConversation() {
    requete.current?.abort();
    setMessages([]);
    setTexte("");
    setEnBas(true);
    saisie.current?.focus();
  }

  function modifierReponse(id: string, update: (message: Reponse) => Reponse) {
    setMessages(previous => previous.map(message => message.id === id && message.role === "assistant" ? update(message) : message));
  }

  async function envoyer(question: string) {
    const content = question.trim().slice(0, 8000);
    if (!content || requete.current) return;
    const controleur = new AbortController();
    requete.current = controleur;
    const id = crypto.randomUUID();
    const historique: Message[] = [...messages, { role: "user", id: crypto.randomUUID(), texte: content }];
    setMessages([...historique, { role: "assistant", id, texte: "", outils: [], cartes: [], fini: false }]);
    setTexte("");
    setFlux(true);
    setEnBas(true);

    try {
      const response = await fetch("/api/radar/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tours: enTours(historique), scope: scopeActif, ficheId: fiche?.id }),
        signal: controleur.signal,
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({})) as { erreur?: string };
        throw new Error(data.erreur || "L’agent est indisponible. Réessaie dans un instant.");
      }
      const lecteur = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let reste = "";
      let termine = false;
      try {
        for (;;) {
          const { value, done } = await lecteur.read();
          if (done) break;
          const lignes = (reste + value).split("\n");
          reste = lignes.pop() ?? "";
          for (const ligne of lignes) {
            if (!ligne.trim()) continue;
            const evenement = JSON.parse(ligne) as Evenement;
            if (evenement.t === "fin") { termine = true; continue; }
            modifierReponse(id, message => {
              switch (evenement.t) {
                case "texte": return { ...message, texte: message.texte + evenement.d };
                case "outil": return message.outils.includes(evenement.l) ? message : { ...message, outils: [...message.outils, evenement.l] };
                case "proposition": return { ...message, cartes: [...message.cartes, { p: evenement.p, etat: "attente" }] };
                case "erreur": return { ...message, erreur: evenement.m };
              }
            });
          }
        }
      } finally {
        lecteur.releaseLock();
      }
      if (!termine) throw new Error("La réponse a été interrompue. Tu peux relancer la question.");
      modifierReponse(id, message => ({ ...message, fini: true }));
    } catch (error) {
      const erreur = controleur.signal.aborted ? "Réponse arrêtée." : error instanceof Error ? error.message : "Connexion interrompue.";
      modifierReponse(id, message => ({ ...message, fini: true, erreur }));
    } finally {
      requete.current = null;
      setFlux(false);
    }
  }

  async function decider(id: string, carte: Carte, accepter: boolean) {
    const { p } = carte;
    if (confirmations.current.has(p.id)) return;
    function changer(etat: Etat, resultat: Pick<Carte, "message" | "href" | "url"> = {}) {
      modifierReponse(id, message => ({ ...message, cartes: message.cartes.map(c => c.p.id === p.id ? { p, etat, ...resultat } : c) }));
    }
    if (!accepter) { changer("refus"); return; }
    confirmations.current.add(p.id);
    changer("enCours");
    try {
      if (p.kind === "dossier") {
        const resultat = await confirmAssistantEdit(p.apercu);
        if (!resultat.ok) { changer("erreur", { message: resultat.error }); return; }
        changer("ok", { message: "Dossier mis à jour dans le Desk." });
      } else if (p.kind === "action_desk") {
        const resultat = await confirmAssistantDeskAction(p.apercu);
        if (!resultat.ok) { changer("erreur", { message: resultat.error }); return; }
        changer("ok", { message: resultat.message, href: resultat.href, url: "url" in resultat ? resultat.url : undefined });
      } else if (p.kind === "brouillon") {
        const resultat = await confirmAssistantDraft(p.apercu);
        if (!resultat.ok) { changer("erreur", { message: resultat.error }); return; }
        const { leadId, kind, agencyId } = p.apercu;
        window.dispatchEvent(new CustomEvent(ASSISTANT_DRAFT_SAVED, { detail: { leadId, kind, agencyId } }));
        changer("ok", { message: "Brouillon enregistré.", href: projectDeskLink(leadId, agencyId ? "agences" : "voyageur") });
      } else {
        const resultat = await appliquerProposition(p);
        if (!resultat.ok) { changer("erreur", { message: resultat.erreur }); return; }
        changer("ok", { message: "Écrit dans Notion." });
      }
      router.refresh();
    } catch {
      changer("erreur", { message: "L’action n’a pas abouti. Réessaie dans un instant." });
    } finally {
      confirmations.current.delete(p.id);
    }
  }

  const suggestions = scopeActif.screen === "project"
    ? [
        ...DESK_PROJECT_TABS[scopeActif.tab].prompts.slice(0, 2).map(question => ({ icon: FolderOpen, label: question, question })),
        { icon: Mail, label: "Derniers e-mails", question: "Lis les derniers e-mails de ce dossier et résume les réponses à traiter, avec les liens." },
        ...(dossierFerme ? [] : [{ icon: Plus, label: "Proposer une note", question: "Prépare une note interne sur la situation et la prochaine action de ce dossier." }]),
      ]
    : suggestionGlobale;

  return (
    <div className={`rdag${fiche ? " decale" : ""}${large ? " rdag--large" : ""}`}>
      <section ref={panneau} id="agent-da-panel" className="rdag__pop" hidden={!ouvert} role="dialog" aria-modal={ouvert && pleinEcran ? true : undefined} aria-labelledby="agent-da-titre"
        onClick={event => {
          if (event.target instanceof Element && event.target.closest('a[href^="/"]:not([target])') && window.matchMedia("(max-width: 760px)").matches) fermer(false);
        }}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); fermer(); } }}>
        <header className="rdag__hd">
          <span className="rdag__ic"><Sparkles size={19} aria-hidden="true" /></span>
          <div className="rdag__identite">
            <h2 id="agent-da-titre">Agent DA</h2>
            <span>Travel Lead Desk</span>
          </div>
          <div className="rdag__commandes">
            <button type="button" className="rdag__icon" aria-label="Nouvelle conversation" title="Nouvelle conversation" onClick={nouvelleConversation}><Plus size={19} /></button>
            <button type="button" className="rdag__icon rdag__agrandir" aria-label={large ? "Réduire le panneau" : "Agrandir le panneau"} title={large ? "Réduire" : "Agrandir"} aria-pressed={large} onClick={() => setLarge(!large)}>
              {large ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button type="button" className="rdag__icon" aria-label="Fermer l’agent" title="Fermer" onClick={() => fermer()}><X size={20} /></button>
          </div>
        </header>
        <div className="rdag__contexte" title={contexte}>
          {scopeActif.screen === "project" ? <FolderOpen size={14} /> : <span className="rdag__dot" />}
          <span>{contexte}</span>
        </div>
        <div className="rdag__corps">
          <div ref={fil} className="rdag__fil" onScroll={event => {
            const el = event.currentTarget;
            setEnBas(el.scrollHeight - el.scrollTop - el.clientHeight < 64);
          }}>
            {messages.length === 0 && <div className="rdag__vide">
              <h3>{scopeActif.screen === "project" ? "Comment avancer sur ce dossier\u00a0?" : "Que veux-tu examiner\u00a0?"}</h3>
              <p>{scopeActif.screen === "project" ? "Interroge le dossier ouvert ou croise-le avec les agences, les e-mails et le catalogue." : "Consulte les dossiers, les agences, les e-mails et les lieux depuis la même conversation."}</p>
              <div className="rdag__sugg">
                {suggestions.map(({ icon: Icone, label, question }) => <button type="button" key={label} onClick={() => void envoyer(question)}>
                  <Icone size={16} aria-hidden="true" /><span>{label}</span><ArrowRight size={14} aria-hidden="true" />
                </button>)}
              </div>
            </div>}
            {projectActions}
            <div className="rdag__messages" role="log" aria-label="Conversation avec Agent DA" aria-live={flux ? "off" : "polite"}>
              {messages.map(message => message.role === "user" ? (
                <div key={message.id} className="rdag__moi">{message.texte}</div>
              ) : (
                <article key={message.id} className="rdag__lui" aria-label="Réponse de l’agent">
                  {message.outils.length > 0 && <ul className="rdag__outils" aria-label="Sources consultées">
                    {message.outils.map(outil => <li key={outil}><Search size={11} aria-hidden="true" /> {outil}</li>)}
                  </ul>}
                  {message.texte && <Md texte={message.texte} liensDesk />}
                  {message.cartes.map(carte => <CarteProposition key={carte.p.id} carte={carte} decider={accepter => void decider(message.id, carte, accepter)} copierLien={async url => toast(await copier(url) ? "Lien copié" : "Copie impossible")} />)}
                  {!message.fini && <div className="rdag__pense" role="status"><span />{message.texte ? "Réponse en cours…" : "Recherche en cours…"}</div>}
                  {message.erreur && <p className="rdag__erreur" role="alert">{message.erreur}</p>}
                  {message.fini && message.texte && <div className="rdag__act">
                    <button type="button" onClick={async () => toast(await copier(message.texte) ? "Réponse copiée" : "Copie impossible")}><Copy size={13} aria-hidden="true" /> Copier</button>
                  </div>}
                </article>
              ))}
            </div>
          </div>
          {!enBas && <button type="button" className="rdag__descendre" onClick={() => {
            if (fil.current) fil.current.scrollTop = fil.current.scrollHeight;
            setEnBas(true);
          }}><ArrowDown size={14} aria-hidden="true" /> Dernier message</button>}
        </div>
        <form className="rdag__in" onSubmit={event => { event.preventDefault(); void envoyer(texte); }}>
          <div className="rdag__zone">
            <textarea ref={saisie} rows={1} value={texte} maxLength={8000} onChange={event => setTexte(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void envoyer(texte); }
              }}
              placeholder={scopeActif.screen === "project" ? "Interroger ce dossier ou le Desk…" : "Interroger le Desk…"} aria-label="Message à l’agent" />
            {flux
              ? <button className="rdag__go" type="button" onClick={() => requete.current?.abort()} aria-label="Arrêter la réponse"><Square size={14} fill="currentColor" /></button>
              : <button className="rdag__go" type="submit" disabled={!texte.trim()} aria-label="Envoyer"><ArrowUp size={20} /></button>}
          </div>
          <div className="rdag__pied">
            <Link href="/settings">Réglages</Link>
            {scopeActif.screen === "file" && <button type="button" onClick={() => { fermer(false); onNewProject(); }}>Nouveau dossier</button>}
          </div>
        </form>
      </section>
      <button ref={lanceur} type="button" className="rdag__bulle" aria-expanded={ouvert} aria-controls="agent-da-panel"
        aria-label={ouvert ? "Fermer l’agent DA" : "Ouvrir l’agent DA"} onClick={() => ouvert ? fermer(false) : setOuvert(true)}>
        <Sparkles size={19} aria-hidden="true" /> Agent DA
      </button>
    </div>
  );
}

function CarteProposition({ carte, decider, copierLien }: { carte: Carte; decider: (accepter: boolean) => void; copierLien: (url: string) => Promise<void> }) {
  const { p, etat, message, href, url } = carte;
  const desk = p.kind === "dossier" || p.kind === "action_desk" || p.kind === "brouillon";
  const lien = desk ? projectDeskLink(p.apercu.leadId) : p.kind === "create" ? null : `/radar/${p.base}?fiche=${p.ficheId}`;
  const titre = p.kind === "dossier" ? "Modifier le dossier"
    : p.kind === "action_desk" ? p.titre
    : p.kind === "brouillon" ? `Brouillon · ${p.titre}`
    : p.kind === "create" ? `Créer dans ${BASES[p.base].label}`
    : p.kind === "comment" ? "Commenter dans Notion" : "Modifier la fiche Radar";
  return (
    <section className={`rdag__prop e-${etat}`} aria-label="Proposition à valider">
      <div className="rdag__prop-hd">
        <strong>{titre}</strong>
        {etat === "ok" && <span className="ok"><Check size={13} /> Appliquée</span>}
        {etat === "refus" && <span className="tag mute">Ignorée</span>}
      </div>
      {lien ? <Link className="rdag__prop-t" href={lien}>{p.kind === "action_desk" ? p.apercu.reference : p.kind === "brouillon" ? p.ref : p.titre}</Link> : <span>{p.titre}</span>}
      {p.kind === "comment" ? <Md texte={p.texte} />
        : p.kind === "action_desk" ? <p>{actionDetail[p.apercu.kind]}</p>
        : p.kind === "brouillon" ? <div className="rdag__brouillon">
          <p><b>Destinataire</b> {p.apercu.recipient}</p>
          <p><b>Objet</b> {p.apercu.subject}</p>
          <div>{p.apercu.bodyText}</div>
        </div>
        : <table className="rdag__diff"><tbody>{p.lignes.map((ligne, i) => (
          <tr key={i}><th scope="row">{ligne.champ}</th><td>{ligne.avant && <><s>{ligne.avant}</s> <ArrowRight size={12} /> </>}<b>{ligne.apres}</b></td></tr>
        ))}</tbody></table>}
      {"raison" in p && p.raison && <p>{p.raison}</p>}
      {message && <p className={etat === "erreur" ? "rdag__erreur" : ""} role={etat === "erreur" ? "alert" : "status"}>{message}</p>}
      {href && <Link href={href}>Ouvrir dans le dossier</Link>}
      {url && <button type="button" className="btn s xs" onClick={() => void copierLien(url)}>Copier le lien voyageur</button>}
      {(etat === "attente" || etat === "erreur" || etat === "enCours") && <div className="rdag__prop-b">
        <button type="button" className="btn s xs" disabled={etat === "enCours"} onClick={() => decider(false)}>Ignorer</button>
        <button type="button" className="btn p xs" disabled={etat === "enCours"} onClick={() => decider(true)}>{etat === "enCours" ? "Validation…" : etat === "erreur" ? "Réessayer" : "Appliquer"}</button>
      </div>}
    </section>
  );
}
