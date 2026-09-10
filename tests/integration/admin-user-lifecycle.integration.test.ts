import { randomUUID } from "node:crypto";

import { and, eq, ilike, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  accounts,
  auditLogs,
  sessions,
  users,
  type User,
} from "@/lib/db/schema";
import {
  buildCredentialAccountValues,
  hashCredentialPassword,
  verifyCredentialPassword,
} from "@/lib/auth/credentials";
import { auth } from "@/lib/auth/server";
import {
  changeAdminManagedUserRole,
  createAdminManagedUser,
  deactivateAdminManagedUser,
  reactivateAdminManagedUser,
  revokeAdminManagedUserSessions,
  setAdminManagedUserTemporaryPassword,
  softDeleteAdminManagedUser,
} from "@/features/admin/users/mutations";
import { changeOwnAdminPassword } from "@/features/admin/users/self-password";
import { ADMIN_USER_MANAGEMENT_ERROR_CODES } from "@/features/admin/users/errors";

import {
  createIntegrationActors,
  createIntegrationUser,
  type IntegrationActors,
} from "./fixtures/users";
import { listAuditLogsForEntity } from "./helpers/audit";
import { createIntegrationRunId, toEmailToken } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { db, ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("ADM");
const emailToken = toEmailToken(runId);
let actors: IntegrationActors;

async function createSessionForUser(userId: string, label: string) {
  const [created] = await db
    .insert(sessions)
    .values({
      id: randomUUID(),
      userId,
      token: `${runId}-${label}-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create integration session.");
  }

  return created;
}

async function countSessionsForUser(userId: string): Promise<number> {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  return rows.length;
}

async function countSessionsForToken(token: string): Promise<number> {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.token, token));

  return rows.length;
}

async function loadCredentialAccount(userId: string) {
  const [credential] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);

  if (!credential) {
    throw new Error("Expected credential account to exist.");
  }

  return credential;
}

async function reloadUser(id: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    throw new Error("Expected user to exist.");
  }

  return user;
}

async function countAuditAction(action: string, entityId: string): Promise<number> {
  const rows = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, action), eq(auditLogs.entityId, entityId)));

  return rows.length;
}

describe("admin user lifecycle mutations", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("creates internal users with Better Auth-compatible credentials and no session", async () => {
    const createdSale = await createAdminManagedUser({
      name: "Managed Sale",
      email: `Managed.Sale.${emailToken}@integration.test`,
      role: "sale",
      temporaryPassword: "temporary-password-1",
    }, actors.admin);
    const createdAccountant = await createAdminManagedUser({
      name: "Managed Accountant",
      email: `managed.accountant.${emailToken}@integration.test`,
      role: "accountant",
      temporaryPassword: "temporary-password-1",
    }, actors.admin);
    const tamperedAdminInput = {
      name: "Managed Admin",
      email: `managed.admin.${emailToken}@integration.test`,
      role: "admin",
      temporaryPassword: "temporary-password-1",
    } as unknown as Parameters<typeof createAdminManagedUser>[0];

    expect(createdSale).toMatchObject({
      email: `managed.sale.${emailToken}@integration.test`,
      role: "sale",
      isActive: true,
      deletedAt: null,
    });
    expect(createdAccountant.role).toBe("accountant");
    await expect(createAdminManagedUser(tamperedAdminInput, actors.admin))
      .rejects.toBeDefined();

    const [credential] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, createdSale.id))
      .limit(1);

    expect(credential).toMatchObject({
      providerId: "credential",
      accountId: createdSale.id,
      userId: createdSale.id,
    });
    expect(credential?.password).toBeTruthy();
    await expect(verifyCredentialPassword({
      hash: credential?.password ?? "",
      password: "temporary-password-1",
    })).resolves.toBe(true);
    await expect(countSessionsForUser(createdSale.id)).resolves.toBe(0);

    const auditRows = await listAuditLogsForEntity("user", createdSale.id);
    const createAudit = auditRows.find((row) => row.action === "user.create");
    expect(createAudit?.after).toMatchObject({
      id: createdSale.id,
      email: createdSale.email,
      role: "sale",
      isActive: true,
      deletedAt: null,
    });
    expect(JSON.stringify(createAudit)).not.toContain("temporary-password-1");
    expect(JSON.stringify(createAudit)).not.toContain(credential?.password ?? "");
  });

  it("maps duplicate normalized email to a safe domain error", async () => {
    const email = `duplicate.${emailToken}@integration.test`;

    await createAdminManagedUser({
      name: "Duplicate One",
      email,
      role: "sale",
      temporaryPassword: "temporary-password-1",
    }, actors.admin);

    await expect(createAdminManagedUser({
      name: "Duplicate Two",
      email: email.toUpperCase(),
      role: "sale",
      temporaryPassword: "temporary-password-1",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_DUPLICATE_EMAIL,
    });
  });

  it("changes roles for active and inactive users, revokes sessions, and audits without a separate session audit", async () => {
    const target = await createIntegrationUser({
      runId,
      label: "role-target",
      role: "sale",
    });
    await createSessionForUser(target.id, "role-a");
    await createSessionForUser(target.id, "role-b");

    const changed = await changeAdminManagedUserRole({
      id: target.id,
      role: "accountant",
      reason: "  team change  ",
    }, actors.admin);

    expect(changed.user.role).toBe("accountant");
    expect(changed.revokedSessionCount).toBe(2);
    await expect(countSessionsForUser(target.id)).resolves.toBe(0);

    const auditRows = await listAuditLogsForEntity("user", target.id);
    expect(auditRows.find((row) => row.action === "user.role_change"))
      ?.toMatchObject({
        reason: "team change",
        after: expect.objectContaining({ revokedSessionCount: 2 }),
      });
    expect(auditRows.some((row) => row.action === "user.sessions_revoked"))
      .toBe(false);

    const inactive = await createIntegrationUser({
      runId,
      label: "inactive-role-target",
      role: "accountant",
      isActive: false,
    });

    await expect(changeAdminManagedUserRole({
      id: inactive.id,
      role: "sale",
      reason: null,
    }, actors.admin)).resolves.toMatchObject({
      user: expect.objectContaining({ role: "sale", isActive: false }),
    });
  });

  it("denies Sale/Accountant lifecycle calls and same-role changes without false audit", async () => {
    const target = await createIntegrationUser({
      runId,
      label: "denied-target",
      role: "sale",
    });

    await expect(changeAdminManagedUserRole({
      id: target.id,
      role: "accountant",
      reason: null,
    }, actors.saleA)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
    });
    await expect(changeAdminManagedUserRole({
      id: target.id,
      role: "accountant",
      reason: null,
    }, actors.accountant)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
    });
    await expect(changeAdminManagedUserRole({
      id: target.id,
      role: "sale",
      reason: null,
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ROLE_UNCHANGED,
    });

    await expect(countAuditAction("user.role_change", target.id)).resolves.toBe(0);
  });

  it("deactivates, reactivates, and preserves session revocation semantics", async () => {
    const target = await createIntegrationUser({
      runId,
      label: "deactivate-target",
      role: "accountant",
    });
    await createSessionForUser(target.id, "deactivate");

    const deactivated = await deactivateAdminManagedUser({
      id: target.id,
      reason: "left department",
    }, actors.admin);

    expect(deactivated.user.isActive).toBe(false);
    expect(deactivated.revokedSessionCount).toBe(1);
    await expect(countSessionsForUser(target.id)).resolves.toBe(0);

    const reactivated = await reactivateAdminManagedUser({
      id: target.id,
      reason: "returned",
    }, actors.admin);

    expect(reactivated.isActive).toBe(true);
    await expect(countSessionsForUser(target.id)).resolves.toBe(0);
    await expect(countAuditAction("user.deactivate", target.id)).resolves.toBe(1);
    await expect(countAuditAction("user.reactivate", target.id)).resolves.toBe(1);
  });

  it("soft-deletes by preserving the user row, setting inactive, and revoking sessions", async () => {
    const target = await createIntegrationUser({
      runId,
      label: "soft-delete-target",
      role: "accountant",
    });
    await createSessionForUser(target.id, "soft-delete");

    const result = await softDeleteAdminManagedUser({
      id: target.id,
      reason: "left company",
    }, actors.admin);
    const persisted = await reloadUser(target.id);

    expect(result.user.id).toBe(target.id);
    expect(persisted.isActive).toBe(false);
    expect(persisted.deletedAt).toBeInstanceOf(Date);
    await expect(countSessionsForUser(target.id)).resolves.toBe(0);
    await expect(countAuditAction("user.soft_delete", target.id)).resolves.toBe(1);

    await expect(reactivateAdminManagedUser({
      id: target.id,
      reason: null,
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
    });
  });

  it("manually revokes all sessions for active/inactive targets but rejects self and deleted targets", async () => {
    const target = await createIntegrationUser({
      runId,
      label: "manual-revoke-target",
      role: "sale",
    });
    await createSessionForUser(target.id, "manual-a");
    await createSessionForUser(target.id, "manual-b");

    const result = await revokeAdminManagedUserSessions({
      id: target.id,
      reason: "security review",
    }, actors.admin);

    expect(result).toEqual({
      targetUserId: target.id,
      revokedSessionCount: 2,
    });
    await expect(countSessionsForUser(target.id)).resolves.toBe(0);

    await expect(revokeAdminManagedUserSessions({
      id: actors.admin.id,
      reason: "self",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
    });
    await expect(revokeAdminManagedUserSessions({
      id: actors.deletedSale.id,
      reason: "deleted",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
    });
  });

  it("sets an existing temporary password, revokes sessions, and audits without exposing secrets", async () => {
    const target = await createAdminManagedUser({
      name: "Password Reset Target",
      email: `password.reset.${emailToken}@integration.test`,
      role: "sale",
      temporaryPassword: "temporary-password-1",
    }, actors.admin);
    const session = await createSessionForUser(target.id, "password-reset");
    const beforeCredential = await loadCredentialAccount(target.id);

    await expect(verifyCredentialPassword({
      hash: beforeCredential.password ?? "",
      password: "temporary-password-1",
    })).resolves.toBe(true);

    const result = await setAdminManagedUserTemporaryPassword({
      id: target.id,
      temporaryPassword: "temporary-password-2",
      reason: "  account recovery  ",
    }, actors.admin);
    const afterCredential = await loadCredentialAccount(target.id);

    expect(result).toEqual({
      targetUserId: target.id,
      revokedSessionCount: 1,
    });
    expect(afterCredential.id).toBe(beforeCredential.id);
    expect(afterCredential.password).not.toBe(beforeCredential.password);
    await expect(verifyCredentialPassword({
      hash: afterCredential.password ?? "",
      password: "temporary-password-1",
    })).resolves.toBe(false);
    await expect(verifyCredentialPassword({
      hash: afterCredential.password ?? "",
      password: "temporary-password-2",
    })).resolves.toBe(true);
    await expect(countSessionsForUser(target.id)).resolves.toBe(0);
    await expect(countSessionsForToken(session.token)).resolves.toBe(0);

    const auditRows = await listAuditLogsForEntity("user", target.id);
    const passwordAudit = auditRows.find(
      (row) => row.action === "user.password_set_by_admin",
    );
    expect(passwordAudit).toMatchObject({
      reason: "account recovery",
      after: expect.objectContaining({
        targetUserId: target.id,
        role: "sale",
        isActive: true,
        deletedAt: null,
        revokedSessionCount: 1,
      }),
    });
    expect(JSON.stringify(passwordAudit)).not.toContain("temporary-password-1");
    expect(JSON.stringify(passwordAudit)).not.toContain("temporary-password-2");
    expect(JSON.stringify(passwordAudit)).not.toContain(afterCredential.password ?? "");
  });

  it("denies password reset to Sale, Accountant, self, and soft-deleted targets without false audit", async () => {
    const target = await createAdminManagedUser({
      name: "Password Denied Target",
      email: `password.denied.${emailToken}@integration.test`,
      role: "accountant",
      temporaryPassword: "temporary-password-1",
    }, actors.admin);

    await expect(setAdminManagedUserTemporaryPassword({
      id: target.id,
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    }, actors.saleA)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
    });
    await expect(setAdminManagedUserTemporaryPassword({
      id: target.id,
      temporaryPassword: "temporary-password-2",
      reason: "account recovery",
    }, actors.accountant)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_MANAGEMENT_FORBIDDEN,
    });
    await expect(setAdminManagedUserTemporaryPassword({
      id: actors.admin.id,
      temporaryPassword: "temporary-password-2",
      reason: "self",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
    });

    await softDeleteAdminManagedUser({
      id: target.id,
      reason: "left company",
    }, actors.admin);

    await expect(setAdminManagedUserTemporaryPassword({
      id: target.id,
      temporaryPassword: "temporary-password-2",
      reason: "deleted",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_INVALID_STATE,
    });
    await expect(countAuditAction("user.password_set_by_admin", target.id))
      .resolves.toBe(0);
  });

  it("protects the last active Admin from demotion, deactivation, and soft delete", async () => {
    await expect(changeAdminManagedUserRole({
      id: actors.admin.id,
      role: "sale",
      reason: null,
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
    });
    await expect(deactivateAdminManagedUser({
      id: actors.admin.id,
      reason: "not allowed",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
    });
    await expect(softDeleteAdminManagedUser({
      id: actors.admin.id,
      reason: "not allowed",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_SELF_ACTION_FORBIDDEN,
    });

    const secondAdmin = await createIntegrationUser({
      runId,
      label: "second-admin",
      role: "admin",
    });

    await expect(changeAdminManagedUserRole({
      id: secondAdmin.id,
      role: "accountant",
      reason: "coverage",
    }, actors.admin)).resolves.toMatchObject({
      user: expect.objectContaining({ role: "accountant" }),
    });
  });

  it("rejects promotion and reactivation paths that would create another active Admin", async () => {
    const activeSale = await createIntegrationUser({
      runId,
      label: "admin-promotion-target",
      role: "sale",
    });
    const inactiveAdmin = await createIntegrationUser({
      runId,
      label: "inactive-admin-reactivation-target",
      role: "admin",
      isActive: false,
    });

    await expect(changeAdminManagedUserRole({
      id: activeSale.id,
      role: "admin",
      reason: "tampered promotion",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ADMIN_UNIQUENESS_PROTECTED,
    });
    await expect(reactivateAdminManagedUser({
      id: inactiveAdmin.id,
      reason: "tampered reactivation",
    }, actors.admin)).rejects.toMatchObject({
      code: ADMIN_USER_MANAGEMENT_ERROR_CODES.USER_ADMIN_UNIQUENESS_PROTECTED,
    });

    expect((await reloadUser(activeSale.id)).role).toBe("sale");
    expect((await reloadUser(inactiveAdmin.id)).isActive).toBe(false);
  });

  it("changes the Admin's own Better Auth credential, preserves the current session, revokes others, and audits safely", async () => {
    const oldPassword = `old-${runId}-password`;
    const newPassword = `new-${runId}-password`;
    const passwordHash = await hashCredentialPassword(oldPassword);

    await db.insert(accounts).values(buildCredentialAccountValues({
      userId: actors.admin.id,
      passwordHash,
    }));
    const otherSession = await createSessionForUser(
      actors.admin.id,
      "self-password-other",
    );

    const loginResponse = await auth.api.signInEmail({
      asResponse: true,
      body: {
        email: actors.admin.email,
        password: oldPassword,
      },
    });
    expect(loginResponse.status).toBe(200);
    const cookieHeader = loginResponse.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";", 1)[0])
      .join("; ");
    expect(cookieHeader).not.toBe("");
    const requestHeaders = new Headers({ cookie: cookieHeader });

    await expect(changeOwnAdminPassword({
      currentPassword: oldPassword,
      newPassword,
      confirmNewPassword: newPassword,
    }, actors.admin, requestHeaders)).resolves.toEqual({
      targetUserId: actors.admin.id,
      otherSessionsRevoked: true,
    });

    const credential = await loadCredentialAccount(actors.admin.id);
    await expect(verifyCredentialPassword({
      hash: credential.password ?? "",
      password: oldPassword,
    })).resolves.toBe(false);
    await expect(verifyCredentialPassword({
      hash: credential.password ?? "",
      password: newPassword,
    })).resolves.toBe(true);
    await expect(countSessionsForToken(otherSession.token)).resolves.toBe(0);
    await expect(countSessionsForUser(actors.admin.id)).resolves.toBe(1);

    const oldPasswordLogin = await auth.api.signInEmail({
      asResponse: true,
      body: { email: actors.admin.email, password: oldPassword },
    });
    const newPasswordLogin = await auth.api.signInEmail({
      asResponse: true,
      body: { email: actors.admin.email, password: newPassword },
    });
    expect(oldPasswordLogin.status).toBe(401);
    expect(newPasswordLogin.status).toBe(200);

    const auditRows = await listAuditLogsForEntity("user", actors.admin.id);
    const audit = auditRows.find(
      (row) => row.action === "user.password.change_self",
    );
    expect(audit?.after).toEqual({
      actorUserId: actors.admin.id,
      targetUserId: actors.admin.id,
      otherSessionsRevoked: true,
    });
    const auditPayload = JSON.stringify(audit);
    expect(auditPayload).not.toContain(oldPassword);
    expect(auditPayload).not.toContain(newPassword);
    expect(auditPayload).not.toContain(credential.password ?? "");
    expect(auditPayload).not.toContain(cookieHeader);
  });

  it("serializes concurrent promotion attempts without creating another active Admin", async () => {
    const [targetA, targetB] = await Promise.all([
      createIntegrationUser({
        runId,
        label: "concurrent-promotion-a",
        role: "sale",
      }),
      createIntegrationUser({
        runId,
        label: "concurrent-promotion-b",
        role: "accountant",
      }),
    ]);

    const results = await Promise.allSettled([
      changeAdminManagedUserRole({
        id: targetA.id,
        role: "admin",
        reason: "concurrent promotion",
      }, actors.admin),
      changeAdminManagedUserRole({
        id: targetB.id,
        role: "admin",
        reason: "concurrent promotion",
      }, actors.admin),
    ]);

    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect((await reloadUser(targetA.id)).role).toBe("sale");
    expect((await reloadUser(targetB.id)).role).toBe("accountant");

    const activeAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );
    expect(activeAdmins).toHaveLength(1);
  });

  it("serializes concurrent active-admin reductions so the active Admin set never reaches zero", async () => {
    await db
      .update(users)
      .set({ role: "sale" })
      .where(and(eq(users.role, "admin"), ilike(users.email, `%${emailToken}%`)));

    const adminA = await createIntegrationUser({
      runId,
      label: "concurrent-admin-a",
      role: "admin",
    });
    const adminB = await createIntegrationUser({
      runId,
      label: "concurrent-admin-b",
      role: "admin",
    });

    const results = await Promise.allSettled([
      changeAdminManagedUserRole({
        id: adminA.id,
        role: "sale",
        reason: "concurrent demotion",
      }, adminB),
      deactivateAdminManagedUser({
        id: adminB.id,
        reason: "concurrent deactivation",
      }, adminA),
    ]);

    expect(results.filter((result) => result.status === "fulfilled").length)
      .toBe(1);
    expect(results.filter((result) => result.status === "rejected").length)
      .toBe(1);

    const activeAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );

    expect(activeAdmins.length).toBeGreaterThanOrEqual(1);
  });
});
