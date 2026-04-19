"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteLead } from "@/app/(dashboard)/leads/actions";

type LeadDetailDeleteZoneProps = {
  leadId: string;
  travelerName: string;
};

export function LeadDetailDeleteZone({ leadId, travelerName }: LeadDetailDeleteZoneProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runDelete() {
    const ok = window.confirm(
      `Supprimer définitivement le dossier « ${travelerName} » ? Cette action est irréversible (devis, propositions, historique liés seront supprimés).`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteLead(leadId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/leads");
      router.refresh();
    });
  }

  return (
    <section className="rounded-md border border-red-200 bg-red-50/40 p-4 sm:p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-red-900">
        Zone sensible
      </h3>
      <p className="mt-2 text-sm text-red-900/90">
        Supprime le lead et toutes les données associées en base (cascade).
      </p>
      {error ? (
        <p className="mt-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={runDelete}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-700 bg-red-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
      >
        <Trash2 className="size-4 shrink-0" aria-hidden />
        {pending ? "Suppression…" : "Supprimer ce lead"}
      </button>
    </section>
  );
}
