import { existsSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import {
  assertAuthorizedDatabaseTarget,
  DatabaseTargetAuthorizationError,
  type AuthorizedDatabaseTarget,
} from "../src/lib/db/database-target-authorization";
import {
  BETTER_AUTH_PASSWORD_MAX_LENGTH,
  BETTER_AUTH_PASSWORD_MIN_LENGTH,
  buildCredentialAccountValues,
  CREDENTIAL_PROVIDER_ID,
  hashCredentialPassword,
  verifyCredentialPassword,
} from "../src/lib/auth/credentials";
import { accounts, auditLogs, sessions, users } from "../src/lib/db/schema";
import type { Database } from "../src/lib/db/client";

// Guard & authorization environment variables
export const BOOTSTRAP_FIRST_ADMIN_AUTHORIZED = "BOOTSTRAP_FIRST_ADMIN_AUTHORIZED";
export const BOOTSTRAP_FIRST_ADMIN_CONFIRM = "BOOTSTRAP_FIRST_ADMIN_CONFIRM";
export const BOOTSTRAP_FIRST_ADMIN_EXPECTED_HOST = "BOOTSTRAP_FIRST_ADMIN_EXPECTED_HOST";
export const BOOTSTRAP_FIRST_ADMIN_EXPECTED_NAME = "BOOTSTRAP_FIRST_ADMIN_EXPECTED_NAME";
export const BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED = "BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED";
export const EXPECTED_CONFIRM_TOKEN = "CREATE_FIRST_ADMIN";

// 64-bit advisory lock key dedicated to First Admin Bootstrap
export const FIRST_ADMIN_BOOTSTRAP_LOCK_KEY = "uniwave_first_admin_bootstrap";

export const bootstrapCredentialsSchema = z.object({
  email: z
    .string({ message: "BOOTSTRAP_ADMIN_EMAIL is required." })
    .trim()
    .email("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.")
    .transform((val) => val.toLowerCase()),
  name: z
    .string({ message: "BOOTSTRAP_ADMIN_NAME is required." })
    .trim()
    .min(1, "BOOTSTRAP_ADMIN_NAME must not be empty.")
    .max(120, "BOOTSTRAP_ADMIN_NAME must be at most 120 characters."),
  password: z
    .string({ message: "BOOTSTRAP_ADMIN_PASSWORD is required." })
    .min(
      BETTER_AUTH_PASSWORD_MIN_LENGTH,
      `BOOTSTRAP_ADMIN_PASSWORD must be at least ${BETTER_AUTH_PASSWORD_MIN_LENGTH} characters.`,
    )
    .max(
      BETTER_AUTH_PASSWORD_MAX_LENGTH,
      `BOOTSTRAP_ADMIN_PASSWORD must be at most ${BETTER_AUTH_PASSWORD_MAX_LENGTH} characters.`,
    ),
});

export type BootstrapCredentials = z.infer<typeof bootstrapCredentialsSchema>;

export type CredentialAccountSnapshot = {
  providerId: string;
  passwordHash: string | null;
};

export type BootstrapUserSnapshot = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  deletedAt: Date | null;
  credentialAccounts: CredentialAccountSnapshot[];
};

