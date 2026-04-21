import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ContactDetail } from "@/components/contacts/contact-detail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactDetailPage({ params }: PageProps) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select(
      "id, type, full_name, email, phone, whatsapp_phone_number, source_lead_id, first_seen_at, last_interaction_at, won_at, trip_completed_at, traveler_notes, lost_at, lost_reason, tags, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !contact) {
    notFound();
  }

  // Fetch activities from the source lead if linked
  let activities: ActivityRow[] = [];
  let sourceLeadRef: string | null = null;

  if (contact.source_lead_id) {
    const [activitiesRes, leadRes] = await Promise.all([
      supabase
        .from("activities")
        .select("id, kind, detail, created_at, actor_id")
        .eq("lead_id", contact.source_lead_id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("leads")
        .select("reference, traveler_name")
        .eq("id", contact.source_lead_id)
        .single(),
    ]);
    activities = (activitiesRes.data ?? []) as ActivityRow[];
    sourceLeadRef = leadRes.data?.reference ?? null;
  }

  return (
    <ContactDetail
      contact={contact as ContactRow}
      activities={activities}
      sourceLeadRef={sourceLeadRef}
    />
  );
}

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
  trip_completed_at: string | null;
  traveler_notes: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  kind: string;
  detail: string | null;
  created_at: string;
  actor_id: string | null;
};
