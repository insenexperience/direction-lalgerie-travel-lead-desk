"use client";

import { useState } from "react";
import { ZONES } from "@/lib/bo3/geo";
import { BUDGETS, budgetParPersonne, DEFINIR, LIEUX_TRIES, MOIS } from "@/lib/bo3/trame";
import type { Manque, Trame } from "@/lib/bo3/types";
import { Icon, Modal } from "./ui";

/** Une étape : un lieu, les autres lieux du même jour (trame du site), un nombre de jours, des envies. */
type Etape = { lieu: string; autres: string[]; jours: number; e: string };
/** Jours consécutifs sur un même lieu seul, sans envies propres → une étape. Rien d'autre n'est fusionné. */
function etapesDe(t: Trame): Etape[] {
  const out: Etape[] = [];
  for (const j of t.jours) {
    const [lieu, ...autres] = j.lieux;
    const der = out[out.length - 1];
    if (der && der.lieu === lieu && !autres.length && !der.autres.length && !j.e) der.jours += 1;
    else out.push({ lieu, autres, jours: 1, e: j.e });
  }
  return out;
}
const nomLieu = (id: string) => LIEUX_TRIES.find((l) => l.id === id)?.nom ?? id;

/**
 * Compléter (seulement les champs manquants) ou construire une trame complète.
 * Rien ne part vers le voyageur ni l'agence : c'est une saisie de l'opérateur.
 */
