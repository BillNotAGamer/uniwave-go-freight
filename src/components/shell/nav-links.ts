import { Package, PlusCircle, LayoutDashboard } from "lucide-react";
import type { Role } from "@/lib/permissions/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
};

export function getNavLinks(role: Role): NavItem[] {
  const links: NavItem[] = [];

  // Everyone who reaches dashboard gets shipping notes
  links.push({
    title: "Shipping Notes",
    href: "/shipping-notes",
    icon: Package,
  });

  if (hasPermission(role, PERMISSIONS.SHIPPING_NOTES_CREATE_OWN)) {
    links.push({
      title: "New Note",
      href: "/shipping-notes/new",
      icon: PlusCircle,
    });
  }
  
  if (hasPermission(role, PERMISSIONS.FINANCIAL_SUMMARY_READ)) {
    links.push({
      title: "Accounting",
      href: "/dashboard", // Currently /dashboard is just a generic landing, but keeping this simple
      icon: LayoutDashboard,
    });
  }

  return links;
}
