"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/bo3/ui";
import { BASES, lienNotion, type BaseKey } from "@/lib/radar/bases";
import { actives, dateDe, dateFr, ligneMeta, pluriel, texteBrut } from "@/lib/radar/format";
import type { Fiche } from "@/lib/radar/types";
import { Note, TagEcheance, TagStatut, useRadar } from "./contexte";
import { EnteteRadar, NavRadar } from "./nav";

const INTRO: Record<BaseKey, string> = {
  signaux: "Le flux quotidien : ce qui bouge dans le tourisme algérien et la diaspora, trié par la passe du matin.",
  acteurs: "La carte de l'écosystème : qui fait quoi, qui compte pour DA, et quelle est la prochaine action.",
  rdv: "Salons, festivals et événements où DA peut couvrir, visiter, exposer ou bâtir un circuit.",
  partenariats: "Les dossiers ouverts. Huit en cours au plus, chacun avec une prochaine action datée.",
  idees: "La boîte à sujets du média et de la plateforme. Une idée retenue est transmise par la routine du lundi.",
};

type Tri = "defaut" | "recent" | "note" | "echeance" | "titre";

function comparer(b: (typeof BASES)[BaseKey], tri: Tri) {
  const cle = (r: Fiche): string | number | null => {
    if (tri === "recent") return r.modifie || null;
    if (tri === "titre") return r.titre.toLowerCase();
    const prop = tri === "note" ? b.note : tri === "echeance" ? b.echeance : b.tri.prop;
    const v = prop ? r.props[prop] : null;
    return v == null || v === "" ? null : typeof v === "number" ? v : String(v);
  };
  const desc = tri === "recent" || tri === "note" || (tri === "defaut" && b.tri.dir === "desc");
  return (x: Fiche, y: Fiche) => {
    const a = cle(x), c = cle(y);
    if (a == null && c == null) return x.titre.localeCompare(y.titre, "fr");
    if (a == null) return 1;
    if (c == null) return -1;
    const r = a < c ? -1 : a > c ? 1 : 0;
    return desc ? -r : r;
  };
}

