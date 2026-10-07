"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as A from "@/app/(dashboard)/leads/projet-actions";
import { LIEUX, ZONES, type Zone } from "@/lib/bo3/geo";
import {
  agencyClock, briefToMarkdown, defaultTab, fmtD, fmtDay, fuitesBrief, hrs, nextAction, nomAgence,
  portionFor, prenom, r1, statutLabel, suggestions, travelerClock, zonesJours, type Action, H,
} from "@/lib/bo3/projet";
import { MANQUES, SOURCES, STATUT_LABEL, STATUTS, type Agence, type BriefSection, type Consultation, type Mention, type Projet, type Trame } from "@/lib/bo3/types";
import { trameVide } from "@/lib/bo3/trame";
import { TrameForm } from "./trame-form";
import { TrameMap } from "./trame-map";
import { Card, Deadline, Icon, Menu, Modal, useNow, useToast } from "./ui";
import { LeadEmailComposer } from "@/components/leads/lead-email-composer";
import type { LeadEmailMessage } from "@/app/(dashboard)/leads/email-actions";
import { LeadLogisticsEditor } from "@/components/leads/qualification/lead-logistics-editor";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { analyzeLeadQualification } from "@/lib/lead-qualification-completeness";

type Res = A.Resultat;
const QUALIF: [string, string][] = [["Ambiance & type de voyage", "envies, rythme"], ["Groupe", "taille, profil"], ["Temporalité", "mois, durée, souplesse"], ["Hébergement & transport", "type, confort"], ["Incontournables", "lieux, expériences"], ["Budget", "fourchette par personne"]];
const MOTIFS = ["Sans réponse", "Budget", "Dates", "Parti ailleurs", "Autre"];

const lienWhatsApp = (tel: string | null, texte: string) => { const d = (tel ?? "").replace(/\D/g, ""); return d.length >= 8 ? `https://wa.me/${d}?text=${encodeURIComponent(texte)}` : null; };
const lienMail = (email: string | null, sujet: string, texte: string) => (email ? `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(texte)}` : null);
const copier = async (t: string) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };

// The BO3 reset otherwise overrides Tailwind controls. Scope the bridge to these modules;
// keep the generated cockpit stylesheet and all existing screens unchanged.
const MAILING_STYLES = `
.bo3 .lead-mailing-header { position:relative; z-index:10; }
.bo3 .lead-mailing-module { color:var(--ink); min-width:0; }
.bo3 .lead-mailing-module button { font:600 12px/1.5 var(--sans); border:1px solid var(--line); border-radius:6px; padding:8px 12px; background:var(--surface); color:var(--ink); }
.bo3 .lead-mailing-module button[class*="bg-steel"] { background:var(--dark); color:var(--surface); border-color:var(--dark); }
.bo3 .lead-mailing-module input,.bo3 .lead-mailing-module textarea,.bo3 .lead-mailing-module select { font:400 13px/1.65 var(--sans); color:var(--ink); padding:9px 11px; background:var(--surface); border:1px solid var(--line); border-radius:6px; }
.bo3 .lead-mailing-module input:disabled,.bo3 .lead-mailing-module textarea:disabled { background:var(--surface-2); color:var(--muted); }
.bo3 .lead-mailing-module label { display:block; }
.bo3 .lead-mailing-module iframe { background:#f5f6f2; }
.bo3 .lead-mailing-module h3 { font-family:var(--serif); }
.bo3 .lead-mailing-dialog { animation:none; transform:none; }
.bo3 .lead-mailing-dialog .mod { max-width:1120px; }
.bo3 .lead-mailing-dialog .mod__bd { padding:16px; }
@media(max-width:760px) { .bo3 .lead-mailing-dialog .ovl { padding:8px; } .bo3 .lead-mailing-dialog .mod__bd { padding:8px; } }
`;

function FicheTab({ id, label, count, active, onSelect }: { id:string; label:string; count?:number; active:string; onSelect:(id:string) => void }) {
  return <button className={active === id ? "on" : ""} onClick={() => onSelect(id)}>{label}{count ? <b>{count}</b> : null}</button>;
}

export type FeasibilityMessageSummary = Pick<LeadEmailMessage, "id" | "agency_id" | "status" | "subject" | "created_at" | "sent_at">;
const STUDY_STATUS: Record<LeadEmailMessage["status"], string> = { draft: "Brouillon", sending: "Transmission à vérifier", sent: "Envoyé", external: "Envoi externe déclaré", failed: "Échec de transmission" };

