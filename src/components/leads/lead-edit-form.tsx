"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadDetails, type ActionResult } from "@/app/(dashboard)/leads/actions";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

// ─── Constantes identiques au formulaire site (v2.9.2) ─────────────────────

const GROUP_OPTIONS = [
  { value: "Seul(e)",             sub: "Rythme libre" },
  { value: "En couple",           sub: "Moments à deux" },
  { value: "En famille",          sub: "Activités adaptées aux enfants" },
  { value: "Entre amis / groupe", sub: "Convivial & partagé" },
];

const HEBERGEMENT_OPTIONS = [
  "Luxe / 5*",
  "Boutique / charme",
  "Logement d'exception",
  "Mixte selon les étapes",
];

const VISION_OPTIONS = [
  "Première découverte de l'Algérie",
  "Exploration en profondeur",
  "Roadtrip avec plusieurs étapes",
  "Grand classique revisité",
  "Hors des sentiers battus",
];

const FLEX_MONTHS = [
  "Dans les 3 prochains mois",
  "Printemps",
  "Été",
  "Automne",
  "Hiver",
  "Je ne sais pas encore",
];

const FLEX_DURATIONS = [
  "3–5 jours",
  "1 semaine",
  "10–12 jours",
  "2 semaines",
  "Plus de 2 semaines",
];

// ─── Helpers de pré-population ──────────────────────────────────────────────

function detectGroupe(travelers: string): string {
  if (!travelers) return "";
  if (/seul/i.test(travelers)) return "Seul(e)";
  if (/couple/i.test(travelers)) return "En couple";
  if (/famille/i.test(travelers)) return "En famille";
  if (/amis|groupe/i.test(travelers)) return "Entre amis / groupe";
  return "";
}

function detectPeople(lead: SupabaseLeadRow): string {
  const total = (lead.travelers_adults ?? 0) + (lead.travelers_children ?? 0);
  if (total > 1) return String(total);
  const m = (lead.travelers ?? "").match(/(\d+)\s*voyageur/);
  if (m) return m[1];
  return "";
}

type DateInfo = {
  mode: "exact" | "flex";
  dateStart: string;
  dateEnd: string;
  flexMonth: string;
  flexDuration: string;
};

function parseDateInfo(lead: SupabaseLeadRow): DateInfo {
  if (lead.travel_start_date) {
    return {
      mode: "exact",
      dateStart: lead.travel_start_date.slice(0, 10),
      dateEnd: (lead.travel_end_date ?? "").slice(0, 10),
      flexMonth: "",
      flexDuration: "",
    };
  }
  const td = lead.trip_dates ?? "";
  if (/^\d{4}-\d{2}-\d{2}/.test(td)) {
    const [s, e] = td.split("→").map((x) => x.trim());
    return { mode: "exact", dateStart: s ?? "", dateEnd: e ?? "", flexMonth: "", flexDuration: "" };
  }
  const flexMonth = FLEX_MONTHS.find((m) => td.includes(m)) ?? "";
  const flexDuration = FLEX_DURATIONS.find((d) => td.includes(d)) ?? "";
  return { mode: "flex", dateStart: "", dateEnd: "", flexMonth, flexDuration };
}

function parseVision(travelStyle: string): string[] {
  return VISION_OPTIONS.filter((v) => (travelStyle ?? "").includes(v));
}

function parseHebergements(qualSummary: string): string[] {
  const line = (qualSummary ?? "")
    .split("\n")
    .find((l) => l.startsWith("Hébergements :"));
  if (!line) return [];
  const val = line.replace("Hébergements : ", "");
  return HEBERGEMENT_OPTIONS.filter((h) => val.includes(h));
}

function parseBudgetIdeal(lead: SupabaseLeadRow): string {
  if (lead.budget_min != null) return String(Math.round(lead.budget_min));
  const m = (lead.budget ?? "").match(/^(\d[\d\s]*)/);
  if (m) return m[1].replace(/\s/g, "");
  return "";
}

