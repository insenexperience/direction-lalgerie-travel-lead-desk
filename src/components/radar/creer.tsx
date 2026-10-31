"use client";

import { useState, useTransition } from "react";
import { creerFiche } from "@/app/(dashboard)/radar/actions";
import { Modal, useToast } from "@/components/bo3/ui";
import { BASES, ORDRE, type BaseKey } from "@/lib/radar/bases";
import { aujourdhui } from "@/lib/radar/format";
import type { Valeur } from "@/lib/radar/types";
import { SaisieChamp } from "./champs";
import { useRadar } from "./contexte";

/** Champs proposés à la création : l'essentiel, le reste se complète dans la fiche. */
function champsCreation(k: BaseKey): string[] {
  const b = BASES[k];
  const cles = [b.categorie, k === "idees" ? "Format média" : null, k === "idees" ? "Format plateforme" : null, b.region, b.porteur, k === "partenariats" ? "Priorité" : null, b.note, b.echeance, k === "rdv" ? "Date début" : null, b.suite, "Source"];
  return [...new Set(cles.filter((c): c is string => !!c && !!b.champs.find((f) => f.k === c)))];
}

export function CreerFiche({ base: fixe, onClose }: { base?: BaseKey; onClose: () => void }) {
  const { ajouter, ouvrir } = useRadar();
  const toast = useToast();
  const [base, setBase] = useState<BaseKey>(fixe ?? "signaux");
  const [vals, setVals] = useState<Record<string, Valeur>>({});
  const [erreur, setErreur] = useState("");
  const [enCours, demarrer] = useTransition();
  const b = BASES[base];

  const creer = () => {
    const titre = String(vals[b.titre] ?? "").trim();
    if (!titre) { setErreur("Le titre est obligatoire."); return; }
    const brut = Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== "" && v != null && !(Array.isArray(v) && !v.length)));
    setErreur("");
    demarrer(async () => {
      const r = await creerFiche(base, brut);
      if (!r.ok || !r.id) { setErreur(r.ok ? "Création incomplète." : r.erreur); return; }
      const statut = String(brut[b.statut] ?? b.statuts[0]);
      const props: Record<string, Valeur> = { ...brut, [b.titre]: titre, [b.statut]: statut };
      if (b.dateCreation && !props[b.dateCreation]) props[b.dateCreation] = aujourdhui();
      ajouter({ id: r.id, base, titre, statut, props, modifie: new Date().toISOString() });
      toast(`${b.label} : fiche créée dans Notion`);
      onClose();
      ouvrir(r.id);
    });
  };

  return (
    <Modal
      title={fixe ? `Nouvelle fiche · ${b.label}` : "Nouvelle fiche"}
      onClose={onClose}
      foot={<><button className="btn s" onClick={onClose} disabled={enCours}>Annuler</button><button className="btn p" onClick={creer} disabled={enCours}>{enCours ? "Création…" : "Créer dans Notion"}</button></>}
    >
      {!fixe && (
        <div className="segctl" role="tablist" aria-label="Base">
          {ORDRE.map((k) => <button key={k} role="tab" aria-selected={base === k} className={base === k ? "on" : ""} onClick={() => { setBase(k); setVals({}); }}>{BASES[k].label}</button>)}
        </div>
      )}
      <div className="field">
        <label className="lbl" htmlFor="rd-c-titre">{b.titre}</label>
        <input id="rd-c-titre" className="inp" autoFocus value={String(vals[b.titre] ?? "")} onChange={(e) => setVals({ ...vals, [b.titre]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && creer()} />
      </div>
      <div className="rd-form">
        <div className="field">
          <label className="lbl" htmlFor="rd-c-statut">{b.statut}</label>
          <select id="rd-c-statut" className="inp" value={String(vals[b.statut] ?? b.statuts[0])} onChange={(e) => setVals({ ...vals, [b.statut]: e.target.value })}>
            {b.statuts.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {champsCreation(base).map((k) => {
          const c = b.champs.find((f) => f.k === k)!;
          const id = `rd-c-${k.replace(/\W+/g, "-")}`;
          return (
            <div key={k} className={`field ${c.long || c.type === "multi" ? "large" : ""}`}>
              <label className="lbl" htmlFor={id} id={`${id}-l`}>{c.label}</label>
              <SaisieChamp f={c} v={vals[k]} onChange={(v) => setVals((x) => ({ ...x, [k]: v }))} id={id} />
            </div>
          );
        })}
      </div>
      {(base === "signaux" || base === "acteurs") && <div className="mt">Pas de source, pas de ligne : indique l&apos;adresse où l&apos;information se vérifie.</div>}
      {erreur && <div className="excl" role="alert">{erreur}</div>}
    </Modal>
  );
}
