"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { chatWithAssistant, confirmAssistantDraft, confirmAssistantEdit, confirmAssistantQualification, prepareAssistantDraft, previewAssistantQualification } from "@/app/(dashboard)/settings/assistant-actions";
import { ASSISTANT_DRAFT_SAVED, ASSISTANT_OPEN_COMPOSER, type AssistantDraft, type AssistantDraftKind, type AssistantEditPreview, type AssistantTurn } from "@/lib/assistant/types";
import { AssistantConnection, useAssistantConnection } from "./assistant-connection";
import { qualificationLabels, type QualificationPreview } from "@/lib/assistant/qualification";

type Lead = { id: string; ref: string };
type Agency = { id: string; n: string };
const failure = "L’action n’a pas abouti. Réessayez depuis l’assistant ou poursuivez dans le dossier.";
const kindLabels: Record<AssistantDraftKind, string> = {
  welcome: "Accusé de réception",
  qualification: "Prise de contact",
  agency_brief: "Brief agence",
};
const priorityLabel = (value: string | null) => value === "high" ? "Haute" : "Normale";
const suggestions = [
  { label: "Résumer la demande", prompt: "Résume la demande de voyage." },
  { label: "Points à qualifier", prompt: "Quels points restent à qualifier sur ce dossier ?" },
  { label: "Préparer une note", prompt: "Propose une note interne synthétique sur la demande et les points à qualifier." },
];

export function AssistantBubble({ lead, agencies }: { lead?: Lead; agencies: Agency[] }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const connection = useAssistantConnection();

  useEffect(() => { if (open) close.current?.focus(); }, [open]);

  function dismiss() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="desk-assistant">
      <section id="desk-assistant-panel" className="desk-assistant__panel" hidden={!open} role="dialog" aria-label="DA Sales"
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); dismiss(); } }}>
        <div className="row b desk-assistant__header">
          <div><b>DA Sales</b><div className="desk-assistant__status">Claude{connection?.status?.state === "connected" ? " connecté" : ""}</div></div>
          <div className="row">
            {connection?.status?.state === "connected" && <button type="button" className="btn s xs" onClick={() => setSettings(!settings)}>{settings ? "Conversation" : "Réglages"}</button>}
            <button type="button" ref={close} className="btn s xs" onClick={dismiss} aria-label="Fermer l’assistant">×</button>
          </div>
        </div>
        <div className="desk-assistant__body" hidden={!(settings || connection?.status?.state !== "connected")}>
          <AssistantConnection />
        </div>
        {connection?.status?.state === "connected" && (
          <div className="desk-assistant__body" hidden={settings}>
            {lead ? <AssistantConversation key={lead.id} lead={lead} agencies={agencies} onOpenComposer={() => setOpen(false)} />
              : <p>Ouvrez un dossier pour l’analyser avec Claude.</p>}
          </div>
        )}
      </section>
      <button type="button" ref={trigger} className="desk-assistant__trigger" aria-expanded={open}
        aria-controls={open ? "desk-assistant-panel" : undefined}
        onClick={() => {
          if (open) { dismiss(); return; }
          setSettings(false);
          setOpen(true);
          connection?.load();
        }}><span aria-hidden="true">✦</span> DA Sales</button>
    </div>
  );
}

