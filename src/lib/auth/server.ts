import "server-only";

import { APIError, BASE_ERROR_CODES, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import { authSchema, users } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";

const allowDevBootstrapSignUp =
  process.env.NODE_ENV !== "production" &&
  process.env.AUTH_ALLOW_DEV_BOOTSTRAP_SIGNUP === "true";

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  baseURL: env.AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
    usePlural: true,
  }),
  databaseHooks: {
    session: {
      create: {
        async before(session) {
          const user = await db.query.users.findFirst({
            columns: {
              isActive: true,
              deletedAt: true,
            },
            where: eq(users.id, session.userId),
          });

          if (!user || !user.isActive || user.deletedAt) {
            throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: !allowDevBootstrapSignUp,
    minPasswordLength: 8,
  },
});