export type BootstrapStateDecision =
  | { action: "PROCEED_CREATE"; reason: string }
  | {
      action: "VERIFY_IDEMPOTENT";
      existingUser: BootstrapUserSnapshot;
      storedPasswordHash: string;
      reason: string;
    }
  | { action: "BLOCKED"; code: string; reason: string };

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const maskedLocal =
    local.length <= 2
      ? `${local[0]}***`
      : `${local.slice(0, 2)}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

export function loadEnvironmentFiles(): void {
  for (const envPath of [".env.local", ".env"]) {
    if (existsSync(envPath)) {
      try {
        if (typeof process.loadEnvFile === "function") {
          process.loadEnvFile(envPath);
        }
      } catch {
        // Continue if environment file could not be parsed
      }
    }
  }
}

export function validateBootstrapCredentials(
  env: Record<string, string | undefined> = process.env,
): BootstrapCredentials {
  const result = bootstrapCredentialsSchema.safeParse({
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    name: env.BOOTSTRAP_ADMIN_NAME,
    password: env.BOOTSTRAP_ADMIN_PASSWORD,
  });

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => issue.message)
      .join(" ");
    throw new Error(`Invalid bootstrap credentials: ${errorDetails}`);
  }

  return result.data;
}

/**
 * Validates the three mandatory live-mutation authorization gates.
 *
 * All three gates are strictly and unconditionally required for this
 * owner production-bootstrap script, regardless of NODE_ENV:
 * 1. BOOTSTRAP_FIRST_ADMIN_AUTHORIZED=true
 * 2. BOOTSTRAP_FIRST_ADMIN_CONFIRM=CREATE_FIRST_ADMIN
 * 3. BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED=true
 */
export function assertBootstrapAuthorization(
  env: Record<string, string | undefined> = process.env,
): AuthorizedDatabaseTarget {
  // Gate 1: Generic database mutation authorization
  if (env[BOOTSTRAP_FIRST_ADMIN_AUTHORIZED] !== "true") {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_NOT_AUTHORIZED",
      `first-admin bootstrap requires explicit database authorization ${BOOTSTRAP_FIRST_ADMIN_AUTHORIZED}=true.`,
    );
  }

  // Gate 2: Confirmation token
  const confirmToken = env[BOOTSTRAP_FIRST_ADMIN_CONFIRM];
  if (confirmToken !== EXPECTED_CONFIRM_TOKEN) {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_NOT_AUTHORIZED",
      `first-admin bootstrap requires explicit confirmation token ${BOOTSTRAP_FIRST_ADMIN_CONFIRM}=${EXPECTED_CONFIRM_TOKEN}.`,
    );
  }

  // Gate 3: Live/production authorization (UNCONDITIONAL: required regardless of NODE_ENV)
  if (env[BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED] !== "true") {
    throw new DatabaseTargetAuthorizationError(
      "INTEGRATION_DB_NOT_AUTHORIZED",
      `first-admin bootstrap requires explicit live/production authorization ${BOOTSTRAP_FIRST_ADMIN_PRODUCTION_AUTHORIZED}=true.`,
    );
  }

  // Gate 4: Database URL target parsing and identity verification (expected host and name)
  return assertAuthorizedDatabaseTarget({
    operation: "first-admin bootstrap",
    databaseUrl: env.DATABASE_URL,
    authorization: "true",
    productionAuthorization: "true",
    expectedHost: env[BOOTSTRAP_FIRST_ADMIN_EXPECTED_HOST],
    expectedDatabase: env[BOOTSTRAP_FIRST_ADMIN_EXPECTED_NAME],
    nodeEnv: env.NODE_ENV,
    forbidProductionNodeEnv: true,
  });
}

export function evaluateBootstrapStateGate(
  usersSnapshot: BootstrapUserSnapshot[],
  requestedEmail: string,
): BootstrapStateDecision {
  const normalizedRequestedEmail = requestedEmail.trim().toLowerCase();

  // Condition 1: Empty database -> Proceed with creation
  if (usersSnapshot.length === 0) {
    return {
      action: "PROCEED_CREATE",
      reason: "Database contains 0 users. First-admin creation permitted.",
    };
  }

  // Condition 2: Exactly 1 user exists
  if (usersSnapshot.length === 1) {
    const singleUser = usersSnapshot[0];
    const isMatchingEmail =
      singleUser.email.toLowerCase() === normalizedRequestedEmail;

    if (isMatchingEmail) {
      if (singleUser.role !== "admin") {
        return {
          action: "BLOCKED",
          code: "TARGET_EMAIL_EXISTS_NON_ADMIN",
          reason: `STOP — Existing user matching ${maskEmail(normalizedRequestedEmail)} has role '${singleUser.role}', not 'admin'.`,
        };
      }

      if (!singleUser.isActive || singleUser.deletedAt !== null) {
        return {
          action: "BLOCKED",
          code: "TARGET_EMAIL_INACTIVE_OR_DELETED",
          reason: `STOP — Existing Admin user matching ${maskEmail(normalizedRequestedEmail)} is inactive or soft-deleted.`,
        };
      }

      const credAccounts = singleUser.credentialAccounts;

      if (credAccounts.length === 0) {
        return {
          action: "BLOCKED",
          code: "TARGET_EMAIL_MISSING_CREDENTIAL",
          reason: `STOP — Existing Admin user matching ${maskEmail(normalizedRequestedEmail)} is missing a credential account.`,
        };
      }

      if (credAccounts.length > 1) {
        return {
          action: "BLOCKED",
          code: "TARGET_EMAIL_CONFLICTING_CREDENTIALS",
          reason: `STOP — Existing Admin user matching ${maskEmail(normalizedRequestedEmail)} has multiple conflicting credential accounts.`,
        };
      }

      const primaryAccount = credAccounts[0];

      if (primaryAccount.providerId !== CREDENTIAL_PROVIDER_ID) {
        return {
          action: "BLOCKED",
          code: "TARGET_EMAIL_INVALID_CREDENTIAL_PROVIDER",
          reason: `STOP — Existing Admin user credential provider is '${primaryAccount.providerId}', expected '${CREDENTIAL_PROVIDER_ID}'.`,
        };
      }

      if (!primaryAccount.passwordHash || primaryAccount.passwordHash.trim().length === 0) {
        return {
          action: "BLOCKED",
          code: "TARGET_EMAIL_MALFORMED_CREDENTIAL",
          reason: `STOP — Existing Admin user matching ${maskEmail(normalizedRequestedEmail)} has an empty or malformed password hash.`,
        };
      }

      return {
        action: "VERIFY_IDEMPOTENT",
        existingUser: singleUser,
        storedPasswordHash: primaryAccount.passwordHash,
        reason: "Matching Admin account found. Credential password verification required.",
      };
    }

    // Email does not match the single existing user
    if (singleUser.role === "admin") {
      return {
        action: "BLOCKED",
        code: "EXISTING_DIFFERENT_ADMIN",
        reason: "STOP — An Admin user already exists with a different email address.",
      };
    }

    return {
      action: "BLOCKED",
      code: "EXISTING_NON_ADMIN_USER",
      reason: "STOP — An existing non-admin user is already present in the database.",
    };
  }

  // Condition 3: Multiple users exist
  return {
    action: "BLOCKED",
    code: "MULTIPLE_USERS_EXIST",
    reason: `STOP — DATABASE IS NOT IN FIRST-ADMIN BOOTSTRAP STATE (${usersSnapshot.length} users exist).`,
  };
}

export async function verifyBootstrapPassword(input: {
  storedPasswordHash: string;
  suppliedPassword: string;
  verifyFn?: (input: { hash: string; password: string }) => Promise<boolean>;
}): Promise<boolean> {
  const verifier = input.verifyFn ?? verifyCredentialPassword;
  return await verifier({
    hash: input.storedPasswordHash,
    password: input.suppliedPassword,
  });
}

export type BootstrapExecutionResult = {
  status: "CREATED" | "ALREADY_BOOTSTRAPPED";
  userId: string;
  email: string;
  role: string;
  isActive: boolean;
  totalUsers: number;
  totalAdmins: number;
  activeAdmins: number;
};

export async function executeFirstAdminBootstrap(input: {
  db: Database;
  credentials: BootstrapCredentials;
  verifyPasswordFn?: (input: { hash: string; password: string }) => Promise<boolean>;
}): Promise<BootstrapExecutionResult> {
  const { db, credentials, verifyPasswordFn } = input;
  const passwordHash = await hashCredentialPassword(credentials.password);

  return await db.transaction(async (tx) => {
    // 1. Acquire transaction-level advisory lock to serialize concurrent bootstrap executions
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${FIRST_ADMIN_BOOTSTRAP_LOCK_KEY}));`,
    );

    // 2. Fetch current users and credential accounts within lock
    const existingUsers = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
      })
      .from(users);

    const credentialAccounts = await tx
      .select({
        userId: accounts.userId,
        providerId: accounts.providerId,
        password: accounts.password,
      })
      .from(accounts)
      .where(eq(accounts.providerId, CREDENTIAL_PROVIDER_ID));

    const accountsByUserId = new Map<string, CredentialAccountSnapshot[]>();
    for (const acc of credentialAccounts) {
      const list = accountsByUserId.get(acc.userId) ?? [];
      list.push({
        providerId: acc.providerId,
        passwordHash: acc.password,
      });
      accountsByUserId.set(acc.userId, list);
    }

    const userSnapshots: BootstrapUserSnapshot[] = existingUsers.map((u) => ({
      ...u,
      credentialAccounts: accountsByUserId.get(u.id) ?? [],
    }));

    // 3. Evaluate state gate
    const decision = evaluateBootstrapStateGate(
      userSnapshots,
      credentials.email,
    );

    if (decision.action === "BLOCKED") {
      throw new Error(decision.reason);
    }

    if (decision.action === "VERIFY_IDEMPOTENT") {
      // Verify supplied password against existing stored credential hash
      const isPasswordMatch = await verifyBootstrapPassword({
        storedPasswordHash: decision.storedPasswordHash,
        suppliedPassword: credentials.password,
        verifyFn: verifyPasswordFn,
      });

      if (!isPasswordMatch) {
        throw new Error(
          "STOP — EXISTING ADMIN CREDENTIAL DOES NOT MATCH PROVIDED BOOTSTRAP PASSWORD",
        );
      }

      const targetUser = decision.existingUser;

      return {
        status: "ALREADY_BOOTSTRAPPED",
        userId: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        isActive: targetUser.isActive,
        totalUsers: userSnapshots.length,
        totalAdmins: userSnapshots.filter((u) => u.role === "admin").length,
        activeAdmins: userSnapshots.filter(
          (u) => u.role === "admin" && u.isActive && u.deletedAt === null,
        ).length,
      };
    }

    // 4. Create the first and only Admin user
    const [createdUser] = await tx
      .insert(users)
      .values({
        name: credentials.name,
        email: credentials.email,
        role: "admin",
        isActive: true,
        deletedAt: null,
        emailVerified: false,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        deletedAt: users.deletedAt,
      });

    if (!createdUser) {
      throw new Error("Failed to create first admin user record.");
    }

    // 5. Create the credential account
    await tx.insert(accounts).values(
      buildCredentialAccountValues({
        userId: createdUser.id,
        passwordHash,
      }),
    );

    // 6. Log audit event with truthful actor provenance (actorUserId = null for system/operator bootstrap)
    await tx.insert(auditLogs).values({
      actorUserId: null,
      action: "user.bootstrap_first_admin",
      entityType: "user",
      entityId: createdUser.id,
      before: null,
      after: {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
        isActive: createdUser.isActive,
        deletedAt: createdUser.deletedAt,
      },
      reason: "Initial first-admin operator bootstrap (system/operator origin)",
    });

    // 7. Post-creation structural verification within transaction
    const [allUsersCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [adminUsersCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "admin"));

    const [activeAdminUsersCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );

    const createdAccounts = await tx
      .select({
        providerId: accounts.providerId,
        password: accounts.password,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, createdUser.id),
          eq(accounts.providerId, CREDENTIAL_PROVIDER_ID),
        ),
      );

    const userSessions = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, createdUser.id));

    if (Number(allUsersCount?.count) !== 1) {
      throw new Error(
        `Invariant violation: expected total users = 1, found ${allUsersCount?.count}.`,
      );
    }

    if (Number(adminUsersCount?.count) !== 1) {
      throw new Error(
        `Invariant violation: expected total admins = 1, found ${adminUsersCount?.count}.`,
      );
    }

    if (Number(activeAdminUsersCount?.count) !== 1) {
      throw new Error(
        `Invariant violation: expected active admins = 1, found ${activeAdminUsersCount?.count}.`,
      );
    }

    if (createdAccounts.length !== 1 || !createdAccounts[0]?.password) {
      throw new Error(
        "Invariant violation: valid credential account not found after creation.",
      );
    }

    if (userSessions.length !== 0) {
      throw new Error(
        `Invariant violation: expected 0 sessions created during bootstrap, found ${userSessions.length}.`,
      );
    }

    // Process-local credential verification check
    const isPasswordValid = await verifyBootstrapPassword({
      storedPasswordHash: createdAccounts[0].password,
      suppliedPassword: credentials.password,
      verifyFn: verifyPasswordFn,
    });

    if (!isPasswordValid) {
      throw new Error(
        "Invariant violation: stored password hash failed verification check.",
      );
    }

    return {
      status: "CREATED",
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      isActive: createdUser.isActive,
      totalUsers: 1,
      totalAdmins: 1,
      activeAdmins: 1,
    };
  });
}

