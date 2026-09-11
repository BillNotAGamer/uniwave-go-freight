import {
  ClipboardList,
  Building2,
  FileText,
  LayoutDashboard,
  Package,
  Percent,
  PlusCircle,
  Users,
} from "lucide-react";
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

  links.push({
    title: "Documents",
    href: "/documents",
    icon: FileText,
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

  if (hasPermission(role, PERMISSIONS.TAX_RULES_READ)) {
    links.push({
      title: "Tax Rules",
      href: "/tax-rules",
      icon: Percent,
    });
  }

  if (hasPermission(role, PERMISSIONS.USERS_MANAGE)) {
    links.push({
      title: "Master Data",
      href: "/admin/master-data/partners",
      icon: Building2,
    });

    links.push({
      title: "Users",
      href: "/admin/users",
      icon: Users,
    });
  }

  if (hasPermission(role, PERMISSIONS.AUDIT_LOGS_READ)) {
    links.push({
      title: "Audit",
      href: "/admin/audit",
      icon: ClipboardList,
    });
  }

  return links;
}
