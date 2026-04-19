"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createLeadFromIntake } from "@/app/(dashboard)/leads/actions";

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
            Nouveau lead (formulaire site)
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

        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
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
        </form>
      </div>
    </div>
  );
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
