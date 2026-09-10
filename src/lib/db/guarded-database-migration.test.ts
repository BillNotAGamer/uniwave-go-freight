import { describe, expect, it, vi } from "vitest";

import {
  getLocalDrizzleKitBinPath,
  runDrizzleKitMigration,
  runGuardedDrizzleMigration,
} from "../../../scripts/guarded-db-migrate";

import {
  DATABASE_MIGRATION_AUTHORIZED,
  DATABASE_MIGRATION_EXPECTED_HOST,
  DATABASE_MIGRATION_EXPECTED_NAME,
  DATABASE_MIGRATION_PRODUCTION_AUTHORIZED,
  runGuardedDatabaseMigration,
} from "./guarded-database-migration";

const databaseUrl =
  "postgresql://user:secret@migration-db.example.invalid:5432/migration_db?sslmode=require";

function env(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    [DATABASE_MIGRATION_AUTHORIZED]: "true",
    [DATABASE_MIGRATION_EXPECTED_HOST]: "migration-db.example.invalid",
    [DATABASE_MIGRATION_EXPECTED_NAME]: "migration_db",
  };

  return Object.assign(base, overrides);
}

describe("guarded database migration runner", () => {
  it("does not invoke migration when authorization is missing", async () => {
    const runMigration = vi.fn();

    await expect(
      runGuardedDatabaseMigration({
        env: env({ [DATABASE_MIGRATION_AUTHORIZED]: undefined }),
        runMigration,
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_DB_NOT_AUTHORIZED" });

    expect(runMigration).not.toHaveBeenCalled();
  });

  it("does not invoke migration when target mismatches", async () => {
    const runMigration = vi.fn();

    await expect(
      runGuardedDatabaseMigration({
        env: env({ [DATABASE_MIGRATION_EXPECTED_HOST]: "other-db.example.invalid" }),
        runMigration,
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_DB_HOST_MISMATCH" });

    expect(runMigration).not.toHaveBeenCalled();
  });

  it("invokes mocked migration after explicit nonproduction target authorization", async () => {
    const runMigration = vi.fn();

    await runGuardedDatabaseMigration({
      env: env(),
      runMigration,
    });

    expect(runMigration).toHaveBeenCalledOnce();
  });

  it("does not invoke migration in production without the production authorization flag", async () => {
    const runMigration = vi.fn();

    await expect(
      runGuardedDatabaseMigration({
        env: env({ NODE_ENV: "production" }),
        runMigration,
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_DB_PRODUCTION_ENV_FORBIDDEN" });

    expect(runMigration).not.toHaveBeenCalled();
  });

  it("invokes mocked migration in production only after explicit production authorization", async () => {
    const runMigration = vi.fn();

    await runGuardedDatabaseMigration({
      env: env({
        NODE_ENV: "production",
        [DATABASE_MIGRATION_PRODUCTION_AUTHORIZED]: "true",
      }),
      runMigration,
    });

    expect(runMigration).toHaveBeenCalledOnce();
  });
});

describe("guarded drizzle-kit CLI runtime", () => {
  const success = { status: 0, signal: null } as const;

  it("invokes the local CLI through npm exec offline after authorization", async () => {
    const runProcess = vi.fn().mockReturnValue(success);

    await runGuardedDrizzleMigration({
      env: env(),
      migrationOptions: {
        cwd: "project",
        platform: "win32",
        localBinExists: () => true,
        runProcess,
      },
    });

    expect(runProcess).toHaveBeenCalledOnce();
    expect(runProcess).toHaveBeenCalledWith(
      "npm.cmd",
      ["exec", "--offline", "--", "drizzle-kit", "migrate"],
      expect.objectContaining({ cwd: "project", shell: true, stdio: "inherit" }),
    );
  });

  it("does not start the CLI when authorization is missing", async () => {
    const runProcess = vi.fn().mockReturnValue(success);

    await expect(runGuardedDrizzleMigration({
      env: env({ [DATABASE_MIGRATION_AUTHORIZED]: undefined }),
      migrationOptions: { localBinExists: () => true, runProcess },
    })).rejects.toMatchObject({ code: "INTEGRATION_DB_NOT_AUTHORIZED" });

    expect(runProcess).not.toHaveBeenCalled();
  });

  it("does not start the CLI when the exact target mismatches", async () => {
    const runProcess = vi.fn().mockReturnValue(success);

    await expect(runGuardedDrizzleMigration({
      env: env({ [DATABASE_MIGRATION_EXPECTED_HOST]: "other.example.invalid" }),
      migrationOptions: { localBinExists: () => true, runProcess },
    })).rejects.toMatchObject({ code: "INTEGRATION_DB_HOST_MISMATCH" });

    expect(runProcess).not.toHaveBeenCalled();
  });

  it("propagates a non-zero CLI exit", async () => {
    await expect(runDrizzleKitMigration({
      localBinExists: () => true,
      runProcess: () => ({ status: 2, signal: null }),
    })).rejects.toThrow("exit code 2");
  });

  it("fails closed when the process cannot be spawned", async () => {
    await expect(runDrizzleKitMigration({
      localBinExists: () => true,
      runProcess: () => ({
        error: new Error("spawn unavailable"),
        status: null,
        signal: null,
      }),
    })).rejects.toThrow("Failed to launch the local drizzle-kit CLI: spawn unavailable");
  });

  it("requires the locally installed project binary", async () => {
    const runProcess = vi.fn().mockReturnValue(success);

    await expect(runDrizzleKitMigration({
      cwd: "project",
      platform: "win32",
      localBinExists: () => false,
      runProcess,
    })).rejects.toThrow("Refusing to download");

    expect(runProcess).not.toHaveBeenCalled();
    expect(getLocalDrizzleKitBinPath("project", "win32")).toMatch(
      /node_modules[\\/]\.bin[\\/]drizzle-kit\.cmd$/,
    );
  });
});
