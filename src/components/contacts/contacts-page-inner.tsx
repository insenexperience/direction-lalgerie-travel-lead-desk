"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserCheck, UserX, Users, ArrowRight, Search } from "lucide-react";
import { useTransition, useRef } from "react";

type ContactRow = {
  id: string;
  type: "traveler" | "seeker";
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone_number: string | null;
  source_lead_id: string | null;
  first_seen_at: string;
  last_interaction_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  tags: string[] | null;
  created_at: string;
};

type ContactsPageInnerProps = {
  contacts: ContactRow[];
  error: string | null;
  activeType: "traveler" | "seeker";
  search: string;
  travelersCount: number;
  seekersCount: number;
};

export function ContactsPageInner({
  contacts,
  error,
  activeType,
  search,
  travelersCount,
  seekersCount,
}: ContactsPageInnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  function switchType(type: "traveler" | "seeker") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    params.delete("search");
    startTransition(() => {
      router.push(`/contacts?${params.toString()}`);
    });
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchRef.current?.value ?? "";
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("search", q);
    else params.delete("search");
    router.push(`/contacts?${params.toString()}`);
  }

  const dateLabel = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[19px] font-semibold text-[#0e1a21]">Contacts</h1>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-1.5 text-sm font-medium text-foreground hover:bg-panel-muted"
        >
          Tous les leads
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-0 border-b border-border">
        <button
          type="button"
          onClick={() => switchType("traveler")}
          className={[
            "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeType === "traveler"
              ? "border-[var(--steel)] text-[var(--steel)]"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <UserCheck className="size-4" aria-hidden />
          Voyageurs
          <span className="ml-0.5 rounded-full bg-panel-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {travelersCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => switchType("seeker")}
          className={[
            "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeType === "seeker"
              ? "border-[var(--steel)] text-[var(--steel)]"
              : "border-transparent text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <UserX className="size-4" aria-hidden />
          Prospects perdus
          <span className="ml-0.5 rounded-full bg-panel-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {seekersCount}
          </span>
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Nom, email, téléphone…"
            className="w-full rounded-md border border-border bg-panel py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-steel/30"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-border bg-panel px-3 py-2 text-sm font-medium text-foreground hover:bg-panel-muted"
        >
          Rechercher
        </button>
      </form>

      {/* Error */}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {/* Empty state */}
      {contacts.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="size-8 text-muted-foreground/50" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Aucun contact</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeType === "traveler"
                ? "Les voyageurs apparaissent ici une fois un lead passé à « Gagné »."
                : "Les prospects perdus apparaissent ici une fois un lead passé à « Perdu »."}
            </p>
          </div>
        </div>
      ) : null}

      {/* List */}
      {contacts.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-panel-muted/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 hidden md:table-cell">Téléphone</th>
                <th className="px-4 py-3 hidden lg:table-cell">
                  {activeType === "traveler" ? "Date voyage validé" : "Date perdu"}
                </th>
                <th className="px-4 py-3 hidden lg:table-cell">Tags</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-panel-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${c.id}`} className="font-medium text-foreground hover:text-[var(--steel)]">
                      {c.full_name}
                    </Link>
                    {c.source_lead_id ? (
                      <Link
                        href={`/leads/${c.source_lead_id}`}
                        className="ml-2 text-[10px] text-muted-foreground hover:text-[var(--steel)]"
                      >
                        → lead
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {c.phone ?? c.whatsapp_phone_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {activeType === "traveler" ? dateLabel(c.won_at) : dateLabel(c.lost_at)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border bg-panel-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="inline-flex items-center rounded border border-border bg-panel-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-panel"
                    >
                      <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
