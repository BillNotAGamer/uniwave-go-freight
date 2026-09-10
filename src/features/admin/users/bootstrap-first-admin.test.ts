import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertBootstrapAuthorization,
  evaluateBootstrapStateGate,
  executeFirstAdminBootstrap,
  maskEmail,
  validateBootstrapCredentials,
  verifyBootstrapPassword,
  type BootstrapCredentials,
  type BootstrapUserSnapshot,
} from "../../../../scripts/bootstrap-first-admin";
import {
  LEGACY_FIRST_ADMIN_DEPRECATION_MESSAGE,
  runLegacyCreateFirstAdmin,
} from "../../../../scripts/create-first-admin";
import { DatabaseTargetAuthorizationError } from "@/lib/db/database-target-authorization";
import { CREDENTIAL_PROVIDER_ID, hashCredentialPassword } from "@/lib/auth/credentials";
import { accounts, auditLogs, sessions, users } from "@/lib/db/schema";
import type { Database } from "@/lib/db/client";

describe("first admin bootstrap - credentials validation", () => {
  it("accepts valid bootstrap credentials and normalizes email to lowercase", () => {
    const creds = validateBootstrapCredentials({
      BOOTSTRAP_ADMIN_EMAIL: "  Admin.Owner@Example.COM ",
      BOOTSTRAP_ADMIN_NAME: "  Owner Administrator  ",
      BOOTSTRAP_ADMIN_PASSWORD: "CorrectHorseBatteryStaple123!",
    });

    expect(creds.email).toBe("admin.owner@example.com");
    expect(creds.name).toBe("Owner Administrator");
    expect(creds.password).toBe("CorrectHorseBatteryStaple123!");
  });

  it("fails closed on invalid email before database interaction", () => {
    expect(() =>
      validateBootstrapCredentials({
        BOOTSTRAP_ADMIN_EMAIL: "not-an-email",
        BOOTSTRAP_ADMIN_NAME: "Admin",
        BOOTSTRAP_ADMIN_PASSWORD: "validPassword123!",
      }),
    ).toThrow(/BOOTSTRAP_ADMIN_EMAIL must be a valid email address/);
  });

  it("fails closed on missing name before database interaction", () => {
    expect(() =>
      validateBootstrapCredentials({
        BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BOOTSTRAP_ADMIN_NAME: "   ",
        BOOTSTRAP_ADMIN_PASSWORD: "validPassword123!",
      }),
    ).toThrow(/BOOTSTRAP_ADMIN_NAME must not be empty/);
  });

  it("fails closed on short password (< 8 characters) before database interaction", () => {
    expect(() =>
      validateBootstrapCredentials({
        BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BOOTSTRAP_ADMIN_NAME: "Admin",
        BOOTSTRAP_ADMIN_PASSWORD: "short",
      }),
    ).toThrow(/BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters/);
  });

  it("fails closed on excessive password (> 128 characters) before database interaction", () => {
    expect(() =>
      validateBootstrapCredentials({
        BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BOOTSTRAP_ADMIN_NAME: "Admin",
        BOOTSTRAP_ADMIN_PASSWORD: "x".repeat(129),
      }),
    ).toThrow(/BOOTSTRAP_ADMIN_PASSWORD must be at most 128 characters/);
  });

  it("masks emails safely for operator output", () => {
    expect(maskEmail("admin@example.com")).toBe("ad***n@example.com");
    expect(maskEmail("a@b.com")).toBe("a***@b.com");
    expect(maskEmail("ab@b.com")).toBe("a***@b.com");
  });
});

