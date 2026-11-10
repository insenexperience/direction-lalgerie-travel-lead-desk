"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveQualificationBudget } from "@/app/(dashboard)/leads/qualification-budget-actions";
import { useDeskToast } from "@/components/ui/desk-toast";
import { qualificationBudgetInput, type QualificationBudgetInput } from "@/lib/qualification-budget";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

const currencies = ["EUR", "DZD", "GBP", "USD"];
const control = "mt-1.5 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-foreground focus:border-steel focus:outline-none focus:ring-2 focus:ring-steel/20";

export function LeadBudgetEditor({ lead, onSaved }: { lead: SupabaseLeadRow; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useDeskToast();
  const [initial] = useState(() => qualificationBudgetInput(lead));
  const [values, setValues] = useState(initial);
  const [revision] = useState(lead.updated_at);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const availableCurrencies = initial.currency && !currencies.includes(initial.currency)
    ? [...currencies, initial.currency] : currencies;
  const set = (field: keyof QualificationBudgetInput, value: string) => {
    setValues(previous => ({ ...previous, [field]: value }));
    setError(null);
  };

  return (
    <form className="space-y-4" aria-busy={pending} onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      setError(null);
      startTransition(async () => {
        try {
          const result = await saveQualificationBudget(lead.id, revision, values);
          if (!result.ok) {
            setError(result.error);
            toast.error(result.error);
            return;
          }
          toast.success("Budget enregistré dans le dossier.");
          onSaved?.();
          router.refresh();
        } catch {
          const message = "Le budget n’a pas pu être enregistré. Rechargez le dossier avant de réessayer.";
          setError(message);
          toast.error(message);
        }
      });
    }}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Indiquez le budget communiqué par le voyageur. Si vous avez seulement un plafond, renseignez le maximum.
      </p>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Budget du voyageur</legend>
        <label className="text-sm">Budget indicatif
          <input type="text" inputMode="decimal" maxLength={18} placeholder="Ex. 1 500,50" value={values.budget_min} onChange={event => set("budget_min", event.target.value)} className={control} />
        </label>
        <label className="text-sm">Budget maximum
          <input type="text" inputMode="decimal" maxLength={18} placeholder="Ex. 2 000" value={values.budget_max} onChange={event => set("budget_max", event.target.value)} className={control} />
        </label>
        <label className="text-sm">Devise
          <select required value={values.currency} onChange={event => set("currency", event.target.value)} className={control}>
            <option value="">Choisir une devise</option>
            {availableCurrencies.map(currency => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
        <label className="text-sm">Base du budget
          <select required value={values.budget_unit} onChange={event => set("budget_unit", event.target.value)} className={control}>
            <option value="">Choisir une base</option>
            <option value="per_person">Par personne</option>
            <option value="total">Pour le groupe</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">Vols inclus dans ce budget
          <select value={values.budget_includes_flights} onChange={event => set("budget_includes_flights", event.target.value)} className={control}>
            <option value="">À confirmer</option>
            <option value="yes">Oui</option>
            <option value="no">Non, hors vols</option>
          </select>
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-steel px-4 py-2.5 text-sm font-semibold text-steel-ink disabled:opacity-50">
        {pending ? "Enregistrement…" : "Enregistrer le budget"}
      </button>
    </form>
  );
}
