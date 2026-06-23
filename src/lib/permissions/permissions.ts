import type { Role } from "./roles";

export const PERMISSIONS = {
  DASHBOARD_SALE_ACCESS: "dashboard:sale-access",
  DASHBOARD_ACCOUNTING_ACCESS: "dashboard:accounting-access",
  SHIPPING_NOTES_CREATE_OWN: "shipping-notes:create-own",
  SHIPPING_NOTES_EDIT_OWN: "shipping-notes:edit-own",
  SHIPPING_NOTES_READ_ALL: "shipping-notes:read-all",
  ACCOUNTING_READ: "accounting:read",
  BUYING_CHARGES_READ: "buying-charges:read",
  NET_PROFIT_READ: "net-profit:read",
  TAX_RULES_READ: "tax-rules:read",
  TAX_RULES_MANAGE: "tax-rules:manage",
  AUDIT_LOGS_READ: "audit-logs:read",
  USERS_MANAGE: "users:manage",
  ADMIN_DESTRUCTIVE_ACTIONS: "admin:destructive-actions",
  EXPORTS_GENERATE: "exports:generate",
  EXPORTS_UPLOAD: "exports:upload",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  sale: [
    PERMISSIONS.DASHBOARD_SALE_ACCESS,
    PERMISSIONS.SHIPPING_NOTES_CREATE_OWN,
    PERMISSIONS.SHIPPING_NOTES_EDIT_OWN,
  ],
  accountant: [
    PERMISSIONS.DASHBOARD_ACCOUNTING_ACCESS,
    PERMISSIONS.SHIPPING_NOTES_READ_ALL,
    PERMISSIONS.ACCOUNTING_READ,
    PERMISSIONS.BUYING_CHARGES_READ,
    PERMISSIONS.NET_PROFIT_READ,
    PERMISSIONS.TAX_RULES_READ,
    PERMISSIONS.TAX_RULES_MANAGE,
    PERMISSIONS.EXPORTS_GENERATE,
  ],
  admin: ALL_PERMISSIONS,
} as const;

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return role === "admin" || ROLE_PERMISSIONS[role].includes(permission);
}
