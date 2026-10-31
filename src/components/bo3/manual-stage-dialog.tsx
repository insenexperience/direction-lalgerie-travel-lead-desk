"use client";

import { useRef, useState, useTransition } from "react";
import { avancerEtapeManuellement } from "@/app/(dashboard)/leads/manual-stage-actions";
import { etapesManuellesSuivantes, MANUAL_CHANNELS, type ManualChannel, type ManualStage } from "@/lib/bo3/manual-stage";
import { STATUT_LABEL, type Projet } from "@/lib/bo3/types";
import { Modal } from "./ui";

export function ManualStageDialog({ p, updatedAt, onClose, onSaved }: { p: Projet; updatedAt: string; onClose: () => void; onSaved: (info: string) => void }) {
  const etapes = etapesManuellesSuivantes(p.statut);
  const [stage, setStage] = useState<ManualStage | "">(etapes[0] ?? "");
  const [channel, setChannel] = useState<ManualChannel>(p.canal);
  const [note, setNote] = useState("");
  const [firstResponse, setFirstResponse] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submitting = useRef(false);
  return <Modal title="Avancer manuellement" onClose={() => { if (!submitting.current) onClose(); }}>
    <form className="stack" onSubmit={(event) => {
      event.preventDefault();
      if (!stage || submitting.current) return;
      submitting.current = true;
      setError("");
      start(async () => {
        try {
          const r = await avancerEtapeManuellement(p.id, { stage, channel, note, firstResponse, expectedUpdatedAt: updatedAt });
          if (r.ok) onSaved(r.info ?? "Étape avancée.");
          else setError(r.erreur);
        } catch { setError("L’enregistrement n’a pas pu être confirmé. Rechargez la fiche avant de réessayer."); }
        finally { submitting.current = false; }
      });
    }}>
      <p>Un échange ou une étape a déjà été traité sur WhatsApp, par téléphone ou hors du desk ? Indiquez où en est le dossier.</p>
      <div className="card soft" style={{ padding: "10px 12px" }}>Étape actuelle : <b>{STATUT_LABEL[p.statut]}</b></div>
      <label className="field"><span className="lbl">Étape atteinte</span>
        <select className="inp" value={stage} disabled={pending} required onChange={e => setStage(e.target.value as ManualStage)} autoFocus>
          {etapes.map(s => <option key={s} value={s}>{STATUT_LABEL[s]}{s === "recu" ? " · qualification faite" : ""}</option>)}
        </select>
      </label>
      <label className="field"><span className="lbl">Canal utilisé</span>
        <select className="inp" value={channel} disabled={pending} onChange={e => setChannel(e.target.value as ManualChannel)}>
          {Object.entries(MANUAL_CHANNELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field"><span className="lbl">Ce qui a été fait</span>
        <textarea className="inp" value={note} onChange={e => setNote(e.target.value)} disabled={pending} required maxLength={2000} rows={4} placeholder="Ex. : projet précisé avec le voyageur sur WhatsApp, puis brief transmis à l’agence." />
      </label>
      {!p.premiereReponse && <label className="row" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" checked={firstResponse} disabled={pending} onChange={e => setFirstResponse(e.target.checked)} />
        <span>La première réponse au voyageur a déjà été faite.<span className="mt" style={{ display: "block" }}>Arrête le compteur de première réponse à cet enregistrement.</span></span>
      </label>}
      <div className="mt">Vous déclarez un traitement déjà effectué. L’étape, le canal et votre note seront ajoutés à l’historique. Les notifications habituelles de suivi du projet restent actives.</div>
      {error && <p className="warn" role="alert">{error}</p>}
      <div className="row wrap" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn s" disabled={pending} onClick={onClose}>Annuler</button>
        <button type="submit" className="btn p" disabled={pending || !stage || !note.trim()}>{pending ? "Enregistrement…" : "Enregistrer l’avancement"}</button>
      </div>
    </form>
  </Modal>;
}
