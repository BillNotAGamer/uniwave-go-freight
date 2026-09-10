import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const serverSecretNames = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "ARTIFACT_R2_ACCESS_KEY_ID",
  "ARTIFACT_R2_SECRET_ACCESS_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "INTEGRATION_TEST_DATABASE_AUTHORIZED",
  "INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED",
  "DATABASE_MIGRATION_AUTHORIZED",
  "DATABASE_MIGRATION_PRODUCTION_AUTHORIZED",
] as const;

const allowedPublicNames = ["NEXT_PUBLIC_AUTH_URL"] as const;

function readEnvExampleNames(): string[] {
  const contents = readFileSync(".env.example", "utf8");

  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name));
}

describe("public environment variable boundary", () => {
  it("documents only explicitly approved browser-exposed variables", () => {
    const publicNames = readEnvExampleNames().filter((name) =>
      name.startsWith("NEXT_PUBLIC_"),
    );

    expect(publicNames).toEqual([...allowedPublicNames]);
  });

  it("does not document server secrets as browser-exposed variables", () => {
    const publicNames = readEnvExampleNames().filter((name) =>
      name.startsWith("NEXT_PUBLIC_"),
    );

    for (const secretName of serverSecretNames) {
      expect(publicNames).not.toContain(`NEXT_PUBLIC_${secretName}`);
    }
  });
});