describe("first admin bootstrap - authorization guards", () => {
  const validUrl =
    "postgresql://user:pass@neon-db.example.invalid:5432/uniwave_prod?sslmode=require";

  function baseEnv(overrides: Record<string, string | undefined> = {}) {
    return {
      DATABASE_URL: validUrl,
      BOOTSTRAP_FIRST_ADMIN_AUTHORIZED: "true",
      BOOTSTRAP_FIRST_ADMIN_CONFIRM: "CREATE_FIRST_ADMIN",
      BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED: "true",
      BOOTSTRAP_FIRST_ADMIN_EXPECTED_HOST: "neon-db.example.invalid",
      BOOTSTRAP_FIRST_ADMIN_EXPECTED_NAME: "uniwave_prod",
      NODE_ENV: "development",
      ...overrides,
    };
  }

  it("authorizes when all three authorization gates are present", () => {
    const target = assertBootstrapAuthorization(baseEnv());
    expect(target.hostname).toBe("neon-db.example.invalid");
    expect(target.databaseName).toBe("uniwave_prod");
  });

  it("fails closed when generic authorization is missing or not 'true'", () => {
    expect(() =>
      assertBootstrapAuthorization(baseEnv({ BOOTSTRAP_FIRST_ADMIN_AUTHORIZED: undefined })),
    ).toThrow(DatabaseTargetAuthorizationError);

    expect(() =>
      assertBootstrapAuthorization(baseEnv({ BOOTSTRAP_FIRST_ADMIN_AUTHORIZED: "false" })),
    ).toThrow(DatabaseTargetAuthorizationError);
  });

  it("fails closed when confirmation token is missing or incorrect", () => {
    expect(() =>
      assertBootstrapAuthorization(baseEnv({ BOOTSTRAP_FIRST_ADMIN_CONFIRM: undefined })),
    ).toThrow(DatabaseTargetAuthorizationError);

    expect(() =>
      assertBootstrapAuthorization(baseEnv({ BOOTSTRAP_FIRST_ADMIN_CONFIRM: "CONFIRM" })),
    ).toThrow(DatabaseTargetAuthorizationError);
  });

  it("fails closed when production authorization is missing or not 'true'", () => {
    expect(() =>
      assertBootstrapAuthorization(
        baseEnv({ BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED: undefined }),
      ),
    ).toThrow(DatabaseTargetAuthorizationError);

    expect(() =>
      assertBootstrapAuthorization(
        baseEnv({ BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED: "false" }),
      ),
    ).toThrow(DatabaseTargetAuthorizationError);
  });

  it("fails closed when NODE_ENV is unset and production authorization is missing", () => {
    expect(() =>
      assertBootstrapAuthorization(
        baseEnv({
          NODE_ENV: undefined,
          BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED: undefined,
        }),
      ),
    ).toThrow(DatabaseTargetAuthorizationError);
  });

  it("fails closed when NODE_ENV is development and production authorization is missing", () => {
    expect(() =>
      assertBootstrapAuthorization(
        baseEnv({
          NODE_ENV: "development",
          BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED: undefined,
        }),
      ),
    ).toThrow(DatabaseTargetAuthorizationError);
  });

  it("fails closed on database host mismatch", () => {
    expect(() =>
      assertBootstrapAuthorization(
        baseEnv({ BOOTSTRAP_FIRST_ADMIN_EXPECTED_HOST: "other-host.example.invalid" }),
      ),
    ).toThrow(DatabaseTargetAuthorizationError);
  });

  it("fails closed on database name mismatch", () => {
    expect(() =>
      assertBootstrapAuthorization(
        baseEnv({ BOOTSTRAP_FIRST_ADMIN_EXPECTED_NAME: "wrong_db" }),
      ),
    ).toThrow(DatabaseTargetAuthorizationError);
  });
});

describe("legacy create-first-admin path elimination", () => {
  it("fails closed with deprecation message when legacy entrypoint is invoked", () => {
    expect(() => runLegacyCreateFirstAdmin()).toThrow(
      LEGACY_FIRST_ADMIN_DEPRECATION_MESSAGE,
    );
  });
});

