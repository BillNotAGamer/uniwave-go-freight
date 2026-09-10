import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";

import {
  ADMIN_USER_MANAGEMENT_ERROR_CODES,
  AdminUserManagementError,
} from "./errors";
import { adminUserActionInitialState } from "./types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  createAdminManagedUser: vi.fn(),
  changeAdminManagedUserRole: vi.fn(),
  deactivateAdminManagedUser: vi.fn(),
  reactivateAdminManagedUser: vi.fn(),
  revokeAdminManagedUserSessions: vi.fn(),
  setAdminManagedUserTemporaryPassword: vi.fn(),
  softDeleteAdminManagedUser: vi.fn(),
  changeOwnAdminPassword: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("./mutations", () => ({
  createAdminManagedUser: mocks.createAdminManagedUser,
  changeAdminManagedUserRole: mocks.changeAdminManagedUserRole,
  deactivateAdminManagedUser: mocks.deactivateAdminManagedUser,
  reactivateAdminManagedUser: mocks.reactivateAdminManagedUser,
  revokeAdminManagedUserSessions: mocks.revokeAdminManagedUserSessions,
  setAdminManagedUserTemporaryPassword: mocks.setAdminManagedUserTemporaryPassword,
  softDeleteAdminManagedUser: mocks.softDeleteAdminManagedUser,
}));

vi.mock("./self-password", () => ({
  changeOwnAdminPassword: mocks.changeOwnAdminPassword,
}));

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date("2026-08-24T00:00:00.000Z");

  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    name: "Admin User",
    image: null,
    emailVerified: true,
    role: "admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeForm(values: Record<string, string>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

describe("admin user server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: makeUser() });
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session=current" }));
  });

  it("sets an existing user's temporary password through the production service", async () => {
    const { setAdminUserTemporaryPasswordAction } = await import("./actions");

    const result = await setAdminUserTemporaryPasswordAction(
      adminUserActionInitialState,
      makeForm({
        id: "00000000-0000-4000-8000-000000000002",
        temporaryPassword: "temporary-password-2",
        reason: "  account recovery  ",
        confirmation: "confirmed",
      }),
    );

    expect(result).toEqual({
      ok: true,
      message: "Temporary password updated. Existing sessions were revoked.",
    });
    expect(mocks.setAdminManagedUserTemporaryPassword).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000002",
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    }, expect.objectContaining({ role: "admin" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("requires explicit confirmation before calling the password service", async () => {
    const { setAdminUserTemporaryPasswordAction } = await import("./actions");

    const result = await setAdminUserTemporaryPasswordAction(
      adminUserActionInitialState,
      makeForm({
        id: "00000000-0000-4000-8000-000000000002",
        temporaryPassword: "temporary-password-2",
        reason: "account recovery",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "Confirmation is required.",
    });
    expect(mocks.setAdminManagedUserTemporaryPassword).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps credential-account contract failures to a safe user-facing message", async () => {
    mocks.setAdminManagedUserTemporaryPassword.mockRejectedValueOnce(
      new AdminUserManagementError(
        ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_ACCOUNT_NOT_FOUND,
        "Ambiguous credential account.",
      ),
    );

    const { setAdminUserTemporaryPasswordAction } = await import("./actions");

    const result = await setAdminUserTemporaryPasswordAction(
      adminUserActionInitialState,
      makeForm({
        id: "00000000-0000-4000-8000-000000000002",
        temporaryPassword: "temporary-password-2",
        reason: "account recovery",
        confirmation: "confirmed",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "This user does not have exactly one existing credential account.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps create-user validation in the action and does not call the service on invalid form data", async () => {
    const { createAdminUserAction } = await import("./actions");

    const result = await createAdminUserAction(
      adminUserActionInitialState,
      makeForm({
        name: "New User",
        email: "not-an-email",
        role: "sale",
        temporaryPassword: "temporary-password-1",
      }),
    );

    expect(result.ok).toBe(false);
    expect(mocks.createAdminManagedUser).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["sale", "accountant"] as const)(
    "accepts normal create-user role %s at the server action boundary",
    async (role) => {
      const { createAdminUserAction } = await import("./actions");

      const result = await createAdminUserAction(
        adminUserActionInitialState,
        makeForm({
          name: `New ${role}`,
          email: `${role}@example.test`,
          role,
          temporaryPassword: "temporary-password-1",
        }),
      );

      expect(result).toEqual({ ok: true, message: "User created." });
      expect(mocks.createAdminManagedUser).toHaveBeenCalledWith(
        expect.objectContaining({ role }),
        expect.objectContaining({ role: "admin" }),
      );
    },
  );

  it("rejects a tampered create-user Admin role before the service boundary", async () => {
    const { createAdminUserAction } = await import("./actions");

    const result = await createAdminUserAction(
      adminUserActionInitialState,
      makeForm({
        name: "Second Admin",
        email: "second-admin@example.test",
        role: "admin",
        temporaryPassword: "temporary-password-1",
      }),
    );

    expect(result.ok).toBe(false);
    expect(mocks.createAdminManagedUser).not.toHaveBeenCalled();
  });

  it("changes only the authenticated Admin's own password", async () => {
    const { changeOwnPasswordAction } = await import("./actions");

    const result = await changeOwnPasswordAction(
      adminUserActionInitialState,
      makeForm({
        currentPassword: "current-password",
        newPassword: "new-password",
        confirmNewPassword: "new-password",
      }),
    );

    expect(result).toEqual({
      ok: true,
      message: "Password changed. Other sessions were revoked.",
    });
    expect(mocks.changeOwnAdminPassword).toHaveBeenCalledWith(
      {
        currentPassword: "current-password",
        newPassword: "new-password",
        confirmNewPassword: "new-password",
      },
      expect.objectContaining({ id: makeUser().id, role: "admin" }),
      expect.any(Headers),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("rejects password confirmation mismatch before any credential mutation", async () => {
    const { changeOwnPasswordAction } = await import("./actions");

    const result = await changeOwnPasswordAction(
      adminUserActionInitialState,
      makeForm({
        currentPassword: "current-password",
        newPassword: "new-password",
        confirmNewPassword: "different-password",
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "New password and confirmation do not match.",
    });
    expect(mocks.changeOwnAdminPassword).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
