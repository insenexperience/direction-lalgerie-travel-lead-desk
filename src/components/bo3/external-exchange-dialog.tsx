"use client";

import { useRef, useState, useTransition } from "react";
import { enregistrerEchangeExterne } from "@/app/(dashboard)/leads/exchange-actions";
import { MANUAL_CHANNELS, type ManualChannel } from "@/lib/bo3/manual-stage";
import type { Projet } from "@/lib/bo3/types";
import { Modal } from "./ui";

function heureAlger(now: number) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function ExternalExchangeDialog({ p, updatedAt, now, onClose, onSaved }: { p: Projet; updatedAt: string; now: number; onClose: () => void; onSaved: (info: string) => void }) {
  const [channel, setChannel] = useState<ManualChannel>(p.canal);
  const [occurredAt, setOccurredAt] = useState(() => heureAlger(now));
  const [note, setNote] = useState("");
  const [firstResponse, setFirstResponse] = useState(!p.premiereReponse);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submitting = useRef(false);
  return <Modal title="Enregistrer un échange déjà effectué" onClose={() => { if (!submitting.current) onClose(); }}>
    <form className="stack" onSubmit={event => {
      event.preventDefault();
      if (submitting.current) return;
      submitting.current = true;
      setError("");
      start(async () => {
        try {
          const timestamp = new Date(`${occurredAt}:00+01:00`);
          if (!Number.isFinite(timestamp.getTime())) { setError("Vérifiez la date de l’échange."); return; }
          const r = await enregistrerEchangeExterne(p.id, { channel, note, occurredAt: timestamp.toISOString(), firstResponse, expectedUpdatedAt: updatedAt });
          if (r.ok) onSaved(r.info ?? "Échange enregistré."); else setError(r.erreur);
        } catch { setError("L’enregistrement n’a pas pu être confirmé. Rechargez la fiche avant de réessayer."); }
        finally { submitting.current = false; }
      });
    }}>
      <p>Enregistrez un message envoyé depuis votre messagerie, un échange WhatsApp ou un appel. L’étape actuelle est conservée.</p>
      <div className="fgrid">
        <label className="field"><span className="lbl">Canal utilisé</span><select className="inp" value={channel} disabled={pending} onChange={e => setChannel(e.target.value as ManualChannel)}>{Object.entries(MANUAL_CHANNELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span className="lbl">Date de l’échange · heure d’Alger</span><input className="inp" type="datetime-local" required value={occurredAt} disabled={pending} onChange={e => setOccurredAt(e.target.value)} /></label>
      </div>
      <label className="field"><span className="lbl">Message ou résumé de l’échange</span><textarea className="inp" autoFocus rows={5} maxLength={2000} required disabled={pending} value={note} onChange={e => setNote(e.target.value)} placeholder="Ex. : premier échange WhatsApp, dates et budget encore à préciser." /></label>
      {!p.premiereReponse && <label className="row" style={{ alignItems: "flex-start" }}><input type="checkbox" checked={firstResponse} disabled={pending} onChange={e => setFirstResponse(e.target.checked)} /><span>C’est la première réponse au voyageur.<span className="mt" style={{ display: "block" }}>Le compteur s’arrête à la date réelle indiquée ci-dessus. La qualification reste à compléter.</span></span></label>}
      {error && <p className="warn" role="alert">{error}</p>}
      <div className="row wrap" style={{ justifyContent: "flex-end" }}><button type="button" className="btn s" disabled={pending} onClick={onClose}>Annuler</button><button type="submit" className="btn p" disabled={pending || !note.trim() || !occurredAt}>{pending ? "Enregistrement…" : "Enregistrer l’échange"}</button></div>
    </form>
  </Modal>;
}