describe("first admin bootstrap - state gate decision logic", () => {
  const targetEmail = "owner@example.com";

  it("allows creation when database has 0 users", () => {
    const decision = evaluateBootstrapStateGate([], targetEmail);
    expect(decision.action).toBe("PROCEED_CREATE");
  });

  it("returns VERIFY_IDEMPOTENT when matching active Admin with valid credential already exists", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          {
            providerId: CREDENTIAL_PROVIDER_ID,
            passwordHash: "valid-stored-hash",
          },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("VERIFY_IDEMPOTENT");
    if (decision.action === "VERIFY_IDEMPOTENT") {
      expect(decision.existingUser.id).toBe("user-1");
      expect(decision.storedPasswordHash).toBe("valid-stored-hash");
    }
  });

  it("blocks when target email exists but role is non-admin", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "sale",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          {
            providerId: CREDENTIAL_PROVIDER_ID,
            passwordHash: "hash-1",
          },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("TARGET_EMAIL_EXISTS_NON_ADMIN");
    }
  });

  it("blocks when target email exists but user is inactive or deleted", () => {
    const existingInactive: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: false,
        deletedAt: null,
        credentialAccounts: [
          {
            providerId: CREDENTIAL_PROVIDER_ID,
            passwordHash: "hash-1",
          },
        ],
      },
    ];

    const decisionInactive = evaluateBootstrapStateGate(existingInactive, targetEmail);
    expect(decisionInactive.action).toBe("BLOCKED");
    if (decisionInactive.action === "BLOCKED") {
      expect(decisionInactive.code).toBe("TARGET_EMAIL_INACTIVE_OR_DELETED");
    }

    const existingDeleted: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: true,
        deletedAt: new Date(),
        credentialAccounts: [
          {
            providerId: CREDENTIAL_PROVIDER_ID,
            passwordHash: "hash-1",
          },
        ],
      },
    ];

    const decisionDeleted = evaluateBootstrapStateGate(existingDeleted, targetEmail);
    expect(decisionDeleted.action).toBe("BLOCKED");
    if (decisionDeleted.action === "BLOCKED") {
      expect(decisionDeleted.code).toBe("TARGET_EMAIL_INACTIVE_OR_DELETED");
    }
  });

  it("blocks when target email exists but is missing credential account", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("TARGET_EMAIL_MISSING_CREDENTIAL");
    }
  });

  it("blocks when target email exists but has multiple conflicting credential accounts", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          { providerId: CREDENTIAL_PROVIDER_ID, passwordHash: "hash-1" },
          { providerId: CREDENTIAL_PROVIDER_ID, passwordHash: "hash-2" },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("TARGET_EMAIL_CONFLICTING_CREDENTIALS");
    }
  });

  it("blocks when target email exists but has invalid credential provider", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          { providerId: "oauth-google", passwordHash: "hash-1" },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("TARGET_EMAIL_INVALID_CREDENTIAL_PROVIDER");
    }
  });

  it("blocks when target email exists but has empty or whitespace password hash", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          { providerId: CREDENTIAL_PROVIDER_ID, passwordHash: "   " },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("TARGET_EMAIL_MALFORMED_CREDENTIAL");
    }
  });

  it("blocks when single existing user has a different email and is Admin", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-2",
        email: "other.admin@example.com",
        name: "Other Admin",
        role: "admin",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          { providerId: CREDENTIAL_PROVIDER_ID, passwordHash: "hash-2" },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("EXISTING_DIFFERENT_ADMIN");
    }
  });

  it("blocks when single existing user has a different email and is non-admin", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-3",
        email: "staff@example.com",
        name: "Staff",
        role: "accountant",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          { providerId: CREDENTIAL_PROVIDER_ID, passwordHash: "hash-3" },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("EXISTING_NON_ADMIN_USER");
    }
  });

  it("blocks when multiple users exist in the database", () => {
    const existing: BootstrapUserSnapshot[] = [
      {
        id: "user-1",
        email: "owner@example.com",
        name: "Owner",
        role: "admin",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          { providerId: CREDENTIAL_PROVIDER_ID, passwordHash: "hash-1" },
        ],
      },
      {
        id: "user-2",
        email: "sales@example.com",
        name: "Sales",
        role: "sale",
        isActive: true,
        deletedAt: null,
        credentialAccounts: [
          { providerId: CREDENTIAL_PROVIDER_ID, passwordHash: "hash-2" },
        ],
      },
    ];

    const decision = evaluateBootstrapStateGate(existing, targetEmail);
    expect(decision.action).toBe("BLOCKED");
    if (decision.action === "BLOCKED") {
      expect(decision.code).toBe("MULTIPLE_USERS_EXIST");
    }
  });
});

describe("first admin bootstrap - password verification primitive", () => {
  it("verifies supplied password against stored hash using Better Auth crypto", async () => {
    const hash = await hashCredentialPassword("SecretPassword123!");

    const match = await verifyBootstrapPassword({
      storedPasswordHash: hash,
      suppliedPassword: "SecretPassword123!",
    });
    expect(match).toBe(true);

    const noMatch = await verifyBootstrapPassword({
      storedPasswordHash: hash,
      suppliedPassword: "WrongPassword123!",
    });
    expect(noMatch).toBe(false);
  });
});

