"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  confirmAssistantDeskAction, confirmAssistantDraft, confirmAssistantQualification, getAssistantDeskView,
  prepareAssistantDraft, previewAssistantDeskAction, previewAssistantQualification,
} from "@/app/(dashboard)/settings/assistant-actions";
import { readDeskGmail } from "@/app/(dashboard)/leads/gmail-actions";
import { useDeskToast } from "@/components/ui/desk-toast";
import type { DeskView } from "@/lib/assistant/desk-data";
import { qualificationLabels, type QualificationPreview } from "@/lib/assistant/qualification";
import { projectDeskLink, type DeskProjectTab } from "@/lib/assistant/scope";
import { ASSISTANT_DRAFT_SAVED, ASSISTANT_OPEN_COMPOSER, type AssistantDraft, type AssistantDraftKind } from "@/lib/assistant/types";
import type { DeskInboundMail } from "@/lib/email/gmail-intake";
import { useAssistantConnection } from "./assistant-connection";
import { DeskGmailMessages } from "./desk-gmail-messages";
import { DeskCopy, DeskReadout, type ReadoutFocus } from "./desk-readout";

type DeskAction = Parameters<typeof previewAssistantDeskAction>[1];
type ActionPreview = Extract<Awaited<ReturnType<typeof previewAssistantDeskAction>>, { ok: true }>["preview"];
const actions: Record<DeskAction, { label: string; effect: string }> = {
  claim: { label: "Prendre le dossier", effect: "Ton compte deviendra le référent du dossier." },
  brief: { label: "Générer le brief", effect: "Le Desk prépare un brief depuis la trame. Il sera disponible dans Brief & agences pour relecture." },
  link: { label: "Préparer le lien voyageur", effect: "Le Desk crée un lien pour compléter la qualification et réutilise le lien actif s’il existe." },
};
const kindLabels: Record<AssistantDraftKind, string> = {
  welcome: "Accusé de réception",
  qualification: "Prise de contact",
  agency_feasibility: "Étude de faisabilité",
  agency_brief: "Brief agence",
};

