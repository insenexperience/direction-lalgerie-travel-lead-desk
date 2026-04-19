"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogoBlock } from "@/components/brand-logo-block";
import { GlobalSearch } from "@/components/global-search";
import { dashboardNavItems } from "@/lib/nav-config";

export function SidebarNav() {
  const currentPath = usePathname();

  return (
    <aside className="hidden w-full flex-col border-b border-border bg-panel lg:sticky lg:top-0 lg:flex lg:max-h-[100dvh] lg:w-72 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-0">
      <BrandLogoBlock variant="sidebar" />

      <div className="flex flex-1 flex-col px-5 py-6">
        <div className="mb-4 hidden lg:block">
          <GlobalSearch />
        </div>
        <nav className="flex flex-col gap-2">
          {dashboardNavItems.map((item) => {
            const isActive = currentPath === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-none border px-4 py-3 text-sm font-semibold transition-colors duration-150",
                  isActive
                    ? "border-[#182b35] bg-[#182b35]"
                    : "border-transparent bg-panel-muted hover:border-border hover:bg-panel",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "size-[1.125rem] shrink-0",
                    isActive ? "text-[#f3f7fa]" : "text-muted-foreground",
                  ].join(" ")}
                  aria-hidden
                />
                <span
                  className={
                    isActive ? "text-[#f3f7fa]" : "text-foreground/90"
                  }
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-md border border-border bg-panel-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rappel
          </p>
          <p className="mt-2 text-sm leading-snug text-foreground/85">
            Interface unique voyageur ↔ Direction l&apos;Algérie.
          </p>
        </div>
      </div>
    </aside>
  );
}
