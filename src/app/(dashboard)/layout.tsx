import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { createClient } from "@/lib/supabase/server";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <DashboardMobileNav />
      <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <SidebarNav />
        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="flex flex-wrap items-center justify-end gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-5 lg:px-8">
            <span className="mr-auto truncate text-sm text-neutral-600">
              {user.email}
            </span>
            <SignOutButton />
          </header>
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