function parseBudgetMax(lead: SupabaseLeadRow): string {
  if ((lead as Record<string, unknown>).budget_max != null) {
    return String(Math.round(Number((lead as Record<string, unknown>).budget_max)));
  }
  const m = (lead.budget ?? "").match(/→\s*(\d[\d\s]*)/);
  if (m) return m[1].replace(/\s/g, "");
  return "";
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const inputCls =
  "mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25";
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const sectionTitleCls =
  "text-[11px] font-semibold uppercase tracking-wider text-[#9aa7b0] mb-3";

// ─── Composant ───────────────────────────────────────────────────────────────

type LeadEditFormProps = {
  lead: SupabaseLeadRow;
  onSaved?: () => void;
};

export function LeadEditForm({ lead, onSaved }: LeadEditFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Identité
  const nameParts = (lead.traveler_name ?? "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.whatsapp_phone_number ?? lead.phone ?? "");

  // Participants & dates
  const [groupe, setGroupe] = useState(detectGroupe(lead.travelers ?? ""));
  const [people, setPeople] = useState(detectPeople(lead));
  const di = parseDateInfo(lead);
  const [datesMode, setDatesMode] = useState<"exact" | "flex">(di.mode);
  const [dateStart, setDateStart] = useState(di.dateStart);
  const [dateEnd, setDateEnd] = useState(di.dateEnd);
  const [flexMonth, setFlexMonth] = useState(di.flexMonth);
  const [flexDuration, setFlexDuration] = useState(di.flexDuration);

  // Style & projet
  const [hebergements, setHebergements] = useState<string[]>(
    parseHebergements(lead.qualification_summary ?? "")
  );
  const [vision, setVision] = useState<string[]>(
    parseVision(lead.travel_style ?? "")
  );
  const [notes, setNotes] = useState(lead.trip_summary ?? "");

  // Budget
  const [budgetIdeal, setBudgetIdeal] = useState(parseBudgetIdeal(lead));
  const [budgetMax, setBudgetMax] = useState(parseBudgetMax(lead));
  const [currency, setCurrency] = useState("EUR");

  // Planning stage
  const [planningStage, setPlanningStage] = useState<"ideas" | "planning" | "ready" | "">(
    lead.planning_stage ?? ""
  );

  // Paramètres opérationnels (limités)
  const [priority, setPriority] = useState<"normal" | "high">(
    lead.priority === "high" ? "high" : "normal"
  );
  const [intakeChannel, setIntakeChannel] = useState(lead.intake_channel ?? "");

  function toggle(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function handleSubmit() {
    setMessage(null);
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!name) {
      setMessage("Le nom du voyageur est obligatoire.");
      return;
    }
    const fd = new FormData();
    fd.set("traveler_name", name);
    fd.set("email", email.trim());
    fd.set("phone", phone.trim());
    fd.set("whatsapp_phone_number", phone.trim());
    fd.set("groupe", groupe);
    fd.set("people", people);
    fd.set("dates_mode", datesMode === "flex" ? "Période flexible" : "Dates précises");
    fd.set("date_start", dateStart);
    fd.set("date_end", dateEnd);
    fd.set("flex_month", flexMonth);
    fd.set("flex_duration", flexDuration);
    fd.set("hebergements", hebergements.join(", "));
    fd.set("vision", vision.join(" · "));
    fd.set("notes", notes.trim());
    fd.set("budget_ideal", budgetIdeal);
    fd.set("budget_max_field", budgetMax);
    fd.set("budget_currency", currency);
    fd.set("priority", priority);
    if (intakeChannel) fd.set("intake_channel", intakeChannel);
    if (planningStage) fd.set("planning_stage", planningStage);

    startTransition(async () => {
      const result: ActionResult = await updateLeadDetails(lead.id, fd);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Modifications enregistrées.");
      onSaved?.();
      router.refresh();
    });
  }

  const totalBudget =
    budgetIdeal && people
      ? (parseFloat(budgetIdeal) || 0) * (parseInt(people, 10) || 0)
      : 0;

  return (
    <div className="space-y-7">

      {/* ── 1. Identité ── */}
      <section>
        <p className={sectionTitleCls}>Identité</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Prénom</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={pending}
              className={inputCls}
              placeholder="Prénom"
            />
          </label>
          <label>
            <span className={labelCls}>Nom</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={pending}
              className={inputCls}
              placeholder="Nom de famille"
            />
          </label>
          <label>
            <span className={labelCls}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Téléphone / WhatsApp</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={pending}
              className={inputCls}
              placeholder="+213…"
            />
          </label>
        </div>
      </section>

      {/* ── 1b. Maturité du projet ── */}
      <section>
        <p className={sectionTitleCls}>Où en est le projet ?</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "ideas",    label: "Je cherche des idées",     sub: "Exploration, premières envies" },
              { value: "planning", label: "Je commence à planifier",  sub: "Projet concret, dates en tête" },
              { value: "ready",    label: "Prêt à réserver",          sub: "Projet avancé, décision proche" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => setPlanningStage(opt.value)}
              className={[
                "rounded-[6px] border p-2.5 text-left transition-colors",
                planningStage === opt.value
                  ? "border-[#15323f] bg-[#15323f]/5"
                  : "border-[#e4e8eb] bg-white hover:bg-[#f6f7f8]",
              ].join(" ")}
            >
              <p className="text-[12px] font-semibold text-[#0e1a21]">{opt.label}</p>
              <p className="mt-0.5 text-[10px] text-[#9aa7b0]">{opt.sub}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── 2. Participants & dates ── */}
      <section>
        <p className={sectionTitleCls}>Participants & dates</p>

        {/* Type de groupe (cards) */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={() => setGroupe(opt.value)}
              className={[
                "rounded-[6px] border p-2.5 text-left transition-colors",
                groupe === opt.value
                  ? "border-[#15323f] bg-[#15323f]/5"
                  : "border-[#e4e8eb] bg-white hover:bg-[#f6f7f8]",
              ].join(" ")}
            >
              <p className="text-[12px] font-semibold text-[#0e1a21]">{opt.value}</p>
              <p className="mt-0.5 text-[10px] text-[#9aa7b0]">{opt.sub}</p>
            </button>
          ))}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Nombre de voyageurs</span>
            <input
              type="number"
              min="1"
              value={people}
              onChange={(e) => setPeople(e.target.value)}
              disabled={pending}
              className={inputCls}
              placeholder="Ex. 2"
            />
          </label>
          <label>
            <span className={labelCls}>Connaissez-vous vos dates ?</span>
            <select
              value={datesMode}
              onChange={(e) => setDatesMode(e.target.value as "exact" | "flex")}
              disabled={pending}
              className={inputCls}
            >
              <option value="exact">Dates précises</option>
              <option value="flex">Période flexible</option>
            </select>
          </label>
        </div>

        {datesMode === "exact" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelCls}>Date de départ</span>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                disabled={pending}
                className={inputCls}
              />
            </label>
            <label>
              <span className={labelCls}>Date de retour</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                disabled={pending}
                className={inputCls}
              />
            </label>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelCls}>Période souhaitée</span>
              <select
                value={flexMonth}
                onChange={(e) => setFlexMonth(e.target.value)}
                disabled={pending}
                className={inputCls}
              >
                <option value="">Choisissez une période</option>
                {FLEX_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelCls}>Durée approximative</span>
              <select
                value={flexDuration}
                onChange={(e) => setFlexDuration(e.target.value)}
                disabled={pending}
                className={inputCls}
              >
                <option value="">Durée approximative</option>
                {FLEX_DURATIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>

      {/* ── 3. Style & projet ── */}
      <section>
        <p className={sectionTitleCls}>Style & projet</p>

        <div className="mb-4">
          <p className={labelCls}>Hébergements préférés</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {HEBERGEMENT_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                disabled={pending}
                onClick={() => toggle(hebergements, setHebergements, h)}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  hebergements.includes(h)
                    ? "border-[#15323f] bg-[#15323f] text-white"
                    : "border-[#e4e8eb] text-[#3a4a55] hover:bg-[#f6f7f8]",
                ].join(" ")}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className={labelCls}>Vision du voyage</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VISION_OPTIONS.map((v) => (
              <button
                key={v}
                type="button"
                disabled={pending}
                onClick={() => toggle(vision, setVision, v)}
                className={[
                  "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  vision.includes(v)
                    ? "border-[#1e5a8a] bg-[#1e5a8a] text-white"
                    : "border-[#e4e8eb] text-[#3a4a55] hover:bg-[#f6f7f8]",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className={labelCls}>Projet en quelques mots</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={pending}
            className={`${inputCls} resize-y`}
            placeholder="Étapes, villes ou régions qui vous attirent, contraintes particulières…"
          />
        </label>
      </section>

      {/* ── 4. Budget ── */}
      <section>
        <p className={sectionTitleCls}>
          Budget indicatif{" "}
          <span className="normal-case font-normal text-[#9aa7b0]">
            (par personne, hors vols internationaux)
          </span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={labelCls}>Budget idéal / pers.</span>
            <input
              type="number"
              min="0"
              step="100"
              value={budgetIdeal}
              onChange={(e) => setBudgetIdeal(e.target.value)}
              disabled={pending}
              className={inputCls}
              placeholder="Ex. 800"
            />
          </label>
          <label>
            <span className={labelCls}>Budget maximum / pers.</span>
            <input
              type="number"
              min="0"
              step="100"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              disabled={pending}
              className={inputCls}
              placeholder="Ex. 1 200"
            />
          </label>
          <label>
            <span className={labelCls}>Devise</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={pending}
              className={inputCls}
            >
              <option value="EUR">Euro (€)</option>
              <option value="USD">Dollar ($)</option>
              <option value="DZD">Dinar algérien (DZD)</option>
            </select>
          </label>
        </div>
        {totalBudget > 0 && (
          <p className="mt-2 text-[11px] text-[#6b7a85]">
            Budget total estimé :{" "}
            <strong>{totalBudget.toLocaleString("fr-FR")} {currency}</strong>{" "}
            pour {people} voyageur{parseInt(people, 10) > 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* ── 5. Paramètres ── */}
      <section>
        <p className={sectionTitleCls}>Paramètres</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Canal d&apos;entrée</span>
            <select
              value={intakeChannel}
              onChange={(e) => setIntakeChannel(e.target.value)}
              disabled={pending}
              className={inputCls}
            >
              <option value="">— inchangé —</option>
              <option value="web_form">Formulaire web</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="manual">Manuel</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label>
            <span className={labelCls}>Priorité</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "normal" | "high")}
              disabled={pending}
              className={inputCls}
            >
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
            </select>
          </label>
        </div>
      </section>

      {/* ── Enregistrer ── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="rounded-md bg-[#15323f] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0e1a21] disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        {message && (
          <p
            className={
              message.includes("enregistr")
                ? "text-sm text-emerald-700"
                : "text-sm text-red-600"
            }
            role="status"
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
