"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import type { TravelerSummary } from "@/lib/traveler-requalification";
import styles from "./traveler.module.css";

type Opt = { id: string; label: string; hint?: string };

const MUST_SEE: Opt[] = [
  { id: "casbah", label: "Casbah d'Alger" },
  { id: "tipaza", label: "Tipaza" },
  { id: "constantine", label: "Constantine" },
  { id: "kabylie", label: "Kabylie" },
  { id: "bejaia", label: "Béjaïa & la côte" },
  { id: "ghardaia", label: "Ghardaïa", hint: "chaud en août" },
  { id: "sahara", label: "Sahara", hint: "oct–avril" },
  { id: "hoggar", label: "Hoggar", hint: "oct–avril" },
  { id: "tassili", label: "Tassili", hint: "oct–avril" },
];

const DIET: Opt[] = [
  { id: "halal", label: "Halal strict" },
  { id: "vegetarian", label: "Végétarien" },
  { id: "allergies", label: "Allergies" },
  { id: "no_alcohol", label: "Sans alcool" },
  { id: "mobility", label: "Mobilité réduite" },
  { id: "child_friendly", label: "Jeunes enfants" },
];

const ROOMS: Opt[] = [
  { id: "two_rooms", label: "Deux chambres" },
  { id: "triple", label: "Une chambre triple" },
  { id: "suite", label: "Suite familiale" },
  { id: "advise", label: "Conseillez-nous" },
];

const PASSPORTS: Opt[] = [
  { id: "algerian", label: "Algérien" },
  { id: "french", label: "Français" },
  { id: "both", label: "Les deux" },
  { id: "other", label: "Autre" },
];

const FLIGHTS: Opt[] = [
  { id: "include", label: "À intégrer au dossier" },
  { id: "already_booked", label: "Déjà réservés" },
  { id: "self_managed", label: "Je m'en occupe" },
];

const RHYTHM: Opt[] = [
  { id: "intense", label: "On bouge beaucoup" },
  { id: "balanced", label: "Équilibré" },
  { id: "slow", label: "Tranquille, on savoure" },
];

const STRUCTURE: Opt[] = [
  { id: "fixed", label: "Précis, réglé d'avance" },
  { id: "flexible", label: "Une trame souple" },
  { id: "full_trust", label: "On vous fait confiance" },
];

const BUSINESS: Opt[] = [
  { id: "curiosity", label: "Simple curiosité, au fil du voyage" },
  { id: "meetings", label: "Organiser des rencontres pro" },
  { id: "none", label: "Pas un sujet" },
];

const ACCOMPANIMENT: Opt[] = [
  { id: "full_guide", label: "Chauffeur-guide tout le séjour" },
  { id: "partial", label: "Ponctuel, selon les étapes" },
  { id: "advise", label: "Conseillez-nous" },
];

const BOARD: Opt[] = [
  { id: "breakfast", label: "Petits-déjeuners" },
  { id: "half_board", label: "Demi-pension" },
  { id: "mixed", label: "Mixte selon les étapes" },
  { id: "advise", label: "Conseillez-nous" },
];

type FormState = {
  travelers: { age: string }[];
  rooms: string | null;
  passports: (string | null)[];
  flights: { mode: string | null; departure_city: string };
  wishes: {
    must_see: string[];
    rhythm: string | null;
    structure: string | null;
    family_days: string;
    notes: string;
  };
  business: { mode: string | null; details: string };
  constraints: {
    diet: string[];
    accompaniment: string | null;
    board: string | null;
    notes: string;
  };
};