export function FicheView({ p, lead, agences, feasibilityMessages = [], now: depart, signature }: { p: Projet; lead: SupabaseLeadRow; agences: Agence[]; feasibilityMessages?: FeasibilityMessageSummary[]; now: number; signature: string }) {
  const now = useNow(depart);
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<string | null>(null);
  const [tab, setTab] = useState(() => defaultTab(p));
  const [briefTab, setBriefTab] = useState<"edit" | "prev">("edit");
  const [briefOpen, setBriefOpen] = useState(p.statut === "brief_pret");
  const [selectedAgencyIds, setSel] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"portion" | "pilote">("portion");
  const [form, setForm] = useState<Record<string, string>>({});
  const [studyAgencyId, setStudyAgencyId] = useState(agences.length === 1 ? agences[0].id : "");
  const [studyDirty, setStudyDirty] = useState(false);
  const [sections, setSections] = useState<BriefSection[]>(p.brief?.sections ?? []);
  // Refresh the editable brief when its saved server revision changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSections(p.brief?.sections ?? []), [p.brief]);

  const information = analyzeLeadQualification(lead);
  const canGenerateBrief = information.readyForAgencyBrief;
  const missingInformation = information.checklist.filter((item) => item.requiredForBrief && item.status === "missing").map((item) => item.label);
  const na = nextAction({ ...p, consultations:p.consultations.filter((c) => c.envoye) }, agences, now);
  const sug = useMemo(() => suggestions(p, agences), [p, agences]);
  const sel = selectedAgencyIds ?? (p.statut === "brief_pret" ? sug.filter((s) => s.jours > 0).slice(0, 1).map((s) => s.a.id) : []);
  const pend = p.consultations.filter((c) => c.envoye && !c.proposition && !c.refus);
  const props = p.consultations.filter((c) => c.envoye && c.proposition);
  const tc = travelerClock(p, now);
  const canalNom = p.canal === "whatsapp" ? "WhatsApp" : "e-mail";
  const n = (id: string | null | undefined) => nomAgence(agences, id);
  const fuites = p.brief ? fuitesBrief(sections, p) : [];
  const stepIdx = STATUTS.indexOf(p.statut);

  /** Exécute une action serveur, affiche son résultat, recharge la fiche. */
  const act = useCallback((fn: () => Promise<Res>, apres?: (r: Res) => void) => {
    start(async () => {
      const r = await fn();
      toast(r.ok ? r.info ?? "Enregistré." : r.erreur);
      if (r.ok) { apres?.(r); router.refresh(); }
    });
  }, [router, toast]);

  function prepareAgencyEmail(agencyId: string) {
    start(async () => {
      const result = await A.preparerEmailAgence(p.id, agencyId);
      if (!result.ok) { toast(result.error); return; }
      setForm({ agence:agencyId, propId:result.proposalId });
      setTab("agences"); setModal("agency-email"); router.refresh();
    });
  }

  function selectStudyAgency(agencyId: string) {
    if (studyDirty && !window.confirm("Changer d’agence et abandonner les modifications non enregistrées ?")) return;
    setStudyDirty(false); setStudyAgencyId(agencyId);
  }

  function closeStudy() {
    if (studyDirty && !window.confirm("Fermer l’étude et abandonner les modifications non enregistrées ?")) return;
    setStudyDirty(false); setModal(null);
  }

  const ouvrirConversion = (c: Consultation) => {
    const pr = c.proposition!;
    const d = p.devis && p.devis.source === c.agence ? p.devis : null;
    setForm({
      propId: c.id, agence: c.agence,
      titre: d?.titre ?? `${p.trame?.titre ?? "Votre voyage"} · ${pr.duree ?? p.trame?.jours.length ?? ""} jours`,
      prix: String(d?.prix ?? pr.prix ?? ""),
      lignes: d ? d.lignes.join("\n") : [`Circuit ${pr.duree ?? ""} jours : ${pr.resume}`, p.trame?.cadre.hebergement ? `Hébergement : ${p.trame.cadre.hebergement}` : "", "Guide francophone et transport sur place", "Non inclus : vols internationaux, visa, repas hors petit-déjeuner"].filter(Boolean).join("\n"),
      validite: String(d?.validite ?? 15), mention: d?.mention ?? "discrete",
      note: d?.note ?? (pr.ecarts && pr.ecarts !== "—" ? `Ajustement par rapport à votre trame : ${pr.ecarts}.` : ""),
    });
    setModal("convert");
  };

  const run = useCallback((a: Action | "lost" | "won" | "lien", extra?: string) => {
    switch (a) {
      case "first": setModal("first"); break;
      case "ask": setModal("ask"); break;
      case "complete": setModal("complete"); break;
      case "qualif": setTab("trame"); break;
      case "brief": act(() => A.genererBrief(p.id), () => { setTab("agences"); setBriefOpen(true); }); break;
      case "scroll-brief": setTab("agences"); setBriefOpen(true); break;
      case "scroll-prop": case "scroll-devis": setTab("props"); break;
      case "remind": { const c = p.consultations.find((x) => x.agence === (extra ?? na.agence)) ?? pend[0]; if (c) act(() => A.relancerAgence(p.id, c.id)); setTab("agences"); break; }
      case "proposal": setForm({ propId: pend[0]?.id ?? "", prix: "", duree: String(p.trame?.jours.length ?? ""), resume: "", ecarts: "" }); setModal("proposal"); break;
      case "remind-traveler": act(() => A.relancerVoyageur(p.id)); break;
      case "close": setForm({ motif: "Sans réponse" }); setModal("lost"); break;
      case "lost": setForm({ motif: "Budget" }); setModal("lost"); break;
      case "won": act(() => A.marquerGagne(p.id)); break;
      case "lien": act(() => A.demanderManque(p.id, "Lien voyageur : {lien}"), (r) => { if (r.ok && r.url) copier(r.url); }); break;
      default: break;
    }
  }, [p, act, na.agence, pend]);

  // Action demandée depuis la file de travail (?action=…), une seule fois.
  const intentFaite = useRef(false);
  useEffect(() => {
    const a = params.get("action") as Action | null;
    if (a && !intentFaite.current) {
      intentFaite.current = true;
      // URL navigation is an external intent; consume it once in this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      run(a);
      router.replace(`/leads/${p.id}`, { scroll: false });
    }
  }, [params, run, router, p.id]);

  const F = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value }) });
  const echeanceAgence = fmtD(now + 48 * H);
  // Un texte par agence : son nom seul (aucune agence ne voit les autres), et sa portion en mode « un brief par agence ».
  const portionDe = (id: string) => (mode === "pilote" ? "tout" : portionFor(p, agences.find((a) => a.id === id)!) || "tout");
  const briefTexte = (id: string) => `Brief dossier ${p.ref} · ${fmtDay(now)}\nConfidentiel · réseau Direction l'Algérie · destinataire : ${n(id)}${portionDe(id) !== "tout" ? ` · votre portion : ${portionDe(id)}` : ""} · réponse attendue avant le ${echeanceAgence}\n\n${briefToMarkdown(sections)}`;

  return (
    <div className="page">
      <style>{MAILING_STYLES}</style>
      {/* En-tête */}
      <div className="hdr lead-mailing-header">
        <div>
          <div className="meta"><span className="tag">{SOURCES[p.source]}</span><span className="mono">{p.ref}</span><span>reçu {fmtD(p.recu)}</span><span>{canalNom}</span></div>
          <h1 className="t">{p.nom}</h1>
          <div className="sub">{p.trame ? `« ${p.trame.titre} » · ${p.trame.jours.length} jours${p.trame.cadre.mois ? ` · ${p.trame.cadre.mois}` : ""}${p.trame.groupe.nombre ? ` · ${p.trame.groupe.nombre} pers.` : ""}` : lead.trip_summary || "Projet à qualifier"}</div>
        </div>
        <div className="row wrap" style={{ alignItems: "flex-end" }}>
          <div style={{ minWidth: 190 }}><div className="lbl" style={{ marginBottom: 4 }}>Première réponse</div><Deadline c={tc} /></div>
          {p.statut !== "clos" && <Menu label="Modèles d’email" items={[
            { l: "Accusé de réception client", ic: "mail", f: () => setModal("first") },
            { l: "Prise de contact et qualification", ic: "users", f: () => setModal("ask") },
            { l: "Étude de faisabilité non chiffrée", ic: "building", f: () => setModal("agency-feasibility") },
            { l: "Brief agence pour chiffrage", ic: "file", f: () => { setTab("agences"); setBriefOpen(true); if (canGenerateBrief && p.brief) setModal("agency-choice"); } },
          ]} />}
          <Menu items={[
            !p.premiereReponse && p.statut !== "clos" && { l: "Écrire la première réponse", ic: "send", f: () => run("first") },
            canGenerateBrief && !p.brief && p.statut !== "clos" && { l: "Générer le brief", ic: "file", f: () => run("brief") },
            !!p.brief && p.statut !== "clos" && { l: "Confier à une agence", ic: "building", f: () => setModal("agency-choice") },
            p.statut !== "clos" && { l: `Lien voyageur${p.manque.length ? " (champs manquants)" : ""}`, ic: "link", f: () => run("lien") },
            !!lienWhatsApp(p.tel, "") && { l: "WhatsApp voyageur", ic: "wa", f: () => window.open(lienWhatsApp(p.tel, "")!, "_blank", "noopener") },
            p.statut === "proposee" && { l: "Marquer gagné", ic: "check", f: () => run("won") },
            p.statut !== "clos" && { l: "Clore · perdu (motif)", ic: "x", d: true, f: () => run("lost") },
          ]} />
        </div>
      </div>

      {/* Étapes */}
      <div className="stepper">
        <div className="stepper__bar">{STATUTS.map((s, k) => <i key={s} className={k < stepIdx ? "done" : k === stepIdx ? "cur" : ""} />)}</div>
        <div className="stepper__t"><b>Étape {stepIdx + 1} / 7 · {statutLabel(p)}</b><span>{stepIdx < 6 ? `puis : ${STATUT_LABEL[STATUTS[stepIdx + 1]]}` : ""}</span></div>
      </div>

      {/* Prochaine action */}
      {na.act ? (
        <div className="next">
          <div className="grow"><div className="lbl">Prochaine action</div><div className="next__t">{na.t}</div><div className="next__s">{na.s}</div></div>
          <button className={`btn ${na.a ? "a" : "p"}`} disabled={pending} onClick={() => run(na.act, na.agence)}>{na.t} <Icon n="arrowR" s={13} /></button>
        </div>
      ) : (
        <div className="next" style={{ borderLeftColor: p.issue === "gagne" ? "var(--green)" : "var(--muted-2)" }}>
          <div className="grow"><div className="lbl">Dossier clos</div><div className="next__t">{na.t}</div><div className="next__s">{na.s}</div></div>
        </div>
      )}

      {p.statut !== "clos" && <Copilote p={p} agences={agences} now={now} onUse={(a) => (a ? run(a) : copier(resume3(p)).then(() => toast("Résumé copié.")))} />}

      {/* Quatre faits */}
      <div className="facts">
        <div className="fact"><div className="lbl">Complétude</div><div className="v"><span className={`tag ${canGenerateBrief ? "green" : "amber"}`}>{information.completeness} %</span><div className="mt">{canGenerateBrief ? "informations pour le brief réunies" : `${missingInformation.length} précision${missingInformation.length > 1 ? "s" : ""} à recueillir`}</div></div></div>
        <div className="fact"><div className="lbl">{p.consultations.some((c) => c.envoye) ? "Agences consultées" : p.consultations.length ? "Agences en préparation" : "Agence pressentie"}</div><div className="v">{p.consultations.length ? p.consultations.map((c) => `${n(c.agence)}${c.envoye ? "" : " (brouillon)"}`).join(" · ") : p.trame && sug[0]?.jours ? `${sug[0].a.n} · ${sug[0].jours} j / ${sug[0].total}` : "à déterminer"}</div></div>
        <div className="fact"><div className="lbl">Horloge agence</div><div className="v">{pend.length ? pend.map((c) => <div key={c.id}><Deadline c={agencyClock(c, now)} small /></div>) : props.length ? <span className="tag green">{props.length} {props.length > 1 ? "propositions reçues" : "proposition reçue"}</span> : <span className="mt">démarre à l&apos;envoi du brief</span>}</div></div>
        <div className="fact"><div className="lbl">Voyageur</div><div className="v">{p.email || "pas d'e-mail"}<div className="mt">{p.tel ?? "pas de téléphone"}{p.agenceChoisie ? ` · a choisi ${n(p.agenceChoisie)}` : ""}</div></div></div>
      </div>

      {/* Onglets */}
      <div className="seg" role="tablist">
        <FicheTab id="trame" label={p.trame ? "Trame" : "Qualification"} active={tab} onSelect={setTab} />
        <FicheTab id="agences" label="Brief & agences" count={p.consultations.length} active={tab} onSelect={setTab} />
        <FicheTab id="props" label="Propositions & devis" count={props.length} active={tab} onSelect={setTab} />
        <FicheTab id="voyageur" label="Voyageur & messages" count={p.messages.length} active={tab} onSelect={setTab} />
      </div>

      {tab === "trame" && p.statut !== "clos" && (
        <div className="stack lead-mailing-module" style={{ marginBottom:16 }}>
          <LeadLogisticsEditor key={lead.updated_at} lead={lead} />
          <LeadEmailComposer lead={lead} kind="qualification" />
        </div>
      )}

      {tab === "trame" && (p.trame ? (
        <>
          <Card t="La trame, telle que le voyageur l'a composée" right={<div className="row">{p.trame.circuit && <span className="tag">socle : {p.trame.circuit}</span>}{p.statut !== "clos" && <button className="btn s xs" onClick={() => setModal("qualif")}><Icon n="pencil" s={11} /> Modifier</button>}</div>}>
            <div className="grid2" style={{ gridTemplateColumns: "minmax(0,1fr) 260px" }}>
              <TrameMap trame={p.trame} />
              <div className="stack">
                <div className="kv">
                  <div><div className="lbl">Durée</div><div className="v">{p.trame.cadre.duree || `${p.trame.jours.length} jours`}</div></div>
                  <div><div className="lbl">Mois</div><div className="v">{p.trame.cadre.mois ? [p.trame.cadre.mois, p.trame.cadre.souplesse].filter(Boolean).join(" · ") : <span className="miss">manquant</span>}</div></div>
                  <div><div className="lbl">Rythme</div><div className="v">{p.trame.cadre.rythme || "—"}</div></div>
                  <div><div className="lbl">Hébergement</div><div className="v">{p.trame.cadre.hebergement || "—"}</div></div>
                  <div><div className="lbl">Groupe</div><div className="v">{p.trame.groupe.type || p.trame.groupe.nombre ? <>{[p.trame.groupe.type, p.trame.groupe.nombre ? `${p.trame.groupe.nombre} pers.` : ""].filter(Boolean).join(" · ")}{p.trame.groupe.enfants ? ` · ${p.trame.groupe.enfants} enfants` : ""}</> : <span className="miss">manquant</span>}</div></div>
                  <div><div className="lbl">Budget / pers. hors vol</div><div className="v">{p.trame.budget || <span className="miss">manquant</span>}</div></div>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {p.trame.envies.grandes.map((e) => <span key={e} className="envie g">{e}</span>)}
                  {[...p.trame.envies.experiences, ...p.trame.envies.activites, ...p.trame.envies.pepites].map((e) => <span key={e} className="envie">{e}</span>)}
                </div>
              </div>
            </div>
            <div className="lbl" style={{ margin: "18px 0 8px" }}>Jour par jour</div>
            <div className="jours">
              {p.trame.jours.map((j) => (
                <div key={j.n} className="day"><div className="day__n">J{j.n}</div><div><div className="day__t">{j.lieux.map((id) => LIEUX[id]?.nom ?? id).join(" · ")}<span className="day__z">{ZONES[LIEUX[j.lieux[0]]?.zone as Zone] ?? ""}</span></div>{j.e && <div className="day__e">{j.e}</div>}</div></div>
              ))}
              {!p.trame.jours.length && <span className="miss">aucun lieu</span>}
            </div>
            <div className="grid2" style={{ marginTop: 16 }}>
              <div><div className="lbl" style={{ marginBottom: 6 }}>Points à ajuster</div><div className="card dash" style={{ padding: "10px 12px" }}>{p.trame.ajuster.map((a, i) => <div key={i}>• {a}</div>)}{!p.trame.ajuster.length && <span className="mt">aucun</span>}</div></div>
              <div><div className="lbl" style={{ marginBottom: 6 }}>Précisions du voyageur</div><div className="card soft" style={{ padding: "10px 12px", fontStyle: "italic" }}>{p.trame.precisions ? `« ${p.trame.precisions} »` : <span className="mt">aucune</span>}</div></div>
            </div>
          </Card>
          <Card t="Complétude">
            <div className="row wrap" style={{ justifyContent: "space-between" }}>
              <div className="row wrap" style={{ gap: 6 }}>{MANQUES.map((k) => p.manque.includes(k) ? <span key={k} className="miss"><Icon n="alert" s={11} /> {k}</span> : <span key={k} className="ok"><Icon n="check" s={11} /> {k}</span>)}</div>
              <div className="row">
                {p.manque.length > 0 && p.statut !== "clos" && (!p.premiereReponse ? <button className="btn a sm" onClick={() => run("ask")}><Icon n="link" s={12} /> Demander ce qui manque</button> : <button className="btn p sm" onClick={() => run("complete")}>Saisir les réponses</button>)}
                {canGenerateBrief && !p.brief && p.statut !== "clos" && <button className="btn p sm" disabled={pending} onClick={() => run("brief")}>Générer le brief depuis le dossier</button>}
                {p.brief && <button className="btn s sm" onClick={() => { setTab("agences"); setBriefOpen(true); }}>Voir le brief</button>}
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card t={`Qualification guidée · ${p.source === "whatsapp" ? "lead WhatsApp" : "sans trame"}`} right={<span className="tag amber">{p.qualification.length} / 6</span>}>
          <div className="warn" style={{ marginBottom: 10 }}>Pas de trame : le voyageur n&apos;est pas passé par le Composer. Qualifiez par la conversation, puis construisez la trame. Rien ne part sans vous.</div>
          {p.texte && <details className="card soft" style={{ padding: "10px 12px", marginBottom: 10 }}><summary style={{ cursor:"pointer" }}>Lire les précisions du voyageur</summary><div style={{ whiteSpace:"pre-wrap", lineHeight:1.8, marginTop:8 }}>{p.texte}</div></details>}
          <div className="stack" style={{ gap: 6 }}>
            {QUALIF.map(([b, aide], i) => { const fait = p.qualification.includes(i); return (
              <div key={b} className={`qb ${fait ? "done" : ""}`}>
                <div><div className="nm">{b}</div><div className="mt">{aide}</div></div>
                {fait ? <span className="ok"><Icon n="check" s={11} /> validé</span> : <button className="btn sm" disabled={pending} onClick={() => act(() => A.validerBlocQualification(p.id, i))}>Valider</button>}
              </div>
            ); })}
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className={`btn ${p.qualification.length === 6 ? "a" : "p"}`} onClick={() => setModal("qualif")}>Construire la trame</button>
            <button className="btn s sm" onClick={() => run("ask")}><Icon n="send" s={11} /> Préparer le mail de qualification</button>
            {canGenerateBrief && !p.brief && p.statut !== "clos" && <button className="btn p sm" disabled={pending} onClick={() => run("brief")}>Générer le brief depuis le dossier</button>}
          </div>
        </Card>
      ))}

      {tab === "agences" && (
        <>
          <Card t="Première étude de faisabilité" right={<span className="tag teal">Non chiffrée</span>}>
            <p className="mt" style={{ lineHeight:1.8 }}>Demandez à l’agence un avis terrain, un premier parcours et les contraintes à anticiper. Cette étape peut commencer pendant la qualification, avant le brief pour chiffrage.</p>
            {p.statut !== "clos" && <div className="row wrap" style={{ marginTop:12 }}>
              <label className="grow">Agence destinataire<select className="inp" value={studyAgencyId} onChange={(e) => selectStudyAgency(e.target.value)}><option value="">Choisir une agence</option>{agences.map((a) => <option key={a.id} value={a.id}>{a.n}</option>)}</select></label>
              <button className="btn p" disabled={!studyAgencyId} onClick={() => setModal("agency-feasibility")}><Icon n="pencil" s={13} /> Préparer l’étude non chiffrée</button>
            </div>}
            {!agences.length && <p className="mt">Aucune agence active disponible.</p>}
            {feasibilityMessages.length > 0 && <div className="stack" style={{ marginTop:14, gap:8 }}>{feasibilityMessages.map((m) => <div key={m.id} className="row wrap" style={{ justifyContent:"space-between", borderTop:"1px solid var(--line-2)", paddingTop:8 }}>
              <div><b>{m.agency_id ? n(m.agency_id) : "Agence supprimée"}</b><div className="mt">{STUDY_STATUS[m.status]} · {fmtD(new Date(m.sent_at || m.created_at).getTime())}</div><div className="mt">{m.subject}</div></div>
              {p.statut !== "clos" && m.agency_id && agences.some((a) => a.id === m.agency_id) && <button className="btn s xs" onClick={() => { setStudyAgencyId(m.agency_id!); setModal("agency-feasibility"); }}>Ouvrir les emails</button>}
            </div>)}</div>}
          </Card>
          <Card t="Brief agence pour chiffrage" right={p.brief ? <div className="row"><span className="mt">relu {p.brief.editedAt ? fmtD(p.brief.editedAt) : "—"}</span><button className="btn s xs" onClick={() => setBriefOpen(!briefOpen)}>{briefOpen ? "Replier" : "Ouvrir"}</button></div> : null}>
            {!p.brief && (
              <div className="row wrap" style={{ justifyContent: "space-between" }}>
                <span className="mt">{canGenerateBrief ? "Le dossier contient les informations nécessaires. Le brief se prépare puis se relit avant envoi." : `Le brief attend ces précisions : ${missingInformation.join(", ")}.`}</span>
                {canGenerateBrief && p.statut !== "clos" && <button className="btn p sm" disabled={pending} onClick={() => run("brief")}>Générer le brief</button>}
              </div>
            )}
            {p.brief && briefOpen && (
              <>
                <div className="row wrap" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                  <div className="seg" style={{ borderBottom: 0 }}>
                    <button className={briefTab === "edit" ? "on" : ""} onClick={() => setBriefTab("edit")}>Éditeur</button>
                    <button className={briefTab === "prev" ? "on" : ""} onClick={() => setBriefTab("prev")}>Ce que l&apos;agence reçoit</button>
                  </div>
                  {p.trame && p.statut !== "clos" && <button className="btn s xs" disabled={pending} onClick={() => act(() => A.genererBrief(p.id))}><Icon n="refresh" s={12} /> Régénérer</button>}
                </div>
                <div className="excl" style={{ marginBottom: 10 }}>Non transmis : nom, e-mail, téléphone, page d&apos;origine, notes internes, autres agences, préférence d&apos;agence.</div>
                {fuites.length > 0 && <div className="warn" style={{ marginBottom: 10 }}><b>Le brief contient {fuites.join(", ")}.</b> Corrigez avant l&apos;envoi : le serveur bloquera sinon.</div>}
                {briefTab === "edit" ? sections.map((s, i) => (
                  <div key={s.id + i} className="bsec">
                    <div className="bsec__h"><span>{i + 1} · {s.title}</span>{s.id === "attendu" && <span className="tag">fixe</span>}</div>
                    <textarea value={s.text} readOnly={s.id === "attendu" || p.statut === "clos"} rows={Math.max(1, s.text.split("\n").length)}
                      onChange={(e) => setSections(sections.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                      onBlur={() => { if (sections[i].text !== p.brief?.sections[i]?.text) act(() => A.modifierBrief(p.id, sections)); }} />
                  </div>
                )) : (
                  <div className="brief">
                    <div className="row b"><b>Brief dossier {p.ref}</b><span className="mt">{fmtDay(now)}</span></div>
                    <div className="mt">Confidentiel · réseau Direction l&apos;Algérie · destinataire : {(sel ?? []).length === 1 ? n(sel![0]) : (sel ?? []).length > 1 ? `${sel!.length} agences (un brief chacune)` : p.consultations.map((c) => n(c.agence)).join(", ") || "—"} · réponse attendue avant le <b>{echeanceAgence}</b></div>
                    {sections.map((s) => <div key={s.id}><h3>{s.title}</h3>{s.text.split("\n").map((l, i) => <p key={i}>{l}</p>)}</div>)}
                  </div>
                )}
              </>
            )}
          </Card>

          {p.brief && p.statut !== "clos" && !p.devis?.envoye && (
            <Card t="Routage · à qui envoyer" right={<div className="row"><button className={`chip ${mode === "portion" ? "on" : ""}`} onClick={() => setMode("portion")}>Un brief par agence</button><button className={`chip ${mode === "pilote" ? "on" : ""}`} onClick={() => setMode("pilote")}>Une agence pilote</button></div>}>
              {p.trame && <div className="bars" style={{ marginBottom: 12 }}>
                {Object.entries(zonesJours(p.trame)).sort((a, b) => b[1] - a[1]).map(([z, nb]) => <div key={z} className="b"><span>{ZONES[z as Zone]}</span><i style={{ width: `${(nb / p.trame!.jours.length) * 100}%` }} /><span className="n">{nb} j</span></div>)}
              </div>}
              <div className="stack" style={{ gap: 8 }}>
                {sug.map(({ a, jours, total }, i) => {
                  const on = (sel ?? []).includes(a.id);
                  const choisie = p.agenceChoisie === a.id;
                  const por = portionFor(p, a);
                  return (
                    <label key={a.id} className="agcard" style={{ cursor: "pointer", borderColor: on ? "var(--dark)" : undefined }}>
                      <div>
                        <div className="row wrap"><span className="agc__n">{a.n}</span>{i === 0 && jours ? <span className="tag dark">Suggérée</span> : null}{choisie && <span className="tag teal">Choisie par le voyageur</span>}{choisie && !jours && <span className="tag amber">hors de sa zone</span>}</div>
                        <div className="mt">{a.ville} · {a.zones.map((z) => ZONES[z]).join(", ")}</div>
                      </div>
                      <div>{p.trame ? <><b>{jours} jour{jours > 1 ? "s" : ""} sur {total}</b> dans sa zone{por && por !== "tout" ? <div className="mt">{mode === "portion" ? `sa portion : ${por}` : "trame complète"}</div> : null}</> : <span className="mt">Dossier qualifié par l’opérateur</span>}</div>
                      <div className="row"><input type="checkbox" checked={on} onChange={() => setSel(on ? (sel ?? []).filter((x) => x !== a.id) : [...(sel ?? []), a.id])} /><span className="mt">sélectionner</span></div>
                    </label>
                  );
                })}
              </div>
              <div className="row wrap" style={{ marginTop: 14, justifyContent: "flex-end" }}>
                {/* Le texte copié est celui qui part vraiment : mêmes garde-fous que l'envoi (pas d'identité du voyageur). */}
                {(sel ?? []).map((id) => (
                  <button key={id} className="btn s" disabled={fuites.length > 0} title={fuites.length ? "Corrigez le brief d'abord" : undefined} onClick={() => copier(briefTexte(id)).then((ok) => toast(ok ? `Brief pour ${n(id)} copié. Collez-le dans votre e-mail ou WhatsApp.` : "Copie impossible : sélectionnez le texte dans l'aperçu."))}><Icon n="copy" s={12} /> Copier pour {n(id)}</button>
                ))}
                {(sel ?? []).map((id) => <button key={`email:${id}`} className="btn a" disabled={fuites.length > 0 || pending} onClick={() => prepareAgencyEmail(id)}><Icon n="pencil" s={12} /> Préparer l’email pour {n(id)}</button>)}
                <button className="btn s" disabled={pending || fuites.length > 0} onClick={() => setModal("agency-choice")}><Icon n="building" s={12} /> Confier à une agence</button>
              </div>
            </Card>
          )}

          {p.consultations.length > 0 && (
            <Card t="Suivi des agences" right={p.statut !== "clos" && !p.devis?.envoye ? <div className="row wrap">{agences.filter((a) => !p.consultations.some((c) => c.agence === a.id)).map((a) => <button key={a.id} className="btn s xs" disabled={pending} onClick={() => prepareAgencyEmail(a.id)}><Icon n="plus" s={11} /> {a.n}</button>)}</div> : null}>
              <div className="stack" style={{ gap: 8 }}>
                {p.consultations.map((c) => (
                  <div key={c.id} className="agcard">
                    <div>
                      <div className="row wrap"><span className="agc__n">{n(c.agence)}</span><span className="tag">{c.portion === "tout" ? "trame complète" : c.portion}</span>{c.retenue && <span className="tag green">retenue</span>}{c.refus && <span className="tag red">refus</span>}</div>
                      <div className="mt">{c.envoye ? <>envoyé {fmtD(c.envoye)} · {c.accuse ? `accusé ${fmtD(c.accuse)}` : c.proposition || c.refus ? "" : <span style={{ color: hrs(c.envoye, now) > 24 ? "var(--amber-deep)" : undefined }}>sans accusé depuis {r1(hrs(c.envoye, now))} h</span>}</> : "Brouillon à préparer"}{c.relances.length ? ` · relancé ${c.relances.map(fmtD).join(", ")}` : ""}</div>
                      {c.proposition && <div className="mt">proposition reçue {fmtD(c.proposition.recu)}{c.proposition.prix ? ` · ${c.proposition.prix.toLocaleString("fr-FR")} € / pers.` : ""}</div>}
                      {p.statut !== "clos" && <button className="btn s xs" style={{ marginTop:8 }} onClick={() => { setForm({ agence:c.agence, propId:c.id }); setModal("agency-email"); }}><Icon n="pencil" s={11} /> Éditer l’email de brief</button>}
                    </div>
                    {c.envoye && <Deadline c={agencyClock(c, now)} />}
                    {c.envoye && !c.proposition && !c.refus && p.statut !== "clos" ? (
                      <div className="row wrap" style={{ justifyContent: "flex-end" }}>
                        {!c.accuse && <button className="btn s xs" disabled={pending} onClick={() => act(() => A.accuseAgence(p.id, c.id))}>Accusé reçu</button>}
                        <button className="btn s xs" onClick={() => { setForm({ propId: c.id, prix: "", duree: String(p.trame?.jours.length ?? ""), resume: "", ecarts: "" }); setModal("proposal"); }}>Saisir la proposition</button>
                        <button className="btn p xs" disabled={pending} onClick={() => act(() => A.relancerAgence(p.id, c.id))}>Relancer</button>
                        <button className="btn d xs" disabled={pending} onClick={() => act(() => A.refusAgence(p.id, c.id))}>Refus</button>
                      </div>
                    ) : c.proposition ? <button className="btn s xs" onClick={() => setTab("props")}>Voir</button> : null}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "props" && (
        <>
          {!props.length && <Card><div className="empty"><b>Aucune proposition pour l&apos;instant</b>{pend.length ? `Réponse attendue de ${pend.map((c) => n(c.agence)).join(" et ")}.` : "Envoyez d'abord le brief à une agence."}</div></Card>}
          {props.map((c) => {
            const pr = c.proposition!;
            const max = Number(((p.trame?.budget ?? "").match(/(\d[\d\s]*)\s*€(?![^€]*\d[\d\s]*\s*€)/) ?? [])[1]?.replace(/\s/g, "") ?? 0);
            const joursTrame = p.trame?.jours.length ?? 0;
            return (
              <div key={c.id} className={`propcard ${c.retenue ? "ret" : ""}`}>
                <div className="row wrap" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                  <div className="row wrap"><span className="agc__n">{n(c.agence)}</span><span className="mt">reçue {fmtD(pr.recu)} · à {r1(hrs(c.envoye, pr.recu))} h</span>{c.retenue && <span className="tag green">retenue</span>}</div>
                  {["envoye", "proposition"].includes(p.statut) && !p.devis?.envoye && (
                    <div className="row wrap">
                      {!c.retenue && <button className="btn s sm" disabled={pending} onClick={() => act(() => A.retenirProposition(p.id, c.id))}><Icon n="check" s={12} /> Retenir</button>}
                      <button className={`btn ${p.devis ? "s" : "a"} sm`} onClick={() => ouvrirConversion(c)}><Icon n="sparkles" s={12} /> {p.devis && p.devis.source === c.agence ? "Modifier la proposition DA" : p.devis ? "Convertir celle-ci à la place" : "Convertir en proposition DA"}</button>
                      {!c.retenue && <button className="btn s sm" disabled={pending} onClick={() => act(() => A.refusAgence(p.id, c.id))}>Décliner</button>}
                    </div>
                  )}
                </div>
                <div className="kv">
                  <div><div className="lbl">Prix / pers.</div><div className="v">{pr.prix ? `${pr.prix.toLocaleString("fr-FR")} €` : "—"} {max && pr.prix ? (pr.prix > max ? <span className="tag amber">au-dessus</span> : <span className="tag green">dans la fourchette</span>) : null}</div></div>
                  <div><div className="lbl">Durée</div><div className="v">{pr.duree ? `${pr.duree} jours` : "—"} {pr.duree && joursTrame ? (pr.duree === joursTrame ? <span className="tag green">= trame</span> : <span className="tag">{pr.duree > joursTrame ? "+" : ""}{pr.duree - joursTrame} j</span>) : null}</div></div>
                  <div><div className="lbl">Itinéraire</div><div className="v">{pr.resume || "—"}</div></div>
                  <div><div className="lbl">Écarts vs trame</div><div className="v">{pr.ecarts || "—"}</div></div>
                </div>
              </div>
            );
          })}
          {p.devis && <DevisCard p={p} agences={agences} pending={pending}
            onModifier={() => { const c = p.consultations.find((x) => x.agence === p.devis!.source && x.proposition); if (c) ouvrirConversion(c); }}
            onEnvoyer={() => { const texte = `Bonjour ${prenom(p)},\n\nVoici votre proposition « ${p.devis!.titre} ». Le document est joint.\n\n${signature} — Direction l'Algérie`; const l = p.canal === "whatsapp" ? lienWhatsApp(p.tel, texte) : lienMail(p.email, p.devis!.titre, texte); if (l) window.open(l, "_blank", "noopener"); act(() => A.envoyerProposition(p.id, canalNom)); }}
            onRelancer={() => run("remind-traveler")} onGagne={() => run("won")} />}
        </>
      )}

      {tab === "voyageur" && <OngletVoyageur p={p} lead={lead} canalNom={canalNom} onPremiere={() => run("first")} pending={pending} onNote={(t) => act(() => A.noteInterne(p.id, t))} />}

      {/* Fenêtres */}
      {modal === "agency-choice" && <Modal title="Confier à une agence" onClose={() => setModal(null)}>
        <div className="mt">Choisissez l’agence pour préparer son email. Le brief reste en brouillon jusqu’à l’envoi depuis l’éditeur ou la déclaration d’un envoi externe.</div>
        {!canGenerateBrief && <div className="warn">À compléter avant envoi : {missingInformation.join(", ")}.</div>}
        <div className="stack" style={{ gap:8 }}>{agences.map((a) => <div className="agcard" key={a.id}>
          <div><div className="agc__n">{a.n}</div><div className="mt">{a.ville} · {a.zones.map((z) => ZONES[z]).join(", ")}</div></div>
          <button className="btn a sm" disabled={pending || !canGenerateBrief || !p.brief || fuites.length > 0} onClick={() => prepareAgencyEmail(a.id)}><Icon n="pencil" s={12} /> Préparer l’email</button>
        </div>)}</div>
        {!agences.length && <div className="empty">Aucune agence active disponible.</div>}
      </Modal>}
      {(modal === "first" || modal === "ask" || modal === "agency-email") && (
        <div className="lead-mailing-dialog">
          <Modal title={modal === "first" ? "Accusé de réception client" : modal === "ask" ? "Prise de contact et qualification" : `Email de brief · ${n(form.agence)}`} onClose={() => setModal(null)}>
            <div className="lead-mailing-module"><LeadEmailComposer key={`${modal}:${form.propId ?? "client"}`} lead={lead} kind={modal === "first" ? "welcome" : modal === "ask" ? "qualification" : "agency_brief"} agencyId={modal === "agency-email" ? form.agence : undefined} proposalId={modal === "agency-email" ? form.propId : undefined} /></div>
          </Modal>
        </div>
      )}
      {modal === "agency-feasibility" && <div className="lead-mailing-dialog">
          <Modal title="Première étude de faisabilité non chiffrée" onClose={closeStudy}>
          <label className="lbl" style={{ display:"block", marginBottom:14 }}>Agence destinataire<select className="inp" value={studyAgencyId} onChange={(e) => selectStudyAgency(e.target.value)}><option value="">Choisir une agence</option>{agences.map((a) => <option key={a.id} value={a.id}>{a.n}</option>)}</select></label>
          {studyAgencyId ? <div className="lead-mailing-module"><LeadEmailComposer key={`agency-feasibility:${studyAgencyId}`} lead={lead} kind="agency_feasibility" agencyId={studyAgencyId} onDirtyChange={setStudyDirty} /></div> : <div className="empty">Choisissez l’agence à qui demander le premier parcours.</div>}
        </Modal>
      </div>}
      {(modal === "complete" || modal === "qualif") && (
        <TrameForm
          initiale={p.trame ?? trameVide(p.texte ? p.texte.slice(0, 60) : undefined)}
          champs={modal === "complete" ? p.manque : "tout"}
          titre={modal === "complete" ? "Réponses du voyageur" : p.trame ? "Modifier la trame" : "Construire la trame"}
          pending={pending}
          onClose={() => setModal(null)}
          onSave={(t: Trame) => act(() => A.enregistrerTrame(p.id, { ...t, ajuster: t.ajuster.map((x) => x.trim()).filter(Boolean) }, modal === "complete" ? "reponses" : "qualification"), () => setModal(null))}
        />
      )}
      {modal === "proposal" && (
        <Modal title="Saisir la proposition de l'agence" onClose={() => setModal(null)} foot={<>
          <button className="btn s" onClick={() => setModal(null)}>Annuler</button>
          <button className="btn p" disabled={!form.prix || !form.propId || pending} onClick={() => act(() => A.saisirProposition(p.id, form.propId, { prix: Number(form.prix), duree: Number(form.duree) || 0, resume: form.resume ?? "", ecarts: form.ecarts ?? "" }), () => { setModal(null); setTab("props"); })}>Enregistrer</button>
        </>}>
          <div className="field"><span className="lbl">Agence</span><select className="inp" {...F("propId")}>{pend.map((c) => <option key={c.id} value={c.id}>{n(c.agence)}</option>)}</select></div>
          <div className="fgrid">
            <div className="field"><span className="lbl">Prix indicatif / pers. (€)</span><input className="inp" type="number" placeholder="ex. 1 380" {...F("prix")} /></div>
            <div className="field"><span className="lbl">Durée (jours)</span><input className="inp" type="number" {...F("duree")} /></div>
          </div>
          <div className="field"><span className="lbl">Itinéraire proposé</span><textarea className="inp" placeholder="Djanet · Sefar · Tadrart · …" {...F("resume")} /></div>
          <div className="field"><span className="lbl">Écarts par rapport à la trame</span><input className="inp" placeholder="ex. Tadrart 2 nuits au lieu de 1" {...F("ecarts")} /></div>
        </Modal>
      )}
      {modal === "convert" && (
        <Modal title="Convertir en proposition Direction l'Algérie" onClose={() => setModal(null)} foot={<>
          <button className="btn s" onClick={() => setModal(null)}>Annuler</button>
          <button className="btn a" disabled={!form.prix || !form.titre || pending} onClick={() => act(() => A.convertirProposition(p.id, form.propId, { titre: form.titre, prix: Number(form.prix), lignes: (form.lignes ?? "").split("\n"), validite: Number(form.validite) || 15, note: form.note ?? "", mention: (form.mention as Mention) || "discrete" }), () => setModal(null))}><Icon n="sparkles" s={12} /> Convertir</button>
        </>}>
          <div className="warn">Le devis de <b>{n(form.agence)}</b> devient un document Direction l&apos;Algérie. Le voyageur ne reçoit jamais le devis brut de l&apos;agence.</div>
          <div className="fgrid">
            <div className="field" style={{ gridColumn: "1 / -1" }}><span className="lbl">Titre</span><input className="inp" {...F("titre")} /></div>
            <div className="field"><span className="lbl">Prix / pers. (€)</span><input className="inp" type="number" {...F("prix")} /></div>
            <div className="field"><span className="lbl">Validité (jours)</span><input className="inp" type="number" {...F("validite")} /></div>
          </div>
          <div className="field"><span className="lbl">Lignes · une par ligne</span><textarea className="inp" style={{ minHeight: 110 }} {...F("lignes")} /></div>
          <div className="field"><span className="lbl">Note au voyageur (facultatif)</span><input className="inp" placeholder="ex. ajustement par rapport à votre trame" {...F("note")} /></div>
          <div className="field">
            <span className="lbl">Mention du partenariat sur le document</span>
            <div className="stack" style={{ gap: 6 }}>
              {([["visible", "Visible", `« Réalisé en partenariat avec ${n(form.agence)} » : nom de l'agence en pied de page.`], ["discrete", "Discrète", `Une ligne en pied de page : « construite avec ${n(form.agence)}, agence réceptive partenaire ».`], ["aucune", "Aucune", "Document 100 % Direction l'Algérie. L'agence reste interne au dossier."]] as const).map(([v, l, s]) => (
                <label key={v} className="qb" style={{ cursor: "pointer", borderColor: form.mention === v ? "var(--amber)" : undefined }}>
                  <div><div className="nm">{l}</div><div className="mt">{s}</div></div>
                  <input type="radio" name="mention" checked={form.mention === v} onChange={() => setForm({ ...form, mention: v })} />
                </label>
              ))}
            </div>
          </div>
          <div className="mt">Dans tous les cas : coordonnées du voyageur jamais transmises, paiement hors plateforme, Direction l&apos;Algérie seul interlocuteur.</div>
        </Modal>
      )}
      {modal === "lost" && (
        <Modal title="Clore le dossier · perdu" onClose={() => setModal(null)} foot={<>
          <button className="btn s" onClick={() => setModal(null)}>Annuler</button>
          <button className="btn d" disabled={pending} onClick={() => act(() => A.marquerPerdu(p.id, form.motif ?? ""), () => setModal(null))}>Clore</button>
        </>}>
          <div className="field"><span className="lbl">Motif (obligatoire)</span><select className="inp" {...F("motif")}>{MOTIFS.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div className="mt">Le motif alimente le pilotage. Aucune relance ne part après la clôture.</div>
        </Modal>
      )}
    </div>
  );
}

const resume3 = (p: Projet) => {
  const t = p.trame;
  if (!t) return p.texte;
  return `${[t.groupe.type, t.groupe.nombre ? `${t.groupe.nombre} pers.` : ""].filter(Boolean).join(", ")}, ${t.jours.length} j${t.cadre.mois ? ` en ${t.cadre.mois}` : ""}${t.cadre.rythme ? `, rythme ${t.cadre.rythme}` : ""}${t.cadre.hebergement ? `, ${t.cadre.hebergement}` : ""}. ${t.envies.grandes.join(" · ")}. ${t.budget ? `Budget ${t.budget}.` : "Budget non précisé."}`;
};

/** Suggestions de règles, pas d'IA générative : le copilote propose, l'opérateur décide. */
function Copilote({ p, agences, now, onUse }: { p: Projet; agences: Agence[]; now: number; onUse: (a: Action | null) => void }) {
  const sug = suggestions(p, agences)[0];
  const items: { t: string; b: string; a: string | null; act: Action | null }[] = [];
  if (p.trame) items.push({ t: "Résumé en 3 lignes", b: resume3(p), a: "Copier", act: null });
  if (p.manque.length && p.trame) items.push({ t: "Ce qui manque", b: `${p.manque.join(", ")} : le lien voyageur peut être raccourci à ces champs.`, a: "Préparer la demande", act: "ask" });
  if (!p.premiereReponse) items.push({ t: "Brouillon de première réponse", b: `Bonjour ${prenom(p)}, votre projet est bien arrivé…${sug && sug.jours ? ` Il part chez ${sug.a.n}.` : ""}`, a: "Ouvrir le brouillon", act: "first" });
  if (p.trame && sug && sug.jours) items.push({ t: "Agence suggérée", b: `${sug.a.n} : ${sug.jours} jour${sug.jours > 1 ? "s" : ""} sur ${sug.total} dans sa zone${p.agenceChoisie && p.agenceChoisie !== sug.a.id ? ` · le voyageur a choisi ${nomAgence(agences, p.agenceChoisie)}` : ""}.`, a: "Voir le routage", act: "scroll-brief" });
  if (p.trame && p.trame.ajuster.length) items.push({ t: "Points de vigilance", b: p.trame.ajuster.join(" · "), a: null, act: null });
  const pend = p.consultations.filter((c) => c.envoye && !c.proposition && !c.refus && !c.accuse && hrs(c.envoye, now) > 24);
  if (pend.length) items.push({ t: "Relance agence", b: `${nomAgence(agences, pend[0].agence)} n'a pas accusé réception depuis ${r1(hrs(pend[0].envoye, now))} h.`, a: "Relancer", act: "remind" });
  if (!items.length) return null;
  return (
    <div className="cop">
      <div className="cop__ic"><Icon n="sparkles" s={16} /></div>
      <div className="grow">
        <div className="cop__t">Copilote <span className="tag amber">propose · vous décidez</span><span className="mt" style={{ fontWeight: 500 }}>Rien n&apos;est envoyé sans votre clic.</span></div>
        <div className="cop__items">{items.slice(0, 4).map((it, k) => <div key={k} className="cop__it"><b>{it.t}</b><span className="mt">{it.b}</span>{it.a && <div className="row"><button className="btn s xs" onClick={() => onUse(it.act)}>{it.a}</button></div>}</div>)}</div>
      </div>
    </div>
  );
}

function DevisCard({ p, agences, pending, onModifier, onEnvoyer, onRelancer, onGagne }: { p: Projet; agences: Agence[]; pending: boolean; onModifier: () => void; onEnvoyer: () => void; onRelancer: () => void; onGagne: () => void }) {
  const d = p.devis!;
  const ag = agences.find((a) => a.id === d.source);
  const canalNom = p.canal === "whatsapp" ? "WhatsApp" : "e-mail";
  return (
    <Card t="Proposition Direction l'Algérie" right={<div className="row wrap">{ag && <span className="tag teal">avec {ag.n}</span>}{d.envoye ? <span className="tag green">envoyée {fmtD(d.envoye)} · {d.canal || canalNom}</span> : <span className="tag amber">brouillon · convertie {fmtD(d.converti)}</span>}</div>}>
      <div className="propda">
        <div className="propda__hd">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bo3/logo.png" alt="Direction l'Algérie" />
          <div><div className="propda__t">{d.titre}</div><div className="mt">Proposition n° {p.ref} · pour {p.nom}{p.trame?.groupe.nombre ? ` · ${p.trame.groupe.nombre} pers.` : ""}{p.trame?.cadre.mois ? ` · ${p.trame.cadre.mois}` : ""}</div></div>
        </div>
        <div className="stack" style={{ gap: 4 }}>{d.lignes.map((l, i) => <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--line-2)" }}>{l}</div>)}</div>
        {d.note && <div className="mt" style={{ marginTop: 8, fontStyle: "italic" }}>{d.note}</div>}
        <div className="row wrap" style={{ justifyContent: "space-between", marginTop: 10 }}><b>Prix par personne : {d.prix ? `${d.prix.toLocaleString("fr-FR")} €` : "—"}</b><span className="mt">valable {d.validite} jours · paiement hors plateforme</span></div>
        <div className="propda__ft">
          {d.mention === "aucune" || !ag ? <span className="mt">Partenariat non mentionné sur le document voyageur.</span> : <><Icon n="building" s={13} /><span>{d.mention === "visible" ? <><b>Réalisé en partenariat avec {ag.n}</b>, agence réceptive à {ag.ville}. Direction l&apos;Algérie reste votre interlocuteur unique.</> : <>Proposition Direction l&apos;Algérie, construite avec {ag.n}{ag.ville ? ` (${ag.ville})` : ""}, agence réceptive partenaire. Votre interlocuteur reste Direction l&apos;Algérie.</>}</span></>}
        </div>
      </div>
      <div className="row wrap" style={{ marginTop: 10, justifyContent: "flex-end" }}>
        {!d.envoye ? (
          <>
            <a className="btn s" href={`/api/leads/${p.id}/quotes/${d.id}/pdf`} target="_blank" rel="noopener">Générer le PDF</a>
            <button className="btn s" onClick={onModifier}><Icon n="pencil" s={12} /> Modifier</button>
            <button className="btn a" disabled={pending} onClick={onEnvoyer}><Icon n="send" s={12} /> Envoyer par {canalNom}</button>
          </>
        ) : (
          <>
            <a className="btn s sm" href={`/api/leads/${p.id}/quotes/${d.id}/pdf`} target="_blank" rel="noopener">PDF</a>
            <span className="mt">{p.relancesVoyageur.length ? `Relances : ${p.relancesVoyageur.map(fmtD).join(", ")}` : "Pas encore relancé"}</span>
            {p.statut === "proposee" && <>
              <button className="btn p sm" disabled={pending || p.relancesVoyageur.length >= 2} onClick={onRelancer}>Relancer ({Math.min(2, p.relancesVoyageur.length + 1)}/2)</button>
              <button className="btn sm" style={{ borderColor: "var(--green)", color: "var(--green)" }} disabled={pending} onClick={onGagne}><Icon n="check" s={12} /> Marquer gagné</button>
            </>}
          </>
        )}
      </div>
    </Card>
  );
}

function OngletVoyageur({ p, lead, canalNom, onPremiere, pending, onNote }: { p: Projet; lead: SupabaseLeadRow; canalNom: string; onPremiere: () => void; pending: boolean; onNote: (t: string) => void }) {
  const [note, setNote] = useState(p.notesInternes);
  const ini = p.nom.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const intake = lead.intake_payload ?? {};
  const travelNotes = lead.project_description || (typeof intake.notes_longues === "string" ? intake.notes_longues : "");
  const sourceMessage = typeof intake.source_message === "string" ? intake.source_message : "";
  return (
    <div className="grid2">
      <div className="stack">
        <Card t="Contact">
          <div className="row"><span className="av">{ini}</span><div><div className="nm">{p.nom}</div><div className="mt">{p.email || "pas d'e-mail"} · {p.tel || "pas de téléphone"}</div></div></div>
          <div className="row wrap" style={{ marginTop: 10 }}><span className={`tag ${p.canal === "whatsapp" ? "dark" : ""}`}>WhatsApp</span><span className={`tag ${p.canal === "email" ? "dark" : ""}`}>e-mail</span><span className="mt">canal préféré : {canalNom}</span></div>
        </Card>
        {(travelNotes || sourceMessage) && <Card t="Notes supplémentaires du voyage">
          {travelNotes && <div style={{ whiteSpace:"pre-wrap", lineHeight:1.8 }}>{travelNotes}</div>}
          {sourceMessage && <details style={{ marginTop:12 }}><summary style={{ cursor:"pointer", fontWeight:600 }}>Lire le message original conservé</summary><div className="card soft" style={{ whiteSpace:"pre-wrap", lineHeight:1.8, marginTop:10, padding:12 }}>{sourceMessage}</div></details>}
        </Card>}
        <Card t="Notes internes" right={note !== p.notesInternes ? <button className="btn p xs" disabled={pending} onClick={() => onNote(note)}>Enregistrer</button> : null}>
          <textarea className="inp" placeholder="Jamais transmises aux agences ni au voyageur." style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} />
        </Card>
        <Card t="Historique">
          <div className="stack" style={{ gap: 4, fontSize: 12 }}>
            <div><span className="mono mt">{fmtD(p.recu)}</span> reçu · {SOURCES[p.source]}</div>
            {p.premiereReponse && <div><span className="mono mt">{fmtD(p.premiereReponse)}</span> première réponse</div>}
            {p.brief?.editedAt && <div><span className="mono mt">{fmtD(p.brief.editedAt)}</span> brief relu</div>}
            {p.consultations.map((c) => <div key={c.id}>{c.envoye ? <><span className="mono mt">{fmtD(c.envoye)}</span> brief envoyé</> : "Brouillon agence à préparer"} · {c.portion === "tout" ? "dossier complet" : c.portion}</div>)}
            {p.devis?.envoye && <div><span className="mono mt">{fmtD(p.devis.envoye)}</span> proposition envoyée</div>}
            {p.closedAt && <div><span className="mono mt">{fmtD(p.closedAt)}</span> {p.issue === "gagne" ? "gagné" : `perdu${p.motif ? ` · ${p.motif}` : ""}`}</div>}
          </div>
        </Card>
      </div>
      <Card t="Messages">
        <div className="stack" style={{ gap: 6 }}>
          {p.messages.map((m, i) => <div key={i} className={`msg ${m.k}`}><div className="msg__h"><span>{m.s}</span><span>{fmtD(m.t)}</span></div><div style={{ whiteSpace: "pre-wrap" }}>{m.b}</div></div>)}
          {!p.premiereReponse && p.statut !== "clos" && <button className="btn a sm" style={{ alignSelf: "flex-start" }} onClick={onPremiere}>Écrire la première réponse</button>}
        </div>
      </Card>
    </div>
  );
}
