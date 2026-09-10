import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { assertAuthorizedIntegrationDatabaseTarget } from "./database-authorization";

const REQUIRED_ENV_KEYS = ["AUTH_SECRET", "AUTH_URL"] as const;

function unquote(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadDotEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = unquote(trimmed.slice(equalsIndex + 1));

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvLocal();

const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing required integration test environment variables: ${missingKeys.join(", ")}.`,
  );
}

assertAuthorizedIntegrationDatabaseTarget();
