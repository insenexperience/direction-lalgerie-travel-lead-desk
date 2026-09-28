"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ZONES, type Zone } from "@/lib/bo3/geo";
import { fmtD, hrs, nomAgence, r1, statutLabel, travelerClock, zonesJours, type Clock } from "@/lib/bo3/projet";
import { SOURCES, STATUT_LABEL, STATUTS, type Agence, type Projet, type Source } from "@/lib/bo3/types";
import { Card, useNow } from "./ui";

// ---------------------------------------------------------------- Projets (registre)
export function ProjetsView({ projets, agences }: { projets: Projet[]; agences: Agence[] }) {
  const [tab, setTab] = useState<string>("all");
  const router = useRouter();
  const rows = projets.filter((p) => tab === "all" || p.statut === tab).sort((a, b) => +new Date(b.recu) - +new Date(a.recu));
  return (
    <div className="page">
      <div><div className="eyebrow">Registre</div><h1 className="t">Projets</h1><div className="sub">{projets.length} projet{projets.length > 1 ? "s" : ""} · triés par date de réception</div></div>
      <div className="seg">
        <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>Tous<b>{projets.length}</b></button>
        {STATUTS.map((s) => { const n = projets.filter((p) => p.statut === s).length; return n ? <button key={s} className={tab === s ? "on" : ""} onClick={() => setTab(s)}>{STATUT_LABEL[s]}<b>{n}</b></button> : null; })}
      </div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Voyageur</th><th>Projet</th><th>Reçu</th><th>1ʳᵉ réponse</th><th>Statut</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} onClick={() => router.push(`/leads/${p.id}`)} style={{ cursor: "pointer" }}>
                <td><div className="nm">{p.nom}</div><div className="mt mono">{p.ref}</div></td>
                <td>{p.trame ? `« ${p.trame.titre} » · ${p.trame.jours.length} j` : <span className="mt">non qualifié</span>}<div className="mt">{SOURCES[p.source]}{p.consultations.length ? " · " + p.consultations.map((c) => nomAgence(agences, c.agence)).join(", ") : ""}</div></td>
                <td className="mono">{fmtD(p.recu)}</td>
                <td>{p.premiereReponse ? <span className="tag green">{r1(hrs(p.recu, p.premiereReponse))} h</span> : <span className="tag amber">en attente</span>}</td>
                <td><span className="tag">{statutLabel(p)}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="mt">Aucun projet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Pilotage
const PERIODES = [7, 30, 90];
export function PilotageView({ projets, agences, now: depart }: { projets: Projet[]; agences: Agence[]; now: number }) {
  const now = useNow(depart);
  const router = useRouter();
  const [jours, setJours] = useState(30);
  const ps = projets.filter((p) => hrs(p.recu, now) <= jours * 24);
  const answered = ps.filter((p) => p.premiereReponse);
  const dus = ps.filter((p) => p.premiereReponse || (travelerClock(p, now).rem ?? 0) < 0);
  const tenues = answered.filter((p) => hrs(p.recu, p.premiereReponse!) <= 48).length;
  const delais = answered.map((p) => hrs(p.recu, p.premiereReponse!)).sort((a, b) => a - b);
  const median = delais.length ? delais[Math.floor(delais.length / 2)] : null;
  const cons = ps.flatMap((p) => p.consultations.map((c) => ({ ...c, p })));
  const consRecues = cons.filter((c) => c.proposition);
  const consTenues = consRecues.filter((c) => hrs(c.envoye, c.proposition!.recu) <= 48).length;
  const retards: { p: Projet; quoi: string; tag: Pick<Clock, "state" | "label"> }[] = [
    ...projets.filter((p) => p.statut !== "clos" && !p.premiereReponse && (travelerClock(p, now).rem ?? 0) < 0).map((p) => ({ p, quoi: "Pas de première réponse", tag: travelerClock(p, now) })),
    ...projets.flatMap((p) => p.statut === "clos" ? [] : p.consultations.filter((c) => !c.proposition && !c.refus && !c.accuse && hrs(c.envoye, now) > 24).map((c) => ({ p, quoi: `${nomAgence(agences, c.agence)} sans accusé`, tag: { state: "amber" as const, label: `${r1(hrs(c.envoye, now))} h` } }))),
  ];
  const parSource = (Object.keys(SOURCES) as Source[]).map((s) => ({ s, n: ps.filter((p) => p.source === s).length, g: ps.filter((p) => p.source === s && p.issue === "gagne").length }));
  const parZone: Partial<Record<Zone, number>> = {};
  ps.forEach((p) => { const main = Object.entries(zonesJours(p.trame)).sort((a, b) => b[1] - a[1])[0]; if (main) parZone[main[0] as Zone] = (parZone[main[0] as Zone] ?? 0) + 1; });
  const zmax = Math.max(1, ...Object.values(parZone).map(Number));
  const K = ({ l, v, d }: { l: string; v: string | number; d: string }) => <div className="kpi"><div className="lbl">{l}</div><div className="kpi__v">{v}</div><div className="kpi__d">{d}</div></div>;
  return (
    <div className="page">
      <div className="row b wrap">
        <div><div className="eyebrow">{jours} derniers jours</div><h1 className="t">Pilotage</h1><div className="sub">Tenons-nous les 48 h ? Où perd-on des projets ? Quelle agence répond ?</div></div>
        <div className="row">{PERIODES.map((j) => <button key={j} className={`chip ${jours === j ? "on" : ""}`} onClick={() => setJours(j)}>{j} j</button>)}</div>
      </div>
      <div className="grid4">
        <K l="48 h tenues · voyageur" v={`${tenues} / ${dus.length}`} d={median === null ? "aucune réponse encore" : `délai médian ${r1(median)} h · ${dus.length - tenues} dépassée${dus.length - tenues > 1 ? "s" : ""}`} />
        <K l="48 h tenues · agences" v={`${consTenues} / ${consRecues.length}`} d={`${cons.length - consRecues.length} brief${cons.length - consRecues.length > 1 ? "s" : ""} en attente`} />
        <K l="Dossiers en retard" v={retards.length} d={Object.entries(retards.reduce<Record<string, number>>((m, x) => { const k = x.quoi.includes("accusé") ? "agences sans accusé" : "sans première réponse"; m[k] = (m[k] ?? 0) + 1; return m; }, {})).map(([k, v]) => `${v} ${k}`).join(" · ") || "aucun"} />
        <K l="Projets reçus" v={ps.length} d={parSource.filter((x) => x.n).map((x) => `${SOURCES[x.s]} ${x.n}`).join(" · ") || "aucun"} />
      </div>
      <div className="grid3">
        <Card t="Conversion par source">
          <div className="bars">{parSource.map((x) => <div key={x.s} className={`b ${!x.n ? "l" : ""}`}><span>{SOURCES[x.s]}</span><i style={{ width: `${(x.n / Math.max(1, ps.length)) * 100}%` }} /><span className="n">{x.n} → {x.g}</span></div>)}</div>
          <div className="mt">reçus → gagnés</div>
        </Card>
        <Card t="Par agence">
          <table className="tbl">
            <thead><tr><th>Agence</th><th>Briefs</th><th>&lt; 48 h</th><th>Gagnés</th></tr></thead>
            <tbody>{agences.map((a) => { const cs = cons.filter((c) => c.agence === a.id); const d = cs.filter((c) => c.proposition); return <tr key={a.id}><td className="nm">{a.n}</td><td className="mono">{cs.length}</td><td className="mono">{d.filter((c) => hrs(c.envoye, c.proposition!.recu) <= 48).length}</td><td className="mono">{ps.filter((p) => p.issue === "gagne" && p.consultations.some((c) => c.agence === a.id && c.retenue)).length}</td></tr>; })}</tbody>
          </table>
        </Card>
        <Card t="Par région">
          <div className="bars">{(Object.keys(ZONES) as Zone[]).map((z) => <div key={z} className="b"><span>{ZONES[z]}</span><i style={{ width: `${((parZone[z] ?? 0) / zmax) * 100}%` }} /><span className="n">{parZone[z] ?? 0}</span></div>)}</div>
        </Card>
      </div>
      <Card t="Dossiers en retard">
        <table className="tbl">
          <thead><tr><th>Projet</th><th>Quoi</th><th>Depuis</th><th /></tr></thead>
          <tbody>
            {retards.map((x, i) => <tr key={i} onClick={() => router.push(`/leads/${x.p.id}`)} style={{ cursor: "pointer" }}><td className="nm">{x.p.nom} <span className="mt mono">{x.p.ref}</span></td><td>{x.quoi}</td><td><span className={`tag ${x.tag.state}`}>{x.tag.label}</span></td><td><button className="btn sm">Ouvrir</button></td></tr>)}
            {!retards.length && <tr><td colSpan={4} className="mt">Aucun retard.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Agences
export function AgencesView({ projets, agences, now: depart }: { projets: Projet[]; agences: Agence[]; now: number }) {
  const now = useNow(depart);
  return (
    <div className="page">
      <div className="hdr">
        <div><div className="eyebrow">Réseau partenaire</div><h1 className="t">Agences</h1><div className="sub">Agences réceptives engagées sur 48 h. Le voyageur ne les contacte jamais directement.</div></div>
        <Link className="btn s" href="/agencies/gestion">Gérer les agences</Link>
      </div>
      <div className="grid3">
        {agences.map((a) => {
          const cs = projets.flatMap((p) => p.consultations.filter((c) => c.agence === a.id));
          const recues = cs.filter((c) => c.proposition);
          return (
            <Link key={a.id} href={`/agencies/${a.id}`} className="agc card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="row b"><span className="agc__n">{a.n}</span>{a.ville && <span className="tag">{a.ville}</span>}</div>
              <div className="row wrap">{a.zones.map((z) => <span key={z} className="tag teal">{ZONES[z]}</span>)}</div>
              <div className="mt">{[a.contact, a.tel].filter(Boolean).join(" · ") || "contact à renseigner"}</div>
              <div className="kv" style={{ marginTop: 6 }}>
                <div><div className="lbl">Briefs reçus</div><div className="v">{cs.length}</div></div>
                <div><div className="lbl">Réponse &lt; 48 h</div><div className="v">{recues.filter((c) => hrs(c.envoye, c.proposition!.recu) <= 48).length} / {recues.length}</div></div>
                <div><div className="lbl">En cours</div><div className="v">{cs.filter((c) => !c.proposition && !c.refus && hrs(c.envoye, now) >= 0).length}</div></div>
                <div><div className="lbl">Gagnés</div><div className="v">{projets.filter((p) => p.issue === "gagne" && p.consultations.some((c) => c.agence === a.id && c.retenue)).length}</div></div>
              </div>
            </Link>
          );
        })}
        {!agences.length && <Card><div className="empty"><b>Aucune agence active</b></div></Card>}
      </div>
    </div>
  );
}
