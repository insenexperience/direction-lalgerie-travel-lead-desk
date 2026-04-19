import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Waypoints,
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const dashboardNavItems: DashboardNavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/metrics", label: "Métriques & data", icon: BarChart3 },
  { href: "/leads", label: "Leads", icon: Waypoints },
  { href: "/agencies", label: "Agences", icon: Building2 },
  { href: "/quotes", label: "Devis", icon: FileText },
  { href: "/users", label: "Équipe", icon: Users },
  { href: "/settings", label: "Réglages", icon: Settings },
];
