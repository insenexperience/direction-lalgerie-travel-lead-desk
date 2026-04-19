import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardPageInner, type DashboardKpis } from "./dashboard-page-inner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadKpis(): Promise<DashboardKpis> {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      newLeads: 0,
      inQualification: 0,
      consultations: 0,
      quotesOpen: 0,
    };
  }

  const [newLeads, inQualification, consultations, quotesOpen] =
    await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("status", "qualification"),
      supabase.from("consultations").select("*", { count: "exact", head: true }),
      supabase.from("quotes").select("*", { count: "exact", head: true }),
    ]);

  return {
    newLeads: newLeads.count ?? 0,
    inQualification: inQualification.count ?? 0,
    consultations: consultations.count ?? 0,
    quotesOpen: quotesOpen.count ?? 0,
  };
}

export default async function DashboardPage() {
  const kpis = await loadKpis();
  return <DashboardPageInner kpis={kpis} />;
}
