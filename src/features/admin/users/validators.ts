import { z } from "zod";

import { ROLES } from "@/lib/permissions/roles";

import {
  BETTER_AUTH_PASSWORD_MAX_LENGTH,
  BETTER_AUTH_PASSWORD_MIN_LENGTH,
} from "@/lib/auth/password-policy";
import {
  ADMIN_USER_OPERATION_TYPES,
  ADMIN_USER_STATUS_FILTERS,
} from "./types";
import { normalizeOptionalAdminReason } from "./policy";

export const ADMIN_USERS_DEFAULT_LIMIT = 20;
export const ADMIN_USERS_MAX_LIMIT = 100;
export const ADMIN_USERS_MAX_SEARCH_LENGTH = 120;
export const ADMIN_USER_TEMP_PASSWORD_MIN_LENGTH =
  BETTER_AUTH_PASSWORD_MIN_LENGTH;
export const ADMIN_USER_TEMP_PASSWORD_MAX_LENGTH =
  BETTER_AUTH_PASSWORD_MAX_LENGTH;

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().trim().max(maxLength).optional());
}

function optionalReason() {
  return z.preprocess(
    (value) => normalizeOptionalAdminReason(
      typeof value === "string" ? value : null,
    ),
    z.string().min(1).nullable(),
  );
}

function requiredReason(message: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    return value.trim();
  }, z.string().min(1, message));
}

function boundedInteger(defaultValue: number, maxValue: number) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }

    return typeof value === "string" || typeof value === "number"
      ? Number(value)
      : value;
  }, z.number().int().min(0).max(maxValue));
}

export const adminUserIdSchema = z.string().trim().uuid();
export const adminUserRoleSchema = z.enum(ROLES);
export const adminUserStatusFilterSchema = z.enum(ADMIN_USER_STATUS_FILTERS);
export const adminUserOperationTypeSchema = z.enum(ADMIN_USER_OPERATION_TYPES);

export const adminUsersListQuerySchema = z.object({
  search: optionalTrimmedString(ADMIN_USERS_MAX_SEARCH_LENGTH),
  role: adminUserRoleSchema.optional(),
  status: adminUserStatusFilterSchema.optional(),
  limit: boundedInteger(
    ADMIN_USERS_DEFAULT_LIMIT,
    ADMIN_USERS_MAX_LIMIT,
  ).default(ADMIN_USERS_DEFAULT_LIMIT),
  offset: boundedInteger(0, Number.MAX_SAFE_INTEGER).default(0),
  page: boundedInteger(1, Number.MAX_SAFE_INTEGER).optional(),
}).transform((value) => {
  const offset = value.page === undefined
    ? value.offset
    : (value.page - 1) * value.limit;

  return {
    ...value,
    offset,
  };
});

export const createAdminUserInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: adminUserRoleSchema,
  temporaryPassword: z
    .string()
    .min(
      ADMIN_USER_TEMP_PASSWORD_MIN_LENGTH,
      "Temporary password must be at least 8 characters.",
    )
    .max(
      ADMIN_USER_TEMP_PASSWORD_MAX_LENGTH,
      "Temporary password must be at most 128 characters.",
    ),
});

export const changeUserRoleInputSchema = z.object({
  id: adminUserIdSchema,
  role: adminUserRoleSchema,
  reason: optionalReason(),
});

export const deactivateUserInputSchema = z.object({
  id: adminUserIdSchema,
  reason: requiredReason("Deactivation reason is required."),
});

export const reactivateUserInputSchema = z.object({
  id: adminUserIdSchema,
  reason: optionalReason(),
});

export const softDeleteUserInputSchema = z.object({
  id: adminUserIdSchema,
  reason: requiredReason("Soft-delete reason is required."),
});

export const setTemporaryPasswordInputSchema = z.object({
  id: adminUserIdSchema,
  temporaryPassword: z
    .string()
    .min(
      ADMIN_USER_TEMP_PASSWORD_MIN_LENGTH,
      "Temporary password must be at least 8 characters.",
    )
    .max(
      ADMIN_USER_TEMP_PASSWORD_MAX_LENGTH,
      "Temporary password must be at most 128 characters.",
    ),
  reason: requiredReason("Password reset reason is required."),
});

export const revokeUserSessionsInputSchema = z.object({
  id: adminUserIdSchema,
  reason: requiredReason("Session revocation reason is required."),
});

export type AdminUsersListQueryInput = z.infer<typeof adminUsersListQuerySchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserInputSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleInputSchema>;
export type DeactivateUserInput = z.infer<typeof deactivateUserInputSchema>;
export type ReactivateUserInput = z.infer<typeof reactivateUserInputSchema>;
export type SoftDeleteUserInput = z.infer<typeof softDeleteUserInputSchema>;
export type SetTemporaryPasswordInput = z.infer<
  typeof setTemporaryPasswordInputSchema
>;
export type RevokeUserSessionsInput = z.infer<
  typeof revokeUserSessionsInputSchema
>;
