const ACCEPTED_BASELINE = Object.freeze({
  total: 11,
  critical: 0,
  high: 3,
  moderate: 8,
});

const APPROVED_EXCEPTION_IDENTITY = Object.freeze({
  schemaVersion: 1,
  advisoryId: "GHSA-vfj7-8cjw-p6xm",
  cve: "CVE-2026-93687",
  npmAdvisorySource: 1240992,
  advisoryUrl: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  rootPackage: Object.freeze({ name: "braces", version: "3.0.3" }),
  dependencyChain: Object.freeze([
    Object.freeze({ name: "eslint-config-next", version: "16.3.8" }),
    Object.freeze({ name: "@next/eslint-plugin-next", version: "16.3.8" }),
    Object.freeze({ name: "fast-glob", version: "3.3.1" }),
    Object.freeze({ name: "micromatch", version: "4.0.8" }),
    Object.freeze({ name: "braces", version: "3.0.3" }),
  ]),
  classification: "development-only-eslint-tooling",
  approvalOwner: "Product Owner",
  approvalDate: "2026-10-20",
  expiresAt: "2026-11-02T17:00:00Z",
});

function compareSemver(left, right) {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function arraysEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => value === right[index]);
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

function validateManifest(exception) {
  const failures = [];
  const expected = APPROVED_EXCEPTION_IDENTITY;
  if (!exception || typeof exception !== "object" || Array.isArray(exception)) {
    return ["exception metadata is missing or is not an object"];
  }

  for (const field of ["schemaVersion", "advisoryId", "cve", "npmAdvisorySource",
    "advisoryUrl", "classification", "approvalOwner", "approvalDate", "expiresAt"]) {
    if (exception[field] !== expected[field]) {
      failures.push(`${field} does not match the approved exception identity`);
    }
  }
  if (exception.rootPackage?.name !== expected.rootPackage.name ||
      exception.rootPackage?.version !== expected.rootPackage.version) {
    failures.push("rootPackage does not match the approved package and version");
  }

  if (!Array.isArray(exception.dependencyChain)) {
    failures.push("dependencyChain is missing or malformed");
  } else {
    const actual = exception.dependencyChain.map((entry) =>
      `${entry?.name ?? ""}@${entry?.version ?? ""}`);
    const approved = expected.dependencyChain.map((entry) => `${entry.name}@${entry.version}`);
    if (!arraysEqual(actual, approved)) {
      failures.push("dependencyChain does not match the approved provenance");
    }
  }

  if (typeof exception.riskJustification !== "string" ||
      exception.riskJustification.length < 100) {
    failures.push("riskJustification is missing or incomplete");
  }
  if (!Array.isArray(exception.evidence) ||
      !exception.evidence.includes(expected.advisoryUrl) ||
      !exception.evidence.includes("package-lock.json") ||
      !exception.evidence.includes(".next/**/*.nft.json")) {
    failures.push("required evidence references are missing");
  }
  return failures;
}