export function AssistantProjectActions({ lead, agencies, tab, visibleProject }: {
  lead: { id: string; ref: string; closed: boolean };
  agencies: { id: string; n: string }[];
  tab: DeskProjectTab;
  visibleProject: boolean;
}) {
  const router = useRouter();
  const toast = useDeskToast();
  const connection = useAssistantConnection();
  const [readout, setReadout] = useState<{ view: DeskView; focus?: ReadoutFocus } | null>(null);
  const [mail, setMail] = useState<DeskInboundMail[] | null>(null);
  const [actionPreview, setActionPreview] = useState<ActionPreview | null>(null);
  const [actionResult, setActionResult] = useState<{ message?: string; href: string; url?: string } | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [notes, setNotes] = useState("");
  const [qualification, setQualification] = useState<QualificationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    start(async () => {
      try { await action(); }
      catch { setError("L’action n’a pas abouti. Vérifie le dossier avant de réessayer."); }
    });
  }

  function clearResults() {
    setReadout(null);
    setMail(null);
    setActionPreview(null);
    setActionResult(null);
    setDraft(null);
    setQualification(null);
  }

  function openReadout(focus?: ReadoutFocus) {
    clearResults();
    run(async () => {
      const result = await getAssistantDeskView({ screen: "project", leadId: lead.id, tab });
      if (result.ok) setReadout({ view: result.view, focus });
      else setError(result.error);
    });
  }

  function openMail() {
    clearResults();
    run(async () => {
      const result = await readDeskGmail(lead.id);
      if (result.ok) setMail(result.messages);
      else setError("Les e-mails de ce dossier ne sont pas accessibles.");
    });
  }

  function prepareAction(kind: DeskAction) {
    clearResults();
    run(async () => {
      const result = await previewAssistantDeskAction(lead.id, kind);
      if (result.ok) setActionPreview(result.preview);
      else setError(result.error);
    });
  }

  function prepareDraft(kind: AssistantDraftKind) {
    clearResults();
    run(async () => {
      const toAgency = kind === "agency_brief" || kind === "agency_feasibility";
      const result = await prepareAssistantDraft(lead.id, kind, toAgency ? agencyId : null);
      if (result.ok) setDraft(result.preview);
      else setError(result.error);
    });
  }

  function importQualification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = notes.trim();
    if (!content || pending) return;
    clearResults();
    run(async () => {
      const result = await previewAssistantQualification(lead.id, content);
      if (result.ok) setQualification(result.preview);
      else setError(result.error);
    });
  }

  return (
    <details className="desk-assistant__shortcuts" onToggle={event => {
      if (event.currentTarget.open && !lead.closed && !connection?.status && !connection?.pending) connection?.load();
    }}>
      <summary>Actions du dossier</summary>
      <div className="stack">
        <div className="desk-assistant__suggestions">
          <button type="button" className="btn s xs" disabled={pending} onClick={() => openReadout()}>État du dossier</button>
          <button type="button" className="btn s xs" disabled={pending} onClick={() => openReadout("timeline")}>Historique</button>
          {tab === "props" && <button type="button" className="btn s xs" disabled={pending} onClick={() => openReadout("offers")}>Comparer les propositions</button>}
          <button type="button" className="btn s xs" disabled={pending} onClick={openMail}>Lire les e-mails</button>
          {!lead.closed && (Object.keys(actions) as DeskAction[]).map(kind =>
            <button key={kind} className="btn s xs" type="button" disabled={pending} onClick={() => prepareAction(kind)}>{actions[kind].label}</button>)}
        </div>
        {!lead.closed && <>
          <details className="desk-assistant__disclosure">
            <summary>Brouillons d’e-mail</summary>
            <fieldset className="desk-assistant__draft-controls" disabled={pending} aria-label="Préparer un brouillon">
              <div className="row wrap">
                <button type="button" className="btn s xs" onClick={() => prepareDraft("welcome")}>Accusé de réception</button>
                <button type="button" className="btn s xs" onClick={() => prepareDraft("qualification")}>Qualification</button>
              </div>
              <label htmlFor="desk-assistant-agency">Agence destinataire</label>
              <div className="row wrap">
                <select id="desk-assistant-agency" className="inp" value={agencyId}
                  onChange={event => { setAgencyId(event.target.value); if (draft?.agencyId) setDraft(null); }}>
                  <option value="">Choisir une agence</option>
                  {agencies.map(({ id, n }) => <option key={id} value={id}>{n}</option>)}
                </select>
                <button type="button" className="btn s xs" disabled={!agencyId} onClick={() => prepareDraft("agency_feasibility")}>Faisabilité</button>
                <button type="button" className="btn s xs" disabled={!agencyId} onClick={() => prepareDraft("agency_brief")}>Brief agence</button>
              </div>
            </fieldset>
          </details>
          {connection?.status?.state === "connected" && (
            <details className="desk-assistant__disclosure">
              <summary>Coller une qualification</summary>
              <form className="stack" onSubmit={importQualification}>
                <textarea aria-label="Retour du voyageur" className="inp" rows={4} maxLength={6000} value={notes}
                  placeholder="Colle les précisions données par le voyageur…"
                  onChange={event => { setNotes(event.target.value); setQualification(null); }} />
                <button type="submit" className="btn s xs" disabled={!notes.trim() || pending}>Analyser la qualification</button>
              </form>
            </details>
          )}
        </>}
        {readout && <DeskReadout view={readout.view} focus={readout.focus} />}
        {mail && <section aria-label="E-mails reçus">
          <b>E-mails reçus dans Gmail</b>
          {mail.length ? <DeskGmailMessages messages={mail} /> : <p>Aucun e-mail rapproché de ce dossier.</p>}
        </section>}
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
          <Link className="desk-assistant__source" href={actionResult.href}>Voir dans le dossier</Link>
        </section>}
        {qualification && <section className="desk-assistant__proposal" aria-label="Qualification à valider">
          <b>Qualification · {lead.ref}</b>
          {qualification.changes?.length ? <div className="desk-assistant__table-wrap">
            <table className="desk-assistant__table">
              <thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead>
              <tbody>{qualification.changes.map(({ label, before, after }) => <tr key={label}>
                <th scope="row">{label}</th><td>{before ?? "—"}</td><td>{after ?? "Effacé"}</td>
              </tr>)}</tbody>
            </table>
          </div> : <dl className="desk-assistant__facts">
            {qualificationLabels(qualification.qualification).map(({ label, value }) =>
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>}
          <div className="row wrap">
            <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantQualification(qualification);
              if (!result.ok) { setError(result.error); return; }
              setQualification(null);
              setNotes("");
              toast.success("Qualification enregistrée dans le dossier.");
              router.refresh();
            })}>Enregistrer la qualification</button>
            <button type="button" className="btn s" disabled={pending} onClick={() => setQualification(null)}>Annuler</button>
          </div>
        </section>}
        {draft && <section className="desk-assistant__proposal" aria-label="Aperçu du brouillon">
          <b>{kindLabels[draft.kind]}</b>
          <div>Destinataire · {draft.recipient}</div>
          <div>Objet · {draft.subject}</div>
          <div className="desk-assistant__draft-text">{draft.bodyText}</div>
          {draft.draftId
            ? visibleProject ? <button type="button" className="btn p" onClick={() => {
              window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_COMPOSER, { detail: {
                leadId: draft.leadId, kind: draft.kind, agencyId: draft.agencyId, proposalId: draft.proposalId,
              } }));
            }}>Ouvrir dans le composeur</button> : <Link className="desk-assistant__source" href={projectDeskLink(lead.id, draft.agencyId ? "agences" : "voyageur")}>Ouvrir le dossier</Link>
            : <button type="button" className="btn p" disabled={pending} onClick={() => run(async () => {
              const result = await confirmAssistantDraft(draft);
              if (!result.ok) { setError(result.error); return; }
              setDraft({ ...draft, draftId: result.draftId });
              toast.success("Brouillon enregistré dans le dossier.");
              window.dispatchEvent(new CustomEvent(ASSISTANT_DRAFT_SAVED, { detail: {
                leadId: draft.leadId, kind: draft.kind, agencyId: draft.agencyId,
              } }));
              router.refresh();
            })}>Valider et enregistrer le brouillon</button>}
        </section>}
        {error && <p role="alert">{error}</p>}
        {pending && <p className="desk-assistant__pending" role="status">Consultation du Desk…</p>}
      </div>
    </details>
  );
}
