import type { Role } from "./roles";

export const PERMISSIONS = {
  DASHBOARD_SALE: "dashboard:sale",
  DASHBOARD_ACCOUNTING: "dashboard:accounting",
  SHIPPING_NOTES_WRITE_OWN: "shipping-notes:write-own",
  SHIPPING_NOTES_READ: "shipping-notes:read",
  SHIPPING_NOTES_READ_ACCOUNTING: "shipping-notes:read-accounting",
  SHIPPING_NOTES_READ_BUYING: "shipping-notes:read-buying",
  TAX_RULES_READ: "tax-rules:read",
  TAX_RULES_MANAGE: "tax-rules:manage",
  AUDIT_LOGS_READ: "audit-logs:read",
  USERS_MANAGE: "users:manage",
  REPORTS_VIEW: "reports:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  sale: [
    PERMISSIONS.DASHBOARD_SALE,
    PERMISSIONS.SHIPPING_NOTES_WRITE_OWN,
  ],
  accountant: [
    PERMISSIONS.DASHBOARD_ACCOUNTING,
    PERMISSIONS.SHIPPING_NOTES_READ,
    PERMISSIONS.SHIPPING_NOTES_READ_ACCOUNTING,
    PERMISSIONS.SHIPPING_NOTES_READ_BUYING,
    PERMISSIONS.TAX_RULES_READ,
    PERMISSIONS.REPORTS_VIEW,
  ],
  admin: ALL_PERMISSIONS,
} as const;

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return role === "admin" || ROLE_PERMISSIONS[role].includes(permission);
}
