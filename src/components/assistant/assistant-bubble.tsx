"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUp, Maximize2, Minimize2, Pin, PinOff, Settings2, Sparkles, X } from "lucide-react";
import {
  chatWithAssistant, confirmAssistantDeskAction, confirmAssistantDraft, confirmAssistantEdit, confirmAssistantQualification,
  getAssistantDeskView, prepareAssistantDraft, previewAssistantDeskAction, previewAssistantQualification,
} from "@/app/(dashboard)/settings/assistant-actions";
import { ASSISTANT_DRAFT_SAVED, ASSISTANT_OPEN_COMPOSER, type AssistantDraft, type AssistantDraftKind, type AssistantEditPreview, type AssistantTurn } from "@/lib/assistant/types";
import { DESK_PROJECT_TABS, DESK_PROJECT_TAB_EVENT, DESK_SURFACES, findDeskProjects, isDeskTab, normalizeDeskQuery, projectDeskLink, type DeskProjectTab, type DeskScope } from "@/lib/assistant/scope";
import type { DeskView } from "@/lib/assistant/desk-data";
import { AssistantConnection, useAssistantConnection } from "./assistant-connection";
import { qualificationLabels, type QualificationPreview } from "@/lib/assistant/qualification";
import { formatQualificationBudget } from "@/lib/qualification-budget";
import { useDeskToast } from "@/components/ui/desk-toast";
import { readDeskGmail } from "@/app/(dashboard)/leads/gmail-actions";
import { isGmailReadRequest, type DeskInboundMail } from "@/lib/email/gmail-intake";
import { DeskGmailMessages } from "./desk-gmail-messages";
import { DeskCopy, DeskReadout, type ReadoutFocus } from "./desk-readout";
import { DeskOverviewChat } from "./desk-overview-chat";

type Lead = { id: string; ref: string; nom: string; tab: DeskProjectTab; closed: boolean };
type Agency = { id: string; n: string };
type Surface = Exclude<DeskScope, { screen: "project" }>;
type DeskAction = Parameters<typeof previewAssistantDeskAction>[1];
type ActionPreview = Extract<Awaited<ReturnType<typeof previewAssistantDeskAction>>, { ok: true }>["preview"];
const failure = "L’action n’a pas abouti. Réessayez depuis l’assistant ou poursuivez dans le dossier.";
const kindLabels: Record<AssistantDraftKind, string> = {
  welcome: "Accusé de réception",
  qualification: "Prise de contact",
  agency_feasibility: "Étude de faisabilité",
  agency_brief: "Brief agence",
};
const actions: Record<DeskAction, { label: string; effect: string }> = {
  claim: { label: "Prendre le dossier", effect: "Ton compte deviendra le référent du dossier." },
  brief: { label: "Générer le brief", effect: "Le Desk prépare un brief depuis la trame. Il sera disponible dans Brief & agences pour relecture." },
  link: { label: "Préparer le lien voyageur", effect: "Le Desk crée un lien pour compléter la qualification et réutilise le lien actif s’il existe." },
};
const priorityLabel = (value: string | null) => value === "high" ? "Haute" : "Normale";
const emptyTurns: AssistantTurn[] = [];

