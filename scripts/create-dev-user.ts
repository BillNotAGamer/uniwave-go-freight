import { existsSync } from "node:fs";
import process from "node:process";

import { eq } from "drizzle-orm";
import { z } from "zod";

const DEV_ROLES = ["sale", "accountant"] as const;

const devUserEnvSchema = z.object({
  DEV_USER_EMAIL: z.string().trim().email(),
  DEV_USER_NAME: z.string().trim().min(1),
  DEV_USER_PASSWORD: z.string().min(8),
  DEV_USER_ROLE: z.enum(DEV_ROLES),
});

function exitWithError(message: string): never {
  throw new Error(message);
}

function loadLocalEnvFile(): void {
  const envPath = ".env.local";

  if (!existsSync(envPath)) {
    exitWithError(".env.local was not found. Create it before running dev:user:create.");
  }

  if (typeof process.loadEnvFile !== "function") {
    exitWithError("This Node.js version does not support process.loadEnvFile().");
  }

  process.loadEnvFile(envPath);
}

function validateDevUserEnv() {
  const parsed = devUserEnvSchema.safeParse({
    DEV_USER_EMAIL: process.env.DEV_USER_EMAIL,
    DEV_USER_NAME: process.env.DEV_USER_NAME,
    DEV_USER_PASSWORD: process.env.DEV_USER_PASSWORD,
    DEV_USER_ROLE: process.env.DEV_USER_ROLE,
  });

  if (!parsed.success) {
    const invalidFields = parsed.error.issues.map((issue) => issue.path.join("."));

    exitWithError(
      `Missing or invalid development user environment variables: ${invalidFields.join(", ")}`,
    );
  }

  return {
    email: parsed.data.DEV_USER_EMAIL.toLowerCase(),
    name: parsed.data.DEV_USER_NAME,
    password: parsed.data.DEV_USER_PASSWORD,
    role: parsed.data.DEV_USER_ROLE,
  };
}

async function main() {
  loadLocalEnvFile();

  if (process.env.NODE_ENV === "production") {
    exitWithError("dev:user:create is disabled in production.");
  }

  const bootstrap = validateDevUserEnv();

  process.env.AUTH_ALLOW_DEV_BOOTSTRAP_SIGNUP = "true";

  const [{ db }, { auth }, { users }] = await Promise.all([
    import("../src/lib/db/client"),
    import("../src/lib/auth/server"),
    import("../src/lib/db/schema"),
  ]);

  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.email, bootstrap.email))
    .limit(1);

  if (existingUser && existingUser.role !== bootstrap.role) {
    exitWithError(
      `A user with ${bootstrap.email} already exists with role ${existingUser.role}. Refusing to overwrite it.`,
    );
  }

  if (!existingUser) {
    await auth.api.signUpEmail({
      body: {
        email: bootstrap.email,
        name: bootstrap.name,
        password: bootstrap.password,
      },
    });
  }

  await db
    .update(users)
    .set({
      name: bootstrap.name,
      role: bootstrap.role,
      isActive: true,
      deletedAt: null,
    })
    .where(eq(users.email, bootstrap.email));

  const [verifiedUser] = await db
    .select({
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.email, bootstrap.email))
    .limit(1);

  if (!verifiedUser) {
    exitWithError("Development user verification failed: user record was not found.");
  }

  if (verifiedUser.email !== verifiedUser.email.toLowerCase()) {
    exitWithError("Development user verification failed: email is not stored in lowercase.");
  }

  if (verifiedUser.role !== bootstrap.role) {
    exitWithError("Development user verification failed: stored role does not match request.");
  }

  if (!verifiedUser.isActive) {
    exitWithError("Development user verification failed: user is inactive.");
  }

  if (verifiedUser.deletedAt !== null) {
    exitWithError("Development user verification failed: user is soft-deleted.");
  }

  if (existingUser) {
    console.log(
      `Development user already exists for ${bootstrap.email}. Verified ${bootstrap.role} access and active status.`,
    );
    return;
  }

  console.log(`Created development ${bootstrap.role} user for ${bootstrap.email}.`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`dev:user:create failed: ${error.message}`);
  } else {
    console.error("dev:user:create failed with an unknown error.");
  }

  process.exitCode = 1;
});
