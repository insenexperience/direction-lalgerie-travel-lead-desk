"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; traveler_name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (query: string) => {
    const t = query.trim();
    if (t.length < 2) {
      setRows([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const like = `%${t.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const [n, e, p] = await Promise.all([
      supabase.from("leads").select("id, traveler_name").ilike("traveler_name", like).limit(10),
      supabase.from("leads").select("id, traveler_name").ilike("email", like).limit(10),
      supabase.from("leads").select("id, traveler_name").ilike("phone", like).limit(10),
    ]);

    setLoading(false);
    const seen = new Set<string>();
    const merged: { id: string; traveler_name: string }[] = [];
    for (const res of [n, e, p]) {
      if (res.error) continue;
      for (const row of res.data ?? []) {
        const id = String(row.id);
        if (seen.has(id)) continue;
        seen.add(id);
        merged.push({
          id,
          traveler_name: String(row.traveler_name ?? ""),
        });
        if (merged.length >= 10) break;
      }
      if (merged.length >= 10) break;
    }
    setRows(merged);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void runSearch(q);
    }, 200);
    return () => window.clearTimeout(id);
  }, [q, runSearch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden rounded-md border border-border bg-panel-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground lg:inline-flex"
      >
        Recherche <kbd className="ml-2 rounded border border-border px-1">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[12vh]">
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-panel p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, email, téléphone…"
          className="w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
        />
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {loading ? (
            <li className="text-sm text-muted-foreground">Recherche…</li>
          ) : rows.length ? (
            rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/leads/${r.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 text-sm font-medium hover:bg-panel-muted"
                >
                  {r.traveler_name || r.id.slice(0, 8)}
                </Link>
              </li>
            ))
          ) : q.trim().length >= 2 ? (
            <li className="text-sm text-muted-foreground">Aucun résultat.</li>
          ) : (
            <li className="text-sm text-muted-foreground">Tapez au moins 2 caractères.</li>
          )}
        </ul>
        <button
          type="button"
          className="mt-3 w-full rounded-md border border-border py-2 text-sm font-semibold text-muted-foreground hover:bg-panel-muted"
          onClick={() => setOpen(false)}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
