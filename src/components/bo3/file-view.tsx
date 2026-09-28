"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { agencyClock, FILTERS, fmtD, hrs, nextAction, nomAgence, statutLabel, travelerClock, urgency } from "@/lib/bo3/projet";
import { SOURCES, type Agence, type Projet } from "@/lib/bo3/types";
import { AgencePressentie, Completude, Deadline, Icon, Ring, useNow } from "./ui";

/** File de travail : triée par urgence réelle. Chaque file est une URL (?file=…). */
export function FileView({ projets, agences, now: depart }: { projets: Projet[]; agences: Agence[]; now: number }) {
  const now = useNow(depart);
  const router = useRouter();
  const params = useSearchParams();
  const f = FILTERS.some((x) => x.id === params.get("file")) ? params.get("file")! : "tous";
  const vue = params.get("vue") === "chrono" ? "chrono" : "liste";
  const set = (k: string, v: string) => { const sp = new URLSearchParams(params.toString()); sp.set(k, v); router.replace(`/inbox?${sp.toString()}`, { scroll: false }); };
  const filtre = FILTERS.find((x) => x.id === f)!;
  const rows = projets.filter((p) => filtre.f(p, now)).sort((a, b) => urgency(a, now) - urgency(b, now));
  const counts = Object.fromEntries(FILTERS.map((x) => [x.id, projets.filter((p) => x.f(p, now)).length]));
  const go = (id: string, act?: string) => router.push(`/leads/${id}${act ? `?action=${act}` : ""}`);

  return (
    <div className="page">
      <div className="hdr">
        <div>
          <div className="eyebrow">Travail du jour · {fmtD(now)}</div>
          <h1 className="t">File de travail</h1>
          <div className="sub">{counts.tous} projet{counts.tous > 1 ? "s" : ""} ouvert{counts.tous > 1 ? "s" : ""} · {counts.today} échéance{counts.today > 1 ? "s" : ""} aujourd&apos;hui · {counts.agences} agence{counts.agences > 1 ? "s" : ""} en retard</div>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6, justifyContent: "space-between" }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {FILTERS.map((x) => <button key={x.id} className={`chip ${f === x.id ? "on" : ""}`} onClick={() => set("file", x.id)}>{x.l}<b>{counts[x.id]}</b></button>)}
        </div>
        <div className="segctl">
          <button className={vue === "liste" ? "on" : ""} onClick={() => set("vue", "liste")}><Icon n="list" s={13} /> Liste</button>
          <button className={vue === "chrono" ? "on" : ""} onClick={() => set("vue", "chrono")}><Icon n="timeline" s={13} /> Chronologie 48 h</button>
        </div>
      </div>
      {vue === "chrono" ? <Timeline48 projets={rows} agences={agences} now={now} go={go} /> : (
        <div className="card">
          {rows.map((p) => {
            const na = nextAction(p, agences, now);
            const tc = travelerClock(p, now);
            const ag = p.consultations.filter((c) => !c.proposition && !c.refus);
            return (
              <div key={p.id} className="prow" onClick={() => go(p.id)} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && go(p.id)}>
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <Ring c={tc} />
                  <div className="grow">
                    <Deadline c={tc} />
                    {ag.map((c) => { const ac = agencyClock(c, now); return <div key={c.id} className="mt" style={{ marginTop: 6, color: ac.state === "amber" || ac.state === "red" ? "var(--amber-deep)" : undefined }}>{nomAgence(agences, c.agence)} · {ac.label.toLowerCase()}{!c.accuse ? " · sans accusé" : ""}</div>; })}
                  </div>
                </div>
                <div>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="nm" style={{ fontSize: 14 }}>{p.nom}</span><span className="mono mt">{p.ref}</span>
                    <span className="tag">{SOURCES[p.source]}</span><span className={`tag ${p.statut === "a_completer" ? "amber" : ""}`}>{statutLabel(p)}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>{p.trame ? <>« {p.trame.titre} » · {p.trame.jours.length} j{p.trame.cadre.mois ? ` · ${p.trame.cadre.mois}` : ""}{p.trame.groupe.nombre ? ` · ${p.trame.groupe.nombre} pers.` : ""}</> : <span className="mt" style={{ fontStyle: "italic" }}>{p.texte || "Pas de trame"}</span>}</div>
                  <div className="mt" style={{ marginTop: 4 }}><Completude p={p} /> · Agence : <AgencePressentie p={p} agences={agences} />{p.relancesVoyageur.length ? ` · relancé ×${p.relancesVoyageur.length}` : ""}</div>
                </div>
                <div className="prow__act">
                  {na.act ? <button className={`btn sm ${na.a ? "p" : "s"}`} onClick={(e) => { e.stopPropagation(); go(p.id, na.act ?? undefined); }}>{na.t}</button> : <span className="mt">—</span>}
                </div>
              </div>
            );
          })}
          {!rows.length && <div className="empty"><b>Rien dans cette file</b>Tout est traité.</div>}
        </div>
      )}
    </div>
  );
}

/** Chaque projet ouvert sur un axe −48 h → +48 h autour de maintenant ; la ligne rouge est l'échéance. */
function Timeline48({ projets, agences, now, go }: { projets: Projet[]; agences: Agence[]; now: number; go: (id: string) => void }) {
  const x = (h: number) => `${((h + 48) / 96) * 100}%`;
  const rows = projets.filter((p) => p.statut !== "clos");
  return (
    <div className="card tl">
      <div className="tl__grid">
        <div className="tl__hd">Projet</div>
        <div className="tl__axis">{[-48, -24, 0, 24, 48].map((h) => <span key={h} style={{ left: x(h) }}>{h === 0 ? "maintenant" : (h > 0 ? "+" : "") + h + " h"}</span>)}</div>
        {rows.map((p) => {
          const start = -hrs(p.recu, now);
          const tc = travelerClock(p, now);
          const end = p.premiereReponse ? -hrs(p.premiereReponse, now) : 0;
          const dl = start + 48;
          const cons = p.consultations.filter((c) => !c.refus);
          return (
            <div key={p.id} className="tl__row" onClick={() => go(p.id)}>
              <div><div className="nm">{p.nom}</div><div className="mt">{statutLabel(p)}</div></div>
              <div className="tl__lane" style={{ ["--n" as string]: cons.length }}>
                <div className="tl__now" style={{ left: x(0) }} />
                {dl > -48 && dl < 48 && <div className="tl__48" style={{ left: x(dl) }} title="échéance 48 h" />}
                <div className={`tl__bar ${tc.state === "green" ? "done" : tc.state}`} style={{ left: x(Math.max(-48, start)), width: `calc(${x(Math.min(48, end))} - ${x(Math.max(-48, start))})` }}>{tc.label}</div>
                {cons.map((c, k) => {
                  const s = -hrs(c.envoye, now);
                  const e = c.proposition ? -hrs(c.proposition.recu, now) : 0;
                  return <div key={c.id} className="tl__bar ag" style={{ left: x(Math.max(-48, s)), width: `calc(${x(Math.min(48, e))} - ${x(Math.max(-48, s))})`, top: 36 + k * 16 }}>{nomAgence(agences, c.agence)}{c.proposition ? " ✓" : ""}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!rows.length && <div className="empty"><b>Aucun projet ouvert</b></div>}
    </div>
  );
}
