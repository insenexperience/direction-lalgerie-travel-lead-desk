"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { ZONES, type Zone } from "@/lib/bo3/geo";
import { BUDGETS_VOYAGEUR } from "@/lib/bo3/champs-voyageur";
import { GROUPES, LIEUX_TRIES, MOIS, SOUPLESSES } from "@/lib/bo3/trame";
import type { Manque } from "@/lib/bo3/types";
import styles from "./traveler.module.css";

/** Ce que la trame contient déjà : le formulaire part de là plutôt que d'une page blanche. */
export type ChampsInitiaux = {
  mois: string;
  souplesse: string;
  groupe: string;
  nombre: number | null;
  enfants: number | null;
  budget: string;
};

const TITRES: Record<Manque, { titre: string; aide: string }> = {
  dates: { titre: "Quand partir ?", aide: "Le mois suffit. Il décide des régions accessibles : le Grand Sud se visite d'octobre à avril." },
  groupe: { titre: "Avec qui ?", aide: "Le nombre de voyageurs change les véhicules, les chambres et le prix." },
  budget: { titre: "Quel budget ?", aide: "Par personne, hors vol. Une fourchette suffit à l'agence pour construire une proposition juste." },
  lieux: { titre: "Où aller ?", aide: "Choisissez les lieux qui vous attirent, dans l'ordre qui vous plaît. L'agence ajustera l'itinéraire avec vous." },
};

const GROUPE_LABEL: Record<string, string> = { solo: "Seul(e)", couple: "En couple", famille: "En famille", amis: "Entre amis" };
const ORDRE_ZONES: Zone[] = ["nord", "kabylie", "est", "ouest", "sahara"];

