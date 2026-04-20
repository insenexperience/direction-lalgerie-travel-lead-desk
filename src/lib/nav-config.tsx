import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  FileText,
  Inbox,
  Settings,
  Users,
  Waypoints,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const workNavItems: DashboardNavItem[] = [
  { href: "/inbox", label: "Inbox opérateur", icon: Inbox },
  { href: "/dashboard", label: "Pilotage business", icon: BarChart3 },
  { href: "/leads", label: "Tous les leads", icon: Waypoints },
];

export const resourceNavItems: DashboardNavItem[] = [
  { href: "/agencies", label: "Agences", icon: Building2 },
  { href: "/quotes", label: "Devis", icon: FileText },
  { href: "/users", label: "Équipe", icon: Users },
  { href: "/settings", label: "Réglages", icon: Settings },
];

/** Flat list kept for DashboardMobileNav backward compat */
export const dashboardNavItems: DashboardNavItem[] = [
  ...workNavItems,
  ...resourceNavItems,
];