describe("first admin bootstrap - idempotent execution and mutation safety", () => {
  const credentials: BootstrapCredentials = {
    email: "admin@example.com",
    name: "Admin User",
    password: "CorrectPassword123!",
  };

  function setupMockDb(options: {
    existingUsers: Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      deletedAt: Date | null;
    }>;
    credentialAccounts: Array<{
      userId: string;
      providerId: string;
      password: string | null;
    }>;
    createdUser?: {
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      deletedAt: Date | null;
      emailVerified: boolean;
    };
  }) {
    const insertedRows: Array<{ table: unknown; values: unknown }> = [];
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();

    const mockTx = {
      execute: vi.fn().mockResolvedValue([]),
      update: updateSpy,
      delete: deleteSpy,
      select: vi.fn((fields?: unknown) => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn(() => {
            if (fields && typeof fields === "object" && "count" in fields) {
              return Promise.resolve([{ count: 1 }]);
            }
            if (table === accounts) {
              const insertedAccount = insertedRows.find(
                (r) => r.table === accounts,
              )?.values as { password?: string } | undefined;
              if (insertedAccount) {
                return Promise.resolve([
                  {
                    providerId: CREDENTIAL_PROVIDER_ID,
                    password: insertedAccount.password ?? "mock-password-hash",
                  },
                ]);
              }
              return Promise.resolve(options.credentialAccounts);
            }
            if (table === users) {
              return Promise.resolve(
                options.existingUsers.filter((u) => u.role === "admin"),
              );
            }
            if (table === sessions) {
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          }),
          then: (resolve: (val: unknown) => unknown) => {
            if (fields && typeof fields === "object" && "count" in fields) {
              return Promise.resolve([{ count: 1 }]).then(resolve);
            }
            if (table === users) {
              return Promise.resolve(options.existingUsers).then(resolve);
            }
            if (table === accounts) {
              return Promise.resolve(options.credentialAccounts).then(resolve);
            }
            return Promise.resolve([]).then(resolve);
          },
        })),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          insertedRows.push({ table, values });
          return {
            returning: vi.fn(() => {
              if (table === users) {
                return Promise.resolve([
                  options.createdUser ?? {
                    id: "new-admin-id",
                    name: (values as { name?: string }).name ?? "Admin User",
                    email: (values as { email?: string }).email ?? "admin@example.com",
                    role: "admin",
                    isActive: true,
                    emailVerified: false,
                    deletedAt: null,
                  },
                ]);
              }
              return Promise.resolve([]);
            }),
            then: (resolve: (val: unknown) => unknown) =>
              Promise.resolve().then(resolve),
          };
        }),
      })),
    };

    const mockDb = {
      transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return await cb(mockTx);
      }),
    };

    return {
      mockDb: mockDb as unknown as Database,
      mockTx,
      insertedRows,
      updateSpy,
      deleteSpy,
    };
  }

  it("matching Admin + matching password -> idempotent success with NO mutations", async () => {
    const { mockDb, mockTx, insertedRows, updateSpy, deleteSpy } = setupMockDb({
      existingUsers: [
        {
          id: "existing-admin-id",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          isActive: true,
          deletedAt: null,
        },
      ],
      credentialAccounts: [
        {
          userId: "existing-admin-id",
          providerId: CREDENTIAL_PROVIDER_ID,
          password: "mock-valid-hash",
        },
      ],
    });

    const verifyMock = vi.fn().mockResolvedValue(true);

    const result = await executeFirstAdminBootstrap({
      db: mockDb,
      credentials,
      verifyPasswordFn: verifyMock,
    });

    expect(result.status).toBe("ALREADY_BOOTSTRAPPED");
    expect(result.userId).toBe("existing-admin-id");
    expect(result.email).toBe("admin@example.com");
    expect(result.role).toBe("admin");
    expect(result.isActive).toBe(true);
    expect(result.totalUsers).toBe(1);
    expect(result.totalAdmins).toBe(1);
    expect(result.activeAdmins).toBe(1);

    // Assert: No password reset, no update, no insert, no delete, no session
    expect(insertedRows).toHaveLength(0);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it("matching Admin + wrong password -> blocked, no mutation", async () => {
    const { mockDb, insertedRows, updateSpy, deleteSpy } = setupMockDb({
      existingUsers: [
        {
          id: "existing-admin-id",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          isActive: true,
          deletedAt: null,
        },
      ],
      credentialAccounts: [
        {
          userId: "existing-admin-id",
          providerId: CREDENTIAL_PROVIDER_ID,
          password: "mock-valid-hash",
        },
      ],
    });

    const verifyMock = vi.fn().mockResolvedValue(false);

    await expect(
      executeFirstAdminBootstrap({
        db: mockDb,
        credentials,
        verifyPasswordFn: verifyMock,
      }),
    ).rejects.toThrow(
      "STOP — EXISTING ADMIN CREDENTIAL DOES NOT MATCH PROVIDED BOOTSTRAP PASSWORD",
    );

    // Assert: No mutation occurred
    expect(insertedRows).toHaveLength(0);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("matching Admin + missing credential -> blocked, no mutation", async () => {
    const { mockDb, insertedRows, updateSpy, deleteSpy } = setupMockDb({
      existingUsers: [
        {
          id: "existing-admin-id",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          isActive: true,
          deletedAt: null,
        },
      ],
      credentialAccounts: [],
    });

    await expect(
      executeFirstAdminBootstrap({
        db: mockDb,
        credentials,
      }),
    ).rejects.toThrow(
      /Existing Admin user matching .* is missing a credential account/,
    );

    expect(insertedRows).toHaveLength(0);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("matching Admin + malformed credential -> blocked, no mutation", async () => {
    const { mockDb, insertedRows, updateSpy, deleteSpy } = setupMockDb({
      existingUsers: [
        {
          id: "existing-admin-id",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          isActive: true,
          deletedAt: null,
        },
      ],
      credentialAccounts: [
        {
          userId: "existing-admin-id",
          providerId: CREDENTIAL_PROVIDER_ID,
          password: "   ",
        },
      ],
    });

    await expect(
      executeFirstAdminBootstrap({
        db: mockDb,
        credentials,
      }),
    ).rejects.toThrow(
      /Existing Admin user matching .* has an empty or malformed password hash/,
    );

    expect(insertedRows).toHaveLength(0);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("matching Admin + correct credential -> no password or timestamp update query called", async () => {
    const { mockDb, updateSpy } = setupMockDb({
      existingUsers: [
        {
          id: "existing-admin-id",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin",
          isActive: true,
          deletedAt: null,
        },
      ],
      credentialAccounts: [
        {
          userId: "existing-admin-id",
          providerId: CREDENTIAL_PROVIDER_ID,
          password: "mock-valid-hash",
        },
      ],
    });

    const verifyMock = vi.fn().mockResolvedValue(true);

    await executeFirstAdminBootstrap({
      db: mockDb,
      credentials,
      verifyPasswordFn: verifyMock,
    });

    // Explicitly verify update was NEVER called
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("fresh creation records audit row with truthful null actorUserId (Option B)", async () => {
    const { mockDb, insertedRows } = setupMockDb({
      existingUsers: [],
      credentialAccounts: [],
      createdUser: {
        id: "created-admin-id",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        isActive: true,
        deletedAt: null,
        emailVerified: false,
      },
    });

    const verifyMock = vi.fn().mockResolvedValue(true);

    const result = await executeFirstAdminBootstrap({
      db: mockDb,
      credentials,
      verifyPasswordFn: verifyMock,
    });

    expect(result.status).toBe("CREATED");
    expect(result.userId).toBe("created-admin-id");

    // Inspect inserted rows: users, accounts, auditLogs
    const auditInsert = insertedRows.find((r) => r.table === auditLogs);
    expect(auditInsert).toBeDefined();

    const auditData = auditInsert?.values as {
      actorUserId: unknown;
      action: string;
      entityType: string;
      entityId: string;
      reason: string;
    };

    // Truthful provenance: actorUserId is null, NEVER created-admin-id
    expect(auditData.actorUserId).toBeNull();
    expect(auditData.actorUserId).not.toBe("created-admin-id");
    expect(auditData.action).toBe("user.bootstrap_first_admin");
    expect(auditData.entityType).toBe("user");
    expect(auditData.entityId).toBe("created-admin-id");
    expect(auditData.reason).toContain("Initial first-admin operator bootstrap");
  });
});
