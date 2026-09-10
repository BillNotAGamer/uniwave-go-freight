import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  betterAuthSecurityPolicy,
  isBetterAuthAdvisoryWaiverValid,
  isPasswordlessEmailAuthEnabled,
} from "./better-auth-security-policy";

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));

  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

function getInstalledBetterAuthVersion(): string {
  const lockfile = JSON.parse(
    readFileSync(new URL("../../../package-lock.json", import.meta.url), "utf8"),
  ) as {
    packages?: Record<string, { version?: string }>;
  };

  const version = lockfile.packages?.["node_modules/better-auth"]?.version;

  if (!version) {
    throw new Error("Unable to determine installed Better Auth version.");
  }

  return version;
}

describe("Better Auth security waiver policy", () => {
  it("keeps passwordless email auth disabled for the accepted advisory waiver", () => {
    expect(betterAuthSecurityPolicy.emailAndPassword.enabled).toBe(true);
    expect(isPasswordlessEmailAuthEnabled()).toBe(false);
    expect(isBetterAuthAdvisoryWaiverValid()).toBe(true);
  });

  it("requires the waiver to remain valid while Better Auth is below the patched version", () => {
    const installedVersion = getInstalledBetterAuthVersion();

    if (
      compareSemver(
        installedVersion,
        betterAuthSecurityPolicy.minimumPatchedVersion,
      ) < 0
    ) {
      expect(isBetterAuthAdvisoryWaiverValid()).toBe(true);
    }
  });
});
