"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLeadCommercialCrm } from "@/app/(dashboard)/leads/actions";
import { CRM_CONVERSION_OPTIONS, CRM_FOLLOW_UP_OPTIONS } from "@/lib/crm-fields";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

function selectField(
  id: string,
  name: string,
  label: string,
  options: { value: string; label: string }[],
  defaultValue: string,
) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[11px] font-semibold text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 w-full rounded-md border border-border bg-panel px-2 py-1.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-steel/25"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LeadCommercialCrmForm({ lead }: { lead: SupabaseLeadRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const res = await updateLeadCommercialCrm(lead.id, formData);
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      router.refresh();
      setMessage("Grille CRM enregistrée.");
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {selectField(
          "crm-conversion",
          "crm_conversion_band",
          "Probabilité de conversion",
          CRM_CONVERSION_OPTIONS,
          lead.crm_conversion_band,
        )}
        {selectField(
          "crm-followup",
          "crm_follow_up_strategy",
          "Stratégie de relance",
          CRM_FOLLOW_UP_OPTIONS,
          lead.crm_follow_up_strategy,
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-steel px-3 py-2 text-sm font-semibold text-steel-ink hover:opacity-95 disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer la grille CRM"}
        </button>
        <p className="text-xs text-muted-foreground">Cible ~1 min : conversion + relance.</p>
      </div>
      {message ? (
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
      ) : null}
    </form>
  );
}
