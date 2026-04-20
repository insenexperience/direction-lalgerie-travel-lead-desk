"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogoBlock } from "@/components/brand-logo-block";
import { workNavItems, resourceNavItems } from "@/lib/nav-config";
import { Avatar } from "@/components/ui/avatar";

type SidebarNavProps = {
  inboxCount?: number;
  leadsCount?: number;
  userEmail?: string;
  userName?: string;
  userRole?: string;
};

const badges: Record<string, number | undefined> = {};

export function SidebarNav({
  inboxCount,
  leadsCount,
  userEmail,
  userName,
  userRole,
}: SidebarNavProps) {
  const currentPath = usePathname();

  const navBadge: Record<string, number | undefined> = {
    "/inbox": inboxCount,
    "/leads": leadsCount,
  };

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }) {
    const isActive = currentPath === href || (href !== "/inbox" && href !== "/dashboard" && currentPath.startsWith(href));
    const count = navBadge[href];
    return (
      <Link
        href={href}
        className={[
          "group flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[13px] font-medium transition-colors duration-100",
          isActive
            ? "bg-[#15323f] text-[#f3f7fa]"
            : "text-[#3a4a55] hover:bg-[#f0f2f4] hover:text-[#0e1a21]",
        ].join(" ")}
      >
        <Icon
          className={`h-[1.05rem] w-[1.05rem] shrink-0 ${isActive ? "text-[#f3f7fa]" : "text-[#6b7a85] group-hover:text-[#3a4a55]"}`}
          aria-hidden
        />
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums ${
              isActive ? "bg-white/20 text-white" : "bg-[#e4e8eb] text-[#6b7a85]"
            }`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    );
  }

  const displayName = userName || userEmail || "Utilisateur";
  const roleLabel = userRole === "admin" ? "Admin" : userRole === "lead_referent" ? "Référent" : userRole ?? "";

  return (
    <aside className="hidden w-full flex-col border-r border-[#e4e8eb] bg-white lg:sticky lg:top-0 lg:flex lg:max-h-[100dvh] lg:w-[17rem] lg:shrink-0 lg:self-start lg:overflow-y-auto">
      <BrandLogoBlock variant="sidebar" />

      <div className="flex flex-1 flex-col gap-6 px-4 py-5">
        {/* Section 1 — Travail du jour */}
        <nav aria-label="Travail du jour">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">
            Travail du jour
          </p>
          <div className="flex flex-col gap-0.5">
            {workNavItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>

        {/* Section 2 — Ressources */}
        <nav aria-label="Ressources">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">
            Ressources
          </p>
          <div className="flex flex-col gap-0.5">
            {resourceNavItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        </nav>
      </div>

      {/* Footer — user info */}
      {userEmail && (
        <div className="border-t border-[#e4e8eb] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={displayName} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-[#0e1a21]">{displayName}</p>
              {roleLabel && (
                <p className="text-[11px] text-[#6b7a85]">{roleLabel}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