export function VueBase({ base, statutInitial, ficheInitiale }: { base: BaseKey; statutInitial?: string; ficheInitiale?: string }) {
  const { bases, ouvrir, setVue } = useRadar();
  const b = BASES[base];
  const rows = bases[base];
  const [statut, setStatut] = useState<string>(statutInitial && b.statuts.includes(statutInitial) ? statutInitial : "actives");
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [porteur, setPorteur] = useState("");
  const [cat, setCat] = useState("");
  const [tri, setTri] = useState<Tri>("defaut");

  useEffect(() => { if (ficheInitiale) ouvrir(ficheInitiale); }, [ficheInitiale, ouvrir]);

  const filtrees = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows
      .filter((r) => (statut === "actives" ? !b.masques.includes(r.statut) : statut === "toutes" ? true : r.statut === statut))
      .filter((r) => !region || !b.region || r.props[b.region] === region)
      .filter((r) => !porteur || !b.porteur || r.props[b.porteur] === porteur)
      .filter((r) => !cat || !b.categorie || r.props[b.categorie] === cat)
      .filter((r) => !n || (r.titre + " " + Object.values(r.props).map((v) => (Array.isArray(v) ? v.join(" ") : String(v ?? ""))).join(" ")).toLowerCase().includes(n))
      .sort(comparer(b, tri));
  }, [rows, statut, region, porteur, cat, q, tri, b]);

  useEffect(() => {
    const filtres = [statut !== "actives" ? `statut ${statut}` : "", region && `région ${region}`, porteur && `porteur ${porteur}`, cat && cat, q && `recherche « ${q} »`].filter(Boolean).join(", ");
    setVue(`Base ${b.label}${filtres ? ` (${filtres})` : ""} : ${filtrees.length} fiche(s) affichée(s)`);
  }, [b.label, statut, region, porteur, cat, q, filtrees.length, setVue]);

  const options = (k: string | null) => (k ? b.champs.find((f) => f.k === k)?.opts ?? [] : []);
  const enCours = b.enCours ? rows.filter((r) => b.enCours!.includes(r.statut)).length : 0;

  return (
    <div className="page">
      <EnteteRadar
        eyebrow="Radar"
        titre={b.label}
        sub={<>{INTRO[base]} {pluriel(actives(b, rows).length, "fiche active", "fiches actives")} sur {rows.length}.{b.plafond ? <> <span className={`tag ${enCours > b.plafond ? "red" : enCours === b.plafond ? "amber" : ""}`}>{enCours} / {b.plafond} en cours</span></> : null}</>}
        base={base}
        notion={lienNotion(b.db)}
      />
      <NavRadar actif={base} />

      <div className="rd-filtres">
        <div className="row wrap" style={{ gap: 6 }}>
          <button className={`chip ${statut === "actives" ? "on" : ""}`} onClick={() => setStatut("actives")}>Actives<b>{actives(b, rows).length}</b></button>
          {b.statuts.map((s) => { const n = rows.filter((r) => r.statut === s).length; return n ? <button key={s} className={`chip ${statut === s ? "on" : ""}`} onClick={() => setStatut(s)}>{s}<b>{n}</b></button> : null; })}
          <button className={`chip ${statut === "toutes" ? "on" : ""}`} onClick={() => setStatut("toutes")}>Toutes<b>{rows.length}</b></button>
        </div>
        <div className="rd-filtres__sel">
          <label className="rd-rech"><Icon n="search" s={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Chercher dans ${b.label.toLowerCase()}…`} aria-label="Rechercher" /></label>
          {b.categorie && <select className="inp" aria-label={b.categorie} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">{b.categorie} : tous</option>{options(b.categorie).map((o) => <option key={o}>{o}</option>)}</select>}
          {b.region && <select className="inp" aria-label="Région" value={region} onChange={(e) => setRegion(e.target.value)}><option value="">Région : toutes</option>{options(b.region).map((o) => <option key={o}>{o}</option>)}</select>}
          {b.porteur && <select className="inp" aria-label="Porteur" value={porteur} onChange={(e) => setPorteur(e.target.value)}><option value="">Porteur : tous</option>{options(b.porteur).map((o) => <option key={o}>{o}</option>)}</select>}
          <select className="inp" aria-label="Trier" value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            <option value="defaut">Tri : {b.tri.prop}</option>
            <option value="recent">Tri : modifiées récemment</option>
            {b.note && b.note !== b.tri.prop && <option value="note">Tri : note</option>}
            {b.echeance && b.echeance !== b.tri.prop && <option value="echeance">Tri : {b.echeance.toLowerCase()}</option>}
            <option value="titre">Tri : alphabétique</option>
          </select>
        </div>
      </div>

      <div className="card rd-liste">
        {filtrees.map((r) => <Ligne key={r.id} r={r} onOpen={() => ouvrir(r.id)} />)}
        {!filtrees.length && <div className="empty"><b>Rien ici</b>{rows.length ? "Aucune fiche ne correspond à ces filtres." : "La base est vide pour l'instant."}</div>}
      </div>
    </div>
  );
}

function Ligne({ r, onOpen }: { r: Fiche; onOpen: () => void }) {
  const b = BASES[r.base];
  const meta = ligneMeta(b, r);
  const suite = texteBrut(r.props[b.suite]);
  const debut = r.base === "rdv" ? dateDe(r, "Date début") : "";
  const ech = dateDe(r, b.echeance);
  return (
    <button type="button" className="rd-ligne" onClick={onOpen}>
      <span className="rd-ligne__main">
        <span className="nm">{r.titre}</span>
        {meta && <span className="mt">{meta}</span>}
        {suite && <span className="rd-ligne__suite">{suite}</span>}
      </span>
      <span className="rd-ligne__st"><TagStatut f={r} /></span>
      <span className="rd-ligne__note">{b.note ? <Note v={r.props[b.note]} /> : null}</span>
      <span className="rd-ligne__date">
        {debut && <span className="mono">{dateFr(debut)}</span>}
        {ech ? <TagEcheance iso={ech} /> : !debut && <span className="mt">·</span>}
      </span>
    </button>
  );
}