export function AssistantBubble({ lead: currentLead, projects, agencies, surface, onNewProject }: {
  lead?: Lead;
  projects: Lead[];
  agencies: Agency[];
  surface: Surface;
  onNewProject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [wide, setWide] = useState(false);
  const [pin, setPin] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Record<string, DeskProjectTab>>({});
  const [threads, setThreads] = useState<Record<string, AssistantTurn[]>>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const connection = useAssistantConnection();
  const pinned = pin ? projects.find(project => project.id === pin) : undefined;
  const lead = pinned ?? currentLead;
  const tab = lead ? tabs[lead.id] ?? lead.tab : "trame";
  const key = lead?.id ?? surface.screen + ":" + (surface.item ?? "");
  const connected = connection?.status?.state === "connected";

  useEffect(() => { if (open) close.current?.focus(); }, [open]);
  useEffect(() => {
    function followProjectTab(event: Event) {
      const detail = (event as CustomEvent<{ leadId: string; tab: DeskProjectTab }>).detail;
      if (typeof detail?.leadId === "string" && isDeskTab(detail.tab)) {
        setTabs(previous => previous[detail.leadId] === detail.tab ? previous : { ...previous, [detail.leadId]: detail.tab });
      }
    }
    window.addEventListener(DESK_PROJECT_TAB_EVENT, followProjectTab);
    return () => window.removeEventListener(DESK_PROJECT_TAB_EVENT, followProjectTab);
  }, []);

  function dismiss(returnFocus = true) {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => trigger.current?.focus());
  }

  function updateTurns(turns: AssistantTurn[]) {
    setThreads(previous => ({ ...previous, [key]: turns.slice(-48) }));
  }

  return (
    <div className="desk-assistant" data-wide={wide}>
      <aside id="desk-assistant-panel" className="desk-assistant__panel" hidden={!open} aria-labelledby="desk-assistant-title"
        onClick={event => {
          if (event.target instanceof Element && event.target.closest('a[href^="/"]:not([target])') && window.matchMedia("(max-width: 1020px)").matches) dismiss(false);
        }}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); dismiss(); } }}>
        <div className="desk-assistant__header">
          <div className="desk-assistant__brand">
            <span className="desk-assistant__mark"><Sparkles size={20} aria-hidden="true" /></span>
            <div><b id="desk-assistant-title">DA Sales</b><div className="desk-assistant__status">{connected ? "Claude connecté" : connection?.pending ? "Connexion…" : "Données du Desk"}</div></div>
          </div>
          <div className="desk-assistant__header-actions">
            <button type="button" className="desk-assistant__icon" onClick={() => setSettings(!settings)} aria-pressed={settings} aria-label={settings ? "Revenir à la conversation" : "Réglages de l’assistant"} title={settings ? "Conversation" : "Réglages"}><Settings2 size={17} aria-hidden="true" /></button>
            <button type="button" className="desk-assistant__icon desk-assistant__expand" onClick={() => setWide(!wide)} aria-pressed={wide} aria-label={wide ? "Réduire le panneau" : "Agrandir le panneau"} title={wide ? "Réduire" : "Agrandir"}>{wide ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}</button>
            <button type="button" ref={close} className="desk-assistant__icon" onClick={() => dismiss()} aria-label="Fermer l’assistant" title="Fermer"><X size={19} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="desk-assistant__body desk-assistant__settings" hidden={!settings}>
          <AssistantConnection />
          <Link href="/settings" className="desk-assistant__source">Ouvrir les réglages du Desk <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
        <div className="desk-assistant__body" hidden={settings}>
          <div className="desk-assistant__context">
            <div>
              <span className="desk-assistant__eyebrow">{pinned ? "Dossier épinglé" : lead ? "Dossier ouvert" : "Écran actif"}</span>
              <strong>{lead ? lead.nom.includes("@") ? lead.ref : lead.nom : DESK_SURFACES[surface.screen].label}</strong>
              {lead && <small>{lead.ref} · {DESK_PROJECT_TABS[tab].label}</small>}
            </div>
            {lead && <button type="button" className="desk-assistant__icon" onClick={() => setPin(pinned ? null : lead.id)} aria-label={pinned ? "Désépingler le dossier" : "Épingler le dossier"} title={pinned ? "Désépingler" : "Épingler"}>{pinned ? <PinOff size={17} aria-hidden="true" /> : <Pin size={17} aria-hidden="true" />}</button>}
          </div>
          {lead ? <AssistantConversation key={key} lead={lead} agencies={agencies} tab={tab} connected={connected} projects={projects}
            turns={threads[key] ?? emptyTurns} onTurns={updateTurns} onPin={setPin} onOpenComposer={() => dismiss(false)} visibleProject={currentLead?.id === lead.id} />
            : <DeskOverviewChat key={key} scope={surface} turns={threads[key] ?? emptyTurns} onTurns={updateTurns} onPin={setPin}
              onNewProject={() => { dismiss(false); onNewProject(); }} />}
        </div>
      </aside>
      <button type="button" ref={trigger} className="desk-assistant__trigger" hidden={open} aria-expanded={open}
        aria-controls="desk-assistant-panel"
        onClick={() => {
          setSettings(false);
          setOpen(true);
          connection?.load();
        }}><Sparkles size={18} aria-hidden="true" /> DA Sales</button>
    </div>
  );
}

