const ACCEPTED_BASELINE = Object.freeze({
  total: 11,
  critical: 0,
  high: 3,
  moderate: 8,
});

const APPROVED_EXCEPTIONS = Object.freeze([]);

function compareSemver(left, right) {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function getCounts(label, audit) {
  const counts = audit?.metadata?.vulnerabilities;
  if (!counts) throw new Error(`${label}: npm audit output is missing metadata counts.`);
  return counts;
}

function getFindings(audit, severity) {
  return Object.entries(audit?.vulnerabilities ?? {})
    .filter(([, finding]) => finding?.severity === severity)
    .map(([name, finding]) => ({ name, ...finding }));
}

function getInstalledPackage(packageLock, packageName) {
  return packageLock?.packages?.[`node_modules/${packageName}`] ?? null;
}

function isLegacyHighWaived(packageName, packageLock, betterAuthPolicy) {
  if (packageName === "sharp" || packageName === "js-yaml") return true;
  if (packageName !== "better-auth") return false;

  const installedVersion = getInstalledPackage(packageLock, "better-auth")?.version;
  const passwordlessEmail = betterAuthPolicy?.passwordlessEmail;
  const passwordlessEnabled = Boolean(passwordlessEmail &&
    (passwordlessEmail.magicLinkEnabled || passwordlessEmail.emailOtpEnabled ||
      passwordlessEmail.passwordlessEmailSignInEnabled));

  return Boolean(installedVersion && betterAuthPolicy?.minimumPatchedVersion &&
    compareSemver(installedVersion, betterAuthPolicy.minimumPatchedVersion) < 0 &&
    !passwordlessEnabled);
}

function validateExceptionManifest(exceptionManifest) {
  const failures = [];
  if (!exceptionManifest || typeof exceptionManifest !== "object" ||
      Array.isArray(exceptionManifest)) {
    return ["exception manifest is missing or is not an object"];
  }
  if (exceptionManifest.schemaVersion !== 1) {
    failures.push("exception manifest schemaVersion must be 1");
  }
  if (!Array.isArray(exceptionManifest.exceptions)) {
    failures.push("exception manifest exceptions must be an array");
  } else if (exceptionManifest.exceptions.length !== APPROVED_EXCEPTIONS.length) {
    failures.push("security exceptions are present but no exceptions are approved");
  }
  return failures;
}

function evaluateBaseline({ label, audit, packageLock, betterAuthPolicy,
  approvedHighPackages, production }) {
  const counts = getCounts(label, audit);
  const highFindings = getFindings(audit, "high");
  const criticalFindings = getFindings(audit, "critical");
  const failures = [];

  if (counts.high !== highFindings.length) {
    failures.push(`${label}: raw high count does not match package findings.`);
  }
  if (counts.critical !== criticalFindings.length) {
    failures.push(`${label}: raw critical count does not match package findings.`);
  }
  if (counts.critical > ACCEPTED_BASELINE.critical) {
    failures.push(`${label}: critical vulnerabilities increased to ${counts.critical}.`);
  }

  const effectiveHighCount = production ? counts.high : counts.high - approvedHighPackages.size;
  if (effectiveHighCount > (production ? 0 : ACCEPTED_BASELINE.high)) {
    failures.push(`${label}: unapproved high vulnerabilities increased to ${effectiveHighCount}.`);
  }
  if (counts.moderate > ACCEPTED_BASELINE.moderate) {
    failures.push(`${label}: moderate vulnerabilities increased to ${counts.moderate}.`);
  }
  if (counts.total > ACCEPTED_BASELINE.total) {
    failures.push(`${label}: total vulnerabilities increased to ${counts.total}.`);
  }

  const unwaivedHighFindings = highFindings.filter((finding) =>
    !approvedHighPackages.has(finding.name) &&
    !isLegacyHighWaived(finding.name, packageLock, betterAuthPolicy));
  if (unwaivedHighFindings.length > 0) {
    failures.push(`${label}: unwaived high vulnerabilities found: ${unwaivedHighFindings
      .map((finding) => finding.name).join(", ")}.`);
  }

  return { counts: { ...counts }, effectiveHighCount,
    highFindingNames: highFindings.map((finding) => finding.name), failures };
}

export function evaluateSecurityPolicy({ fullAudit, productionAudit, packageLock,
  betterAuthPolicy, exception }) {
  const exceptionFailures = validateExceptionManifest(exception);
  const approvedHighPackages = new Set();
  const acceptedExceptions = [];
  const warnings = [];

  const full = evaluateBaseline({ label: "npm audit", audit: fullAudit, packageLock,
    betterAuthPolicy, approvedHighPackages, production: false });
  const production = evaluateBaseline({ label: "npm audit --omit=dev",
    audit: productionAudit, packageLock, betterAuthPolicy,
    approvedHighPackages: new Set(), production: true });
  const failures = [
    ...exceptionFailures.map((failure) =>
      `security exception manifest rejected: ${failure}.`),
    ...full.failures,
    ...production.failures,
  ];

  return {
    rawCounts: { full: full.counts, production: production.counts },
    full,
    production,
    acceptedExceptions,
    acceptedHighPackages: [...approvedHighPackages],
    warnings,
    failures: [...new Set(failures)],
  };
}

export { ACCEPTED_BASELINE, APPROVED_EXCEPTIONS };
