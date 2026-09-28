"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe2, MapPin, MoreVertical, Plus, Trash2 } from "lucide-react";
import {
  createPartnerAgency,
  deletePartnerAgency,
} from "@/app/(dashboard)/agencies/actions";
import { CreateAgencyModal } from "@/components/create-agency-modal";
import { TopHeader } from "@/components/top-header";
import type { CreatePartnerAgencyInput, PartnerAgency } from "@/lib/mock-agencies";
import {
  partnerAgencyStatusLabelFr,
  partnerAgencyTypeLabelFr,
} from "@/lib/mock-agencies";

type AgenciesPageInnerProps = {
  initialAgencies: PartnerAgency[];
};

function AgencyCardMenu({ agency }: { agency: PartnerAgency }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const name = agency.tradeName?.trim() || agency.legalName;
    if (
      !window.confirm(
        `Supprimer l’agence « ${name} » ? Les leads qui la référencent perdront cette liaison (réinitialisation).`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await deletePartnerAgency(agency.id);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group relative shrink-0">
      <summary
        className="flex cursor-pointer list-none items-center justify-center rounded-md border border-border bg-panel p-1.5 text-muted-foreground transition-colors hover:bg-panel-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
        aria-label="Menu agence"
      >
        <MoreVertical className="size-4" aria-hidden />
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border border-border bg-panel py-1 shadow-md">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDelete()}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="size-4 shrink-0" aria-hidden />
          Supprimer
        </button>
      </div>
    </details>
  );
}

export function AgenciesPageInner({ initialAgencies }: AgenciesPageInnerProps) {
  const router = useRouter();
  const [agencies, setAgencies] = useState(initialAgencies);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setAgencies(initialAgencies);
  }, [initialAgencies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agencies;
    return agencies.filter((a) => {
      const hay = [
        a.legalName,
        a.tradeName ?? "",
        a.city,
        a.country,
        a.destinations,
        a.email,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [agencies, query]);

  async function handleCreate(input: CreatePartnerAgencyInput) {
    const res = await createPartnerAgency(input);
    if (!res.ok) {
      return { ok: false as const, error: res.error };
    }
    router.refresh();
    return { ok: true as const };
  }

  return (
    <div className="space-y-6">
      <TopHeader
        title="Agences partenaires"
        description="Annuaire Supabase : les agences créées ici sont proposées à l’étape « Assignation » sur les fiches leads."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-[#182b35] bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] transition-colors hover:bg-[#213e4b]"
          >
            <Plus className="size-4" aria-hidden />
            Nouvelle agence
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="max-w-md flex-1">
          <span className="sr-only">Rechercher</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (ville, destination, email…)"
            className="w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
          />
        </label>
        <p className="text-sm text-muted-foreground">
          {filtered.length} agence{filtered.length > 1 ? "s" : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-panel px-4 py-10 text-center">
          <Building2 className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-foreground">Aucun résultat</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Modifiez la recherche ou créez une agence dans Supabase.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filtered.map((a) => (
            <li
              key={a.id}
              className="flex flex-col rounded-md border border-border bg-panel p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold leading-tight text-foreground">
                    {a.tradeName ?? a.legalName}
                  </p>
                  {a.tradeName ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.legalName}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <span className="rounded-none border border-border bg-panel-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/90">
                    {partnerAgencyStatusLabelFr[a.status]}
                  </span>
                  <AgencyCardMenu agency={a} />
                </div>
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {partnerAgencyTypeLabelFr[a.type]}
              </p>

              <div className="mt-3 space-y-2 text-sm text-foreground/90">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    {a.city}, {a.country}
                  </span>
                </p>
                {a.website ? (
                  <p className="flex items-start gap-2">
                    <Globe2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="break-all">{a.website}</span>
                  </p>
                ) : null}
              </div>

              <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Contact</dt>
                  <dd className="text-right font-medium text-foreground">{a.contactName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all text-right font-medium text-foreground">{a.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Téléphone</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">{a.phone}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">SLA devis</dt>
                  <dd className="text-right font-medium tabular-nums text-foreground">
                    {a.slaQuoteDays} j
                  </dd>
                </div>
              </dl>

              <div className="mt-4 rounded-md border border-border bg-panel-muted/60 p-3 text-sm leading-relaxed text-foreground/90">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Destinations
                </p>
                <p className="mt-1">{a.destinations || "—"}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Segments
                </p>
                <p className="mt-1">{a.segments || "—"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateAgencyModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={handleCreate}
        dataSource="supabase"
      />
    </div>
  );
}
