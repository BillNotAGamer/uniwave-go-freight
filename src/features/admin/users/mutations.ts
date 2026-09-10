import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import {
  buildCredentialAccountValues,
  CREDENTIAL_PROVIDER_ID,
  hashCredentialPassword,
} from "@/lib/auth/credentials";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { db } from "@/lib/db/client";
import {
  accounts,
  sessions,
  users,
  type User as DbUser,
} from "@/lib/db/schema";
import type { Role } from "@/lib/permissions/roles";

import {
  canChangeUserRole,
  canDeactivateUser,
  canManageUsers,
  canManuallyRevokeUserSessions,
  canReactivateUser,
  canSetTemporaryPassword,
  canSoftDeleteUser,
  isLastAdminSensitiveOperation,
  normalizeOptionalAdminReason,
} from "./policy";
import type { AdminUserPolicySubject } from "./policy";
import {
  changeUserRoleInputSchema,
  createAdminUserInputSchema,
  deactivateUserInputSchema,
  reactivateUserInputSchema,
  revokeUserSessionsInputSchema,
  setTemporaryPasswordInputSchema,
  softDeleteUserInputSchema,
  type ChangeUserRoleInput,
  type CreateAdminUserInput,
  type DeactivateUserInput,
  type ReactivateUserInput,
  type RevokeUserSessionsInput,
  type SetTemporaryPasswordInput,
  type SoftDeleteUserInput,
} from "./validators";
import {
  ADMIN_USER_MANAGEMENT_ERROR_CODES,
  AdminUserManagementError,
} from "./errors";

type AdminUserMutationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

type AdminUserMutationSubject = Pick<
  DbUser,
  | "id"
  | "name"
  | "email"
  | "role"
  | "isActive"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

export type AdminManagedUserResult = AdminUserMutationSubject;

export type AdminUserLifecycleResult = {
  user: AdminManagedUserResult;
  revokedSessionCount: number;
};

export type AdminUserSessionRevocationResult = {
  targetUserId: string;
  revokedSessionCount: number;
};

export type AdminUserPasswordResetResult = {
  targetUserId: string;
  revokedSessionCount: number;
};

const adminUserMutationColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
} as const;

function toPolicySubject(user: AdminUserMutationSubject): AdminUserPolicySubject {
  return {
    id: user.id,
    role: user.role,
    isActive: user.isActive,
    deletedAt: user.deletedAt,
  };
}

function requireActiveManager(actor: DbUser): AdminUserPolicySubject {
  const activeActor = rejectInactiveOrSoftDeletedUsers(actor);

  if (!activeActor || !canManageUsers(activeActor.role)) {
    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
      "User management is restricted to active Admin users.",
    );
  }

  return toPolicySubject(activeActor);
}

function assertPolicyAllowed(input: {
  allowed: boolean;
  reason?: string;
}): void {
  if (input.allowed) {
    return;
  }

  const reason = input.reason ?? "User lifecycle operation is not allowed.";

  if (reason.includes("themselves")) {
    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
      reason,
    );
  }

  if (reason.includes("At least one active non-deleted Admin")) {
    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_LAST_ADMIN_PROTECTED,
      reason,
    );
  }

  if (reason.includes("additional") && reason.includes("Admin")) {
    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ADMIN_UNIQUENESS_PROTECTED,
      reason,
    );
  }

  if (reason.includes("Actor cannot manage users")) {
    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
      reason,
    );
  }

  throw new AdminUserManagementError(
    ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
    reason,
  );
}

function toUserAuditSnapshot(user: AdminUserMutationSubject) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    deletedAt: user.deletedAt,
  };
}

function toLifecycleStateSnapshot(
  user: Pick<AdminUserMutationSubject, "role" | "isActive" | "deletedAt">,
) {
  return {
    role: user.role,
    isActive: user.isActive,
    deletedAt: user.deletedAt,
  };
}

async function lockActiveAdminRows(
  tx: AdminUserMutationTransaction,
): Promise<void> {
  await tx.execute(sql`
    select id
    from ${users}
    where role = 'admin'
      and is_active = true
      and deleted_at is null
    order by id
    for update
  `);
}

async function lockTargetUserRow(
  tx: AdminUserMutationTransaction,
  targetUserId: string,
): Promise<void> {
  await tx.execute(sql`
    select id
    from ${users}
    where id = ${targetUserId}
    for update
  `);
}

