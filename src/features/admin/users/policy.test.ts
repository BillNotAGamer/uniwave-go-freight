import { describe, expect, it } from "vitest";

import type { Role } from "@/lib/permissions/roles";

import {
  canChangeUserRole,
  canDeactivateUser,
  canManageUsers,
  canManuallyRevokeUserSessions,
  canReactivateUser,
  canSetTemporaryPassword,
  canSoftDeleteUser,
  getAdminUserAccountStatus,
  isLastAdminSensitiveOperation,
  isProductionUserHardDeleteAllowed,
  normalizeOptionalAdminReason,
  shouldRevokeSessionsForUserOperation,
  type AdminUserPolicySubject,
} from "./policy";
import type { AdminUserOperationType } from "./types";

const now = new Date("2026-08-23T00:00:00.000Z");

function user(overrides: Partial<AdminUserPolicySubject> = {}): AdminUserPolicySubject {
  return {
    id: "user-1",
    role: "sale",
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

function actor(role: Role): AdminUserPolicySubject {
  return user({ id: `${role}-actor`, role });
}

describe("admin user management policy", () => {
  it("keeps USERS_MANAGE denied to Sale/Accountant and allowed to Admin", () => {
    expect(canManageUsers("sale")).toBe(false);
    expect(canManageUsers("accountant")).toBe(false);
    expect(canManageUsers("admin")).toBe(true);
  });

  it("derives account status from isActive and deletedAt", () => {
    expect(getAdminUserAccountStatus({
      isActive: true,
      deletedAt: null,
    })).toBe("active");
    expect(getAdminUserAccountStatus({
      isActive: false,
      deletedAt: null,
    })).toBe("inactive");
    expect(getAdminUserAccountStatus({
      isActive: true,
      deletedAt: now,
    })).toBe("deleted");
    expect(getAdminUserAccountStatus({
      isActive: false,
      deletedAt: now,
    })).toBe("deleted");
  });

  it("prohibits production hard delete", () => {
    expect(isProductionUserHardDeleteAllowed()).toBe(false);
  });

  it("blocks Admin self-demotion, self-deactivation, self-delete, and self password reset", () => {
    const admin = actor("admin");

    expect(canChangeUserRole({
      actor: admin,
      target: admin,
      nextRole: "accountant",
      lastAdmin: { activeAdminCount: 2 },
    }).allowed).toBe(false);
    expect(canDeactivateUser({
      actor: admin,
      target: admin,
      lastAdmin: { activeAdminCount: 2 },
    }).allowed).toBe(false);
    expect(canSoftDeleteUser({
      actor: admin,
      target: admin,
      lastAdmin: { activeAdminCount: 2 },
    }).allowed).toBe(false);
    expect(canSetTemporaryPassword({
      actor: admin,
      target: admin,
    }).allowed).toBe(false);
  });

  it("protects the last active non-deleted Admin", () => {
    const admin = actor("admin");
    const target = user({ id: "admin-target", role: "admin" });
    const lastAdmin = { activeAdminCount: 1 };

    expect(canChangeUserRole({
      actor: admin,
      target,
      nextRole: "sale",
      lastAdmin,
    }).allowed).toBe(false);
    expect(canDeactivateUser({ actor: admin, target, lastAdmin }).allowed)
      .toBe(false);
    expect(canSoftDeleteUser({ actor: admin, target, lastAdmin }).allowed)
      .toBe(false);
  });

  it("allows non-last Admin changes when otherwise valid", () => {
    const admin = actor("admin");
    const target = user({ id: "admin-target", role: "admin" });
    const lastAdmin = { activeAdminCount: 2 };

    expect(canChangeUserRole({
      actor: admin,
      target,
      nextRole: "accountant",
      lastAdmin,
    }).allowed).toBe(true);
    expect(canDeactivateUser({ actor: admin, target, lastAdmin }).allowed)
      .toBe(true);
    expect(canSoftDeleteUser({ actor: admin, target, lastAdmin }).allowed)
      .toBe(true);
  });

  it("denies deleted-user mutations and permits inactive role preparation/reactivation", () => {
    const admin = actor("admin");
    const deleted = user({ id: "deleted", deletedAt: now });
    const inactive = user({ id: "inactive", isActive: false });

    expect(canChangeUserRole({
      actor: admin,
      target: deleted,
      nextRole: "accountant",
      lastAdmin: { activeAdminCount: 2 },
    }).allowed).toBe(false);
    expect(canReactivateUser({ actor: admin, target: deleted }).allowed)
      .toBe(false);
    expect(canSetTemporaryPassword({ actor: admin, target: deleted }).allowed)
      .toBe(false);

    expect(canReactivateUser({ actor: admin, target: inactive }).allowed)
      .toBe(true);
    expect(canChangeUserRole({
      actor: admin,
      target: inactive,
      nextRole: "accountant",
      lastAdmin: { activeAdminCount: 2 },
    }).allowed).toBe(true);
    expect(canDeactivateUser({
      actor: admin,
      target: inactive,
      lastAdmin: { activeAdminCount: 2 },
    }).allowed).toBe(false);
  });

  it("marks only role/demotion/deactivation/delete as last-admin sensitive", () => {
    const admin = user({ role: "admin" });

    expect(isLastAdminSensitiveOperation({
      target: admin,
      operation: "role_change",
      nextRole: "sale",
    })).toBe(true);
    expect(isLastAdminSensitiveOperation({
      target: admin,
      operation: "role_change",
      nextRole: "admin",
    })).toBe(false);
    expect(isLastAdminSensitiveOperation({
      target: admin,
      operation: "deactivate",
    })).toBe(true);
    expect(isLastAdminSensitiveOperation({
      target: admin,
      operation: "soft_delete",
    })).toBe(true);
    expect(isLastAdminSensitiveOperation({
      target: admin,
      operation: "password_reset",
    })).toBe(false);
  });

  it("allows manual revoke for active/inactive users but not deleted or self-targeted users", () => {
    const admin = actor("admin");

    expect(canManuallyRevokeUserSessions({
      actor: admin,
      target: user({ isActive: true }),
    }).allowed).toBe(true);
    expect(canManuallyRevokeUserSessions({
      actor: admin,
      target: user({ isActive: false }),
    }).allowed).toBe(true);
    expect(canManuallyRevokeUserSessions({
      actor: admin,
      target: user({ deletedAt: now }),
    }).allowed).toBe(false);
    expect(canManuallyRevokeUserSessions({
      actor: admin,
      target: admin,
    }).allowed).toBe(false);
  });

  it("normalizes optional reasons and defines session revocation matrix", () => {
    expect(normalizeOptionalAdminReason(undefined)).toBeNull();
    expect(normalizeOptionalAdminReason("   ")).toBeNull();
    expect(normalizeOptionalAdminReason("  role prep  ")).toBe("role prep");

    const matrix: Record<AdminUserOperationType, boolean> = {
      create: false,
      role_change: true,
      deactivate: true,
      reactivate: false,
      soft_delete: true,
      password_reset: true,
      manual_revoke_sessions: true,
    };

    for (const [operation, expected] of Object.entries(matrix)) {
      expect(shouldRevokeSessionsForUserOperation(
        operation as AdminUserOperationType,
      )).toBe(expected);
    }
  });
});
