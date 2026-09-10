import type { User } from "@/lib/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import type { Role } from "@/lib/permissions/roles";

export function canReadAuditViewer(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.AUDIT_LOGS_READ);
}

export function requireAuditViewerAccess(actor: User): void {
  if (!canReadAuditViewer(actor.role)) {
    throw new AuthorizationError();
  }
}
