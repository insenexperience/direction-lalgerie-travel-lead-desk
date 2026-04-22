import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/top-header";
import { UserManagement } from "@/components/users/user-management";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, avatar_url")
    .order("full_name");

  type ProfileRow = {
    id: string;
    full_name: string;
    role: "admin" | "lead_referent";
    email: string;
    avatar_url: string | null;
  };

  const rows = (profiles ?? []) as ProfileRow[];
  const currentUserId = user?.id ?? null;
  const currentProfile = rows.find((p) => p.id === currentUserId);
  const isAdmin = currentProfile?.role === "admin";
  const hasAnyAdmin = rows.some((p) => p.role === "admin");

  return (
    <div className="space-y-5">
      <TopHeader title="Équipe & opérateurs" />
      <UserManagement
        profiles={rows}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        hasAnyAdmin={hasAnyAdmin}
      />
    </div>
  );
}
