import { APIError } from "better-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";

import { ADMIN_USER_MANAGEMENT_ERROR_CODES } from "./errors";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  revokeOtherSessions: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      changePassword: mocks.changePassword,
      revokeOtherSessions: mocks.revokeOtherSessions,
    },
  },
}));

vi.mock("@/lib/db/client", () => ({
  db: { insert: vi.fn() },
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date("2026-09-10T00:00:00.000Z");

  return {
    id: ADMIN_ID,
    email: "owner@example.test",
    name: "Owner Administrator",
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

const validInput = {
  currentPassword: "current-password",
  newPassword: "new-password",
  confirmNewPassword: "new-password",
};

describe("Admin self-password service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.changePassword.mockResolvedValue({
      token: null,
      user: { id: ADMIN_ID },
    });
    mocks.revokeOtherSessions.mockResolvedValue({ status: true });
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("uses Better Auth to verify/change the password and revoke only other sessions", async () => {
    const { changeOwnAdminPassword } = await import("./self-password");
    const requestHeaders = new Headers({ cookie: "session=current" });

    await expect(changeOwnAdminPassword(
      validInput,
      makeUser(),
      requestHeaders,
    )).resolves.toEqual({
      targetUserId: ADMIN_ID,
      otherSessionsRevoked: true,
    });

    expect(mocks.changePassword).toHaveBeenCalledWith({
      body: {
        currentPassword: "current-password",
        newPassword: "new-password",
        revokeOtherSessions: false,
      },
      headers: requestHeaders,
    });
    expect(mocks.revokeOtherSessions).toHaveBeenCalledWith({
      headers: requestHeaders,
    });
  });

  it("rejects inactive, deleted, and non-Admin actors before credential access", async () => {
    const { changeOwnAdminPassword } = await import("./self-password");
    const deniedActors = [
      makeUser({ role: "sale" }),
      makeUser({ isActive: false }),
      makeUser({ deletedAt: new Date("2026-09-10T01:00:00.000Z") }),
    ];

    for (const actor of deniedActors) {
      await expect(changeOwnAdminPassword(
        validInput,
        actor,
        new Headers(),
      )).rejects.toMatchObject({
        code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
      });
    }

    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("rejects a session whose credential owner differs from the actor", async () => {
    mocks.changePassword.mockResolvedValueOnce({
      token: null,
      user: { id: "00000000-0000-4000-8000-000000000099" },
    });
    const { changeOwnAdminPassword } = await import("./self-password");

    await expect(changeOwnAdminPassword(
      validInput,
      makeUser(),
      new Headers(),
    )).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
    });
    expect(mocks.revokeOtherSessions).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("maps an incorrect current password without exposing provider internals", async () => {
    mocks.changePassword.mockRejectedValueOnce(APIError.from("BAD_REQUEST", {
      code: "INVALID_PASSWORD",
      message: "Invalid password",
    }));
    const { changeOwnAdminPassword } = await import("./self-password");

    await expect(changeOwnAdminPassword(
      validInput,
      makeUser(),
      new Headers(),
    )).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CURRENT_PASSWORD_INVALID,
    });
    expect(mocks.revokeOtherSessions).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects weak passwords and confirmation mismatch before credential access", async () => {
    const { changeOwnAdminPassword } = await import("./self-password");

    await expect(changeOwnAdminPassword({
      currentPassword: "current-password",
      newPassword: "short",
      confirmNewPassword: "short",
    }, makeUser(), new Headers())).rejects.toBeDefined();
    await expect(changeOwnAdminPassword({
      currentPassword: "current-password",
      newPassword: "new-password",
      confirmNewPassword: "not-the-new-password",
    }, makeUser(), new Headers())).rejects.toBeDefined();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("audits safe identity/session metadata and never password, hash, or token data", async () => {
    const { changeOwnAdminPassword } = await import("./self-password");

    await changeOwnAdminPassword(validInput, makeUser(), new Headers());

    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorUserId: ADMIN_ID,
        action: "user.password.change_self",
        entityType: "user",
        entityId: ADMIN_ID,
        after: {
          actorUserId: ADMIN_ID,
          targetUserId: ADMIN_ID,
          otherSessionsRevoked: true,
        },
        reason: null,
      },
    );
    const auditPayload = JSON.stringify(mocks.logAuditEvent.mock.calls[0]?.[1]);
    expect(auditPayload).not.toContain(validInput.currentPassword);
    expect(auditPayload).not.toContain(validInput.newPassword);
    expect(auditPayload).not.toContain("session=current");
    expect(auditPayload).not.toContain("hash");
  });
});
