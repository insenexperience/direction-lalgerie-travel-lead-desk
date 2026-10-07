"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createLeadFromIntake } from "@/app/(dashboard)/leads/actions";
import { analyzeManualLeadMessage, createLeadFromManualMessage } from "@/app/(dashboard)/leads/manual-import-actions";
import { manualLeadUnknownFields, type ManualLeadDraft } from "@/lib/manual-lead-import";

type LeadIntakeModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const dateModeOptions = [
  { value: "Dates précises", label: "Dates précises" },
  { value: "Dates flexibles", label: "Dates flexibles" },
];

const currencyOptions = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "DZD", label: "DZD" },
];

export function LeadIntakeModal({ open, onClose, onCreated }: LeadIntakeModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"message" | "form">("message");

  if (!open) return null;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createLeadFromIntake(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-lead-intake-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1419]/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-border bg-panel shadow-lg">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <h2
            id="new-lead-intake-title"
            className="font-display text-lg font-semibold text-foreground"
          >
            Nouveau projet de voyage
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-panel-muted hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-2 border-b border-border px-5 py-3 sm:px-6">
          <button type="button" onClick={() => setMode("message")} aria-pressed={mode === "message"} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "message" ? "bg-steel text-white" : "text-muted-foreground hover:bg-panel-muted"}`}>Importer un message</button>
          <button type="button" onClick={() => setMode("form")} aria-pressed={mode === "form"} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === "form" ? "bg-steel text-white" : "text-muted-foreground hover:bg-panel-muted"}`}>Saisie libre</button>
        </div>
        {mode === "message" ? <ManualMessageImport onClose={onClose} onCreated={onCreated} /> : <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contact voyageur
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prénom" name="first" />
                <Field label="Nom" name="last" />
                <Field label="Email *" name="email" type="email" required />
                <Field label="Téléphone" name="phone" type="tel" />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Projet
              </h3>
              <Field
                label="Étape de planification"
                name="planning_stage"
                placeholder="Ex. premières idées, dates bloquées…"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Type de groupe"
                  name="group_type"
                  placeholder="Famille, couple, entreprise…"
                />
                <Field
                  label="Nombre de voyageurs"
                  name="travellers_count"
                  placeholder="ex. 4"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dates
              </h3>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mode
                <select
                  name="dates_mode"
                  defaultValue="Dates précises"
                  className="mt-1 w-full rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25"
                >
                  {dateModeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date début" name="date_start" placeholder="JJ/MM/AAAA" />
                <Field label="Date fin" name="date_end" placeholder="JJ/MM/AAAA" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Mois / période flexible"
                  name="flex_month"
                  placeholder="ex. juin 2026"
                />
                <Field
                  label="Durée souhaitée"
                  name="flex_duration"
                  placeholder="ex. 10 jours"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Préférences
              </h3>
              <TextArea
                label="Hébergements (tags ou texte libre)"
                name="hebergements"
                rows={2}
              />
              <TextArea label="Vision du voyage" name="vision" rows={2} />
              <TextArea
                label="Préférences de suivi (follow)"
                name="follow_prefs"
                rows={2}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Budget
              </h3>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Devise
                <select
                  name="currency"
                  defaultValue="EUR"
                  className="mt-1 w-full rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25"
                >
                  {currencyOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Budget idéal / pers. (nombre)"
                  name="budget_ideal"
                  placeholder="ex. 2500"
                />
                <Field
                  label="Budget max / pers. (nombre)"
                  name="budget_max"
                  placeholder="ex. 3500"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes & traçabilité
              </h3>
              <TextArea label="Notes détaillées" name="notes_longues" rows={4} />
              <Field
                label="URL page d'origine (optionnel)"
                name="page_origin"
                placeholder="https://…"
              />
              <Field
                label="ID soumission externe (optionnel)"
                name="submission_id"
                placeholder="Laisser vide pour générer un UUID"
              />
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Priorité
                <select
                  name="priority"
                  defaultValue="normal"
                  className="mt-1 w-full rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25"
                >
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                </select>
              </label>
            </section>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-panel px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-panel-muted"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-transparent bg-steel px-4 py-2 text-sm font-semibold text-[#f3f7fa] hover:bg-[#0f1c24] disabled:opacity-50"
            >
              {pending ? "Création…" : "Créer le lead"}
            </button>
          </div>
        </form>}
      </div>
    </div>
  );
}

