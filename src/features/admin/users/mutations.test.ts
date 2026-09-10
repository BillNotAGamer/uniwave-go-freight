import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";

import { ADMIN_USER_MANAGEMENT_ERROR_CODES } from "./errors";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const TARGET_ID = "00000000-0000-4000-8000-000000000002";
const CREATED_ID = "00000000-0000-4000-8000-000000000003";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logAuditEvent: vi.fn(),
  hashCredentialPassword: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/auth/credentials", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/credentials")>();

  return {
    ...actual,
    hashCredentialPassword: mocks.hashCredentialPassword,
  };
});

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date("2026-08-23T00:00:00.000Z");

  return {
    id: "user-1",
    email: "user@example.com",
    name: "User One",
    image: null,
    emailVerified: false,
    role: "sale",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeFakeTx(input: {
  selectResults?: unknown[][];
  insertResults?: unknown[][];
  updateResults?: unknown[][];
  deleteResults?: unknown[][];
} = {}) {
  const selectResults = [...(input.selectResults ?? [])];
  const insertResults = [...(input.insertResults ?? [])];
  const updateResults = [...(input.updateResults ?? [])];
  const deleteResults = [...(input.deleteResults ?? [])];
  const insertValues: unknown[] = [];
  const updateValues: unknown[] = [];

  function queryBuilder(result: unknown[]) {
    const promise = Promise.resolve(result);

    return {
      limit: vi.fn(async () => result),
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
  }

  const tx = {
    execute: vi.fn(async () => []),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => queryBuilder(selectResults.shift() ?? [])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertValues.push(values);
        const result = insertResults.shift() ?? [];
        const promise = Promise.resolve(result);

        return {
          returning: vi.fn(async () => result),
          then: promise.then.bind(promise),
          catch: promise.catch.bind(promise),
          finally: promise.finally.bind(promise),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updateValues.push(values);

        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => updateResults.shift() ?? []),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => deleteResults.shift() ?? []),
      })),
    })),
    insertValues,
    updateValues,
  };

  return tx;
}