function Section({ n, titre, aide, children }: { n: number; titre: string; aide: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>{n}</span>
        <div>
          <div className={styles.sectionTitle}>{titre}</div>
          <p className={styles.sectionHint}>{aide}</p>
        </div>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Choix({ options, valeur, onChoix }: { options: { id: string; label: string }[]; valeur: string; onChoix: (id: string) => void }) {
  return (
    <div className={styles.cardsChoice}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={valeur === o.id} onClick={() => onChoix(o.id)} className={`${styles.choice} ${valeur === o.id ? styles.choiceActive : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChampsForm({
  token,
  champs,
  reference,
  prenom,
  dejaEnvoye,
  initiaux,
}: {
  token: string;
  champs: Manque[];
  reference: string;
  prenom: string;
  dejaEnvoye: boolean;
  initiaux: ChampsInitiaux;
}) {
  const [mois, setMois] = useState(initiaux.mois);
  const [souplesse, setSouplesse] = useState(initiaux.souplesse);
  const [groupe, setGroupe] = useState(initiaux.groupe);
  const [nombre, setNombre] = useState(initiaux.nombre ? String(initiaux.nombre) : "");
  const [enfants, setEnfants] = useState(initiaux.enfants ? String(initiaux.enfants) : "");
  const [budget, setBudget] = useState(initiaux.budget);
  const [lieux, setLieux] = useState<string[]>([]);
  const [precisions, setPrecisions] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fini, setFini] = useState(dejaEnvoye);

  const basculerLieu = (id: string) => setLieux((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  async function envoyer() {
    setErreur(null);
    if (champs.includes("dates") && !mois) return setErreur("Choisissez un mois de départ.");
    if (champs.includes("groupe") && !groupe && !nombre) return setErreur("Dites-nous avec qui vous partez.");
    if (champs.includes("groupe") && nombre && !(Number(nombre) >= 1 && Number(nombre) <= 40)) return setErreur("Indiquez un nombre de voyageurs entre 1 et 40.");
    if (champs.includes("budget") && !budget) return setErreur("Choisissez une fourchette de budget.");
    if (champs.includes("lieux") && !lieux.length) return setErreur("Choisissez au moins un lieu.");
    if (!champs.length && !precisions.trim()) return setErreur("Écrivez votre message.");

    setEnvoi(true);
    try {
      const res = await fetch(`/api/q/${token}/champs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          champs: champs.join(","),
          dates: { mois, souplesse },
          groupe: { type: groupe, nombre: nombre ? Number(nombre) : null, enfants: enfants ? Number(enfants) : null },
          budget,
          lieux,
          precisions,
        }),
      });
      // 409 = déjà envoyé : pour le voyageur, c'est le même état final.
      if (res.ok || res.status === 409) {
        setFini(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      setErreur("L'envoi a échoué. Réessayez, ou répondez simplement à notre message.");
    } finally {
      setEnvoi(false);
    }
  }

  let n = 0;
  return (
    <div className={styles.root}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.brand}>
            <Image src="/brand/direction-lalgerie-logo-white.webp" alt="Direction l'Algérie" width={165} height={75} className={styles.brandLogo} priority />
            <span className={styles.brandRule} />
          </div>
          <div className={styles.heroEyebrow}>
            <span>Votre projet de voyage</span>
            <span className={styles.heroRef}>{reference}</span>
          </div>
          {/* Plus rien ne manque (réglé entre-temps avec nous) : il reste la place d'un message. */}
          <h1 className={styles.heroTitle}>{champs.length ? `Encore ${champs.length > 1 ? "quelques précisions" : "une précision"}` : "Votre projet est complet"}</h1>
          <p className={styles.heroSub}>
            {champs.length
              ? `${prenom ? `${prenom}, votre` : "Votre"} projet est bien reçu. Il nous manque ${champs.length > 1 ? "ces informations" : "cette information"} pour le confier à l'agence partenaire la plus adaptée.`
              : `${prenom ? `Merci ${prenom}, nous` : "Nous"} avons tout ce qu'il faut pour le confier à l'agence partenaire. Vous pouvez encore nous écrire un mot pour elle.`}
          </p>
        </div>
      </header>

      <div className={styles.page}>
        {fini ? (
          <div className={styles.thanksCard}>
            <div className={styles.thanksDot}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className={styles.thanksTitle}>C&apos;est bien reçu.</div>
            <p className={styles.thanksText}>
              Merci{prenom ? `, ${prenom}` : ""}. Nous transmettons votre projet à une agence partenaire, puis revenons vers vous avec sa proposition.
            </p>
            <div className={styles.thanksSteps}>
              <div className={styles.step}>
                <span className={styles.stepDot}>●</span>
                <span><span className={styles.stepStrong}>Une question d&apos;ici là ?</span> Répondez à notre message, par e-mail ou sur WhatsApp.</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {champs.includes("dates") && (
              <Section n={++n} titre={TITRES.dates.titre} aide={TITRES.dates.aide}>
                <div>
                  <label className={styles.fieldLabel} htmlFor="mois">Mois de départ</label>
                  <select id="mois" className={styles.input} value={mois} onChange={(e) => setMois(e.target.value)}>
                    <option value="">Choisir un mois</option>
                    {MOIS.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <span className={styles.fieldLabel}>Vos dates sont…</span>
                  <Choix options={SOUPLESSES.map((s) => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} valeur={souplesse} onChoix={setSouplesse} />
                </div>
              </Section>
            )}

            {champs.includes("groupe") && (
              <Section n={++n} titre={TITRES.groupe.titre} aide={TITRES.groupe.aide}>
                <Choix options={GROUPES.map((g) => ({ id: g, label: GROUPE_LABEL[g] ?? g }))} valeur={groupe} onChoix={(g) => { setGroupe(g); if (g === "solo") setNombre("1"); if (g === "couple") setNombre("2"); }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className={styles.fieldLabel} htmlFor="nombre">Voyageurs</label>
                    <input id="nombre" className={styles.input} type="number" inputMode="numeric" min={1} max={40} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  </div>
                  <div>
                    <label className={styles.fieldLabel} htmlFor="enfants">Dont enfants</label>
                    <input id="enfants" className={styles.input} type="number" inputMode="numeric" min={0} max={20} value={enfants} onChange={(e) => setEnfants(e.target.value)} />
                  </div>
                </div>
              </Section>
            )}

            {champs.includes("budget") && (
              <Section n={++n} titre={TITRES.budget.titre} aide={TITRES.budget.aide}>
                <Choix options={BUDGETS_VOYAGEUR.map((b) => ({ id: b.valeur, label: b.label }))} valeur={budget} onChoix={setBudget} />
              </Section>
            )}

            {champs.includes("lieux") && (
              <Section n={++n} titre={TITRES.lieux.titre} aide={TITRES.lieux.aide}>
                {ORDRE_ZONES.map((z) => (
                  <div key={z}>
                    <span className={styles.fieldLabel}>{ZONES[z]}</span>
                    <div className={styles.chips}>
                      {LIEUX_TRIES.filter((l) => l.zone === z).map((l) => {
                        const rang = lieux.indexOf(l.id);
                        return (
                          <button key={l.id} type="button" aria-pressed={rang >= 0} onClick={() => basculerLieu(l.id)} className={`${styles.chip} ${rang >= 0 ? styles.chipActive : ""}`}>
                            {rang >= 0 ? `${rang + 1}. ` : ""}{l.nom}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </Section>
            )}

            <Section n={++n} titre={champs.length ? "Autre chose à nous dire ?" : "Votre message"} aide={`${champs.length ? "Facultatif. " : ""}Une envie, une contrainte, une question.`}>
              <textarea className={styles.textarea} maxLength={1000} value={precisions} onChange={(e) => setPrecisions(e.target.value)} placeholder="Tout ce qui aidera l'agence à bien faire." />
            </Section>

            <div className={styles.submitZone}>
              {erreur ? <p className={styles.error} role="alert">{erreur}</p> : null}
              <button type="button" className={styles.submit} onClick={envoyer} disabled={envoi}>
                {envoi ? "Envoi en cours…" : "Envoyer"}
              </button>
            </div>
          </>
        )}
      </div>

      <footer className={styles.foot}>
        <div className={styles.footInner}>
          <span className={styles.footBrand}>Direction l&apos;Algérie</span>
          <span className={styles.footTag}>Voyages sur mesure en Algérie</span>
          <span className={styles.footLink}>www.directionlalgerie.com</span>
        </div>
      </footer>
    </div>
  );
}
