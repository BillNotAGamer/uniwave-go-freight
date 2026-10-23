import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { evaluateSecurityPolicy } from "./ci-security-audit-policy.mjs";

const root = process.cwd();
const betterAuthPolicy = JSON.parse(
  readFileSync(
    path.join(root, "src", "lib", "auth", "better-auth-security-policy.json"),
    "utf8",
  ),
);
const packageLock = JSON.parse(
  readFileSync(path.join(root, "package-lock.json"), "utf8"),
);
const exception = JSON.parse(
  readFileSync(path.join(root, "scripts", "ci-security-exception.json"), "utf8"),
);

function runAudit(args) {
  const auditArgs = ["audit", "--json", ...args];
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const commandArgs =
    process.platform === "win32"
      ? ["/d", "/c", ["npm.cmd", ...auditArgs].join(" ")]
      : auditArgs;
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    shell: false,
  });

  if (result.error) {
    throw new Error(
      `npm audit ${args.join(" ")} could not be executed: ${result.error.message}`,
    );
  }

  if (!result.stdout?.trim()) {
    throw new Error(
      `npm audit ${args.join(" ")} did not produce JSON output.\n${result.stderr}`,
    );
  }

  return JSON.parse(result.stdout);
}

function listRuntimeTraceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRuntimeTraceFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".nft.json") ? [entryPath] : [];
  });
}

function inspectRuntimeTraces() {
  const traceFiles = listRuntimeTraceFiles(path.join(root, ".next"));
  const packageNames = new Set();
  for (const traceFile of traceFiles) {
    const trace = JSON.parse(readFileSync(traceFile, "utf8"));
    for (const file of trace.files ?? []) {
      const normalized = String(file).replaceAll("\\", "/");
      const match = normalized.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/u);
      if (match?.[1]) packageNames.add(match[1]);
    }
  }
  return {
    inspected: existsSync(path.join(root, ".next")),
    fileCount: traceFiles.length,
    packageNames: [...packageNames],
  };
}

const fullAudit = runAudit([]);
const productionAudit = runAudit(["--omit=dev"]);

const evaluation = evaluateSecurityPolicy({
  fullAudit,
  productionAudit,
  packageLock,
  betterAuthPolicy,
  exception,
  now: new Date(),
  runtimeTrace: inspectRuntimeTraces(),
});

console.log(`npm audit raw counts: ${JSON.stringify(evaluation.rawCounts.full)}`);
console.log(
  `npm audit --omit=dev raw counts: ${JSON.stringify(evaluation.rawCounts.production)}`,
);
for (const warning of evaluation.warnings) {
  console.warn(`SECURITY EXCEPTION WARNING: ${warning}`);
}

if (evaluation.failures.length > 0) {
  console.error("Security audit policy failed:");
  for (const failure of evaluation.failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Security audit policy passed: no active exceptions; critical, high, moderate, and total vulnerability controls remain enforced.",
);
