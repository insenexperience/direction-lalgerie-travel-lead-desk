"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogoBlock } from "@/components/brand-logo-block";
import { dashboardNavItems } from "@/lib/nav-config";

export function DashboardMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#0f1c24] to-[#182b35] px-4 py-3 lg:hidden">
        <BrandLogoBlock variant="compact" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-white/35 bg-white/5 text-[#F3F7FA] transition-colors hover:bg-white/10"
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          aria-label="Ouvrir le menu"
        >
          <span className="sr-only">Menu</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" id="mobile-nav-drawer">
          <button
            type="button"
            className="absolute inset-0 bg-[#0b1419]/55 backdrop-blur-[2px]"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
          />
          <nav
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-border bg-panel shadow-[0_0_0_1px_rgba(24,43,53,0.06)]"
            aria-label="Navigation principale"
          >
            <BrandLogoBlock variant="drawer" />
            <div className="flex items-center justify-between border-b border-border bg-panel px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-border text-foreground/80 transition-colors hover:bg-panel-muted"
                aria-label="Fermer le menu"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-1">
                {dashboardNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
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
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="border-t border-border px-4 py-3 text-xs leading-snug text-muted-foreground">
              Interface unique voyageur ↔ Direction l&apos;Algérie.
            </p>
          </nav>
        </div>
      ) : null}
    </>
  );
}
