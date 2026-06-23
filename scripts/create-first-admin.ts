import { existsSync } from "node:fs";
import process from "node:process";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { User } from "../src/lib/db/schema";

const bootstrapEnvSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email(),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8),
});

function exitWithError(message: string): never {
  throw new Error(message);
}

function loadLocalEnvFile(): void {
  const envPath = ".env.local";

  if (!existsSync(envPath)) {
    exitWithError(".env.local was not found. Create it before running admin:create-first.");
  }

  if (typeof process.loadEnvFile !== "function") {
    exitWithError("This Node.js version does not support process.loadEnvFile().");
  }

  process.loadEnvFile(envPath);
}

function validateBootstrapEnv() {
  const parsed = bootstrapEnvSchema.safeParse({
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_NAME: process.env.BOOTSTRAP_ADMIN_NAME,
    BOOTSTRAP_ADMIN_PASSWORD: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    const missingFields = parsed.error.issues.map((issue) => issue.path.join("."));

    exitWithError(
      `Missing or invalid bootstrap environment variables: ${missingFields.join(", ")}`,
    );
  }

  return {
    email: parsed.data.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
    name: parsed.data.BOOTSTRAP_ADMIN_NAME,
    password: parsed.data.BOOTSTRAP_ADMIN_PASSWORD,
  };
}

function assertSingleUsableAdmin(
  admins: Pick<User, "email" | "isActive" | "deletedAt">[],
  targetEmail: string,
): void {
  if (admins.length > 1) {
    exitWithError(
      "Multiple admin users already exist. Refusing to run an automated first-admin bootstrap.",
    );
  }

  if (admins.length === 0) {
    return;
  }

  const [admin] = admins;

  if (
    admin.email === targetEmail &&
    admin.isActive &&
    admin.deletedAt === null
  ) {
    return;
  }

  exitWithError(
    "An admin user already exists. Refusing to create or change a second admin automatically.",
  );
}

async function main() {
  loadLocalEnvFile();

  if (process.env.NODE_ENV === "production") {
    exitWithError("admin:create-first is disabled in production.");
  }

  const bootstrap = validateBootstrapEnv();

  process.env.AUTH_ALLOW_DEV_BOOTSTRAP_SIGNUP = "true";

  const [{ db }, { auth }, { users }] = await Promise.all([
    import("../src/lib/db/client"),
    import("../src/lib/auth/server"),
    import("../src/lib/db/schema"),
  ]);

  const existingAdmins = await db
    .select({
      email: users.email,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.role, "admin"));

  assertSingleUsableAdmin(existingAdmins, bootstrap.email);

  if (existingAdmins.length === 0) {
    const existingUser = await db
      .select({
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, bootstrap.email));

    if (existingUser.length > 0) {
      exitWithError(
        "A user with the requested bootstrap email already exists and is not the first admin.",
      );
    }

    const result = await auth.api.signUpEmail({
      body: {
        email: bootstrap.email,
        name: bootstrap.name,
        password: bootstrap.password,
      },
    });

    await db
      .update(users)
      .set({
        role: "admin",
        isActive: true,
        deletedAt: null,
      })
      .where(eq(users.id, result.user.id));

    console.log(`Created first admin user for ${bootstrap.email}.`);
  } else {
    console.log(`Admin user already exists for ${bootstrap.email}. No new user was created.`);
  }

  const signInResult = await auth.api.signInEmail({
    body: {
      email: bootstrap.email,
      password: bootstrap.password,
      rememberMe: false,
    },
  });

  const adminRows = await db
    .select({
      email: users.email,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.role, "admin"));

  if (adminRows.length !== 1) {
    exitWithError("Admin verification failed: expected exactly one admin user.");
  }

  const [admin] = adminRows;

  if (admin.email !== bootstrap.email) {
    exitWithError("Admin verification failed: bootstrap email does not match the stored admin.");
  }

  if (admin.email !== admin.email.toLowerCase()) {
    exitWithError("Admin verification failed: admin email is not stored in lowercase.");
  }

  if (!admin.isActive) {
    exitWithError("Admin verification failed: admin is inactive.");
  }

  if (admin.deletedAt !== null) {
    exitWithError("Admin verification failed: admin is soft-deleted.");
  }

  console.log(`Auth smoke test passed for ${signInResult.user.email}.`);
  console.log("Admin verification passed.");
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`admin:create-first failed: ${error.message}`);
  } else {
    console.error("admin:create-first failed with an unknown error.");
  }

  process.exitCode = 1;
});
