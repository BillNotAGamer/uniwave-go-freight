import process from "node:process";
import { pathToFileURL } from "node:url";

export const LEGACY_FIRST_ADMIN_DEPRECATION_MESSAGE =
  "admin:create-first (scripts/create-first-admin.ts) is deprecated and disabled. Use 'npm run bootstrap:first-admin' instead.";

export function runLegacyCreateFirstAdmin(): never {
  console.error(`\n[DISABLED ENTRYPOINT] ${LEGACY_FIRST_ADMIN_DEPRECATION_MESSAGE}\n`);
  throw new Error(LEGACY_FIRST_ADMIN_DEPRECATION_MESSAGE);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runLegacyCreateFirstAdmin();
  } catch {
    process.exitCode = 1;
  }
}
