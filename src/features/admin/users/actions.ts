"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";

import {
  changeAdminManagedUserRole,
  createAdminManagedUser,
  deactivateAdminManagedUser,
  reactivateAdminManagedUser,
  revokeAdminManagedUserSessions,
  setAdminManagedUserTemporaryPassword,
  softDeleteAdminManagedUser,
} from "./mutations";
import {
  ADMIN_USER_MANAGEMENT_ERROR_CODES,
  AdminUserManagementError,
  type AdminUserManagementErrorCode,
} from "./errors";
import {
  changeUserRoleInputSchema,
  createAdminUserInputSchema,
  deactivateUserInputSchema,
  reactivateUserInputSchema,
  revokeUserSessionsInputSchema,
  setTemporaryPasswordInputSchema,
  softDeleteUserInputSchema,
} from "./validators";

export type AdminUserActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const initialSuccessMessage = "Ready.";

export const adminUserActionInitialState: AdminUserActionResult = {
  ok: true,
  message: initialSuccessMessage,
};

function readFormString(
  formData: Pick<FormData, "get">,
  key: string,
): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim().length > 0 ? value : undefined;
}

function safeErrorMessage(code: AdminUserManagementErrorCode): string {
  switch (code) {
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_DUPLICATE_EMAIL:
      return "A user with this email already exists.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN:
      return "This self-action is not allowed through Admin User Management.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_LAST_ADMIN_PROTECTED:
      return "At least one active Admin must remain.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ROLE_UNCHANGED:
      return "The selected role matches the current role.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_ACCOUNT_NOT_FOUND:
      return "This user does not have exactly one existing credential account.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN:
      return "You do not have permission to manage users.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_REASON_REQUIRED:
      return "A reason is required.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_NOT_FOUND:
      return "User was not found.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_CREATION_FAILED:
      return "Credential setup failed.";
    case ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE:
      return "The user is not in a valid state for this action.";
  }
}

function mapActionError(error: unknown): AdminUserActionResult {
  if (error instanceof AdminUserManagementError) {
    return {
      ok: false,
      error: safeErrorMessage(error.code),
    };
  }

  if (error instanceof Error && "issues" in error) {
    return {
      ok: false,
      error: "Invalid user-management request.",
    };
  }

  return {
    ok: false,
    error: "User-management action failed.",
  };
}

function revalidateAdminUsers(): void {
  revalidatePath("/admin/users");
}

export async function createAdminUserAction(
  _state: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = createAdminUserInputSchema.safeParse({
    name: readFormString(formData, "name"),
    email: readFormString(formData, "email"),
    role: readFormString(formData, "role"),
    temporaryPassword: readFormString(formData, "temporaryPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid create-user request.",
    };
  }

  try {
    await createAdminManagedUser(parsed.data, user);
  } catch (error) {
    return mapActionError(error);
  }

  revalidateAdminUsers();
  return { ok: true, message: "User created." };
}

export async function changeAdminUserRoleAction(
  _state: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = changeUserRoleInputSchema.safeParse({
    id: readFormString(formData, "id"),
    role: readFormString(formData, "role"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid role-change request.",
    };
  }

  try {
    await changeAdminManagedUserRole(parsed.data, user);
  } catch (error) {
    return mapActionError(error);
  }

  revalidateAdminUsers();
  return { ok: true, message: "Role updated. Existing sessions were revoked." };
}

export async function deactivateAdminUserAction(
  _state: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = deactivateUserInputSchema.safeParse({
    id: readFormString(formData, "id"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid deactivation request.",
    };
  }

  if (readFormString(formData, "confirmation") !== "confirmed") {
    return { ok: false, error: "Confirmation is required." };
  }

  try {
    await deactivateAdminManagedUser(parsed.data, user);
  } catch (error) {
    return mapActionError(error);
  }

  revalidateAdminUsers();
  return { ok: true, message: "User deactivated. Existing sessions were revoked." };
}

export async function reactivateAdminUserAction(
  _state: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = reactivateUserInputSchema.safeParse({
    id: readFormString(formData, "id"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reactivation request.",
    };
  }

  try {
    await reactivateAdminManagedUser(parsed.data, user);
  } catch (error) {
    return mapActionError(error);
  }

  revalidateAdminUsers();
  return { ok: true, message: "User reactivated." };
}

export async function softDeleteAdminUserAction(
  _state: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = softDeleteUserInputSchema.safeParse({
    id: readFormString(formData, "id"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid soft-delete request.",
    };
  }

  if (readFormString(formData, "confirmation") !== "confirmed") {
    return { ok: false, error: "Confirmation is required." };
  }

  try {
    await softDeleteAdminManagedUser(parsed.data, user);
  } catch (error) {
    return mapActionError(error);
  }

  revalidateAdminUsers();
  return { ok: true, message: "User soft-deleted. Existing sessions were revoked." };
}

export async function revokeAdminUserSessionsAction(
  _state: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = revokeUserSessionsInputSchema.safeParse({
    id: readFormString(formData, "id"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid session-revocation request.",
    };
  }

  try {
    await revokeAdminManagedUserSessions(parsed.data, user);
  } catch (error) {
    return mapActionError(error);
  }

  revalidateAdminUsers();
  return { ok: true, message: "Sessions revoked." };
}

export async function setAdminUserTemporaryPasswordAction(
  _state: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = setTemporaryPasswordInputSchema.safeParse({
    id: readFormString(formData, "id"),
    temporaryPassword: readFormString(formData, "temporaryPassword"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid password request.",
    };
  }

  if (readFormString(formData, "confirmation") !== "confirmed") {
    return { ok: false, error: "Confirmation is required." };
  }

  try {
    await setAdminManagedUserTemporaryPassword(parsed.data, user);
  } catch (error) {
    return mapActionError(error);
  }

  revalidateAdminUsers();
  return {
    ok: true,
    message: "Temporary password updated. Existing sessions were revoked.",
  };
}
