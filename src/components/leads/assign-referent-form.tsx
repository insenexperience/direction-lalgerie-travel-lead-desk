"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  assignLeadReferent,
  type AssignReferentResult,
} from "@/app/(dashboard)/leads/actions";
import { referentDisplayLabel, type ReferentDisplayRow } from "@/lib/referent-display";

type ReferentOption = ReferentDisplayRow;

type AssignReferentFormProps = {
  leadId: string;
  currentReferentId: string | null;
  referents: ReferentOption[];
  /** Allouer l’opérateur travel desk (étape Nouveau) — distinct de l’agence partenaire. */
  variant?: "travel_desk" | "referent";
};

export function AssignReferentForm({
  leadId,
  currentReferentId,
  referents,
  variant = "travel_desk",
}: AssignReferentFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    setPending(true);
    const result: AssignReferentResult = await assignLeadReferent(
      leadId,
      formData,
    );
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.refresh();
    setMessage(
      variant === "travel_desk"
        ? "Opérateur assigné enregistré."
        : "Opérateur assigné mis à jour.",
    );
  }

  const fieldLabel =
    variant === "travel_desk" ? "Opérateur assigné" : "Opérateur assigné";
  const submitLabel =
    variant === "travel_desk"
      ? "Allouer l’opérateur"
      : "Enregistrer l’opérateur";

  return (
    <form action={handleSubmit} className="space-y-3">
      <label className="block text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">
          {fieldLabel}
        </span>
        <select
          name="referent_id"
          defaultValue={currentReferentId ?? "__none__"}
          disabled={pending}
          className="mt-2 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-steel/25"
        >
          <option value="__none__">— Non assigné —</option>
          {referents.map((r) => (
            <option key={r.id} value={r.id}>
              {referentDisplayLabel(r)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-steel px-3 py-2 text-sm font-semibold text-steel-ink hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : submitLabel}
      </button>
      {message ? (
        <p
          className={
            message.includes("enregistr") || message.includes("mis à jour")
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
