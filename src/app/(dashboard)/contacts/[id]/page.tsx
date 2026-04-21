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

  const { data: rawContact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!rawContact) {
    notFound();
  }

  const contact = rawContact as unknown as ContactRow;

  let activities: ActivityRow[] = [];
  let sourceLead: SourceLeadRow | null = null;

  if (contact.source_lead_id) {
    const [activitiesRes, leadRes] = await Promise.all([
      supabase
        .from("activities")
        .select("id, kind, detail, created_at, actor_id")
        .eq("lead_id", contact.source_lead_id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("leads")
        .select(
          "id, reference, traveler_name, trip_summary, travel_style, travelers, " +
          "budget, trip_dates, retained_agency_id, status, source",
        )
        .eq("id", contact.source_lead_id)
        .maybeSingle(),
    ]);
    activities = (activitiesRes.data ?? []) as ActivityRow[];
    sourceLead = leadRes.data as SourceLeadRow | null;
  }

  return (
    <ContactDetail
      contact={contact}
      activities={activities}
      sourceLead={sourceLead}
    />
  );
}

export type ContactRow = {
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
  project_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type SourceLeadRow = {
  id: string;
  reference: string | null;
  traveler_name: string | null;
  trip_summary: string | null;
  travel_style: string | null;
  travelers: string | null;
  budget: string | null;
  trip_dates: string | null;
  retained_agency_id: string | null;
  status: string;
  source: string | null;
};

export type ActivityRow = {
  id: string;
  kind: string;
  detail: string | null;
  created_at: string;
  actor_id: string | null;
};
