import "server-only";

import { APIError } from "better-auth";

import { logAuditEvent } from "@/lib/audit/log";
import { auth } from "@/lib/auth/server";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { db } from "@/lib/db/client";
import type { User as DbUser } from "@/lib/db/schema";

import {
  ADMIN_USER_MANAGEMENT_ERROR_CODES,
  AdminUserManagementError,
} from "./errors";
import {
  changeOwnPasswordInputSchema,
  type ChangeOwnPasswordInput,
} from "./validators";

export type ChangeOwnAdminPasswordResult = {
  targetUserId: string;
  otherSessionsRevoked: true;
};

function toBetterAuthErrorCode(error: unknown): string | null {
  if (!(error instanceof APIError)) {
    return null;
  }

  const body = error.body;
  return typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
    ? body.code
    : null;
}

function mapBetterAuthPasswordError(error: unknown): AdminUserManagementError {
  const code = toBetterAuthErrorCode(error);

  if (code === "INVALID_PASSWORD") {
    return new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CURRENT_PASSWORD_INVALID,
      "Current password is incorrect.",
    );
  }

  if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
    return new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_ACCOUNT_NOT_FOUND,
      "A credential account was not found.",
    );
  }

  return new AdminUserManagementError(
    ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_PASSWORD_CHANGE_FAILED,
    "Password change failed.",
  );
}

export async function changeOwnAdminPassword(
  input: ChangeOwnPasswordInput,
  actor: DbUser,
  requestHeaders: Headers,
): Promise<ChangeOwnAdminPasswordResult> {
  const activeActor = rejectInactiveOrSoftDeletedUsers(actor);

  if (!activeActor || activeActor.role !== "admin") {
    throw new AdminUserManagementError(
      ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
      "Self-service Admin password changes require an active Admin session.",
    );
  }

  const parsedInput = changeOwnPasswordInputSchema.parse(input);

  try {
    const changed = await auth.api.changePassword({
      body: {
        currentPassword: parsedInput.currentPassword,
        newPassword: parsedInput.newPassword,
        revokeOtherSessions: false,
      },
      headers: requestHeaders,
    });

    if (changed.user.id !== activeActor.id) {
      throw new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
        "The authenticated credential owner does not match the Admin actor.",
      );
    }

    await auth.api.revokeOtherSessions({ headers: requestHeaders });
  } catch (error) {
    if (error instanceof AdminUserManagementError) {
      throw error;
    }

    throw mapBetterAuthPasswordError(error);
  }

  await logAuditEvent(db, {
    actorUserId: activeActor.id,
    action: "user.password.change_self",
    entityType: "user",
    entityId: activeActor.id,
    after: {
      actorUserId: activeActor.id,
      targetUserId: activeActor.id,
      otherSessionsRevoked: true,
    },
    reason: null,
  });

  return {
    targetUserId: activeActor.id,
    otherSessionsRevoked: true,
  };
}
