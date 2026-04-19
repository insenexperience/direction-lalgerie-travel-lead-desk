import { mapDbLeadRowsToMocks } from "@/lib/supabase-lead-mapper";
import { createClient } from "@/lib/supabase/server";
import { MetricsPageInner } from "./metrics-page-inner";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function MetricsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("*");
  const leads = mapDbLeadRowsToMocks(data ?? []);

  return <MetricsPageInner leads={leads} />;
}
