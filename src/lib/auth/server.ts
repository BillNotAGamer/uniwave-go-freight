import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { authSchema } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  baseURL: env.AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
});
