import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { Topbar } from "@/components/topbar";
import { createClient } from "@/lib/supabase/server";

type DashboardLayoutProps = {
  children: ReactNode;
};

async function loadLayoutData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, inboxCountRes, leadsCountRes] = await Promise.all([
    supabase.from("profiles").select("full_name, role, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("won","lost")'),
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("won","lost")'),
  ]);

  const profile = profileRes.data as { full_name?: string; role?: string; avatar_url?: string | null } | null;
  return {
    user,
    userName: profile?.full_name ?? undefined,
    userRole: profile?.role ?? undefined,
    avatarUrl: profile?.avatar_url ?? null,
    inboxCount: inboxCountRes.count ?? 0,
    leadsCount: leadsCountRes.count ?? 0,
  };
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const data = await loadLayoutData();
  if (!data) redirect("/login");

  const { user, userName, userRole, avatarUrl, inboxCount, leadsCount } = data;

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <DashboardMobileNav />
      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <SidebarNav
          inboxCount={inboxCount}
          leadsCount={leadsCount}
          userEmail={user.email}
          userName={userName}
          userRole={userRole}
          avatarUrl={avatarUrl}
        />
        <div className="flex min-h-screen min-w-0 flex-col">
          <Topbar userEmail={user.email} userName={userName} avatarUrl={avatarUrl} />
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