async function main(): Promise<void> {
  console.log("=== Uniwave Go Freight: First Admin Bootstrap ===");
  loadEnvironmentFiles();

  // Validate credentials first (fail closed on syntax before touching DB)
  const credentials = validateBootstrapCredentials();
  console.log(`Target admin account: ${maskEmail(credentials.email)}`);

  // Assert authorization and database target
  const target = assertBootstrapAuthorization();
  console.log(
    `Database target authorized: host=${target.hostname}, db=${target.databaseName}`,
  );

  // Dynamic import of database client after authorization check
  const { db } = await import("../src/lib/db/client");

  console.log("Acquiring lock and inspecting database bootstrap state...");
  const result = await executeFirstAdminBootstrap({ db, credentials });

  if (result.status === "ALREADY_BOOTSTRAPPED") {
    console.log("\n[SUCCESS - IDEMPOTENT]");
    console.log("FIRST ADMIN ALREADY BOOTSTRAPPED — NO CHANGES");
    console.log(`Admin User ID : ${result.userId}`);
    console.log(`Admin Email   : ${maskEmail(result.email)}`);
    console.log(`Role          : ${result.role}`);
    console.log(`Active        : ${result.isActive}`);
    console.log(`Total Users   : ${result.totalUsers}`);
    console.log(`Active Admins : ${result.activeAdmins}`);
    return;
  }

  console.log("\n[SUCCESS - CREATED]");
  console.log("First Admin user bootstrapped successfully.");
  console.log(`Admin User ID : ${result.userId}`);
  console.log(`Admin Email   : ${maskEmail(result.email)}`);
  console.log(`Role          : ${result.role}`);
  console.log(`Active        : ${result.isActive}`);
  console.log(`Total Users   : ${result.totalUsers}`);
  console.log(`Active Admins : ${result.activeAdmins}`);
  console.log("\nNext step: Owner can log in via /login with configured credentials.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(
      "\n[BOOTSTRAP FAILED - CLOSED]",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
