import { describe, expect, it } from "vitest";

import {
  adminUserIdSchema,
  adminUserRoleSchema,
  adminUsersListQuerySchema,
  changeUserRoleInputSchema,
  createAdminUserInputSchema,
  deactivateUserInputSchema,
  reactivateUserInputSchema,
  revokeUserSessionsInputSchema,
  setTemporaryPasswordInputSchema,
  softDeleteUserInputSchema,
} from "./validators";

const id = "6a985f8b-312d-4111-9960-2f230a39d9f0";

describe("admin user management validators", () => {
  it("accepts UUID user IDs and rejects arbitrary text IDs", () => {
    expect(adminUserIdSchema.safeParse(id).success).toBe(true);
    expect(adminUserIdSchema.safeParse("user-1").success).toBe(false);
  });

  it("accepts only the application single-role values", () => {
    expect(adminUserRoleSchema.safeParse("sale").success).toBe(true);
    expect(adminUserRoleSchema.safeParse("accountant").success).toBe(true);
    expect(adminUserRoleSchema.safeParse("admin").success).toBe(true);
    expect(adminUserRoleSchema.safeParse(["admin", "sale"]).success).toBe(false);
    expect(adminUserRoleSchema.safeParse("admin,sale").success).toBe(false);
    expect(adminUserRoleSchema.safeParse("user").success).toBe(false);
  });

  it("normalizes list query search, bounds pagination, and supports page offset", () => {
    expect(adminUsersListQuerySchema.parse({})).toMatchObject({
      limit: 20,
      offset: 0,
    });
    expect(adminUsersListQuerySchema.parse({
      search: "  Alice  ",
      limit: "50",
      page: "3",
    })).toMatchObject({
      search: "Alice",
      limit: 50,
      offset: 100,
      page: 3,
    });
    expect(adminUsersListQuerySchema.parse({ search: "   " }).search)
      .toBeUndefined();
    expect(adminUsersListQuerySchema.safeParse({ limit: 101 }).success)
      .toBe(false);
    expect(adminUsersListQuerySchema.safeParse({
      search: "x".repeat(121),
    }).success).toBe(false);
  });

  it("validates future create-user input without implementing creation", () => {
    expect(createAdminUserInputSchema.parse({
      name: "  New User ",
      email: " USER@EXAMPLE.TEST ",
      role: "accountant",
      temporaryPassword: "12345678",
    })).toMatchObject({
      name: "New User",
      email: "user@example.test",
      role: "accountant",
    });
    expect(createAdminUserInputSchema.safeParse({
      name: "New User",
      email: "user@example.test",
      role: "manager",
      temporaryPassword: "12345678",
    }).success).toBe(false);
    expect(createAdminUserInputSchema.safeParse({
      name: "New User",
      email: "user@example.test",
      role: "sale",
      temporaryPassword: "1234567",
    }).success).toBe(false);
    expect(createAdminUserInputSchema.safeParse({
      name: "New User",
      email: "user@example.test",
      role: "sale",
      temporaryPassword: "x".repeat(129),
    }).success).toBe(false);
  });

  it("allows optional role-change and reactivation reasons with blank normalized to null", () => {
    expect(changeUserRoleInputSchema.parse({
      id,
      role: "sale",
    }).reason).toBeNull();
    expect(changeUserRoleInputSchema.parse({
      id,
      role: "sale",
      reason: "   ",
    }).reason).toBeNull();
    expect(changeUserRoleInputSchema.parse({
      id,
      role: "sale",
      reason: "  staffing change  ",
    }).reason).toBe("staffing change");
    expect(reactivateUserInputSchema.parse({ id }).reason).toBeNull();
  });

  it("requires reasons for deactivation, soft delete, password reset, and manual session revoke", () => {
    expect(deactivateUserInputSchema.safeParse({ id }).success).toBe(false);
    expect(deactivateUserInputSchema.safeParse({
      id,
      reason: "   ",
    }).success).toBe(false);
    expect(deactivateUserInputSchema.parse({
      id,
      reason: "left department",
    }).reason).toBe("left department");

    expect(softDeleteUserInputSchema.safeParse({ id }).success).toBe(false);
    expect(setTemporaryPasswordInputSchema.safeParse({
      id,
      temporaryPassword: "12345678",
    }).success).toBe(false);
    expect(revokeUserSessionsInputSchema.safeParse({ id }).success).toBe(false);
  });

  it("validates existing-user temporary password reset input", () => {
    expect(setTemporaryPasswordInputSchema.parse({
      id,
      temporaryPassword: "temporary-password-2",
      reason: "  account recovery  ",
    })).toEqual({
      id,
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    });
    expect(setTemporaryPasswordInputSchema.safeParse({
      id: "not-a-user-id",
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    }).success).toBe(false);
    expect(setTemporaryPasswordInputSchema.safeParse({
      id,
      temporaryPassword: "1234567",
      reason: "account recovery",
    }).success).toBe(false);
    expect(setTemporaryPasswordInputSchema.safeParse({
      id,
      temporaryPassword: "x".repeat(129),
      reason: "account recovery",
    }).success).toBe(false);
    expect(setTemporaryPasswordInputSchema.safeParse({
      id,
      temporaryPassword: "temporary-password-2",
      reason: "   ",
    }).success).toBe(false);
  });
});
