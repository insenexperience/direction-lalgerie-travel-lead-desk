"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  updateLeadDetails,
  type ActionResult,
} from "@/app/(dashboard)/leads/actions";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

type LeadEditFormProps = {
  lead: SupabaseLeadRow;
  /** Après enregistrement réussi (ex. fermer le panneau « Modifier »). */
  onSaved?: () => void;
};

export function LeadEditForm({ lead, onSaved }: LeadEditFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    setPending(true);
    const result: ActionResult = await updateLeadDetails(lead.id, formData);
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("Modifications enregistrées.");
    onSaved?.();
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelClass}>Nom du voyageur *</span>
          <input
            name="traveler_name"
            required
            defaultValue={lead.traveler_name}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Email</span>
          <input
            name="email"
            type="email"
            defaultValue={lead.email}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Téléphone</span>
          <input
            name="phone"
            defaultValue={lead.phone}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>WhatsApp (E.164 recommandé)</span>
          <input
            name="whatsapp_phone_number"
            defaultValue={lead.whatsapp_phone_number ?? ""}
            disabled={pending}
            className={inputClass}
            placeholder="+213…"
          />
        </label>
        <label>
          <span className={labelClass}>Canal d&apos;entrée</span>
          <select
            name="intake_channel"
            defaultValue={lead.intake_channel ?? ""}
            disabled={pending}
            className={inputClass}
          >
            <option value="">— inchangé —</option>
            <option value="manual">Manuel</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="web_form">Formulaire web</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Résumé du projet</span>
          <textarea
            name="trip_summary"
            rows={3}
            defaultValue={lead.trip_summary}
            disabled={pending}
            className={`${inputClass} resize-y`}
          />
        </label>
        <label>
          <span className={labelClass}>Style / tonalité</span>
          <input
            name="travel_style"
            defaultValue={lead.travel_style}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Voyageurs</span>
          <input
            name="travelers"
            defaultValue={lead.travelers}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Budget</span>
          <input
            name="budget"
            defaultValue={lead.budget}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Dates (texte libre)</span>
          <input
            name="trip_dates"
            defaultValue={lead.trip_dates}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Source</span>
          <input
            name="source"
            defaultValue={lead.source}
            disabled={pending}
            className={inputClass}
            placeholder="Site, partenaire, salon…"
          />
        </label>
        <label>
          <span className={labelClass}>Priorité</span>
          <select
            name="priority"
            defaultValue={lead.priority}
            disabled={pending}
            className={inputClass}
          >
            <option value="normal">Normale</option>
            <option value="high">Haute</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>État devis (champ libre)</span>
          <input
            name="quote_status"
            defaultValue={lead.quote_status}
            disabled={pending}
            className={inputClass}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Qualification</span>
          <textarea
            name="qualification_summary"
            rows={4}
            defaultValue={lead.qualification_summary}
            disabled={pending}
            className={`${inputClass} resize-y`}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Notes internes</span>
          <textarea
            name="internal_notes"
            rows={4}
            defaultValue={lead.internal_notes}
            disabled={pending}
            className={`${inputClass} resize-y`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-steel px-4 py-2 text-sm font-semibold text-[#f3f7fa] transition-colors hover:bg-[#0f1c24] disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
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
      </div>
    </form>
  );
}