function validateApprovedException({ fullAudit, productionAudit, packageLock,
  exception, now, runtimeTrace }) {
  const failures = validateManifest(exception);
  const expected = APPROVED_EXCEPTION_IDENTITY;
  const evaluationTime = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(evaluationTime)) {
    failures.push("evaluation time is invalid");
  } else if (evaluationTime >= Date.parse(expected.expiresAt)) {
    failures.push(`exception expired at ${expected.expiresAt}`);
  }

  const fullVulnerabilities = fullAudit?.vulnerabilities ?? {};
  const productionVulnerabilities = productionAudit?.vulnerabilities ?? {};
  const chain = expected.dependencyChain;

  for (let index = 0; index < chain.length; index += 1) {
    const current = chain[index];
    const parent = index > 0 ? chain[index - 1] : null;
    const child = index + 1 < chain.length ? chain[index + 1] : null;
    const lockEntry = getInstalledPackage(packageLock, current.name);
    const finding = fullVulnerabilities[current.name];

    if (!lockEntry) {
      failures.push(`${current.name} is missing from package-lock.json`);
    } else {
      if (lockEntry.version !== current.version) {
        failures.push(`${current.name} version changed from approved ${current.version} to ${lockEntry.version}`);
      }
      if (lockEntry.dev !== true) {
        failures.push(`${current.name} is not marked development-only in package-lock.json`);
      }
      if (child && !(child.name in (lockEntry.dependencies ?? {}))) {
        failures.push(`${current.name} no longer directly depends on ${child.name}`);
      }
    }

    if (!finding) {
      failures.push(`${current.name} is absent from the audit; the stale exception must be removed`);
      continue;
    }
    if (finding.severity !== "high") {
      failures.push(`${current.name} is no longer reported at the approved high severity`);
    }
    if (Boolean(finding.isDirect) !== (index === 0)) {
      failures.push(`${current.name} direct-dependency classification changed`);
    }
    if (!arraysEqual(finding.nodes, [`node_modules/${current.name}`])) {
      failures.push(`${current.name} audit node provenance changed`);
    }
    if (!arraysEqual(finding.effects, parent ? [parent.name] : [])) {
      failures.push(`${current.name} reverse dependency provenance changed`);
    }

    if (child) {
      if (!arraysEqual(finding.via, [child.name])) {
        failures.push(`${current.name} advisory provenance changed`);
      }
    } else {
      const advisory = Array.isArray(finding.via) ? finding.via[0] : null;
      if (finding.via?.length !== 1 || !advisory || typeof advisory !== "object" ||
          advisory.source !== expected.npmAdvisorySource ||
          advisory.name !== expected.rootPackage.name ||
          advisory.dependency !== expected.rootPackage.name ||
          advisory.url !== expected.advisoryUrl || advisory.severity !== "high") {
        failures.push("root npm advisory identity changed");
      }
    }

    if (current.name in productionVulnerabilities) {
      failures.push(`${current.name} is present in the production dependency audit`);
    }
  }

  if (!runtimeTrace?.inspected || runtimeTrace.fileCount < 1) {
    failures.push("Next.js runtime trace evidence is missing");
  } else {
    const tracedPackages = new Set(runtimeTrace.packageNames ?? []);
    const runtimeMatches = chain.map((entry) => entry.name)
      .filter((name) => tracedPackages.has(name));
    if (runtimeMatches.length > 0) {
      failures.push(`approved development-only packages appeared in runtime traces: ${runtimeMatches.join(", ")}`);
    }
  }

  return [...new Set(failures)];
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
  betterAuthPolicy, exception, now, runtimeTrace }) {
  const exceptionFailures = validateApprovedException({ fullAudit, productionAudit,
    packageLock, exception, now, runtimeTrace });
  const approvedHighPackages = new Set();
  const acceptedExceptions = [];
  const warnings = [];

  if (exceptionFailures.length === 0) {
    for (const entry of APPROVED_EXCEPTION_IDENTITY.dependencyChain) {
      approvedHighPackages.add(entry.name);
    }
    acceptedExceptions.push({ advisoryId: APPROVED_EXCEPTION_IDENTITY.advisoryId,
      cve: APPROVED_EXCEPTION_IDENTITY.cve,
      expiresAt: APPROVED_EXCEPTION_IDENTITY.expiresAt,
      approvalOwner: APPROVED_EXCEPTION_IDENTITY.approvalOwner,
      derivedPackageNames: [...approvedHighPackages] });
    warnings.push(`TEMPORARY EXCEPTION ${APPROVED_EXCEPTION_IDENTITY.advisoryId} ` +
      `(${APPROVED_EXCEPTION_IDENTITY.cve}) accepts ${approvedHighPackages.size} derived ` +
      `package findings until ${APPROVED_EXCEPTION_IDENTITY.expiresAt}; approved by ` +
      `${APPROVED_EXCEPTION_IDENTITY.approvalOwner}.`);
  }

  const full = evaluateBaseline({ label: "npm audit", audit: fullAudit, packageLock,
    betterAuthPolicy, approvedHighPackages, production: false });
  const production = evaluateBaseline({ label: "npm audit --omit=dev",
    audit: productionAudit, packageLock, betterAuthPolicy,
    approvedHighPackages: new Set(), production: true });
  const failures = [
    ...exceptionFailures.map((failure) =>
      `temporary exception ${APPROVED_EXCEPTION_IDENTITY.advisoryId} rejected: ${failure}.`),
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

export { ACCEPTED_BASELINE, APPROVED_EXCEPTION_IDENTITY };
