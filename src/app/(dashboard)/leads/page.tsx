import { Suspense } from "react";
import Link from "next/link";
import { Kanban, LayoutList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LeadsListServer } from "@/components/leads/leads-list-server";
import { LeadsPageInner } from "@/app/(dashboard)/leads/leads-page-inner";

export const dynamic = "force-dynamic";

type LeadsPageProps = {
  searchParams: Promise<{ status?: string; view?: string }>;
};

async function loadReferents() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email");
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    if (r.id) map[r.id] = (r.full_name as string) || (r.email as string) || r.id;
  });
  return map;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const view = params.view === "kanban" ? "kanban" : "list";
  const status = params.status;

  const referentMap = await loadReferents();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[19px] font-semibold text-[#0e1a21]">Tous les leads</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-[6px] border border-[#e4e8eb] bg-white">
            <Link
              href={`/leads${status ? `?status=${status}` : ""}`}
              className={[
                "flex items-center gap-1.5 rounded-l-[5px] px-3 py-1.5 text-[12px] font-medium transition-colors",
                view === "list" ? "bg-[#15323f] text-white" : "text-[#6b7a85] hover:bg-[#f6f7f8]",
              ].join(" ")}
              aria-label="Vue liste"
            >
              <LayoutList className="h-3.5 w-3.5" aria-hidden />
              Liste
            </Link>
            <Link
              href={`/leads?view=kanban${status ? `&status=${status}` : ""}`}
              className={[
                "flex items-center gap-1.5 rounded-r-[5px] px-3 py-1.5 text-[12px] font-medium transition-colors",
                view === "kanban" ? "bg-[#15323f] text-white" : "text-[#6b7a85] hover:bg-[#f6f7f8]",
              ].join(" ")}
              aria-label="Vue Kanban"
            >
              <Kanban className="h-3.5 w-3.5" aria-hidden />
              Kanban
            </Link>
          </div>
        </div>
      </div>

      {view === "kanban" ? (
        // Existing Kanban (keeps demo context)
        <Suspense fallback={<div className="h-64 animate-pulse rounded-[8px] bg-[#f4f7fa]" />}>
          <LeadsPageInner />
        </Suspense>
      ) : (
        // New server-rendered list
        <Suspense fallback={<div className="h-64 animate-pulse rounded-[8px] bg-[#f4f7fa]" />}>
          <LeadsListServer status={status} referentMap={referentMap} />
        </Suspense>
      )}
    </div>
  );
}
