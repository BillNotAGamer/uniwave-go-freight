import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  APPROVED_EXCEPTIONS,
  evaluateSecurityPolicy,
} from "../../../scripts/ci-security-audit-policy.mjs";

type PolicyResult = {
  failures: string[];
  warnings: string[];
  rawCounts: { full: Record<string, number> };
  full: { effectiveHighCount: number };
  acceptedExceptions: unknown[];
  acceptedHighPackages: string[];
};

const runPolicy = evaluateSecurityPolicy as unknown as (
  input: Record<string, unknown>,
) => PolicyResult;

const exceptionManifest = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "scripts", "ci-security-exception.json"),
    "utf8",
  ),
);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createFullAudit() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: {
      info: 0, low: 0, moderate: 6, high: 0, critical: 0, total: 6,
    } },
  };
}

function createProductionAudit() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: {
      info: 0, low: 0, moderate: 6, high: 0, critical: 0, total: 6,
    } },
  };
}

function createPackageLock() {
  return { packages: {
    "node_modules/better-auth": { version: "1.6.22" },
  } };
}

function evaluate(
  overrides: Record<string, unknown> = {},
) {
  return runPolicy({
    fullAudit: createFullAudit(),
    productionAudit: createProductionAudit(),
    packageLock: createPackageLock(),
    betterAuthPolicy: {
      minimumPatchedVersion: "1.6.0",
      passwordlessEmail: {
        magicLinkEnabled: false,
        emailOtpEnabled: false,
        passwordlessEmailSignInEnabled: false,
      },
    },
    exception: clone(exceptionManifest),
    ...overrides,
  });
}

describe("CI security policy without active exceptions", () => {
  it("keeps the exception manifest and approved exception set empty", () => {
    expect(exceptionManifest).toEqual({ schemaVersion: 1, exceptions: [] });
    expect(APPROVED_EXCEPTIONS).toEqual([]);
  });

  it("accepts the current six-Moderate baseline without warnings or exceptions", () => {
    const result = evaluate();
    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.acceptedExceptions).toEqual([]);
    expect(result.acceptedHighPackages).toEqual([]);
  });

  it("rejects every unapproved High finding", () => {
    const fullAudit = createFullAudit() as ReturnType<typeof createFullAudit> & {
      vulnerabilities: Record<string, unknown>;
    };
    fullAudit.vulnerabilities["unapproved-package"] = {
      name: "unapproved-package", severity: "high", isDirect: false,
      via: [], effects: [], nodes: ["node_modules/unapproved-package"],
    };
    fullAudit.metadata.vulnerabilities.high = 1;
    fullAudit.metadata.vulnerabilities.total = 7;
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "unwaived high vulnerabilities found: unapproved-package",
    );
  });

  it("rejects every Critical finding", () => {
    const fullAudit = createFullAudit() as ReturnType<typeof createFullAudit> & {
      vulnerabilities: Record<string, unknown>;
    };
    fullAudit.vulnerabilities["critical-package"] = {
      name: "critical-package", severity: "critical", isDirect: false,
      via: [], effects: [], nodes: ["node_modules/critical-package"],
    };
    fullAudit.metadata.vulnerabilities.critical = 1;
    fullAudit.metadata.vulnerabilities.total = 7;
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "critical vulnerabilities increased to 1",
    );
  });

  it("rejects an unexpected Moderate increase", () => {
    const fullAudit = createFullAudit();
    fullAudit.metadata.vulnerabilities.moderate = 9;
    fullAudit.metadata.vulnerabilities.total = 9;
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "moderate vulnerabilities increased to 9",
    );
  });

  it("rejects the withdrawn braces advisory if it returns without new approval", () => {
    const fullAudit = createFullAudit() as ReturnType<typeof createFullAudit> & {
      vulnerabilities: Record<string, unknown>;
    };
    fullAudit.vulnerabilities.braces = {
      name: "braces", severity: "high", isDirect: false,
      via: [{
        source: 1240992,
        name: "braces",
        dependency: "braces",
        url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
        severity: "high",
      }],
      effects: ["micromatch"], nodes: ["node_modules/braces"],
    };
    fullAudit.metadata.vulnerabilities.high = 1;
    fullAudit.metadata.vulnerabilities.total = 7;
    const result = evaluate({ fullAudit });
    expect(result.failures.join("\n")).toContain(
      "unwaived high vulnerabilities found: braces",
    );
    expect(result.acceptedHighPackages).toEqual([]);
  });

  it("rejects production High findings independently", () => {
    const productionAudit = createProductionAudit() as ReturnType<
      typeof createProductionAudit
    > & { vulnerabilities: Record<string, unknown> };
    productionAudit.vulnerabilities["production-package"] = {
      name: "production-package", severity: "high", isDirect: false,
      via: [], effects: [], nodes: ["node_modules/production-package"],
    };
    productionAudit.metadata.vulnerabilities.high = 1;
    productionAudit.metadata.vulnerabilities.total = 7;
    expect(evaluate({ productionAudit }).failures.join("\n")).toContain(
      "unapproved high vulnerabilities increased to 1",
    );
  });

  it("fails closed for missing, malformed, or nonempty exception manifests", () => {
    expect(evaluate({ exception: null }).failures.join("\n")).toContain(
      "exception manifest is missing",
    );
    expect(evaluate({ exception: { schemaVersion: 1 } }).failures.join("\n"))
      .toContain("exception manifest exceptions must be an array");
    expect(evaluate({
      exception: { schemaVersion: 1, exceptions: [{ advisoryId: "GHSA-test" }] },
    }).failures.join("\n")).toContain(
      "security exceptions are present but no exceptions are approved",
    );
  });

  it("fails closed when npm audit metadata is missing", () => {
    expect(() => evaluate({ fullAudit: { vulnerabilities: {} } })).toThrow(
      "npm audit: npm audit output is missing metadata counts",
    );
  });

  it("rejects inconsistent High and Critical package counts", () => {
    const fullAudit = createFullAudit();
    fullAudit.metadata.vulnerabilities.high = 1;
    fullAudit.metadata.vulnerabilities.critical = 1;
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "raw high count does not match package findings",
    );
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "raw critical count does not match package findings",
    );
  });

  it("preserves the total vulnerability baseline", () => {
    const fullAudit = createFullAudit();
    fullAudit.metadata.vulnerabilities.total = 12;
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "total vulnerabilities increased to 12",
    );
  });

  it("reports raw counts without subtracting or suppressing findings", () => {
    const result = evaluate();
    expect(result.rawCounts.full).toEqual({
      info: 0, low: 0, moderate: 6, high: 0, critical: 0, total: 6,
    });
    expect(result.full.effectiveHighCount).toBe(0);
  });
});