function AssistantConversation({ lead, agencies, tab, connected, projects, turns, onTurns, onPin, onOpenComposer, visibleProject }: {
  lead: Lead; agencies: Agency[]; tab: DeskProjectTab; connected: boolean; projects: Lead[];
  turns: AssistantTurn[]; onTurns: (turns: AssistantTurn[]) => void; onPin: (id: string) => void;
  onOpenComposer: () => void; visibleProject: boolean;
}) {
  const router = useRouter();
  const toast = useDeskToast();
  const [readout, setReadout] = useState<{ view: DeskView; focus?: ReadoutFocus } | null>(null);
  const [actionPreview, setActionPreview] = useState<ActionPreview | null>(null);
  const [actionResult, setActionResult] = useState<{ message?: string; href: string; url?: string } | null>(null);
  const [mail, setMail] = useState<DeskInboundMail[] | null>(null);
  const [message, setMessage] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [preview, setPreview] = useState<AssistantDraft | null>(null);
  const [editPreview, setEditPreview] = useState<AssistantEditPreview | null>(null);
  const [qualificationPreview, setQualificationPreview] = useState<QualificationPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef<HTMLDivElement>(null);
  const readoutTop = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const container = latest.current?.parentElement;
    if (!container) return;
    const target = readoutTop.current;
    if (target && !preview && !editPreview && !qualificationPreview && !actionPreview && !actionResult) {
      container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top - 18;
    } else if (turns.length || preview || editPreview || qualificationPreview || mail || actionPreview || actionResult) {
      container.scrollTop = container.scrollHeight;
    }
  }, [turns, preview, editPreview, qualificationPreview, mail, error, readout, actionPreview, actionResult]);

  async function prepare(kind: AssistantDraftKind) {
    setEditPreview(null);
    setQualificationPreview(null);
    const toAgency = kind === "agency_brief" || kind === "agency_feasibility";
    if (toAgency && !agencyId) {
      setError("Choisis l’agence destinataire dans Brouillons d’e-mail.");
      return;
    }
    const result = await prepareAssistantDraft(lead.id, kind, toAgency ? agencyId : null);
    if (result.ok) setPreview(result.preview);
    else setError(result.error);
  }

  function run(action: () => Promise<void>) {
    setError(null);
    start(async () => {
      try { await action(); } catch { setError(failure); }
    });
  }

  function clearPreviews() {
    setPreview(null);
    setEditPreview(null);
    setQualificationPreview(null);
    setActionPreview(null);
    setActionResult(null);
  }

  function openReadout(focus?: ReadoutFocus, question = "") {
    clearPreviews();
    setReadout(null);
    setMail(null);
    run(async () => {
      const result = await getAssistantDeskView({ screen: "project", leadId: lead.id, tab }, question);
      if (!result.ok) { setError(result.error); return; }
      setReadout({ view: result.view, focus });
      if (question) setMessage("");
    });
  }

  function prepareAction(kind: DeskAction) {
    clearPreviews();
    run(async () => {
      const result = await previewAssistantDeskAction(lead.id, kind);
      if (!result.ok) { setError(result.error); return; }
      setActionPreview(result.preview);
      setMessage("");
    });
  }

  function send(content: string) {
    if (!content || pending) return;
    const query = normalizeDeskQuery(content);
    const targets = findDeskProjects(content, projects);
    const otherProject = targets.some(project => project.id !== lead.id);
    const focus = /qualifi|precis|changement|change/.test(query) ? "facts" : /histor|echanges|parcours/.test(query) ? "timeline"
      : /offres|propositions|devis/.test(query) ? "offers" : undefined;
    if (!otherProject && !lead.closed) {
      if (/^(?:prends|prendre|attribue moi) (?:le|ce) dossier$/.test(query)) { prepareAction("claim"); return; }
      if (/^(?:genere|generer|cree|creer) (?:le|un) brief(?: agence)?$/.test(query)) { prepareAction("brief"); return; }
      if (/^(?:prepare|preparer|cree|creer|genere|generer) (?:le|un) lien (?:voyageur|de qualification)$/.test(query)) { prepareAction("link"); return; }
    }
    if (otherProject || !connected || /^(?:ou en est|affiche l historique|voir l historique)/.test(query)) {
      openReadout(focus, content);
      return;
    }
    const input = [...turns, { role: "user", content } satisfies AssistantTurn];
    clearPreviews();
    run(async () => {
      const result = await chatWithAssistant(lead.id, input.slice(-9), tab);
      if (!result.ok) {
        const fallback = await getAssistantDeskView({ screen: "project", leadId: lead.id, tab });
        if (fallback.ok) setReadout({ view: fallback.view, focus });
        setError(result.error);
        return;
      }
      onTurns([...input, { role: "assistant", content: result.answer.reply }]);
      setMessage("");
      setEditPreview(result.editPreview);
      if (result.editError) setError(result.editError);
      if (result.answer.draftKind) {
        await prepare(result.answer.draftKind);
      }
    });
  }

  function openMail() {
    clearPreviews();
    setReadout(null);
    setMail(null);
    run(async () => {
      const result = await readDeskGmail(lead.id);
      if (!result.ok) {
        setError("Les e-mails de ce dossier ne sont pas accessibles.");
        return;
      }
      setMail(result.messages);
      setMessage("");
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!content || pending) return;
    if (!importing) {
      const targets = findDeskProjects(content, projects);
      if (isGmailReadRequest(content) && targets.every(project => project.id === lead.id)) openMail();
      else send(content);
      return;
    }
    clearPreviews();
    run(async () => {
      const result = await previewAssistantQualification(lead.id, content);
      if (result.ok) setQualificationPreview(result.preview);
      else setError(result.error);
    });
  }

  return (
    <div className="desk-assistant__conversation">
      <div className="desk-assistant__history">
      {turns.length === 0 && <div className="desk-assistant__welcome">
        <span className="desk-assistant__eyebrow">Assistant de dossier</span>
        <h2>Comment avancer sur ce dossier&nbsp;?</h2>
        <p>Retrouve les actions réalisées, les dernières précisions et ce qui reste à faire.</p>
        <div className="desk-assistant__suggestions">
          <button type="button" className="btn s sm" disabled={pending} onClick={() => openReadout()}>Où en est le dossier&nbsp;?</button>
          <button type="button" className="btn s sm" disabled={pending} onClick={() => openReadout("timeline")}>Voir l’historique</button>
          {tab === "trame" && <button type="button" className="btn s sm" disabled={pending} onClick={() => openReadout("facts")}>Depuis la qualification</button>}
          {tab === "agences" && <button type="button" className="btn s sm" disabled={pending} onClick={() => openReadout("timeline")}>Suivre les retours d’agence</button>}
          {tab === "props" && <button type="button" className="btn s sm" disabled={pending} onClick={() => openReadout("offers")}>Comparer les propositions</button>}
          {tab === "voyageur" && <button type="button" className="btn s sm" disabled={pending} onClick={openMail}>Lire les e-mails du dossier</button>}
        </div>
      </div>}
      <div className="desk-assistant__messages" role="log" aria-label="Conversation">
        {turns.map(({ role, content }, index) => (
          <div key={index} className="desk-assistant__message" data-role={role}><b>{role === "user" ? "Vous" : "DA Sales"}</b><div>{content}</div></div>
        ))}
      </div>
      {readout && <div ref={readoutTop}><DeskReadout view={readout.view} focus={readout.focus} onPin={readout.view.project?.id === lead.id ? undefined : onPin} /></div>}
      {mail && <section aria-label="E-mails reçus">
        <b>E-mails reçus dans Gmail</b>
        {mail.length ? <DeskGmailMessages messages={mail} /> : <p>Aucun e-mail rapproché de ce dossier.</p>}
      </section>}
      {!lead.closed && <details className="desk-assistant__shortcuts"><summary>Brouillons d’e-mail</summary>
      <fieldset className="desk-assistant__draft-controls" disabled={pending} aria-label="Préparer un brouillon">
        <div className="row wrap">
          <button type="button" className="btn s xs" onClick={() => { clearPreviews(); run(() => prepare("welcome")); }}>Accusé de réception</button>
          <button type="button" className="btn s xs" onClick={() => { clearPreviews(); run(() => prepare("qualification")); }}>Qualification</button>
        </div>
        <label htmlFor="desk-assistant-agency">Agence destinataire</label>
        <div className="row wrap">
          <select id="desk-assistant-agency" className="inp" value={agencyId}
            onChange={(event) => { setAgencyId(event.target.value); if (preview?.agencyId) setPreview(null); }}>
            <option value="">Choisir une agence</option>
            {agencies.map(({ id, n }) => <option key={id} value={id}>{n}</option>)}
          </select>
          <button type="button" className="btn s xs" disabled={!agencyId}
            onClick={() => { clearPreviews(); run(() => prepare("agency_feasibility")); }}>Faisabilité</button>
          <button type="button" className="btn s xs" disabled={!agencyId}
            onClick={() => { clearPreviews(); run(() => prepare("agency_brief")); }}>Brief agence</button>
        </div>
      </fieldset>
      </details>}
      {!lead.closed && <details className="desk-assistant__shortcuts"><summary>Actions du dossier</summary>
        <div className="desk-assistant__suggestions">
          {(Object.keys(actions) as DeskAction[]).map(kind => <button key={kind} className="btn s xs" type="button" disabled={pending} onClick={() => prepareAction(kind)}>{actions[kind].label}</button>)}
          {connected && <button type="button" className="btn s xs" disabled={pending} onClick={() => send("Prépare une note interne sur la situation actuelle et la prochaine action de ce dossier.")}>Préparer une note</button>}
        </div>
      </details>}
      {actionPreview && <section className="desk-assistant__proposal" aria-label="Action à valider">
        <b>{actions[actionPreview.kind].label}</b>
        <p><span className="mono">{actionPreview.reference}</span> · {actions[actionPreview.kind].effect}</p>
        <div className="row wrap">
          <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
            const result = await confirmAssistantDeskAction(actionPreview);
            if (!result.ok) { setError(result.error); return; }
            setActionPreview(null);
            setActionResult(result);
            router.refresh();
          })}>Confirmer</button>
          <button type="button" className="btn s" disabled={pending} onClick={() => setActionPreview(null)}>Annuler</button>
        </div>
      </section>}
      {actionResult && <section className="desk-assistant__readout" role="status">
        <p>{actionResult.message}</p>
        {actionResult.url && <DeskCopy value={actionResult.url} label="Copier le lien voyageur" />}
        <Link className="desk-assistant__source" href={actionResult.href}>Voir dans le dossier <ArrowRight size={13} aria-hidden="true" /></Link>
      </section>}
      {qualificationPreview && (
        <section className="desk-assistant__proposal" aria-label="Qualification à valider">
          <b>Qualification · {lead.ref}</b>
          {qualificationPreview.changes?.length ? <div className="desk-assistant__table-wrap">
            <table className="desk-assistant__table">
              <thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead>
              <tbody>{qualificationPreview.changes.map(({ label, before, after }) => <tr key={label}>
                <th scope="row">{label}</th><td>{before ?? "—"}</td><td>{after ?? "Effacé"}</td>
              </tr>)}</tbody>
            </table>
          </div> : <dl className="desk-assistant__facts">
            {qualificationLabels(qualificationPreview.qualification).map(({ label, value }) =>
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>}
          <div className="row wrap">
            <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantQualification(qualificationPreview);
              if (!result.ok) { setError(result.error); return; }
              setQualificationPreview(null);
              setMessage("");
              setImporting(false);
              toast.success("Qualification enregistrée dans le dossier.");
              router.refresh();
            })}>{pending ? "Enregistrement…" : "Enregistrer la qualification"}</button>
            <button type="button" className="btn s" disabled={pending} onClick={() => setQualificationPreview(null)}>Annuler</button>
          </div>
        </section>
      )}
      {editPreview && (
        <section className="desk-assistant__proposal" aria-label="Modification à valider">
          {editPreview.edit.kind === "budget" ? <>
            <b>Enregistrer le budget voyageur</b>
            <dl className="desk-assistant__facts">
              <div><dt>Budget actuel</dt><dd>{editPreview.previous || "À préciser"}</dd></div>
              <div><dt>Budget proposé</dt><dd>{formatQualificationBudget(editPreview.edit.value)}
                {editPreview.edit.value.includesFlights === null ? " · Vols à préciser" : ""}</dd></div>
            </dl>
          </> : <>
            <b>{editPreview.edit.kind === "note" ? "Ajouter une note interne" : "Changer la priorité"}</b>
            <div className="desk-assistant__draft-text">{editPreview.edit.kind === "note"
              ? editPreview.edit.value
              : `${priorityLabel(editPreview.previous)} → ${priorityLabel(editPreview.edit.value)}`}</div>
          </>}
          <div className="row wrap">
            <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantEdit(editPreview);
              if (!result.ok) { setError(result.error); return; }
              setEditPreview(null);
              toast.success({ note: "Note interne ajoutée au dossier.", priority: "Priorité enregistrée.", budget: "Budget voyageur enregistré." }[editPreview.edit.kind]);
              router.refresh();
            })}>{pending ? "Enregistrement…" : "Appliquer au dossier"}</button>
            <button type="button" className="btn s" disabled={pending} onClick={() => setEditPreview(null)}>Annuler</button>
          </div>
        </section>
      )}
      {preview && (
        <section className="desk-assistant__proposal" aria-label="Aperçu du brouillon">
          <b>{kindLabels[preview.kind]}</b>
          <div>Destinataire · {preview.recipient}</div>
          <div>Objet · {preview.subject}</div>
          <div className="desk-assistant__draft-text">{preview.bodyText}</div>
          {preview.draftId
            ? visibleProject ? <button type="button" className="btn p" onClick={() => {
              window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_COMPOSER, { detail: {
                leadId: preview.leadId, kind: preview.kind, agencyId: preview.agencyId, proposalId: preview.proposalId,
              } }));
              onOpenComposer();
            }}>Ouvrir dans le composeur</button> : <Link className="desk-assistant__source" href={projectDeskLink(lead.id, preview.agencyId ? "agences" : "voyageur")}>Ouvrir le dossier</Link>
            : <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantDraft(preview);
              if (!result.ok) { setError(result.error); return; }
              setPreview({ ...preview, draftId: result.draftId });
              toast.success("Brouillon enregistré dans le dossier.");
              window.dispatchEvent(new CustomEvent(ASSISTANT_DRAFT_SAVED, { detail: {
                leadId: preview.leadId, kind: preview.kind, agencyId: preview.agencyId,
              } }));
              router.refresh();
            })}>Valider et enregistrer le brouillon</button>}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {pending && <p className="desk-assistant__pending" role="status">Consultation du Desk…</p>}
      <div ref={latest} />
      </div>
      <form className="desk-assistant__input" ref={composer} onSubmit={submit}>
        <div className="desk-assistant__composer-actions">
          {connected && !lead.closed && <button type="button" className="btn s xs" disabled={pending} onClick={() => { setImporting(!importing); clearPreviews(); }}>
            {importing ? "Revenir au chat" : "Coller une qualification"}
          </button>}
          {!importing && <button type="button" className="btn s xs" disabled={pending} onClick={openMail}>Lire les e-mails</button>}
        </div>
        <div className="desk-assistant__composer-field">
        <textarea aria-label={importing ? "Retour du voyageur" : "Votre message"} className="inp" rows={importing ? 4 : 2} maxLength={importing ? 6000 : 1600} value={message}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text").trim();
            if (importing || lead.closed || !connected || pasted.split(/\r?\n/).filter((line) => line.trim()).length < 3 ||
                !/\b(?:dates|voyageurs|budget|vols|dur[ée]e|h[ée]bergement|excursions|formalit[ée]s)\b/i.test(pasted)) return;
            event.preventDefault();
            if (pasted.length > 6000) { setError("Collez au maximum 6 000 caractères par import."); return; }
            setImporting(true);
            setMessage(pasted);
            setQualificationPreview(null);
            setError(null);
          }}
          onChange={(event) => { setMessage(event.target.value); setQualificationPreview(null); }}
          onKeyDown={event => {
            if (!importing && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); composer.current?.requestSubmit(); }
          }}
          placeholder={importing ? "Colle les précisions données par le voyageur…" : "Écrire à DA Sales…"} />
          <button type="submit" className="desk-assistant__send" aria-label={importing ? "Analyser la qualification" : "Envoyer"} disabled={!message.trim() || pending}><ArrowUp size={18} aria-hidden="true" /></button>
        </div>
      </form>
    </div>
  );
}
