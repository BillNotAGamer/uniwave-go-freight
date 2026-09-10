import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runGuardedDatabaseMigration } from "../src/lib/db/guarded-database-migration";

type MigrationProcessResult = {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
};

type MigrationProcessRunner = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    shell: boolean;
    stdio: "inherit";
  },
) => MigrationProcessResult;

export type DrizzleKitMigrationOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  localBinExists?: (filePath: string) => boolean;
  runProcess?: MigrationProcessRunner;
};

export function getLocalDrizzleKitBinPath(
  cwd: string,
  platform: NodeJS.Platform,
): string {
  return path.join(
    cwd,
    "node_modules",
    ".bin",
    platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit",
  );
}

export async function runDrizzleKitMigration(
  options: DrizzleKitMigrationOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const localBin = getLocalDrizzleKitBinPath(cwd, platform);

  if (!(options.localBinExists ?? existsSync)(localBin)) {
    throw new Error(
      "Local drizzle-kit CLI is not installed. Refusing to download or execute a non-project version.",
    );
  }

  const command = platform === "win32" ? "npm.cmd" : "npm";
  const args = ["exec", "--offline", "--", "drizzle-kit", "migrate"];
  const result = (options.runProcess ?? spawnSync)(command, args, {
    cwd,
    env,
    shell: platform === "win32",
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`Failed to launch the local drizzle-kit CLI: ${result.error.message}`);
  }

  if (result.signal) {
    throw new Error(`Local drizzle-kit CLI terminated by signal ${result.signal}.`);
  }

  if (result.status !== 0) {
    throw new Error(`Local drizzle-kit CLI failed with exit code ${result.status ?? "unknown"}.`);
  }
}

export async function runGuardedDrizzleMigration(input: {
  env?: NodeJS.ProcessEnv;
  migrationOptions?: Omit<DrizzleKitMigrationOptions, "env">;
} = {}): Promise<void> {
  const env = input.env ?? process.env;
  await runGuardedDatabaseMigration({
    env,
    runMigration: () => runDrizzleKitMigration({
      ...input.migrationOptions,
      env,
    }),
  });
}

async function main(): Promise<void> {
  await runGuardedDrizzleMigration();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
