import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ContactsPageInner } from "@/components/contacts/contacts-page-inner";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contacts — Direction l'Algérie",
};

type PageProps = {
  searchParams: Promise<{ type?: string; search?: string }>;
};

async function ContactsContent({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const typeFilter = params.type === "seeker" ? "seeker" : "traveler";
  const search = params.search ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select(
      "id, type, full_name, email, phone, whatsapp_phone_number, source_lead_id, first_seen_at, last_interaction_at, won_at, lost_at, lost_reason, tags, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (typeFilter) {
    query = query.eq("type", typeFilter);
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data: contacts, error } = await query;

  const [travelersRes, seekersRes] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("type", "traveler"),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("type", "seeker"),
  ]);

  return (
    <ContactsPageInner
      contacts={contacts ?? []}
      error={error?.message ?? null}
      activeType={typeFilter}
      search={search}
      travelersCount={travelersRes.count ?? 0}
      seekersCount={seekersRes.count ?? 0}
    />
  );
}

export default function ContactsPage(props: PageProps) {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-[#6b7a85]">Chargement…</div>}>
      <ContactsContent {...props} />
    </Suspense>
  );
}
