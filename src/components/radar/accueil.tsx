"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { modifierFiche } from "@/app/(dashboard)/radar/actions";
import { Card, Icon, useToast } from "@/components/bo3/ui";
import { BASES, COULEUR_REGION, lienNotion, NOTION_RADAR_PAGE, ORDRE, REGIONS, type BaseKey } from "@/lib/radar/bases";
import { actives, dateDe, dateFr, joursAvant, ligneMeta, pluriel, texteBrut } from "@/lib/radar/format";
import type { Fiche } from "@/lib/radar/types";
import { Note, TagEcheance, TagStatut, useRadar } from "./contexte";
import { EnteteRadar, NavRadar } from "./nav";

type Tache = { f: Fiche; date: string; quoi: string };

const parDate = (x: { date: string }, y: { date: string }) => (x.date || "9999").localeCompare(y.date || "9999");
const dans = (iso: string, min: number, max: number) => { const d = joursAvant(iso); return d != null && d >= min && d <= max; };

export function AccueilRadar() {
  const { bases, donnees, ouvrir, noter, setVue, recharger } = useRadar();
  const toast = useToast();
  const [enCours, demarrer] = useTransition();
  const [patience, setPatience] = useState<string | null>(null);

  useEffect(() => { setVue("Vue d'ensemble du radar (accueil)"); }, [setVue]);

  const { signaux, acteurs, rdv, partenariats, idees } = bases;
  const charge = donnees.ok ? new Date(donnees.charge) : null;

  const taches = useMemo<Tache[]>(() => {
    const t: Tache[] = [];
    signaux.filter((r) => r.statut === "Actionnable").forEach((f) => t.push({ f, date: dateDe(f, "Fenêtre de tir"), quoi: "Signal actionnable" }));
    actives(BASES.acteurs, acteurs).filter((r) => r.statut === "Prioritaire" || dans(dateDe(r, "Fenêtre de tir"), -30, 21)).forEach((f) => t.push({ f, date: dateDe(f, "Fenêtre de tir"), quoi: `Acteur ${f.statut.toLowerCase()}` }));
    actives(BASES.rdv, rdv).filter((r) => dans(dateDe(r, "Échéance d'inscription"), -3, 30)).forEach((f) => t.push({ f, date: dateDe(f, "Échéance d'inscription"), quoi: "Inscription à boucler" }));
    partenariats.filter((r) => BASES.partenariats.enCours!.includes(r.statut) || dans(dateDe(r, "Échéance"), -60, 21)).filter((r) => !BASES.partenariats.masques.includes(r.statut)).forEach((f) => t.push({ f, date: dateDe(f, "Échéance"), quoi: `Partenariat · ${f.statut.toLowerCase()}` }));
    idees.filter((r) => r.statut === "Retenue" && dans(dateDe(r, "Publier avant"), -30, 21)).forEach((f) => t.push({ f, date: dateDe(f, "Publier avant"), quoi: "Idée à publier" }));
    return t.sort(parDate).slice(0, 10);
  }, [signaux, acteurs, rdv, partenariats, idees]);

  const aTrier = useMemo(() => signaux.filter((r) => r.statut === "À trier").sort((x, y) => dateDe(y, "Détecté le").localeCompare(dateDe(x, "Détecté le")) || (Number(y.props["Note DA /10"]) || 0) - (Number(x.props["Note DA /10"]) || 0)), [signaux]);
  const agenda = useMemo(() => actives(BASES.rdv, rdv).filter((r) => { const fin = dateDe(r, "Date fin") || dateDe(r, "Date début"); return fin && (joursAvant(fin) ?? -1) >= 0; }).sort((x, y) => dateDe(x, "Date début").localeCompare(dateDe(y, "Date début"))), [rdv]);
  const sansDate = actives(BASES.rdv, rdv).filter((r) => !dateDe(r, "Date début")).length;
  const proposees = useMemo(() => idees.filter((r) => r.statut === "Proposée").sort((x, y) => (Number(y.props["Note /10"]) || 0) - (Number(x.props["Note /10"]) || 0)), [idees]);
  const enCoursP = partenariats.filter((r) => BASES.partenariats.enCours!.includes(r.statut));
  const actifs = actives(BASES.acteurs, acteurs);
  const parRegion = REGIONS.map((reg) => ({ reg, a: actifs.filter((r) => r.props["Région"] === reg).length, s: actives(BASES.signaux, signaux).filter((r) => r.props["Région"] === reg).length })).filter((x) => x.a || x.s);
  const rmax = Math.max(1, ...parRegion.map((x) => x.a));
  const prioritaires = actifs.filter((r) => r.statut === "Prioritaire" || r.statut === "Partenaire").sort((x, y) => (Number(y.props["Note DA /10"]) || 0) - (Number(x.props["Note DA /10"]) || 0)).slice(0, 6);

  const changer = (f: Fiche, statut: string) => {
    setPatience(f.id);
    demarrer(async () => {
      const r = await modifierFiche(f.base, f.id, { [BASES[f.base].statut]: statut });
      setPatience(null);
      if (!r.ok) { toast(r.erreur); return; }
      noter({ ...f, statut, props: { ...f.props, [BASES[f.base].statut]: statut }, modifie: new Date().toISOString() });
      toast(`« ${f.titre.slice(0, 40)} » → ${statut}`);
    });
  };

  const semaine = signaux.filter((r) => dans(dateDe(r, "Détecté le"), -7, 0)).length;
  const actionnables = signaux.filter((r) => r.statut === "Actionnable");
  const prochaine = actionnables.map((r) => dateDe(r, "Fenêtre de tir")).filter((d) => d && (joursAvant(d) ?? -1) >= 0).sort()[0];
  const rdv60 = actives(BASES.rdv, rdv).filter((r) => dans(dateDe(r, "Date début"), 0, 60)).length;
  const inscriptions = actives(BASES.rdv, rdv).filter((r) => dans(dateDe(r, "Échéance d'inscription"), 0, 30)).length;
  const plafond = BASES.partenariats.plafond ?? 8;

  return (
    <div className="page">
      <EnteteRadar
        eyebrow="Veille et réseau"
        titre="Radar"
        sub={<>Signaux, acteurs, rendez-vous, partenariats et idées de Direction l&apos;Algérie, lus et écrits dans Notion.{charge && <> Lu à {charge.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.</>}</>}
        notion={lienNotion(NOTION_RADAR_PAGE)}
        extra={<button className="btn s" onClick={recharger} title="Relire Notion"><Icon n="refresh" s={12} /> Actualiser</button>}
      />
      <NavRadar actif="accueil" />

      <div className="rd-kpis">
        <Kpi l="Signaux à trier" v={aTrier.length} d={`${pluriel(semaine, "détecté", "détectés")} en 7 jours`} href="/radar/signaux?statut=%C3%80%20trier" ton={aTrier.length > 12 ? "amber" : ""} />
        <Kpi l="Actionnables" v={actionnables.length} d={prochaine ? `prochaine fenêtre ${dateFr(prochaine, true)}` : "aucune fenêtre datée"} href="/radar/signaux?statut=Actionnable" />
        <Kpi l="Rendez-vous à 60 jours" v={rdv60} d={inscriptions ? `${pluriel(inscriptions, "inscription", "inscriptions")} à boucler sous 30 j` : "aucune inscription urgente"} href="/radar/rdv" />
        <Kpi l="Partenariats en cours" v={`${enCoursP.length} / ${plafond}`} d={BASES.partenariats.enCours!.map((s) => ({ s, n: partenariats.filter((r) => r.statut === s).length })).filter((x) => x.n).map((x) => `${x.n} ${x.s.toLowerCase()}`).join(" · ") || "aucun dossier ouvert"} href="/radar/partenariats" ton={enCoursP.length > plafond ? "red" : ""} />
        <Kpi l="Idées à arbitrer" v={proposees.length} d={`${proposees.filter((r) => r.props.Site === "Média").length} média · ${proposees.filter((r) => r.props.Site === "Plateforme").length} plateforme`} href="/radar/idees?statut=Propos%C3%A9e" />
      </div>

      <div className="grid2 rd-g">
        <Card t="À faire maintenant" right={<span className="mt">trié par échéance</span>}>
          <div className="rd-items">
            {taches.map(({ f, date, quoi }) => (
              <button key={`${f.base}-${f.id}`} type="button" className="rd-item" onClick={() => ouvrir(f.id)}>
                <span className="rd-item__main">
                  <span className="rd-item__k">{quoi}</span>
                  <span className="nm">{f.titre}</span>
                  {texteBrut(f.props[BASES[f.base].suite]) && <span className="rd-ligne__suite">{texteBrut(f.props[BASES[f.base].suite])}</span>}
                </span>
                {date ? <TagEcheance iso={date} /> : <span className="tag">sans date</span>}
              </button>
            ))}
            {!taches.length && <div className="empty"><b>Rien d&apos;urgent</b>Aucun signal actionnable ni échéance dans les trois semaines.</div>}
          </div>
        </Card>

        <Card t={`À trier · ${aTrier.length}`} right={<Link className="btn s xs" href="/radar/signaux?statut=%C3%80%20trier">Tout voir <Icon n="arrowR" s={11} /></Link>}>
          <div className="rd-items">
            {aTrier.slice(0, 7).map((f) => (
              <div key={f.id} className="rd-item rd-tri">
                <button type="button" className="rd-item__main" onClick={() => ouvrir(f.id)}>
                  <span className="nm">{f.titre}</span>
                  <span className="mt">{[ligneMeta(BASES.signaux, f), dateFr(dateDe(f, "Détecté le"), true)].filter(Boolean).join(" · ")}</span>
                </button>
                <Note v={f.props["Note DA /10"]} />
                <span className="rd-tri__b" aria-busy={patience === f.id}>
                  <button className="btn xs" disabled={enCours} onClick={() => changer(f, "Actionnable")} title="Interlocuteur, échéance et prochaine action connus">Actionnable</button>
                  <button className="btn xs" disabled={enCours} onClick={() => changer(f, "Suivi")}>Suivi</button>
                  <button className="btn s xs" disabled={enCours} onClick={() => changer(f, "Archivé")} aria-label={`Archiver ${f.titre}`} title="Archiver"><Icon n="x" s={11} /></button>
                </span>
              </div>
            ))}
            {!aTrier.length && <div className="empty"><b>Tout est trié</b>La prochaine passe arrive demain à 07h24.</div>}
          </div>
        </Card>
      </div>

      <div className="grid3 rd-g">
        <Card t="Agenda" right={sansDate ? <Link className="mt" href="/radar/rdv?statut=Dates%20%C3%A0%20confirmer">{pluriel(sansDate, "sans date", "sans date")}</Link> : null}>
          <div className="rd-items">
            {agenda.slice(0, 7).map((f) => {
              const d = new Date(dateDe(f, "Date début") + "T12:00:00");
              return (
                <button key={f.id} type="button" className="rd-item" onClick={() => ouvrir(f.id)}>
                  <span className="rd-cal"><b>{d.getDate()}</b>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span>
                  <span className="rd-item__main"><span className="nm">{f.titre}</span><span className="mt">{[f.props["Ville & lieu"], f.props.Type].filter(Boolean).map(String).join(" · ")}</span></span>
                  <TagStatut f={f} />
                </button>
              );
            })}
            {!agenda.length && <div className="empty"><b>Agenda vide</b>Aucun rendez-vous daté à venir.</div>}
          </div>
        </Card>

        <Card t={`Idées à arbitrer · ${proposees.length}`} right={<Link className="btn s xs" href="/radar/idees?statut=Propos%C3%A9e">Tout voir <Icon n="arrowR" s={11} /></Link>}>
          <div className="rd-items">
            {proposees.slice(0, 6).map((f) => (
              <div key={f.id} className="rd-item rd-tri">
                <button type="button" className="rd-item__main" onClick={() => ouvrir(f.id)}>
                  <span className="nm">{f.titre}</span>
                  <span className="mt">{ligneMeta(BASES.idees, f)}</span>
                </button>
                <Note v={f.props["Note /10"]} />
                <span className="rd-tri__b">
                  <button className="btn xs" disabled={enCours} onClick={() => changer(f, "Retenue")}>Retenir</button>
                  <button className="btn s xs" disabled={enCours} onClick={() => changer(f, "Écartée")} aria-label={`Écarter ${f.titre}`} title="Écarter"><Icon n="x" s={11} /></button>
                </span>
              </div>
            ))}
            {!proposees.length && <div className="empty"><b>Rien à arbitrer</b>Nouvelles idées lundi à 07h38.</div>}
          </div>
        </Card>

        <Card t="Réseau par région" right={<Link className="btn s xs" href="/radar/acteurs">Acteurs <Icon n="arrowR" s={11} /></Link>}>
          <div className="bars rd-bars">
            {parRegion.map((x) => (
              <div key={x.reg} className="b"><span>{x.reg}</span><i style={{ width: `${(x.a / rmax) * 100}%`, background: COULEUR_REGION[x.reg] }} /><span className="n" title={`${x.a} acteurs, ${x.s} signaux`}>{x.a} · {x.s}</span></div>
            ))}
          </div>
          <div className="mt">acteurs actifs · signaux en cours</div>
          {prioritaires.length > 0 && (
            <div className="rd-items" style={{ marginTop: 10 }}>
              {prioritaires.map((f) => (
                <button key={f.id} type="button" className="rd-item" onClick={() => ouvrir(f.id)}>
                  <span className="rd-item__main"><span className="nm">{f.titre}</span><span className="mt">{ligneMeta(BASES.acteurs, f)}</span></span>
                  <Note v={f.props["Note DA /10"]} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card t="Routines" right={<span className="mt">exécutées par Claude, heure d&apos;Alger</span>}>
        <div className="rd-routines">
          <Routine t="Passe quotidienne" q="Tous les jours · 07h24" d={derniere(signaux, "Détecté le")} />
          <Routine t="Idées de contenu" q="Lundi · 07h38" d={derniere(idees, "Proposée le")} />
          <Routine t="Cartographie" q="Mercredi · 09h35" d={derniere(acteurs, "Créé le")} />
          <Routine t="Bilan du mois" q="Le 1er · 09h40" d="" />
        </div>
        <div className="mt" style={{ marginTop: 8 }}>{ORDRE.map((k: BaseKey) => `${BASES[k].label} ${bases[k].length}`).join(" · ")} fiches au total.</div>
      </Card>
    </div>
  );
}

function Kpi({ l, v, d, href, ton }: { l: string; v: string | number; d: string; href: string; ton?: string }) {
  return <Link href={href} className={`kpi rd-kpi ${ton ?? ""}`}><div className="lbl">{l}</div><div className="kpi__v">{v}</div><div className="kpi__d">{d}</div></Link>;
}

function derniere(rows: Fiche[], k: string): string {
  const d = rows.map((r) => dateDe(r, k).slice(0, 10)).filter(Boolean).sort().pop();
  return d ? `dernière trace le ${dateFr(d, true)}` : "";
}

function Routine({ t, q, d }: { t: string; q: string; d: string }) {
  return <div className="rd-routine"><div className="nm">{t}</div><div className="mt">{q}</div>{d && <div className="mt">{d}</div>}</div>;
}
