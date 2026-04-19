import { createClient } from "@/lib/supabase/server";
import { mapAgencyRowToPartner } from "@/lib/agency-db-mapper";
import { AgenciesPageInner } from "./agencies-page-inner";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export default async function AgenciesPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("agencies")
    .select(
      [
        "id",
        "legal_name",
        "trade_name",
        "type",
        "country",
        "city",
        "website",
        "contact_name",
        "email",
        "phone",
        "destinations",
        "languages",
        "segments",
        "sla_quote_days",
        "status",
        "internal_notes",
        "created_at",
      ].join(", "),
    )
    .order("legal_name", { ascending: true });

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        Impossible de charger les agences : {error.message}
      </div>
    );
  }

  const agencies = (rows ?? []).map((r) =>
    mapAgencyRowToPartner(r as unknown as Record<string, unknown>),
  );

  return <AgenciesPageInner initialAgencies={agencies} />;
}