function initialState(existing: Record<string, unknown> | null): FormState {
  const e = existing as
    | {
        travelers?: { age?: number }[];
        rooms?: string;
        passports?: string[];
        flights?: { mode?: string; departure_city?: string };
        wishes?: {
          must_see?: string[];
          rhythm?: string;
          structure?: string;
          family_days?: string;
          notes?: string;
        };
        business?: { mode?: string; details?: string };
        constraints?: {
          diet?: string[];
          accompaniment?: string;
          board?: string;
          notes?: string;
        };
      }
    | null;

  if (e && Array.isArray(e.travelers) && e.travelers.length) {
    return {
      travelers: e.travelers.map((t) => ({
        age: t.age != null ? String(t.age) : "",
      })),
      rooms: e.rooms ?? null,
      passports: Array.isArray(e.passports)
        ? e.passports.map((p) => p ?? null)
        : e.travelers.map(() => null),
      flights: {
        mode: e.flights?.mode ?? null,
        departure_city: e.flights?.departure_city ?? "",
      },
      wishes: {
        must_see: e.wishes?.must_see ?? [],
        rhythm: e.wishes?.rhythm ?? null,
        structure: e.wishes?.structure ?? null,
        family_days: e.wishes?.family_days ?? "",
        notes: e.wishes?.notes ?? "",
      },
      business: {
        mode: e.business?.mode ?? null,
        details: e.business?.details ?? "",
      },
      constraints: {
        diet: e.constraints?.diet ?? [],
        accompaniment: e.constraints?.accompaniment ?? null,
        board: e.constraints?.board ?? null,
        notes: e.constraints?.notes ?? "",
      },
    };
  }

  return {
    travelers: [{ age: "" }, { age: "" }],
    rooms: null,
    passports: [null, null],
    flights: { mode: null, departure_city: "" },
    wishes: {
      must_see: [],
      rhythm: null,
      structure: null,
      family_days: "",
      notes: "",
    },
    business: { mode: null, details: "" },
    constraints: { diet: [], accompaniment: null, board: null, notes: "" },
  };
}

