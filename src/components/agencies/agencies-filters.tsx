"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { useCallback } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "Tous" },
  { value: "active", label: "Actives" },
  { value: "pending_validation", label: "En validation" },
  { value: "suspended", label: "Suspendues" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Tous types" },
  { value: "dmc", label: "DMC" },
  { value: "travel_agency", label: "Agence" },
  { value: "tour_operator", label: "TO" },
  { value: "other", label: "Autre" },
];

export function AgenciesFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const type   = params.get("type") ?? "";

  const hasActiveFilters = search || status || type;

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const reset = () => router.push(pathname);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
      {/* Search */}
      <div className="relative flex min-w-[200px] flex-1 items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#9aa7b0]" aria-hidden />
        <input
          type="text"
          placeholder="Nom, pays, destinations…"
          value={search}
          onChange={(e) => update("search", e.target.value)}
          className="w-full rounded-[6px] border border-[#e4e8eb] bg-[#f6f7f8] py-1.5 pl-8 pr-3 text-[13px] text-[#0e1a21] placeholder:text-[#9aa7b0] focus:border-[#15323f] focus:outline-none"
        />
      </div>

      {/* Status chips */}
      <div className="flex gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update("status", opt.value)}
            className={[
              "rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-colors",
              status === opt.value
                ? "border-[#15323f] bg-[#15323f] text-white"
                : "border-[#e4e8eb] text-[#3a4a55] hover:bg-[#f6f7f8]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Type chips */}
      <div className="flex gap-1">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update("type", opt.value)}
            className={[
              "rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-colors",
              type === opt.value
                ? "border-[#15323f] bg-[#15323f] text-white"
                : "border-[#e4e8eb] text-[#3a4a55] hover:bg-[#f6f7f8]",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[12px] text-[#6b7a85] hover:text-[#0e1a21] transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
