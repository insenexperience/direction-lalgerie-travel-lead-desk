"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  assignLeadPartnerAgency,
  type AssignPartnerAgencyResult,
} from "@/app/(dashboard)/leads/actions";

type AgencyOption = {
  id: string;
  label: string;
};

type AssignPartnerAgencyFormProps = {
  leadId: string;
  currentAgencyId: string | null;
  agencies: AgencyOption[];
};

export function AssignPartnerAgencyForm({
  leadId,
  currentAgencyId,
  agencies,
}: AssignPartnerAgencyFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setMessage(null);
    setPending(true);
    const result: AssignPartnerAgencyResult = await assignLeadPartnerAgency(
      leadId,
      formData,
    );
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.refresh();
    setMessage("Agence partenaire enregistrée.");
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <label className="block text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wider">
          Agence partenaire (traitement du lead)
        </span>
        <select
          name="agency_id"
          defaultValue={currentAgencyId ?? "__none__"}
          disabled={pending}
          className="mt-2 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-steel/25"
        >
          <option value="__none__">— Aucune agence assignée —</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label.trim() || a.id.slice(0, 8) + "…"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-steel px-3 py-2 text-sm font-semibold text-steel-ink hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Assigner l’agence partenaire"}
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
    </form>
  );
}
