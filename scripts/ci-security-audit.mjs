import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ACCEPTED_BASELINE = Object.freeze({
  total: 11,
  critical: 0,
  high: 3,
  moderate: 8,
});

const policyPath = path.join(
  process.cwd(),
  "src",
  "lib",
  "auth",
  "better-auth-security-policy.json",
);
const lockfilePath = path.join(process.cwd(), "package-lock.json");

const betterAuthPolicy = JSON.parse(readFileSync(policyPath, "utf8"));
const packageLock = JSON.parse(readFileSync(lockfilePath, "utf8"));

function compareSemver(left, right) {
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

function getInstalledVersion(packageName) {
  return packageLock.packages?.[`node_modules/${packageName}`]?.version ?? null;
}

function isPasswordlessEmailAuthEnabled() {
  const passwordlessEmail = betterAuthPolicy.passwordlessEmail;

  return (
    passwordlessEmail.magicLinkEnabled ||
    passwordlessEmail.emailOtpEnabled ||
    passwordlessEmail.passwordlessEmailSignInEnabled
  );
}

function isBetterAuthHighWaived() {
  const installedVersion = getInstalledVersion("better-auth");

  if (!installedVersion) {
    return false;
  }

  const vulnerable =
    compareSemver(installedVersion, betterAuthPolicy.minimumPatchedVersion) < 0;

  return vulnerable && !isPasswordlessEmailAuthEnabled();
}

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

function getVulnerabilityEntries(audit) {
  return Object.entries(audit.vulnerabilities ?? {}).map(([name, value]) => ({
    name,
    severity: value.severity,
    isDirect: Boolean(value.isDirect),
    effects: value.effects ?? [],
  }));
}

function evaluateAudit(label, audit) {
  const counts = audit.metadata?.vulnerabilities;

  if (!counts) {
    throw new Error(`${label}: npm audit output is missing metadata counts.`);
  }

  const failures = [];

  if (counts.critical > ACCEPTED_BASELINE.critical) {
    failures.push(`${label}: critical vulnerabilities increased to ${counts.critical}.`);
  }

  if (counts.high > ACCEPTED_BASELINE.high) {
    failures.push(`${label}: high vulnerabilities increased to ${counts.high}.`);
  }

  if (counts.moderate > ACCEPTED_BASELINE.moderate) {
    failures.push(`${label}: moderate vulnerabilities increased to ${counts.moderate}.`);
  }

  if (counts.total > ACCEPTED_BASELINE.total) {
    failures.push(`${label}: total vulnerabilities increased to ${counts.total}.`);
  }

  const highFindings = getVulnerabilityEntries(audit).filter(
    (entry) => entry.severity === "high",
  );
  const unwaivedHighFindings = highFindings.filter(
    (entry) =>
      !(
        (entry.name === "better-auth" && isBetterAuthHighWaived()) ||
        entry.name === "sharp" ||
        entry.name === "js-yaml"
      ),
  );

  if (unwaivedHighFindings.length > 0) {
    failures.push(
      `${label}: unwaived high vulnerabilities found: ${unwaivedHighFindings
        .map((entry) => entry.name)
        .join(", ")}.`,
    );
  }

  return { counts, failures, highFindings };
}

const fullAudit = runAudit([]);
const productionAudit = runAudit(["--omit=dev"]);

const evaluations = [
  ["npm audit", evaluateAudit("npm audit", fullAudit)],
  ["npm audit --omit=dev", evaluateAudit("npm audit --omit=dev", productionAudit)],
];

for (const [label, evaluation] of evaluations) {
  console.log(`${label}: ${JSON.stringify(evaluation.counts)}`);
}

const failures = evaluations.flatMap(([, evaluation]) => evaluation.failures);

if (failures.length > 0) {
  console.error("Security audit policy failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Security audit policy passed: accepted Better Auth waiver is still configuration-bound and no vulnerability count regression was detected.",
);
