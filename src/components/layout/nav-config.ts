import {
  LayoutDashboard,
  Users,
  Banknote,
  CalendarClock,
  Wallet,
  Coins,
  FileBarChart,
  UserCog,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLE_RANK } from "@/lib/rbac";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  minRole?: Role; // minimum role required to see the item
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Lending",
    items: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Loans", href: "/loans", icon: Banknote },
      { label: "EMI Schedule", href: "/emi", icon: CalendarClock },
      { label: "Collections", href: "/collections", icon: Wallet },
    ],
  },
  {
    title: "Insights",
    items: [{ label: "Reports", href: "/reports", icon: FileBarChart }],
  },
  {
    title: "Administration",
    items: [
      { label: "Cash", href: "/cash", icon: Coins, minRole: "ADMIN" },
      { label: "Team", href: "/admin/agents", icon: UserCog, minRole: "ADMIN" },
      { label: "Activity Logs", href: "/admin/activity", icon: ScrollText, minRole: "ADMIN" },
      { label: "PDF Settings", href: "/settings", icon: Settings, minRole: "ADMIN" },
    ],
  },
];

export function visibleSections(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.minRole || ROLE_RANK[role] >= ROLE_RANK[item.minRole],
    ),
  })).filter((section) => section.items.length > 0);
}