const importSections: { title: string; fields: { key: keyof ManualLeadDraft; label: string; type?: string; wide?: boolean }[] }[] = [
  { title: "Contact et projet", fields: [
    { key: "full_name", label: "Nom complet *" }, { key: "email", label: "Email *", type: "email" },
    { key: "phone", label: "Téléphone", type: "tel" }, { key: "project_title", label: "Titre du projet" },
    { key: "destination_main", label: "Destinations et options", wide: true }, { key: "vision", label: "Envies et activité", wide: true },
  ] },
  { title: "Participants et chambres", fields: [
    { key: "group_type", label: "Type de groupe" }, { key: "travellers_count", label: "Total des participants", type: "number" },
    { key: "travelers_adults", label: "Adultes", type: "number" }, { key: "travelers_children", label: "Enfants", type: "number" },
    { key: "children_ages", label: "Âge de chaque enfant au départ", wide: true },
    { key: "rooms", label: "Chambres : nombre de singles, doubles, twins, familiales…", wide: true },
  ] },
  { title: "Dates et logistique", fields: [
    { key: "date_start", label: "Début (année confirmée)", type: "date" }, { key: "date_end", label: "Fin (année confirmée)", type: "date" },
    { key: "flex_period", label: "Période et dates dans le message", wide: true }, { key: "flex_duration", label: "Durée demandée" },
    { key: "departure_airport", label: "Ville ou aéroport de départ" },
    { key: "arrival_details", label: "Arrivée : lieu, date et heure", wide: true }, { key: "departure_details", label: "Départ : lieu, date et heure", wide: true },
    { key: "hebergements", label: "Hébergement et confort", wide: true },
  ] },
  { title: "Budget et contraintes", fields: [
    { key: "budget_ideal", label: "Budget idéal", type: "number" }, { key: "budget_max", label: "Budget maximum", type: "number" },
    { key: "constraints", label: "Contraintes et points à vérifier", wide: true },
  ] },
];