async function loadTargetUser(
  tx: AdminUserMutationTransaction,
  targetUserId: string,
): Promise<AdminUserMutationSubject> {
  const [target] = await tx
    .select(adminUserMutationColumns)
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!target) {
    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_NOT_FOUND,
      "User was not found.",
    );
  }

  return target;
}

async function countActiveAdmins(
  tx: AdminUserMutationTransaction,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        eq(users.role, "admin"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  return Number(row?.count ?? 0);
}

async function revokeUserSessions(
  tx: AdminUserMutationTransaction,
  targetUserId: string,
): Promise<number> {
  const revoked = await tx
    .delete(sessions)
    .where(eq(sessions.userId, targetUserId))
    .returning({ id: sessions.id });

  return revoked.length;
}

function isPostgresUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  // Drizzle/Neon may preserve the PostgreSQL error as `cause` rather than
  // exposing its SQLSTATE on the transaction error itself.
  while (typeof current === "object" && current !== null) {
    if ("code" in current && (current as { code?: unknown }).code === "23505") {
      return true;
    }

    current = "cause" in current
      ? (current as { cause?: unknown }).cause
      : undefined;
  }

  return false;
}

function isCredentialCreationError(error: unknown): boolean {
  return error instanceof AdminUserManagementError &&
    error.code === ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_CREATION_FAILED;
}

export async function createAdminManagedUser(
  input: CreateAdminUserInput,
  actor: DbUser,
): Promise<AdminManagedUserResult> {
  const activeActor = requireActiveManager(actor);
  const parsedInput = createAdminUserInputSchema.parse(input);
  const passwordHash = await hashCredentialPassword(parsedInput.temporaryPassword);

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name: parsedInput.name,
          email: parsedInput.email,
          role: parsedInput.role,
          isActive: true,
          deletedAt: null,
          emailVerified: false,
        })
        .returning(adminUserMutationColumns);

      if (!created) {
        throw new AdminUserManagementError(
          ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
          "User could not be created.",
        );
      }

      try {
        await tx
          .insert(accounts)
          .values(buildCredentialAccountValues({
            userId: created.id,
            passwordHash,
          }));
      } catch {
        throw new AdminUserManagementError(
          ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_CREATION_FAILED,
          "Credential account could not be created.",
        );
      }

      await logAuditEvent(tx, {
        actorUserId: activeActor.id,
        action: "user.create",
        entityType: "user",
        entityId: created.id,
        after: toUserAuditSnapshot(created),
        reason: null,
      });

      return created;
    });
  } catch (error) {
    if (isPostgresUniqueViolation(error)) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_DUPLICATE_EMAIL,
        "A user with this email already exists.",
      );
    }

    if (error instanceof AdminUserManagementError) {
      throw error;
    }

    if (isCredentialCreationError(error)) {
      throw error;
    }

    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
      "User could not be created.",
    );
  }
}

export async function changeAdminManagedUserRole(
  input: ChangeUserRoleInput,
  actor: DbUser,
): Promise<AdminUserLifecycleResult> {
  const activeActor = requireActiveManager(actor);
  const parsedInput = changeUserRoleInputSchema.parse(input);
  const reason = normalizeOptionalAdminReason(parsedInput.reason);

  return db.transaction(async (tx) => {
    await lockActiveAdminRows(tx);
    await lockTargetUserRow(tx, parsedInput.id);

    const target = await loadTargetUser(tx, parsedInput.id);

    if (target.role === parsedInput.role) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ROLE_UNCHANGED,
        "Requested role matches the current role.",
      );
    }

    const activeAdminCount = await countActiveAdmins(tx);
    assertPolicyAllowed(canChangeUserRole({
      actor: activeActor,
      target: toPolicySubject(target),
      nextRole: parsedInput.role,
      lastAdmin: { activeAdminCount },
    }));

    const mutationTime = new Date();
    const [updated] = await tx
      .update(users)
      .set({
        role: parsedInput.role,
        updatedAt: mutationTime,
      })
      .where(
        and(
          eq(users.id, parsedInput.id),
          eq(users.role, target.role),
          eq(users.isActive, target.isActive),
          isNull(users.deletedAt),
        ),
      )
      .returning(adminUserMutationColumns);

    if (!updated) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
        "User role changed concurrently.",
      );
    }

    const revokedSessionCount = await revokeUserSessions(tx, updated.id);

    await logAuditEvent(tx, {
      actorUserId: activeActor.id,
      action: "user.role_change",
      entityType: "user",
      entityId: updated.id,
      before: toLifecycleStateSnapshot(target),
      after: {
        ...toLifecycleStateSnapshot(updated),
        revokedSessionCount,
      },
      reason,
    });

    return {
      user: updated,
      revokedSessionCount,
    };
  });
}

