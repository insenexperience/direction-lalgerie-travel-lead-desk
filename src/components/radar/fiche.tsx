"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { commenterFiche, lireDetail, modifierFiche } from "@/app/(dashboard)/radar/actions";
import { Icon, useToast } from "@/components/bo3/ui";
import { BASES, lienNotion, type Champ } from "@/lib/radar/bases";
import { dateDe, dateFr, ficheEnTexte, valeurTexte } from "@/lib/radar/format";
import type { DetailFiche, Fiche, Valeur } from "@/lib/radar/types";
import { SaisieChamp } from "./champs";
import { copier, Note, TagEcheance, useRadar } from "./contexte";
import { Md } from "./md";

const vide = (v: Valeur | undefined) => v == null || v === "" || v === false || (Array.isArray(v) && !v.length);
const egal = (a: Valeur | undefined, b: Valeur | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null) || (vide(a) && vide(b));

export function demanderAgent(texte: string) {
  window.dispatchEvent(new CustomEvent("radar:agent", { detail: texte }));
}

/** Tiroir latéral : lecture, modification, contenu de la page et commentaires d'une fiche. */
export function TiroirFiche() {
  const { ouverte, trouver, fermer } = useRadar();
  const f = ouverte ? trouver(ouverte) : null;
  useEffect(() => {
    if (!ouverte) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target as HTMLElement).closest?.(".rdag")) fermer(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ouverte, fermer]);
  if (!ouverte) return null;
  return (
    <>
      <div className="rd-voile" onClick={fermer} aria-hidden="true" />
      {f ? <Contenu key={f.id} f={f} /> : (
        <aside className="rd-tiroir" role="dialog" aria-modal="true" aria-label="Fiche introuvable">
          <div className="rd-tiroir__bd"><div className="empty"><b>Fiche introuvable</b>Elle a peut-être été archivée ou supprimée dans Notion.</div></div>
          <div className="rd-tiroir__ft"><button className="btn s" onClick={fermer}>Fermer</button></div>
        </aside>
      )}
    </>
  );
}