function ManualMessageImport({ onClose, onCreated }: Pick<LeadIntakeModalProps, "onClose" | "onCreated">) {
  const [source, setSource] = useState("");
  const [draft, setDraft] = useState<ManualLeadDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function analyze() {
    setError(null); setWarning(null);
    startTransition(async () => {
      const result = await analyzeManualLeadMessage(source);
      if (!result.ok) { setError(result.error); return; }
      setDraft(result.draft); setWarning(result.warning ?? null);
    });
  }

  function create(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createLeadFromManualMessage(formData);
      if (!result.ok) { setError(result.error); return; }
      onCreated(); onClose();
    });
  }

  const unknownFields = draft ? manualLeadUnknownFields(draft) : [];
  return <form action={create} className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
      <p className="text-sm leading-relaxed text-muted-foreground">Collez le mail ou le message du voyageur. L’analyse répartit les informations dans le dossier et retranscrit le projet dans les notes supplémentaires. Vous vérifiez les champs avant la création.</p>
      <label className="block text-xs font-semibold text-muted-foreground">Message original *
        <textarea value={source} disabled={pending} maxLength={40000} onChange={event => { setSource(event.target.value); setDraft(null); }} rows={draft ? 4 : 9} className="mt-1 w-full resize-y rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground disabled:opacity-60" placeholder="Collez ici le message complet, avec les coordonnées si disponibles…" />
      </label>
      <input type="hidden" name="source_message" value={source} />
      <div className="flex items-end gap-3">
        <label className="flex-1 text-xs font-semibold text-muted-foreground">Canal d’origine
          <select name="import_channel" defaultValue="email" className="mt-1 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-foreground"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="manual">Autre import manuel</option></select>
        </label>
        <button type="button" onClick={analyze} disabled={pending || !source.trim()} className="rounded-md bg-steel px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Traitement…" : draft ? "Relire le message" : "Analyser et préremplir"}</button>
      </div>
      {warning ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="status">{warning}</p> : null}
      {draft ? <>
        <div className="rounded-md border border-border bg-panel-muted p-3 text-sm text-muted-foreground">Les champs vides restent inconnus. Une date sans année n’est pas transformée en date confirmée. Le message original est conservé intégralement dans le dossier.</div>
        {importSections.map(section => <section key={section.title} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          <div className="grid gap-3 sm:grid-cols-2">{section.fields.map(field => <label key={field.key} className={`block text-xs font-semibold text-muted-foreground ${field.wide ? "sm:col-span-2" : ""}`}>{field.label}
            <input name={field.key} value={draft[field.key]} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "any" : undefined} required={field.key === "full_name" || field.key === "email"} placeholder="Non renseigné" className="mt-1 w-full rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25" />
          </label>)}</div>
        </section>)}
        <div className="grid gap-3 sm:grid-cols-2">
          <ImportSelect label="Langue des emails au client" name="language" value={draft.language} options={[["fr", "Français"], ["en", "English"]]} onChange={value => setDraft({ ...draft, language: value === "en" ? "en" : "fr" })} />
          <ImportSelect label="Vols" name="flights" value={draft.flights} options={[["", "À préciser"], ["included", "Proposition avec vols"], ["excluded", "Le voyageur réserve ses vols"], ["booked", "Vols déjà réservés"]]} onChange={value => setDraft({ ...draft, flights: value })} />
          <ImportSelect label="Maturité du projet" name="planning_stage" value={draft.planning_stage} options={[["", "À préciser"], ["ideas", "Premières idées"], ["planning", "En préparation"], ["ready", "Prêt à réserver"]]} onChange={value => setDraft({ ...draft, planning_stage: value })} />
          <ImportSelect label="Budget" name="budget_unit" value={draft.budget_unit} options={[["", "Unité à préciser"], ["per_person", "Par personne"], ["total", "Total du groupe"]]} onChange={value => setDraft({ ...draft, budget_unit: value })} />
          <ImportSelect label="Devise communiquée" name="currency" value={draft.currency} options={[["", "À préciser"], ["EUR", "EUR"], ["USD", "USD"], ["DZD", "DZD"], ["GBP", "GBP"]]} onChange={value => setDraft({ ...draft, currency: value })} />
          <ImportSelect label="Le budget comprend-il les vols ?" name="budget_includes_flights" value={draft.budget_includes_flights} options={[["", "À préciser"], ["yes", "Oui, vols inclus"], ["no", "Non, budget hors vols"]]} onChange={value => setDraft({ ...draft, budget_includes_flights: value })} />
        </div>
        <label className="block text-xs font-semibold text-muted-foreground">Notes supplémentaires du voyage — retranscription complète *
          <textarea name="notes_longues" value={draft.notes_longues} onChange={event => setDraft({ ...draft, notes_longues: event.target.value })} rows={12} required className="mt-1 w-full resize-y rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground" />
        </label>
        {unknownFields.length ? <div className="rounded-md border border-border p-3"><p className="text-sm font-semibold text-foreground">Informations à demander au client</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{unknownFields.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
        <label className="flex items-start gap-2 text-sm text-foreground"><input type="checkbox" name="import_reviewed" value="yes" required className="mt-1" />J’ai vérifié les champs et la retranscription. Les informations absentes restent à préciser.</label>
      </> : null}
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    </div>
    <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-panel px-5 py-4 sm:px-6">
      <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-panel-muted">Annuler</button>
      <button type="submit" disabled={pending || !draft} className="rounded-md bg-steel px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Traitement…" : "Créer le dossier"}</button>
    </div>
  </form>;
}

function ImportSelect({ label, name, value, options, onChange }: { label: string; name: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-muted-foreground">{label}<select name={name} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-foreground">{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  rows,
}: {
  label: string;
  name: string;
  rows: number;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <textarea
        name={name}
        rows={rows}
        className="mt-1 w-full resize-y rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25"
      />
    </label>
  );
}
