import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ProfilePageInner } from "@/components/profile/profile-page-inner";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, activeLeadsRes, closedLeadsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url, bio")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id, reference, traveler_name, status, created_at")
      .eq("referent_id", user.id)
      .not("status", "in", '("won","lost")')
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id, reference, traveler_name, status, created_at")
      .eq("referent_id", user.id)
      .in("status", ["won", "lost"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const profile = profileRes.data as {
    id: string;
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
    bio: string | null;
  } | null;

  type LeadRow = { id: string; reference: string | null; traveler_name: string | null; status: string; created_at: string };
  const activeLeads = (activeLeadsRes.data ?? []) as LeadRow[];
  const closedLeads = (closedLeadsRes.data ?? []) as LeadRow[];

  return (
    <ProfilePageInner
      userId={user.id}
      userEmail={user.email ?? ""}
      fullName={profile?.full_name ?? null}
      role={profile?.role ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      bio={profile?.bio ?? ""}
      activeLeads={activeLeads}
      closedLeads={closedLeads}
    />
  );
}
