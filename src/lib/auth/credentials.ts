import "server-only";

import { hashPassword, verifyPassword } from "better-auth/crypto";

export {
  BETTER_AUTH_PASSWORD_MAX_LENGTH,
  BETTER_AUTH_PASSWORD_MIN_LENGTH,
} from "./password-policy";

export const CREDENTIAL_PROVIDER_ID = "credential";

export async function hashCredentialPassword(password: string): Promise<string> {
  return hashPassword(password);
}

export async function verifyCredentialPassword(input: {
  hash: string;
  password: string;
}): Promise<boolean> {
  return verifyPassword(input);
}

export function buildCredentialAccountValues(input: {
  userId: string;
  passwordHash: string;
}) {
  return {
    userId: input.userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    accountId: input.userId,
    password: input.passwordHash,
  };
}