export function TrameForm({ initiale, champs, titre, onClose, onSave, pending }: {
  initiale: Trame; champs: Manque[] | "tout"; titre: string; onClose: () => void; onSave: (t: Trame) => void; pending: boolean;
}) {
  const [t, setT] = useState<Trame>(initiale);
  const [etapes, setEtapesBrut] = useState<Etape[]>(() => etapesDe(initiale));
  // L'itinéraire n'est reconstruit que si l'opérateur a touché aux étapes : sinon la trame garde ses jours tels quels.
  const [etapesTouchees, setEtapesTouchees] = useState(false);
  const setEtapes = (e: Etape[]) => { setEtapesBrut(e); setEtapesTouchees(true); };
  const [lieu, setLieu] = useState(LIEUX_TRIES[0].id);
  const [nbJ, setNbJ] = useState(1);
  const tout = champs === "tout";
  const voir = (m: Manque) => tout || champs.includes(m);
  const budgetAutre = t.budget && ![...BUDGETS.map(budgetParPersonne), DEFINIR].includes(t.budget);

  const enregistrer = () => {
    let n = 0;
    const jours = etapes.flatMap((e) => Array.from({ length: Math.max(1, e.jours) }, (_, i) => ({ n: ++n, lieux: i === 0 ? [e.lieu, ...e.autres] : [e.lieu], e: i === 0 ? e.e : "" })));
    onSave({ ...t, jours: voir("lieux") && etapesTouchees ? jours : t.jours });
  };

  return (
    <Modal title={titre} onClose={onClose} foot={<><button className="btn s" onClick={onClose}>Annuler</button><button className="btn p" disabled={pending} onClick={enregistrer}>{pending ? "Enregistrement…" : "Enregistrer la trame"}</button></>}>
      {tout && (
        <div className="field"><span className="lbl">Nom de la trame</span><input className="inp" value={t.titre} onChange={(e) => setT({ ...t, titre: e.target.value })} /></div>
      )}
      {voir("dates") && (
        <div className="fgrid">
          <div className="field"><span className="lbl">Mois</span><select className="inp" value={t.cadre.mois} onChange={(e) => setT({ ...t, cadre: { ...t.cadre, mois: e.target.value } })}><option value="">à préciser</option>{MOIS.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div className="field"><span className="lbl">Souplesse</span><select className="inp" value={t.cadre.souplesse} onChange={(e) => setT({ ...t, cadre: { ...t.cadre, souplesse: e.target.value } })}><option value="">—</option><option>dates fixes</option><option>à quelques jours près</option><option>flexibles</option></select></div>
          {tout && <div className="field"><span className="lbl">Durée souhaitée</span><select className="inp" value={t.cadre.duree} onChange={(e) => setT({ ...t, cadre: { ...t.cadre, duree: e.target.value } })}><option value="">—</option><option>2–4 jours</option><option>1 semaine</option><option>10–12 jours</option><option>2 semaines et +</option></select></div>}
        </div>
      )}
      {tout && (
        <div className="fgrid">
          <div className="field"><span className="lbl">Rythme</span><select className="inp" value={t.cadre.rythme} onChange={(e) => setT({ ...t, cadre: { ...t.cadre, rythme: e.target.value } })}><option value="">—</option><option>contemplatif</option><option>équilibré</option><option>soutenu</option></select></div>
          <div className="field"><span className="lbl">Hébergement</span><select className="inp" value={t.cadre.hebergement} onChange={(e) => setT({ ...t, cadre: { ...t.cadre, hebergement: e.target.value } })}><option value="">—</option><option>bivouac & belle étoile</option><option>simple et local</option><option>confort d&apos;abord</option><option>chez l&apos;habitant</option></select></div>
        </div>
      )}
      {voir("groupe") && (
        <div className="fgrid">
          <div className="field"><span className="lbl">Groupe</span><select className="inp" value={t.groupe.type} onChange={(e) => setT({ ...t, groupe: { ...t.groupe, type: e.target.value } })}><option value="">à préciser</option><option>solo</option><option>couple</option><option>famille</option><option>amis</option></select></div>
          <div className="field"><span className="lbl">Nombre</span><input className="inp" type="number" min={1} value={t.groupe.nombre ?? ""} onChange={(e) => setT({ ...t, groupe: { ...t.groupe, nombre: Number(e.target.value) || null } })} /></div>
          <div className="field"><span className="lbl">Dont enfants</span><input className="inp" type="number" min={0} value={t.groupe.enfants ?? ""} onChange={(e) => setT({ ...t, groupe: { ...t.groupe, enfants: Number(e.target.value) || null } })} /></div>
        </div>
      )}
      {voir("budget") && (
        <div className="field">
          <span className="lbl">Budget par personne, hors vol</span>
          <select className="inp" value={budgetAutre ? "autre" : t.budget ?? ""} onChange={(e) => setT({ ...t, budget: e.target.value === "autre" ? "" : e.target.value || null })}>
            <option value="">manquant</option>
            {BUDGETS.map((b) => <option key={b} value={budgetParPersonne(b)}>{b}</option>)}
            <option value={DEFINIR}>{DEFINIR}</option>
            <option value="autre">Autre montant…</option>
          </select>
          {(budgetAutre || t.budget === "") && <input className="inp" placeholder="ex. 2 000 € par personne, hors vol" value={t.budget ?? ""} onChange={(e) => setT({ ...t, budget: e.target.value })} />}
        </div>
      )}
      {voir("lieux") && (
        <div className="field">
          <span className="lbl">Itinéraire · lieux dans l&apos;ordre</span>
          <div className="stack" style={{ gap: 6 }}>
            {etapes.map((e, i) => (
              <div key={i} className="qb">
                <div className="grow"><div className="nm">{nomLieu(e.lieu)}{e.autres.length ? ` + ${e.autres.map(nomLieu).join(", ")}` : ""} <span className="mt">· {ZONES[LIEUX_TRIES.find((l) => l.id === e.lieu)?.zone ?? "nord"]}</span></div>
                  <input className="inp" style={{ height: 30, marginTop: 4 }} placeholder="envies sur cette étape (facultatif)" value={e.e} onChange={(x) => setEtapes(etapes.map((y, k) => (k === i ? { ...y, e: x.target.value } : y)))} /></div>
                <input className="inp" type="number" min={1} style={{ width: 70 }} aria-label="jours" value={e.jours} onChange={(x) => setEtapes(etapes.map((y, k) => (k === i ? { ...y, jours: Number(x.target.value) || 1 } : y)))} />
                <span className="mt">j</span>
                <button className="btn s xs" aria-label="Retirer" onClick={() => setEtapes(etapes.filter((_, k) => k !== i))}><Icon n="x" s={11} /></button>
              </div>
            ))}
            <div className="row wrap">
              <select className="inp grow" value={lieu} onChange={(e) => setLieu(e.target.value)} aria-label="Lieu">{LIEUX_TRIES.map((l) => <option key={l.id} value={l.id}>{l.nom} · {ZONES[l.zone]}</option>)}</select>
              <input className="inp" type="number" min={1} style={{ width: 70 }} aria-label="Nombre de jours" value={nbJ} onChange={(e) => setNbJ(Number(e.target.value) || 1)} />
              <button className="btn sm" onClick={() => setEtapes([...etapes, { lieu, autres: [], jours: nbJ, e: "" }])}><Icon n="plus" s={11} /> Ajouter l&apos;étape</button>
            </div>
            <span className="mt">{etapes.reduce((s, e) => s + e.jours, 0)} jours au total</span>
          </div>
        </div>
      )}
      {tout && (
        <>
          <div className="field"><span className="lbl">Précisions du voyageur</span><textarea className="inp" value={t.precisions} onChange={(e) => setT({ ...t, precisions: e.target.value })} /></div>
          <div className="field"><span className="lbl">Points à ajuster · un par ligne</span><textarea className="inp" style={{ minHeight: 60 }} value={t.ajuster.join("\n")} onChange={(e) => setT({ ...t, ajuster: e.target.value.split("\n") })} /></div>
        </>
      )}
      <div className="mt">Saisie de l&apos;opérateur, d&apos;après la conversation avec le voyageur. Rien n&apos;est envoyé.</div>
    </Modal>
  );
}
