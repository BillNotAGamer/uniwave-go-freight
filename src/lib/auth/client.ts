"use client";

import { createAuthClient } from "better-auth/react";

const authBaseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
  basePath: "/api/auth",
});