function ChipsMulti({
  options,
  value,
  onToggle,
}: {
  options: Opt[];
  value: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className={styles.chips}>
      {options.map((o) => {
        const active = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.id)}
            className={`${styles.chip} ${active ? styles.chipActive : ""}`}
          >
            {o.label}
            {o.hint ? <span className={styles.chipHint}>({o.hint})</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function RadioCards({
  options,
  value,
  onPick,
}: {
  options: Opt[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className={styles.cardsChoice}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
          className={`${styles.choice} ${value === o.id ? styles.choiceActive : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>{n}</span>
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          <p className={styles.sectionHint}>{hint}</p>
        </div>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function TravelerForm({
  token,
  summary,
  alreadySubmitted,
  existingResponses,
}: {
  token: string;
  summary: TravelerSummary;
  alreadySubmitted: boolean;
  existingResponses: Record<string, unknown> | null;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(existingResponses),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadySubmitted);

  const progress = useMemo(() => {
    let n = 0;
    if (form.travelers.every((t) => t.age.trim() !== "") && form.rooms) n++;
    if (
      form.passports.length === form.travelers.length &&
      form.passports.every(Boolean)
    )
      n++;
    if (form.flights.mode) n++;
    if (form.wishes.rhythm && form.wishes.structure) n++;
    if (form.business.mode) n++;
    if (form.constraints.accompaniment && form.constraints.board) n++;
    return n;
  }, [form]);

  function setTravelerAge(i: number, age: string) {
    setForm((f) => {
      const travelers = f.travelers.slice();
      travelers[i] = { age };
      return { ...f, travelers };
    });
  }

  function addTraveler() {
    setForm((f) =>
      f.travelers.length >= 8
        ? f
        : {
            ...f,
            travelers: [...f.travelers, { age: "" }],
            passports: [...f.passports, null],
          },
    );
  }

  function removeTraveler(i: number) {
    setForm((f) => ({
      ...f,
      travelers: f.travelers.filter((_, idx) => idx !== i),
      passports: f.passports.filter((_, idx) => idx !== i),
    }));
  }

  function setPassport(i: number, id: string) {
    setForm((f) => {
      const passports = f.passports.slice();
      passports[i] = id;
      return { ...f, passports };
    });
  }

  function toggleMustSee(id: string) {
    setForm((f) => ({
      ...f,
      wishes: {
        ...f.wishes,
        must_see: f.wishes.must_see.includes(id)
          ? f.wishes.must_see.filter((x) => x !== id)
          : [...f.wishes.must_see, id],
      },
    }));
  }

  function toggleDiet(id: string) {
    setForm((f) => ({
      ...f,
      constraints: {
        ...f.constraints,
        diet: f.constraints.diet.includes(id)
          ? f.constraints.diet.filter((x) => x !== id)
          : [...f.constraints.diet, id],
      },
    }));
  }

  async function submit() {
    setError(null);

    for (const t of form.travelers) {
      const n = Number(t.age);
      if (
        t.age.trim() === "" ||
        !Number.isInteger(n) ||
        n < 0 ||
        n > 110
      ) {
        setError("Indiquez un âge valide pour chaque voyageur.");
        return;
      }
    }
    if (!form.rooms) return setError("Choisissez une configuration de chambres.");
    if (!form.passports.every(Boolean))
      return setError("Indiquez le passeport de chaque voyageur.");
    if (!form.flights.mode) return setError("Précisez la situation des vols.");
    if (!form.wishes.rhythm || !form.wishes.structure)
      return setError("Choisissez un rythme et une structure d'itinéraire.");
    if (!form.business.mode)
      return setError("Répondez à la question sur l'Algérie business.");
    if (!form.constraints.accompaniment || !form.constraints.board)
      return setError("Choisissez l'accompagnement et la formule de repas.");

    const payload = {
      version: 1,
      travelers: form.travelers.map((t) => ({ age: Number(t.age) })),
      rooms: form.rooms,
      passports: form.passports,
      flights: form.flights,
      wishes: form.wishes,
      business: form.business,
      constraints: form.constraints,
    };

    setPending(true);
    try {
      const res = await fetch(`/api/q/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // 409 = déjà soumis : état final équivalent côté voyageur.
      if (res.ok || res.status === 409) {
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      setError(
        "L'envoi a échoué. Réessayez, ou répondez simplement à notre email.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.progressWrap}>
        <div className={styles.progressInner}>
          <span className={styles.progressLabel}>Votre projet — 2 minutes</span>
          <span className={styles.progressCount}>
            {done ? 6 : progress}/6
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${((done ? 6 : progress) / 6) * 100}%` }}
          />
        </div>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.brand}>
            <Image
              src="/brand/direction-lalgerie-logo-white.webp"
              alt="Direction l'Algérie"
              width={165}
              height={75}
              className={styles.brandLogo}
              priority
            />
            <span className={styles.brandRule} />
          </div>
          <div className={styles.heroEyebrow}>
            <span>Votre projet de voyage</span>
            <span className={styles.heroRef}>{summary.reference}</span>
          </div>
          <h1 className={styles.heroTitle}>Votre voyage en Algérie</h1>
          <p className={styles.heroSub}>
            {summary.travelerName}, voici votre projet tel que nous l&apos;avons
            compris. Encore quelques précisions, et nous dessinons votre
            itinéraire.
          </p>
        </div>
      </header>

      <div className={styles.page}>
        {done ? (
          <div className={styles.thanksCard}>
            <div className={styles.thanksDot}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className={styles.thanksTitle}>C&apos;est bien reçu.</div>
            <p className={styles.thanksText}>
              Merci, {summary.travelerName}. Votre projet est entre de bonnes
              mains — voici ce qui se passe maintenant.
            </p>
            <div className={styles.thanksSteps}>
              <div className={styles.step}>
                <span className={styles.stepDot}>●</span>
                <span>
                  <span className={styles.stepStrong}>Sous quelques jours :</span>{" "}
                  votre première proposition d&apos;itinéraire, par email.
                </span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepDot}>●</span>
                <span>
                  <span className={styles.stepStrong}>Ensuite :</span> on ajuste
                  ensemble, jusqu&apos;à ce que ce soit exactement votre voyage.
                </span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepDot}>●</span>
                <span>
                  <span className={styles.stepStrong}>Une question d&apos;ici là ?</span>{" "}
                  Répondez à notre email, ou écrivez-nous sur WhatsApp.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className={styles.card}>
              <span className={styles.cardLabel}>Votre projet, en l&apos;état</span>
              <h2 className={styles.cardTitle}>Ce que nous avons noté</h2>
              <div className={styles.rail}>
                <div className={styles.railItem}>
                  <span className={styles.railDot} />
                  <div className={styles.railKey}>Dates</div>
                  <div className={styles.railVal}>{summary.datesLine}</div>
                </div>
                <div className={styles.railItem}>
                  <span className={styles.railDot} />
                  <div className={styles.railKey}>Voyageurs</div>
                  <div className={styles.railVal}>{summary.travelers}</div>
                </div>
                <div className={styles.railItem}>
                  <span className={styles.railDot} />
                  <div className={styles.railKey}>Style de voyage</div>
                  <div className={styles.railVal}>{summary.travelStyle}</div>
                </div>
                <div className={styles.railItem}>
                  <span className={styles.railDot} />
                  <div className={styles.railKey}>Budget</div>
                  <div className={styles.railVal}>{summary.budget}</div>
                </div>
              </div>
              {summary.tripSummary && summary.tripSummary !== "—" ? (
                <p className={styles.quote}>« {summary.tripSummary} »</p>
              ) : null}
            </section>

            <aside className={styles.season}>
              <span className={styles.seasonLabel}>Notre promesse</span>
              <p className={styles.seasonText}>
                Nous composons votre itinéraire étape par étape, à la meilleure
                saison pour chaque région d&apos;Algérie — et nous vous disons
                franchement ce qui vaut le détour selon vos dates.
              </p>
            </aside>

            <Section
              n={1}
              title="Qui voyage ?"
              hint="Les âges guident le rythme, les activités et les chambres."
            >
              <div>
                <span className={styles.fieldLabel}>Les voyageurs</span>
                <div className={styles.stack}>
                  {form.travelers.map((t, i) => (
                    <div key={i} className={styles.travelerRow}>
                      <span className={styles.travelerTag}>Voyageur {i + 1}</span>
                      <input
                        className={`${styles.input} ${styles.travelerAge}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={110}
                        placeholder="Âge"
                        aria-label={`Âge du voyageur ${i + 1}`}
                        value={t.age}
                        onChange={(ev) => setTravelerAge(i, ev.target.value)}
                      />
                      {form.travelers.length > 1 ? (
                        <button
                          type="button"
                          className={styles.rowRemove}
                          aria-label={`Retirer le voyageur ${i + 1}`}
                          onClick={() => removeTraveler(i)}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {form.travelers.length < 8 ? (
                  <button
                    type="button"
                    className={styles.addTraveler}
                    style={{ marginTop: 8 }}
                    onClick={addTraveler}
                  >
                    + Ajouter un voyageur
                  </button>
                ) : null}
              </div>
              <div>
                <span className={styles.fieldLabel}>Les chambres</span>
                <RadioCards
                  options={ROOMS}
                  value={form.rooms}
                  onPick={(id) => setForm((f) => ({ ...f, rooms: id }))}
                />
              </div>
            </Section>

            <Section
              n={2}
              title="Vos passeports"
              hint="C'est ce qui règle les formalités d'entrée — selon votre réponse, nous vous guidons précisément, sans stress."
            >
              <div className={styles.passportBlock}>
                {form.travelers.map((_, i) => (
                  <div key={i}>
                    <span className={styles.fieldLabel}>Voyageur {i + 1}</span>
                    <div className={styles.passportRow}>
                      {PASSPORTS.map((o) => {
                        const active = form.passports[i] === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setPassport(i, o.id)}
                            className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              n={3}
              title="Les vols"
              hint="Pour savoir si votre budget les inclut, et d'où vous partez."
            >
              <div>
                <span className={styles.fieldLabel}>Vos billets</span>
                <RadioCards
                  options={FLIGHTS}
                  value={form.flights.mode}
                  onPick={(id) =>
                    setForm((f) => ({
                      ...f,
                      flights: { ...f.flights, mode: id },
                    }))
                  }
                />
              </div>
              <div>
                <label className={styles.fieldLabel} htmlFor="departureCity">
                  Ville de départ
                </label>
                <input
                  id="departureCity"
                  className={styles.input}
                  type="text"
                  maxLength={120}
                  placeholder="Paris, Lyon, Marseille…"
                  value={form.flights.departure_city}
                  onChange={(ev) =>
                    setForm((f) => ({
                      ...f,
                      flights: { ...f.flights, departure_city: ev.target.value },
                    }))
                  }
                />
              </div>
            </Section>

            <Section
              n={4}
              title="Vos envies, votre rythme"
              hint="Cochez ce qui vous attire — nous composons le reste."
            >
              <div>
                <span className={styles.fieldLabel}>Ce qui vous attire déjà</span>
                <ChipsMulti
                  options={MUST_SEE}
                  value={form.wishes.must_see}
                  onToggle={toggleMustSee}
                />
              </div>
              <div>
                <span className={styles.fieldLabel}>Le rythme</span>
                <RadioCards
                  options={RHYTHM}
                  value={form.wishes.rhythm}
                  onPick={(id) =>
                    setForm((f) => ({
                      ...f,
                      wishes: { ...f.wishes, rhythm: id },
                    }))
                  }
                />
              </div>
              <div>
                <span className={styles.fieldLabel}>L&apos;itinéraire</span>
                <RadioCards
                  options={STRUCTURE}
                  value={form.wishes.structure}
                  onPick={(id) =>
                    setForm((f) => ({
                      ...f,
                      wishes: { ...f.wishes, structure: id },
                    }))
                  }
                />
              </div>
              <div>
                <label className={styles.fieldLabel} htmlFor="familyDays">
                  De la famille à visiter, des jours à garder libres ?
                </label>
                <textarea
                  id="familyDays"
                  className={styles.textarea}
                  maxLength={500}
                  placeholder="Ex. : 3 jours en Kabylie chez la famille, sans programme."
                  value={form.wishes.family_days}
                  onChange={(ev) =>
                    setForm((f) => ({
                      ...f,
                      wishes: { ...f.wishes, family_days: ev.target.value },
                    }))
                  }
                />
              </div>
            </Section>

            <Section
              n={5}
              title="L'Algérie qui entreprend"
              hint="Vous évoquiez l'Algérie business — dites-nous en plus."
            >
              <RadioCards
                options={BUSINESS}
                value={form.business.mode}
                onPick={(id) =>
                  setForm((f) => ({
                    ...f,
                    business: { ...f.business, mode: id },
                  }))
                }
              />
              {form.business.mode === "meetings" ? (
                <div>
                  <label className={styles.fieldLabel} htmlFor="businessDetails">
                    Précisez — secteur, type de rencontres
                  </label>
                  <input
                    id="businessDetails"
                    className={styles.input}
                    type="text"
                    maxLength={500}
                    placeholder="Ex. : immobilier, agroalimentaire, rencontres d'entrepreneurs…"
                    value={form.business.details}
                    onChange={(ev) =>
                      setForm((f) => ({
                        ...f,
                        business: { ...f.business, details: ev.target.value },
                      }))
                    }
                  />
                </div>
              ) : null}
            </Section>

            <Section
              n={6}
              title="Confort & détails"
              hint="Ce qui rendra le voyage vraiment confortable, pour vous."
            >
              <div>
                <span className={styles.fieldLabel}>À prendre en compte</span>
                <ChipsMulti
                  options={DIET}
                  value={form.constraints.diet}
                  onToggle={toggleDiet}
                />
              </div>
              <div>
                <span className={styles.fieldLabel}>L&apos;accompagnement</span>
                <RadioCards
                  options={ACCOMPANIMENT}
                  value={form.constraints.accompaniment}
                  onPick={(id) =>
                    setForm((f) => ({
                      ...f,
                      constraints: { ...f.constraints, accompaniment: id },
                    }))
                  }
                />
              </div>
              <div>
                <span className={styles.fieldLabel}>Les repas</span>
                <RadioCards
                  options={BOARD}
                  value={form.constraints.board}
                  onPick={(id) =>
                    setForm((f) => ({
                      ...f,
                      constraints: { ...f.constraints, board: id },
                    }))
                  }
                />
              </div>
              <div>
                <label className={styles.fieldLabel} htmlFor="healthNotes">
                  Santé, précisions, dernières envies
                </label>
                <textarea
                  id="healthNotes"
                  className={styles.textarea}
                  maxLength={500}
                  placeholder="Tout ce qui nous aidera à bien faire."
                  value={form.constraints.notes}
                  onChange={(ev) =>
                    setForm((f) => ({
                      ...f,
                      constraints: { ...f.constraints, notes: ev.target.value },
                    }))
                  }
                />
              </div>
            </Section>

            <div className={styles.submitZone}>
              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                className={styles.submit}
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Envoi en cours…" : "Envoyer mes réponses"}
              </button>
              <p className={styles.reassure}>
                Lues uniquement par l&apos;équipe Direction l&apos;Algérie — jamais
                partagées.
              </p>
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
