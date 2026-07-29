import type { Role } from "./roles";

export const PERMISSIONS = {
  DASHBOARD_SALE_ACCESS: "dashboard:sale-access",
  DASHBOARD_ACCOUNTING_ACCESS: "dashboard:accounting-access",
  SHIPPING_NOTES_CREATE_OWN: "shipping-notes:create-own",
  SHIPPING_NOTES_EDIT_OWN: "shipping-notes:edit-own",
  SHIPPING_NOTES_READ_ALL: "shipping-notes:read-all",
  SHIPPING_NOTES_ACCOUNTING_REVIEW: "shipping-notes:accounting-review",
  SHIPPING_NOTES_MARK_CHECKED: "shipping-notes:mark-checked",
  ACCOUNTING_READ: "accounting:read",
  BUYING_CHARGES_READ: "buying-charges:read",
  BUYING_CHARGES_MANAGE: "buying-charges:manage",
  FINANCIAL_SUMMARY_READ: "financial-summary:read",
  NET_PROFIT_READ: "net-profit:read",
  TAX_RULES_READ: "tax-rules:read",
  TAX_RULES_MANAGE: "tax-rules:manage",
  CHARGE_TAX_ASSIGN: "charge-tax:assign",
  CHARGE_TAX_OVERRIDE: "charge-tax:override",
  TAX_SUMMARY_READ: "tax-summary:read",
  AUDIT_LOGS_READ: "audit-logs:read",
  USERS_MANAGE: "users:manage",
  ADMIN_DESTRUCTIVE_ACTIONS: "admin:destructive-actions",
  EXPORTS_GENERATE: "exports:generate",
  EXPORTS_UPLOAD: "exports:upload",
  SHIPPING_NOTES_EXPORT_INTERNAL: "shipping-notes:export-internal",
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
    PERMISSIONS.SHIPPING_NOTES_ACCOUNTING_REVIEW,
    PERMISSIONS.SHIPPING_NOTES_MARK_CHECKED,
    PERMISSIONS.ACCOUNTING_READ,
    PERMISSIONS.BUYING_CHARGES_READ,
    PERMISSIONS.BUYING_CHARGES_MANAGE,
    PERMISSIONS.FINANCIAL_SUMMARY_READ,
    PERMISSIONS.NET_PROFIT_READ,
    PERMISSIONS.TAX_RULES_READ,
    PERMISSIONS.CHARGE_TAX_ASSIGN,
    PERMISSIONS.CHARGE_TAX_OVERRIDE,
    PERMISSIONS.TAX_SUMMARY_READ,
    PERMISSIONS.EXPORTS_GENERATE,
    PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL,
  ],
  admin: ALL_PERMISSIONS,
} as const;

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return role === "admin" || ROLE_PERMISSIONS[role].includes(permission);
}