export async function deactivateAdminManagedUser(
  input: DeactivateUserInput,
  actor: DbUser,
): Promise<AdminUserLifecycleResult> {
  const activeActor = requireActiveManager(actor);
  const parsedInput = deactivateUserInputSchema.parse(input);

  return db.transaction(async (tx) => {
    await lockActiveAdminRows(tx);
    await lockTargetUserRow(tx, parsedInput.id);

    const target = await loadTargetUser(tx, parsedInput.id);
    const activeAdminCount = await countActiveAdmins(tx);
    assertPolicyAllowed(canDeactivateUser({
      actor: activeActor,
      target: toPolicySubject(target),
      lastAdmin: { activeAdminCount },
    }));

    const mutationTime = new Date();
    const [updated] = await tx
      .update(users)
      .set({
        isActive: false,
        updatedAt: mutationTime,
      })
      .where(
        and(
          eq(users.id, parsedInput.id),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .returning(adminUserMutationColumns);

    if (!updated) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
        "User state changed concurrently.",
      );
    }

    const revokedSessionCount = await revokeUserSessions(tx, updated.id);

    await logAuditEvent(tx, {
      actorUserId: activeActor.id,
      action: "user.deactivate",
      entityType: "user",
      entityId: updated.id,
      before: toLifecycleStateSnapshot(target),
      after: {
        ...toLifecycleStateSnapshot(updated),
        revokedSessionCount,
      },
      reason: parsedInput.reason,
    });

    return {
      user: updated,
      revokedSessionCount,
    };
  });
}

export async function reactivateAdminManagedUser(
  input: ReactivateUserInput,
  actor: DbUser,
): Promise<AdminManagedUserResult> {
  const activeActor = requireActiveManager(actor);
  const parsedInput = reactivateUserInputSchema.parse(input);
  const reason = normalizeOptionalAdminReason(parsedInput.reason);

  return db.transaction(async (tx) => {
    await lockActiveAdminRows(tx);
    await lockTargetUserRow(tx, parsedInput.id);

    const target = await loadTargetUser(tx, parsedInput.id);
    const activeAdminCount = await countActiveAdmins(tx);
    assertPolicyAllowed(canReactivateUser({
      actor: activeActor,
      target: toPolicySubject(target),
      lastAdmin: { activeAdminCount },
    }));

    const mutationTime = new Date();
    const [updated] = await tx
      .update(users)
      .set({
        isActive: true,
        updatedAt: mutationTime,
      })
      .where(
        and(
          eq(users.id, parsedInput.id),
          eq(users.isActive, false),
          isNull(users.deletedAt),
        ),
      )
      .returning(adminUserMutationColumns);

    if (!updated) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
        "User state changed concurrently.",
      );
    }

    await logAuditEvent(tx, {
      actorUserId: activeActor.id,
      action: "user.reactivate",
      entityType: "user",
      entityId: updated.id,
      before: toLifecycleStateSnapshot(target),
      after: toLifecycleStateSnapshot(updated),
      reason,
    });

    return updated;
  });
}