function AssistantConversation({ lead, agencies, onOpenComposer }: { lead: Lead; agencies: Agency[]; onOpenComposer: () => void }) {
  const router = useRouter();
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [message, setMessage] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [preview, setPreview] = useState<AssistantDraft | null>(null);
  const [editPreview, setEditPreview] = useState<AssistantEditPreview | null>(null);
  const [qualificationPreview, setQualificationPreview] = useState<QualificationPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef<HTMLDivElement>(null);

  useEffect(() => { latest.current?.scrollIntoView({ block: "nearest" }); }, [turns, preview, editPreview, qualificationPreview, notice]);

  async function prepare(kind: AssistantDraftKind) {
    setEditPreview(null);
    setQualificationPreview(null);
    if (kind === "agency_brief" && !agencyId) {
      setError("Choisissez l’agence destinataire du brief.");
      return;
    }
    const result = await prepareAssistantDraft(lead.id, kind, kind === "agency_brief" ? agencyId : null);
    if (result.ok) setPreview(result.preview);
    else setError(result.error);
  }

  function run(action: () => Promise<void>) {
    setError(null);
    setNotice(null);
    start(async () => {
      try { await action(); } catch { setError(failure); }
    });
  }

  function send(content: string) {
    if (!content || pending) return;
    const input = [...turns, { role: "user", content } satisfies AssistantTurn];
    setPreview(null);
    setEditPreview(null);
    setQualificationPreview(null);
    run(async () => {
      const result = await chatWithAssistant(lead.id, input.slice(-9));
      if (!result.ok) { setError(result.error); return; }
      setTurns([...input, { role: "assistant", content: result.answer.reply }]);
      setMessage("");
      setEditPreview(result.editPreview);
      if (result.editError) setError(result.editError);
      if (result.answer.draftKind) {
        await prepare(result.answer.draftKind);
      }
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (!content || pending) return;
    if (!importing) { send(content); return; }
    setPreview(null);
    setEditPreview(null);
    setQualificationPreview(null);
    run(async () => {
      const result = await previewAssistantQualification(lead.id, content);
      if (result.ok) setQualificationPreview(result.preview);
      else setError(result.error);
    });
  }

  return (
    <div className="desk-assistant__conversation">
      <p className="desk-assistant__context">Dossier ouvert <b>{lead.ref}</b></p>
      <div className="desk-assistant__history">
      <div className="desk-assistant__messages" role="log" aria-label="Conversation">
        {turns.length === 0 && <div className="desk-assistant__welcome">
          <h2>Comment avancer sur ce dossier ?</h2>
          <div className="row wrap">{suggestions.map(({ label, prompt }) =>
            <button key={label} type="button" className="btn s xs" disabled={pending} onClick={() => send(prompt)}>{label}</button>
          )}<button type="button" className="btn p xs" disabled={pending} onClick={() => setImporting(true)}>Coller une qualification</button></div>
        </div>}
        {turns.map(({ role, content }, index) => (
          <div key={index} className="desk-assistant__message" data-role={role}><b>{role === "user" ? "Vous" : "Claude"}</b><div>{content}</div></div>
        ))}
      </div>
      <details className="desk-assistant__shortcuts"><summary>Brouillons d’e-mail</summary>
      <fieldset className="desk-assistant__draft-controls" disabled={pending} aria-label="Préparer un brouillon">
        <div className="row wrap">
          <button type="button" className="btn s xs" onClick={() => { setPreview(null); run(() => prepare("welcome")); }}>Accusé</button>
          <button type="button" className="btn s xs" onClick={() => { setPreview(null); run(() => prepare("qualification")); }}>Qualification</button>
        </div>
        <label htmlFor="desk-assistant-agency">Agence destinataire</label>
        <div className="row wrap">
          <select id="desk-assistant-agency" className="inp" value={agencyId}
            onChange={(event) => { setAgencyId(event.target.value); if (preview?.kind === "agency_brief") setPreview(null); }}>
            <option value="">Choisir une agence</option>
            {agencies.map(({ id, n }) => <option key={id} value={id}>{n}</option>)}
          </select>
          <button type="button" className="btn s xs" disabled={!agencyId}
            onClick={() => { setPreview(null); run(() => prepare("agency_brief")); }}>Brief agence</button>
        </div>
      </fieldset>
      </details>
      {qualificationPreview && (
        <section className="desk-assistant__proposal" aria-label="Qualification à valider">
          <b>Champs à renseigner</b>
          <dl className="desk-assistant__facts">
            {qualificationLabels(qualificationPreview.qualification).map(({ label, value }) =>
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <div className="row wrap">
            <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantQualification(qualificationPreview);
              if (!result.ok) { setError(result.error); return; }
              setQualificationPreview(null);
              setMessage("");
              setImporting(false);
              setNotice("Qualification enregistrée dans la trame et les champs du dossier.");
              router.refresh();
            })}>Enregistrer la qualification</button>
            <button type="button" className="btn s" disabled={pending} onClick={() => setQualificationPreview(null)}>Annuler</button>
          </div>
        </section>
      )}
      {editPreview && (
        <section className="desk-assistant__proposal" aria-label="Modification à valider">
          <b>{editPreview.edit.kind === "note" ? "Ajouter une note interne" : "Changer la priorité"}</b>
          <div className="desk-assistant__draft-text">{editPreview.edit.kind === "note"
            ? editPreview.edit.value
            : `${priorityLabel(editPreview.previous)} → ${priorityLabel(editPreview.edit.value)}`}</div>
          <div className="row wrap">
            <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantEdit(editPreview);
              if (!result.ok) { setError(result.error); return; }
              setEditPreview(null);
              setNotice(editPreview.edit.kind === "note" ? "Note interne ajoutée au dossier."
                : `Priorité ${priorityLabel(editPreview.edit.value).toLowerCase()} enregistrée.`);
              router.refresh();
            })}>Appliquer au dossier</button>
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
            ? <button type="button" className="btn p" onClick={() => {
              window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_COMPOSER, { detail: {
                leadId: preview.leadId, kind: preview.kind, agencyId: preview.agencyId, proposalId: preview.proposalId,
              } }));
              onOpenComposer();
            }}>Ouvrir dans le composeur</button>
            : <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantDraft(preview);
              if (!result.ok) { setError(result.error); return; }
              setPreview({ ...preview, draftId: result.draftId });
              setNotice("Brouillon enregistré dans le dossier.");
              window.dispatchEvent(new CustomEvent(ASSISTANT_DRAFT_SAVED, { detail: {
                leadId: preview.leadId, kind: preview.kind, agencyId: preview.agencyId,
              } }));
              router.refresh();
            })}>Valider et enregistrer le brouillon</button>}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div ref={latest} />
      </div>
      <form className="desk-assistant__input" onSubmit={submit}>
        <div className="row b desk-assistant__input-header">
          <label htmlFor="desk-assistant-message">{importing ? "Retour du voyageur" : "Votre message"}</label>
          <button type="button" className="btn s xs" disabled={pending} onClick={() => { setImporting(!importing); setQualificationPreview(null); }}>
            {importing ? "Revenir au chat" : "Coller une qualification"}
          </button>
        </div>
        <textarea id="desk-assistant-message" className="inp" rows={importing ? 4 : 2} maxLength={importing ? 6000 : 1600} value={message} disabled={pending}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text").trim();
            if (importing || pasted.split(/\r?\n/).filter((line) => line.trim()).length < 3 ||
                !/\b(?:dates|voyageurs|budget|vols|dur[ée]e|h[ée]bergement|excursions|formalit[ée]s)\b/i.test(pasted)) return;
            event.preventDefault();
            if (pasted.length > 6000) { setError("Collez au maximum 6 000 caractères par import."); return; }
            setImporting(true);
            setMessage(pasted);
            setQualificationPreview(null);
            setError(null);
          }}
          onChange={(event) => { setMessage(event.target.value); setQualificationPreview(null); }}
          placeholder={importing ? "Collez les dates, le groupe, les vols, le budget et les autres précisions données par le voyageur." : "Ex. Marque ce dossier comme prioritaire."} />
        <button type="submit" className="btn p" disabled={!message.trim() || pending}>{pending ? "Traitement…" : importing ? "Analyser la qualification" : "Interroger Claude"}</button>
      </form>
    </div>
  );
}