function Contenu({ f }: { f: Fiche }) {
  const { fermer, ouvrir, noter, noms } = useRadar();
  const toast = useToast();
  const b = BASES[f.base];
  const [edition, setEdition] = useState(false);
  const [brouillon, setBrouillon] = useState<Record<string, Valeur>>({});
  const [erreur, setErreur] = useState("");
  const [detail, setDetail] = useState<DetailFiche | null>(null);
  const [detailErreur, setDetailErreur] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [enCours, demarrer] = useTransition();
  const fermerRef = useRef<HTMLButtonElement>(null);

  const charger = useCallback(async () => {
    const r = await lireDetail(f.id);
    if (r.ok) { setDetail(r.detail); setDetailErreur(""); } else setDetailErreur(r.erreur);
  }, [f.id]);

  useEffect(() => { fermerRef.current?.focus(); void charger(); }, [charger]);

  const commencer = () => {
    setBrouillon({ ...f.props, [b.titre]: f.titre, [b.statut]: f.statut });
    setErreur("");
    setEdition(true);
  };

  const enregistrer = (changes: Record<string, Valeur>, message: string) => {
    const diff = Object.fromEntries(Object.entries(changes).filter(([k, v]) => !egal(v, k === b.titre ? f.titre : k === b.statut ? f.statut : f.props[k])));
    if (!Object.keys(diff).length) { setEdition(false); return; }
    setErreur("");
    demarrer(async () => {
      const r = await modifierFiche(f.base, f.id, diff);
      if (!r.ok) { setErreur(r.erreur); toast("Notion a refusé la modification"); return; }
      const props = { ...f.props, ...diff };
      noter({ ...f, props, titre: String(props[b.titre] ?? f.titre) || f.titre, statut: String(props[b.statut] ?? f.statut), modifie: new Date().toISOString() });
      setEdition(false);
      toast(message);
    });
  };

  const commenter = () => {
    const t = commentaire.trim();
    if (!t) return;
    demarrer(async () => {
      const r = await commenterFiche(f.id, t);
      if (!r.ok) { setErreur(r.erreur); return; }
      setCommentaire("");
      setDetail((d) => d && { ...d, commentaires: [...d.commentaires, { id: `local-${Date.now()}`, qui: "Toi (via le desk)", quand: new Date().toISOString(), texte: t }] });
      toast("Commentaire publié dans Notion");
    });
  };

  const echeance = dateDe(f, b.echeance);
  const champs = b.champs.filter((c) => c.type !== "created" || !vide(f.props[c.k]));
  const pleins = champs.filter((c) => c.k !== b.suite && !vide(f.props[c.k]));
  const vides = champs.filter((c) => c.k !== b.suite && vide(f.props[c.k]) && c.type !== "created");

  return (
    <aside className="rd-tiroir" role="dialog" aria-modal="true" aria-label={f.titre}>
      <header className="rd-tiroir__hd">
        <div className="row b">
          <span className="eyebrow">{b.label}</span>
          <div className="row" style={{ gap: 4 }}>
            <button className="ibtn" title="Copier la fiche" aria-label="Copier la fiche" onClick={async () => toast((await copier(ficheEnTexte(f, noms, detail?.contenu))) ? "Fiche copiée" : "Copie impossible")}><Icon n="copy" s={15} /></button>
            <a className="ibtn" href={lienNotion(f.id)} target="_blank" rel="noopener noreferrer" title="Ouvrir dans Notion" aria-label="Ouvrir dans Notion"><Icon n="link" s={15} /></a>
            <button ref={fermerRef} className="ibtn" title="Fermer (Échap)" aria-label="Fermer" onClick={fermer}><Icon n="x" s={15} /></button>
          </div>
        </div>
        {edition ? (
          <input className="inp rd-tiroir__tin" value={String(brouillon[b.titre] ?? "")} onChange={(e) => setBrouillon({ ...brouillon, [b.titre]: e.target.value })} aria-label="Titre" />
        ) : <h2 className="rd-tiroir__t">{f.titre}</h2>}
        <div className="row wrap" style={{ gap: 8 }}>
          <select className="inp rd-statut" aria-label={b.statut} value={f.statut} disabled={enCours || edition} onChange={(e) => enregistrer({ [b.statut]: e.target.value }, `${b.statut} : ${e.target.value}`)}>
            {!f.statut && <option value="">Sans statut</option>}
            {b.statuts.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {b.note && f.props[b.note] != null && <span className="row" style={{ gap: 6 }}><span className="lbl">Note</span><Note v={f.props[b.note]} /></span>}
          {echeance && <TagEcheance iso={echeance} avant={`${champLabel(b.echeance)} · ${dateFr(echeance, true)} · `} />}
          {enCours && <span className="mt">Écriture dans Notion…</span>}
        </div>
      </header>

      <div className="rd-tiroir__bd">
        {erreur && <div className="excl" role="alert">{erreur}</div>}
        {edition ? (
          <div className="rd-form">
            {[{ k: b.suite }, ...b.champs.filter((c) => c.k !== b.suite && c.type !== "created")].map(({ k }) => {
              const c = b.champs.find((x) => x.k === k) as Champ;
              const id = `rd-${f.id}-${k}`;
              return (
                <div key={k} className={`field ${c.long || c.type === "multi" || c.type === "relation" ? "large" : ""}`}>
                  <label className="lbl" htmlFor={id} id={`${id}-l`}>{c.label}</label>
                  <SaisieChamp f={c} v={brouillon[k]} onChange={(v) => setBrouillon((x) => ({ ...x, [k]: v }))} id={id} />
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {!vide(f.props[b.suite]) && (
              <div className="rd-suite">
                <div className="lbl">{champLabel(b.suite)}</div>
                <Md texte={String(f.props[b.suite])} />
              </div>
            )}
            <div className="rd-props">
              {pleins.map((c) => (
                <div key={c.k} className={`rd-prop ${c.long ? "large" : ""}`}>
                  <div className="lbl">{c.label}</div>
                  <div className="v"><ValeurProp c={c} v={f.props[c.k]} noms={noms} ouvrir={ouvrir} /></div>
                </div>
              ))}
            </div>
            {vides.length > 0 && <div className="mt">Non renseigné : {vides.map((c) => c.label).join(", ")}.</div>}
          </>
        )}

        <section className="rd-section">
          <div className="lbl">Page Notion</div>
          {detail ? (detail.contenu ? <Md texte={detail.contenu} /> : <div className="mt">La page est vide.</div>)
            : detailErreur ? <div className="warn">{detailErreur}</div>
            : <div className="stack" style={{ gap: 8 }}><div className="sk" style={{ height: 12, width: "90%" }} /><div className="sk" style={{ height: 12, width: "70%" }} /><div className="sk" style={{ height: 12, width: "80%" }} /></div>}
        </section>

        <section className="rd-section">
          <div className="lbl">Commentaires{detail?.commentaires.length ? ` · ${detail.commentaires.length}` : ""}</div>
          {detail?.commentaires.map((c) => (
            <div key={c.id} className="rd-com">
              <div className="rd-com__h"><b>{c.qui || "Notion"}</b> <span className="mt">{dateFr(c.quand)}</span></div>
              <Md texte={c.texte} />
            </div>
          ))}
          <textarea className="inp" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ajouter un commentaire dans Notion…" aria-label="Nouveau commentaire"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commenter(); } }} />
          <div className="row b">
            <span className="mt">Signé de ton nom, visible par toute l&apos;équipe dans Notion.</span>
            <button className="btn sm" disabled={enCours || !commentaire.trim()} onClick={commenter}><Icon n="send" s={12} /> Commenter</button>
          </div>
        </section>
      </div>

      <footer className="rd-tiroir__ft">
        {edition ? (
          <>
            <button className="btn s" onClick={() => setEdition(false)} disabled={enCours}>Annuler</button>
            <button className="btn p" onClick={() => enregistrer(brouillon, "Fiche mise à jour dans Notion")} disabled={enCours}>{enCours ? "Écriture…" : "Enregistrer dans Notion"}</button>
          </>
        ) : (
          <>
            <button className="btn s" onClick={() => demanderAgent(`Sur la fiche « ${f.titre} » (${b.label}) : qu'est-ce que tu proposes comme prochaine étape concrète ?`)}><Icon n="sparkles" s={13} /> Demander à l&apos;agent</button>
            <button className="btn p" onClick={commencer}><Icon n="pencil" s={12} /> Modifier</button>
          </>
        )}
      </footer>
    </aside>
  );

  function champLabel(k: string | null) {
    return (k && b.champs.find((c) => c.k === k)?.label) || k || "";
  }
}

function ValeurProp({ c, v, noms, ouvrir }: { c: Champ; v: Valeur | undefined; noms: Record<string, string>; ouvrir: (id: string) => void }) {
  if (c.type === "relation" && Array.isArray(v)) {
    return (
      <span className="rd-multi">
        {v.map((id) => noms[id]
          ? <button key={id} type="button" className="tag rd-lien" onClick={() => ouvrir(id)}>{noms[id]}</button>
          : <a key={id} className="tag" href={lienNotion(id)} target="_blank" rel="noopener noreferrer">Fiche Notion</a>)}
      </span>
    );
  }
  if (c.type === "multi" && Array.isArray(v)) return <span className="rd-multi">{v.map((x) => <span key={x} className="tag">{x}</span>)}</span>;
  if (c.type === "url" && typeof v === "string") return <a href={v} target="_blank" rel="noopener noreferrer" className="rd-url">{v.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>;
  if (c.type === "number") return <Note v={v} />;
  if (c.type === "text") return <Md texte={String(v ?? "")} />;
  return <>{valeurTexte(c, v, noms)}</>;
}
