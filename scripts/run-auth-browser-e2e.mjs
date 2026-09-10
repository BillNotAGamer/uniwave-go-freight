import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const EXPECTED_HOST =
  "ep-falling-sky-az05o2cl-pooler.c-3.ap-southeast-1.aws.neon.tech";
const EXPECTED_DATABASE = "neondb";
const DEFAULT_PORT = "3101";

function loadLocalEnvironment() {
  for (const envPath of [".env.local", ".env"]) {
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for authenticated browser E2E.`);
  }

  return value;
}

function buildRunId() {
  const now = new Date();
  const timestamp = [
    now.getUTCFullYear().toString().padStart(4, "0"),
    (now.getUTCMonth() + 1).toString().padStart(2, "0"),
    now.getUTCDate().toString().padStart(2, "0"),
  ].join("");
  const time = [
    now.getUTCHours().toString().padStart(2, "0"),
    now.getUTCMinutes().toString().padStart(2, "0"),
    now.getUTCSeconds().toString().padStart(2, "0"),
  ].join("");

  return `E2E11I-${timestamp}-${time}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function buildPassword() {
  return `E2E11I-${randomBytes(18).toString("base64url")}-aA1!`;
}

function parseTargetDescriptor(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    hostname: parsed.hostname.toLowerCase(),
    databaseName: decodeURIComponent(parsed.pathname.replace(/^\/+/, "")),
  };
}

function run(command, args, env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false,
      stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    let stdout = "";

    if (options.capture) {
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(`${path.basename(command)} exited with code ${code}`));
    });
  });
}

function startServer(nodeBin, nextStartArgs, env) {
  return spawn(nodeBin, nextStartArgs, {
    env,
    shell: false,
    stdio: "inherit",
  });
}

async function waitForServer(env) {
  const deadline = Date.now() + 120_000;
  const url = `${env.E2E_AUTH_BASE_URL}/login`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for authenticated E2E server at ${url}`);
}

function stopServer(server) {
  return new Promise((resolve) => {
    if (server.exitCode !== null || server.killed) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, 3_000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    server.kill();
  });
}

function assertZeroResidue(verificationJson) {
  const parsed = JSON.parse(verificationJson);
  const counts = parsed.counts ?? {};
  const remaining = Object.entries(counts).filter(([, value]) => Number(value) > 0);

  if (remaining.length > 0) {
    throw new Error(
      `Authenticated E2E fixture residue remains: ${remaining
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")}`,
    );
  }
}

loadLocalEnvironment();

const databaseUrl = requireEnv("DATABASE_URL");
const target = parseTargetDescriptor(databaseUrl);

if (target.hostname !== EXPECTED_HOST || target.databaseName !== EXPECTED_DATABASE) {
  throw new Error(
    "Configured DATABASE_URL does not match the authorized Phase 11I production target.",
  );
}

const port = process.env.E2E_AUTH_PORT || DEFAULT_PORT;
const baseURL = process.env.E2E_AUTH_BASE_URL || `http://127.0.0.1:${port}`;
const runId = process.env.AUTH_E2E_RUN_ID || buildRunId();
const nodeBin = process.execPath;
const nextCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(
  process.cwd(),
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const fixtureScript = path.join(process.cwd(), "scripts", "auth-e2e-fixtures.ts");

const commonEnv = {
  ...process.env,
  E2E_AUTH_PORT: port,
  E2E_AUTH_BASE_URL: baseURL,
  NEXT_PUBLIC_AUTH_URL: baseURL,
  AUTH_URL: baseURL,
  AUTH_E2E_RUN_ID: runId,
  AUTH_E2E_SALE_PASSWORD:
    process.env.AUTH_E2E_SALE_PASSWORD || buildPassword(),
  AUTH_E2E_ACCOUNTANT_PASSWORD:
    process.env.AUTH_E2E_ACCOUNTANT_PASSWORD || buildPassword(),
  AUTH_E2E_ADMIN_PASSWORD:
    process.env.AUTH_E2E_ADMIN_PASSWORD || buildPassword(),
  INTEGRATION_TEST_DATABASE_AUTHORIZED:
    process.env.INTEGRATION_TEST_DATABASE_AUTHORIZED,
  INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED:
    process.env.INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED,
  INTEGRATION_TEST_DATABASE_EXPECTED_HOST:
    process.env.INTEGRATION_TEST_DATABASE_EXPECTED_HOST,
  INTEGRATION_TEST_DATABASE_EXPECTED_NAME:
    process.env.INTEGRATION_TEST_DATABASE_EXPECTED_NAME,
  ARTIFACT_R2_ACCOUNT_ID: "auth-e2e-disabled",
  ARTIFACT_R2_ACCESS_KEY_ID: "auth-e2e-disabled",
  ARTIFACT_R2_SECRET_ACCESS_KEY: "auth-e2e-disabled",
  ARTIFACT_R2_BUCKET_NAME: "auth-e2e-disabled",
  GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
  GOOGLE_DRIVE_ROOT_FOLDER_ID: "auth-e2e-disabled",
};

const fixtureEnv = {
  ...commonEnv,
  NODE_ENV: "test",
};
const serverEnv = {
  ...commonEnv,
  NODE_ENV: "production",
};
const nextStartArgs = [
  nextCli,
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  port,
];

let server;
let setupMetadata = null;

try {
  if (process.env.E2E_AUTH_SKIP_BUILD !== "true") {
    await run(nodeBin, [nextCli, "build"], serverEnv);
  }

  const setupJson = await run(
    nodeBin,
    ["--conditions=react-server", "--import", "tsx", fixtureScript, "setup"],
    fixtureEnv,
    { capture: true },
  );
  setupMetadata = JSON.parse(setupJson);

  const testEnv = {
    ...serverEnv,
    AUTH_E2E_SALE_EMAIL: setupMetadata.users.sale.email,
    AUTH_E2E_ACCOUNTANT_EMAIL: setupMetadata.users.accountant.email,
    AUTH_E2E_ADMIN_EMAIL: setupMetadata.users.admin.email,
    AUTH_E2E_WORKFLOW_NOTE_ID: setupMetadata.notes.workflow.id,
    AUTH_E2E_WORKFLOW_JOB: setupMetadata.notes.workflow.jobsheetNo,
    AUTH_E2E_LOCKED_NOTE_ID: setupMetadata.notes.locked.id,
    AUTH_E2E_LOCKED_JOB: setupMetadata.notes.locked.jobsheetNo,
    AUTH_E2E_BROWSER_DRAFT_JOB: setupMetadata.notes.browserDraft.jobsheetNo,
    AUTH_E2E_BROWSER_DRAFT_MAWB: setupMetadata.notes.browserDraft.mawbHawbNo,
  };

  server = startServer(nodeBin, nextStartArgs, serverEnv);
  await waitForServer(serverEnv);
  await run(
    nodeBin,
    [
      playwrightCli,
      "test",
      "--config",
      "playwright.auth.config.ts",
      ...process.argv.slice(2),
    ],
    testEnv,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (server) {
    await stopServer(server);
  }

  if (setupMetadata || process.env.AUTH_E2E_RUN_ID || runId) {
    try {
      const cleanupJson = await run(
        nodeBin,
        ["--conditions=react-server", "--import", "tsx", fixtureScript, "cleanup"],
        fixtureEnv,
        { capture: true },
      );
      assertZeroResidue(cleanupJson);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