export async function softDeleteAdminManagedUser(
  input: SoftDeleteUserInput,
  actor: DbUser,
): Promise<AdminUserLifecycleResult> {
  const activeActor = requireActiveManager(actor);
  const parsedInput = softDeleteUserInputSchema.parse(input);

  return db.transaction(async (tx) => {
    await lockActiveAdminRows(tx);
    await lockTargetUserRow(tx, parsedInput.id);

    const target = await loadTargetUser(tx, parsedInput.id);
    const activeAdminCount = await countActiveAdmins(tx);
    assertPolicyAllowed(canSoftDeleteUser({
      actor: activeActor,
      target: toPolicySubject(target),
      lastAdmin: { activeAdminCount },
    }));

    const mutationTime = new Date();
    const [updated] = await tx
      .update(users)
      .set({
        isActive: false,
        deletedAt: mutationTime,
        updatedAt: mutationTime,
      })
      .where(and(eq(users.id, parsedInput.id), isNull(users.deletedAt)))
      .returning(adminUserMutationColumns);

    if (!updated) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
        "User state changed concurrently.",
      );
    }

    const revokedSessionCount = await revokeUserSessions(tx, updated.id);

    await logAuditEvent(tx, {
      actorUserId: activeActor.id,
      action: "user.soft_delete",
      entityType: "user",
      entityId: updated.id,
      before: toLifecycleStateSnapshot(target),
      after: {
        ...toLifecycleStateSnapshot(updated),
        revokedSessionCount,
      },
      reason: parsedInput.reason,
    });

    return {
      user: updated,
      revokedSessionCount,
    };
  });
}

export async function revokeAdminManagedUserSessions(
  input: RevokeUserSessionsInput,
  actor: DbUser,
): Promise<AdminUserSessionRevocationResult> {
  const activeActor = requireActiveManager(actor);
  const parsedInput = revokeUserSessionsInputSchema.parse(input);

  return db.transaction(async (tx) => {
    await lockTargetUserRow(tx, parsedInput.id);

    const target = await loadTargetUser(tx, parsedInput.id);
    assertPolicyAllowed(canManuallyRevokeUserSessions({
      actor: activeActor,
      target: toPolicySubject(target),
    }));

    const revokedSessionCount = await revokeUserSessions(tx, target.id);

    await logAuditEvent(tx, {
      actorUserId: activeActor.id,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: target.id,
      after: {
        targetUserId: target.id,
        revokedSessionCount,
      },
      reason: parsedInput.reason,
    });

    return {
      targetUserId: target.id,
      revokedSessionCount,
    };
  });
}

export async function setAdminManagedUserTemporaryPassword(
  input: SetTemporaryPasswordInput,
  actor: DbUser,
): Promise<AdminUserPasswordResetResult> {
  const activeActor = requireActiveManager(actor);
  const parsedInput = setTemporaryPasswordInputSchema.parse(input);
  const passwordHash = await hashCredentialPassword(parsedInput.temporaryPassword);

  return db.transaction(async (tx) => {
    await lockTargetUserRow(tx, parsedInput.id);

    const target = await loadTargetUser(tx, parsedInput.id);
    assertPolicyAllowed(canSetTemporaryPassword({
      actor: activeActor,
      target: toPolicySubject(target),
    }));

    const credentialAccounts = await tx
      .select({
        id: accounts.id,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, target.id),
          eq(accounts.providerId, CREDENTIAL_PROVIDER_ID),
        ),
      );

    if (credentialAccounts.length !== 1) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_ACCOUNT_NOT_FOUND,
        "A single existing credential account was not found for this user.",
      );
    }

    const [credentialAccount] = credentialAccounts;
    const mutationTime = new Date();
    const [updatedCredential] = await tx
      .update(accounts)
      .set({
        password: passwordHash,
        updatedAt: mutationTime,
      })
      .where(eq(accounts.id, credentialAccount.id))
      .returning({ id: accounts.id });

    if (!updatedCredential) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_ACCOUNT_NOT_FOUND,
        "Credential account could not be updated.",
      );
    }

    const revokedSessionCount = await revokeUserSessions(tx, target.id);

    await logAuditEvent(tx, {
      actorUserId: activeActor.id,
      action: "user.password_set_by_admin",
      entityType: "user",
      entityId: target.id,
      after: {
        targetUserId: target.id,
        role: target.role,
        isActive: target.isActive,
        deletedAt: target.deletedAt,
        revokedSessionCount,
      },
      reason: parsedInput.reason,
    });

    return {
      targetUserId: target.id,
      revokedSessionCount,
    };
  });
}

export function requiresLastActiveAdminSerialization(input: {
  target: AdminUserPolicySubject;
  nextRole?: Role;
  operation: "role_change" | "deactivate" | "soft_delete";
}): boolean {
  return isLastAdminSensitiveOperation(input) &&
    input.target.isActive &&
    !input.target.deletedAt;
}
