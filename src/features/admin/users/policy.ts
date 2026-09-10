import type { Role } from "@/lib/permissions/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

import type {
  AdminUserAccountStatus,
  AdminUserOperationType,
} from "./types";

export type AdminUserPolicySubject = {
  id: string;
  role: Role;
  isActive: boolean;
  deletedAt: Date | null;
};

export type LastAdminContext = {
  activeAdminCount: number;
};

export type AdminUserPolicyDecision = {
  allowed: boolean;
  reason?: string;
};

export function canManageUsers(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.USERS_MANAGE);
}

export function getAdminUserAccountStatus(input: {
  isActive: boolean;
  deletedAt: Date | null;
}): AdminUserAccountStatus {
  if (input.deletedAt) {
    return "deleted";
  }

  return input.isActive ? "active" : "inactive";
}

export function isProductionUserHardDeleteAllowed(): false {
  return false;
}

export function normalizeOptionalAdminReason(
  reason: string | null | undefined,
): string | null {
  if (typeof reason !== "string") {
    return null;
  }

  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeRequiredAdminReason(
  reason: string | null | undefined,
): string | null {
  return normalizeOptionalAdminReason(reason);
}

export function isLastAdminSensitiveOperation(input: {
  target: AdminUserPolicySubject;
  nextRole?: Role;
  operation:
    | "role_change"
    | "deactivate"
    | "soft_delete"
    | "reactivate"
    | "password_reset"
    | "manual_revoke_sessions";
}): boolean {
  if (input.target.role !== "admin") {
    return false;
  }

  if (input.operation === "role_change") {
    return input.nextRole !== undefined && input.nextRole !== "admin";
  }

  return input.operation === "deactivate" || input.operation === "soft_delete";
}

function deny(reason: string): AdminUserPolicyDecision {
  return { allowed: false, reason };
}

function allow(): AdminUserPolicyDecision {
  return { allowed: true };
}

function requireManageUsers(actor: AdminUserPolicySubject): AdminUserPolicyDecision | null {
  return canManageUsers(actor.role)
    ? null
    : deny("Actor cannot manage users.");
}

function requireNotDeleted(target: AdminUserPolicySubject): AdminUserPolicyDecision | null {
  return getAdminUserAccountStatus(target) === "deleted"
    ? deny("Soft-deleted users cannot be modified in the MVP.")
    : null;
}

function requireNotSelf(input: {
  actor: AdminUserPolicySubject;
  target: AdminUserPolicySubject;
  action: string;
}): AdminUserPolicyDecision | null {
  return input.actor.id === input.target.id
    ? deny(`Admin cannot ${input.action} themselves through Admin User Management.`)
    : null;
}

function requireLastAdminInvariant(input: {
  target: AdminUserPolicySubject;
  lastAdmin: LastAdminContext;
  nextRole?: Role;
  operation: "role_change" | "deactivate" | "soft_delete";
}): AdminUserPolicyDecision | null {
  if (
    isLastAdminSensitiveOperation({
      target: input.target,
      nextRole: input.nextRole,
      operation: input.operation,
    }) &&
    input.target.isActive &&
    !input.target.deletedAt &&
    input.lastAdmin.activeAdminCount <= 1
  ) {
    return deny("At least one active non-deleted Admin must remain.");
  }

  return null;
}

export function canChangeUserRole(input: {
  actor: AdminUserPolicySubject;
  target: AdminUserPolicySubject;
  nextRole: Role;
  lastAdmin: LastAdminContext;
}): AdminUserPolicyDecision {
  return requireManageUsers(input.actor) ??
    requireNotDeleted(input.target) ??
    (input.actor.id === input.target.id &&
    input.target.role === "admin" &&
    input.nextRole !== "admin"
      ? deny("Admin cannot demote themselves through Admin User Management.")
      : null) ??
    requireLastAdminInvariant({
      target: input.target,
      nextRole: input.nextRole,
      operation: "role_change",
      lastAdmin: input.lastAdmin,
    }) ??
    allow();
}

export function canDeactivateUser(input: {
  actor: AdminUserPolicySubject;
  target: AdminUserPolicySubject;
  lastAdmin: LastAdminContext;
}): AdminUserPolicyDecision {
  const status = getAdminUserAccountStatus(input.target);

  return requireManageUsers(input.actor) ??
    requireNotDeleted(input.target) ??
    requireNotSelf({
      actor: input.actor,
      target: input.target,
      action: "deactivate",
    }) ??
    (status !== "active" ? deny("Only active users can be deactivated.") : null) ??
    requireLastAdminInvariant({
      target: input.target,
      operation: "deactivate",
      lastAdmin: input.lastAdmin,
    }) ??
    allow();
}

export function canReactivateUser(input: {
  actor: AdminUserPolicySubject;
  target: AdminUserPolicySubject;
}): AdminUserPolicyDecision {
  const status = getAdminUserAccountStatus(input.target);

  return requireManageUsers(input.actor) ??
    requireNotDeleted(input.target) ??
    (status !== "inactive" ? deny("Only inactive users can be reactivated.") : null) ??
    allow();
}

export function canSoftDeleteUser(input: {
  actor: AdminUserPolicySubject;
  target: AdminUserPolicySubject;
  lastAdmin: LastAdminContext;
}): AdminUserPolicyDecision {
  return requireManageUsers(input.actor) ??
    requireNotDeleted(input.target) ??
    requireNotSelf({
      actor: input.actor,
      target: input.target,
      action: "soft-delete",
    }) ??
    requireLastAdminInvariant({
      target: input.target,
      operation: "soft_delete",
      lastAdmin: input.lastAdmin,
    }) ??
    allow();
}

export function canSetTemporaryPassword(input: {
  actor: AdminUserPolicySubject;
  target: AdminUserPolicySubject;
}): AdminUserPolicyDecision {
  return requireManageUsers(input.actor) ??
    requireNotDeleted(input.target) ??
    requireNotSelf({
      actor: input.actor,
      target: input.target,
      action: "reset their own password",
    }) ??
    allow();
}

export function canManuallyRevokeUserSessions(input: {
  actor: AdminUserPolicySubject;
  target: AdminUserPolicySubject;
}): AdminUserPolicyDecision {
  const status = getAdminUserAccountStatus(input.target);

  return requireManageUsers(input.actor) ??
    requireNotSelf({
      actor: input.actor,
      target: input.target,
      action: "manually revoke their own sessions",
    }) ??
    (status === "deleted"
      ? deny("Manual session revocation is not exposed for soft-deleted users in the MVP.")
      : null) ??
    allow();
}

export function shouldRevokeSessionsForUserOperation(
  operation: AdminUserOperationType,
): boolean {
  switch (operation) {
    case "create":
    case "reactivate":
      return false;
    case "role_change":
    case "deactivate":
    case "soft_delete":
    case "password_reset":
    case "manual_revoke_sessions":
      return true;
  }
}
