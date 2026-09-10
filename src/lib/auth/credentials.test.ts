import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Better Auth credential helper", () => {
  it("uses the credential account representation expected by Better Auth", async () => {
    const {
      BETTER_AUTH_PASSWORD_MAX_LENGTH,
      BETTER_AUTH_PASSWORD_MIN_LENGTH,
      CREDENTIAL_PROVIDER_ID,
      buildCredentialAccountValues,
    } = await import("./credentials");

    expect(BETTER_AUTH_PASSWORD_MIN_LENGTH).toBe(8);
    expect(BETTER_AUTH_PASSWORD_MAX_LENGTH).toBe(128);
    expect(CREDENTIAL_PROVIDER_ID).toBe("credential");
    expect(buildCredentialAccountValues({
      userId: "user-1",
      passwordHash: "hash-1",
    })).toEqual({
      userId: "user-1",
      providerId: "credential",
      accountId: "user-1",
      password: "hash-1",
    });
  });

  it("hashes passwords with Better Auth-compatible verification semantics", async () => {
    const {
      hashCredentialPassword,
      verifyCredentialPassword,
    } = await import("./credentials");

    const hash = await hashCredentialPassword("temporary-password-1");

    expect(hash).not.toBe("temporary-password-1");
    await expect(verifyCredentialPassword({
      hash,
      password: "temporary-password-1",
    })).resolves.toBe(true);
    await expect(verifyCredentialPassword({
      hash,
      password: "wrong-password",
    })).resolves.toBe(false);
  });
});
