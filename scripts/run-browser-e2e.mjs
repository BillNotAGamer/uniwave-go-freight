import { spawn } from "node:child_process";
import path from "node:path";

import { buildBrowserE2EEnv } from "./browser-e2e-env.mjs";

const env = buildBrowserE2EEnv();
const nodeBin = process.execPath;
const nextCli = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(
  process.cwd(),
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const nextStartArgs = [
  nextCli,
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  env.E2E_PORT,
];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      args,
      {
      env,
        shell: false,
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${path.basename(command)} exited with code ${code}`));
    });
  });
}

function startServer() {
  return spawn(nodeBin, nextStartArgs, {
    env,
    shell: false,
    stdio: "inherit",
  });
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  const url = `${env.E2E_BASE_URL}/login`;

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

  throw new Error(`Timed out waiting for browser E2E server at ${url}`);
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

let server;

try {
  if (process.env.E2E_SKIP_BUILD !== "true") {
    await run(nodeBin, [nextCli, "build"]);
  }

  server = startServer();
  await waitForServer();
  await run(nodeBin, [playwrightCli, "test", ...process.argv.slice(2)]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (server) {
    await stopServer(server);
  }
}
