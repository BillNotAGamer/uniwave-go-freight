import type { ShippingNoteStatus } from "../constants";
import type { Role } from "@/lib/permissions/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

/**
 * Customs Declarations read permission:
 * Only Accountant and Admin can query or view customs declarations.
 * Sale has no access to customs declarations.
 */
export function canReadCustomsDeclarations(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.ACCOUNTING_READ);
}

/**
 * Mutable statuses for Customs Declarations add/remove:
 * submitted, accounting_reviewing
 */
export function isCustomsMutableStatus(status: ShippingNoteStatus): boolean {
  return status === "submitted" || status === "accounting_reviewing";
}

/**
 * Customs Declarations manage permission:
 * Only Accountant and Admin can add/remove declarations,
 * and only when the shipping note status is submitted or accounting_reviewing.
 */
export function canManageCustomsDeclarations(input: {
  role: Role;
  status: ShippingNoteStatus;
}): boolean {
  return (
    hasPermission(input.role, PERMISSIONS.BUYING_CHARGES_MANAGE) &&
    isCustomsMutableStatus(input.status)
  );
}
