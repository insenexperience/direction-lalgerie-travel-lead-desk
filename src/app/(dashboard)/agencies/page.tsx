import { Suspense } from "react";
import { connection } from "next/server";
import { getAgenciesList } from "@/lib/agencies/queries";
import { AgenciesPage } from "@/components/agencies/agencies-page";
import { createClient } from "@/lib/supabase/server";
import type { AgencyListFilters } from "@/lib/agencies/queries";
import type { PartnerAgencyType, PartnerAgencyStatus } from "@/lib/mock-agencies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Agences partenaires — Direction l'Algérie",
};

type PageProps = {
  searchParams: Promise<{ search?: string; status?: string; type?: string }>;
};

async function AgenciesContent({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;

  const filters: AgencyListFilters = {
    search: params.search || undefined,
    status: (params.status as PartnerAgencyStatus) || undefined,
    type: (params.type as PartnerAgencyType) || undefined,
  };

  const supabase = await createClient();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const [agencies, activeRes, consultRes, wonRes] = await Promise.all([
    getAgenciesList(filters),
    supabase.from("agencies").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).not("status", "in", '("declined","quote_received")'),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "won").gte("updated_at", yearStart),
  ]);

  return (
    <AgenciesPage
      agencies={agencies}
      activeCount={activeRes.count ?? 0}
      consultationsCount={consultRes.count ?? 0}
      wonCount={wonRes.count ?? 0}
    />
  );
}

export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-[#6b7a85]">Chargement…</div>}>
      <AgenciesContent {...props} />
    </Suspense>
  );
}