describe("admin user lifecycle mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashCredentialPassword.mockResolvedValue("better-auth-hash");
    mocks.transaction.mockImplementation(async (callback) => callback(makeFakeTx()));
  });

  it("denies non-Admin actors at the production service boundary", async () => {
    const { createAdminManagedUser } = await import("./mutations");

    await expect(createAdminManagedUser({
      name: "New User",
      email: "new@example.com",
      role: "sale",
      temporaryPassword: "temporary-password-1",
    }, makeUser({ role: "sale" }))).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a user, credential account, and safe audit without sessions or password disclosure", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const created = makeUser({
      id: CREATED_ID,
      email: "new@example.com",
      name: "New User",
      role: "accountant",
    });
    const tx = makeFakeTx({
      insertResults: [[created], []],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { createAdminManagedUser } = await import("./mutations");
    const result = await createAdminManagedUser({
      name: "New User",
      email: "NEW@example.com",
      role: "accountant",
      temporaryPassword: "temporary-password-1",
    }, admin);

    expect(result).toMatchObject({
      id: CREATED_ID,
      email: "new@example.com",
      role: "accountant",
      isActive: true,
      deletedAt: null,
    });
    expect(tx.insertValues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        email: "new@example.com",
        role: "accountant",
        isActive: true,
        deletedAt: null,
        emailVerified: false,
      }),
      expect.objectContaining({
        userId: CREATED_ID,
        providerId: "credential",
        accountId: CREATED_ID,
        password: "better-auth-hash",
      }),
    ]));
    const auditPayload = mocks.logAuditEvent.mock.calls[0]?.[1];
    expect(String(JSON.stringify(auditPayload))).not.toContain("temporary-password-1");
    expect(String(JSON.stringify(auditPayload))).not.toContain("better-auth-hash");
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("rejects Admin creation at the production service boundary", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const { createAdminManagedUser } = await import("./mutations");
    const tamperedInput = {
      name: "Second Admin",
      email: "second-admin@example.test",
      role: "admin",
      temporaryPassword: "temporary-password-1",
    } as unknown as Parameters<typeof createAdminManagedUser>[0];

    await expect(createAdminManagedUser(tamperedInput, admin)).rejects.toBeDefined();
    expect(mocks.hashCredentialPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("maps a wrapped PostgreSQL duplicate-email violation to the domain contract", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const duplicateError = Object.assign(
      new Error("Transaction failed."),
      { cause: { code: "23505" } },
    );

    mocks.transaction.mockRejectedValueOnce(duplicateError);

    const { createAdminManagedUser } = await import("./mutations");

    await expect(createAdminManagedUser({
      name: "Duplicate User",
      email: "DUPLICATE@example.com",
      role: "sale",
      temporaryPassword: "temporary-password-1",
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_DUPLICATE_EMAIL,
    });
  });

  it("changes role under advisory serialization, revokes sessions, and writes parent audit metadata", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const target = makeUser({ id: TARGET_ID, role: "sale" });
    const updated = makeUser({ ...target, role: "accountant" });
    const tx = makeFakeTx({
      selectResults: [[target], [{ count: 2 }]],
      updateResults: [[updated]],
      deleteResults: [[{ id: "session-1" }, { id: "session-2" }]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { changeAdminManagedUserRole } = await import("./mutations");
    const result = await changeAdminManagedUserRole({
      id: TARGET_ID,
      role: "accountant",
      reason: "  team change  ",
    }, admin);

    expect(tx.execute).toHaveBeenCalled();
    expect(result.revokedSessionCount).toBe(2);
    expect(result.user.role).toBe("accountant");
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: "user.role_change",
      entityType: "user",
      entityId: TARGET_ID,
      reason: "team change",
      after: expect.objectContaining({
        role: "accountant",
        revokedSessionCount: 2,
      }),
    }));
  });

  it("rejects same-role changes without revoking sessions or writing misleading audit", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const target = makeUser({ id: TARGET_ID, role: "sale" });
    const tx = makeFakeTx({
      selectResults: [[target]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { changeAdminManagedUserRole } = await import("./mutations");

    await expect(changeAdminManagedUserRole({
      id: TARGET_ID,
      role: "sale",
      reason: null,
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ROLE_UNCHANGED,
    });
    expect(tx.delete).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects promotion to Admin while the sole Admin exists", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const target = makeUser({ id: TARGET_ID, role: "sale" });
    const tx = makeFakeTx({
      selectResults: [[target], [{ count: 1 }]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { changeAdminManagedUserRole } = await import("./mutations");

    await expect(changeAdminManagedUserRole({
      id: TARGET_ID,
      role: "admin",
      reason: null,
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ADMIN_UNIQUENESS_PROTECTED,
    });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects reactivation of an inactive Admin while another Admin is active", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const target = makeUser({
      id: TARGET_ID,
      role: "admin",
      isActive: false,
    });
    const tx = makeFakeTx({
      selectResults: [[target], [{ count: 1 }]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { reactivateAdminManagedUser } = await import("./mutations");

    await expect(reactivateAdminManagedUser({
      id: TARGET_ID,
      reason: null,
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ADMIN_UNIQUENESS_PROTECTED,
    });
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(tx.update).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("soft-deletes by preserving the user row, clearing active state, revoking sessions, and auditing", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const target = makeUser({ id: TARGET_ID, role: "accountant" });
    const deletedAt = new Date("2026-08-23T01:00:00.000Z");
    const updated = makeUser({
      ...target,
      isActive: false,
      deletedAt,
    });
    const tx = makeFakeTx({
      selectResults: [[target], [{ count: 2 }]],
      updateResults: [[updated]],
      deleteResults: [[{ id: "session-1" }]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { softDeleteAdminManagedUser } = await import("./mutations");
    const result = await softDeleteAdminManagedUser({
      id: TARGET_ID,
      reason: "left company",
    }, admin);

    expect(result.user.isActive).toBe(false);
    expect(result.user.deletedAt).toBe(deletedAt);
    expect(result.revokedSessionCount).toBe(1);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: "user.soft_delete",
      reason: "left company",
      after: expect.objectContaining({
        isActive: false,
        deletedAt,
        revokedSessionCount: 1,
      }),
    }));
  });

  it("manual revoke rejects self-target and accepts zero-session target deterministically", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const selfTx = makeFakeTx({
      selectResults: [[admin]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(selfTx));

    const { revokeAdminManagedUserSessions } = await import("./mutations");

    await expect(revokeAdminManagedUserSessions({
      id: ADMIN_ID,
      reason: "security review",
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
    });

    expect(selfTx.delete).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();

    const targetTx = makeFakeTx({
      selectResults: [[makeUser({ id: TARGET_ID, role: "sale" })]],
      deleteResults: [[]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(targetTx));

    const result = await revokeAdminManagedUserSessions({
      id: TARGET_ID,
      reason: "security review",
    }, admin);

    expect(result).toEqual({
      targetUserId: TARGET_ID,
      revokedSessionCount: 0,
    });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(targetTx, expect.objectContaining({
      action: "user.sessions_revoked",
      after: {
        targetUserId: TARGET_ID,
        revokedSessionCount: 0,
      },
      reason: "security review",
    }));
  });

  it("sets an existing credential password, revokes sessions, and audits without secret disclosure", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const target = makeUser({ id: TARGET_ID, role: "sale" });
    const tx = makeFakeTx({
      selectResults: [[target], [{ id: "credential-account-1" }]],
      updateResults: [[{ id: "credential-account-1" }]],
      deleteResults: [[{ id: "session-1" }, { id: "session-2" }]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { setAdminManagedUserTemporaryPassword } = await import("./mutations");
    const result = await setAdminManagedUserTemporaryPassword({
      id: TARGET_ID,
      temporaryPassword: "temporary-password-2",
      reason: "  account recovery  ",
    }, admin);

    expect(result).toEqual({
      targetUserId: TARGET_ID,
      revokedSessionCount: 2,
    });
    expect(tx.updateValues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        password: "better-auth-hash",
        updatedAt: expect.any(Date),
      }),
    ]));
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: "user.password_set_by_admin",
      entityType: "user",
      entityId: TARGET_ID,
      after: expect.objectContaining({
        targetUserId: TARGET_ID,
        role: "sale",
        isActive: true,
        deletedAt: null,
        revokedSessionCount: 2,
      }),
      reason: "account recovery",
    }));

    const auditPayload = mocks.logAuditEvent.mock.calls[0]?.[1];
    expect(String(JSON.stringify(auditPayload))).not.toContain("temporary-password-2");
    expect(String(JSON.stringify(auditPayload))).not.toContain("better-auth-hash");
  });

  it("refuses password reset when the exact existing credential account contract is not met", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const target = makeUser({ id: TARGET_ID, role: "sale" });
    const missingTx = makeFakeTx({
      selectResults: [[target], []],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(missingTx));

    const { setAdminManagedUserTemporaryPassword } = await import("./mutations");

    await expect(setAdminManagedUserTemporaryPassword({
      id: TARGET_ID,
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_ACCOUNT_NOT_FOUND,
    });
    expect(missingTx.insert).not.toHaveBeenCalled();
    expect(missingTx.delete).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();

    const ambiguousTx = makeFakeTx({
      selectResults: [[target], [
        { id: "credential-account-1" },
        { id: "credential-account-2" },
      ]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(ambiguousTx));

    await expect(setAdminManagedUserTemporaryPassword({
      id: TARGET_ID,
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_CREDENTIAL_ACCOUNT_NOT_FOUND,
    });
    expect(ambiguousTx.insert).not.toHaveBeenCalled();
    expect(ambiguousTx.delete).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("denies self-target password reset before touching credentials or sessions", async () => {
    const admin = makeUser({ id: ADMIN_ID, role: "admin" });
    const tx = makeFakeTx({
      selectResults: [[admin]],
    });

    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    const { setAdminManagedUserTemporaryPassword } = await import("./mutations");

    await expect(setAdminManagedUserTemporaryPassword({
      id: ADMIN_ID,
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    }, admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
    });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });
});
