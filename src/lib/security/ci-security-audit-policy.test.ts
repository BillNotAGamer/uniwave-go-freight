import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { evaluateSecurityPolicy } from "../../../scripts/ci-security-audit-policy.mjs";

type PolicyResult = {
  failures: string[];
  warnings: string[];
  rawCounts: { full: Record<string, number> };
  full: { effectiveHighCount: number };
  acceptedExceptions: Array<{
    advisoryId: string;
    derivedPackageNames: string[];
  }>;
  acceptedHighPackages: string[];
};

const runPolicy = evaluateSecurityPolicy as unknown as (
  input: Record<string, unknown>,
) => PolicyResult;

const approvedException = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "scripts", "ci-security-exception.json"),
    "utf8",
  ),
);
const beforeExpiration = new Date("2026-10-20T12:00:00Z");
const chain = [
  "eslint-config-next",
  "@next/eslint-plugin-next",
  "fast-glob",
  "micromatch",
  "braces",
] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createFullAudit() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      "eslint-config-next": {
        name: "eslint-config-next", severity: "high", isDirect: true,
        via: ["@next/eslint-plugin-next"], effects: [],
        nodes: ["node_modules/eslint-config-next"],
      },
      "@next/eslint-plugin-next": {
        name: "@next/eslint-plugin-next", severity: "high", isDirect: false,
        via: ["fast-glob"], effects: ["eslint-config-next"],
        nodes: ["node_modules/@next/eslint-plugin-next"],
      },
      "fast-glob": {
        name: "fast-glob", severity: "high", isDirect: false,
        via: ["micromatch"], effects: ["@next/eslint-plugin-next"],
        nodes: ["node_modules/fast-glob"],
      },
      micromatch: {
        name: "micromatch", severity: "high", isDirect: false,
        via: ["braces"], effects: ["fast-glob"],
        nodes: ["node_modules/micromatch"],
      },
      braces: {
        name: "braces", severity: "high", isDirect: false,
        via: [{
          source: 1240992,
          name: "braces",
          dependency: "braces",
          url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
          severity: "high",
        }],
        effects: ["micromatch"], nodes: ["node_modules/braces"],
      },
    },
    metadata: { vulnerabilities: {
      info: 0, low: 0, moderate: 6, high: 5, critical: 0, total: 11,
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
    "node_modules/eslint-config-next": {
      version: "16.3.8", dev: true,
      dependencies: { "@next/eslint-plugin-next": "16.3.8" },
    },
    "node_modules/@next/eslint-plugin-next": {
      version: "16.3.8", dev: true, dependencies: { "fast-glob": "3.3.1" },
    },
    "node_modules/fast-glob": {
      version: "3.3.1", dev: true, dependencies: { micromatch: "^4.0.4" },
    },
    "node_modules/micromatch": {
      version: "4.0.8", dev: true, dependencies: { braces: "^3.0.3" },
    },
    "node_modules/braces": { version: "3.0.3", dev: true },
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
    exception: clone(approvedException),
    now: beforeExpiration,
    runtimeTrace: { inspected: true, fileCount: 29, packageNames: [] },
    ...overrides,
  });
}

describe("CI security advisory exception", () => {
  it("accepts the exact approved advisory before expiration with an audit warning", () => {
    const result = evaluate();
    expect(result.failures).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("GHSA-vfj7-8cjw-p6xm");
    expect(result.warnings[0]).toContain("2026-11-02T17:00:00Z");
  });

  it("rejects the approved advisory at and after the exclusive cutoff", () => {
    for (const now of [
      new Date("2026-11-02T17:00:00Z"),
      new Date("2026-11-02T17:00:00.001Z"),
    ]) {
      expect(evaluate({ now }).failures.join("\n")).toContain("exception expired");
    }
  });

  it("rejects a different braces advisory", () => {
    const fullAudit = createFullAudit();
    fullAudit.vulnerabilities.braces.via[0].source = 9999999;
    fullAudit.vulnerabilities.braces.via[0].url =
      "https://github.com/advisories/GHSA-xxxx-yyyy-zzzz";
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "root npm advisory identity changed",
    );
  });

  it("rejects a new high advisory on an ancestor package", () => {
    const fullAudit = createFullAudit();
    fullAudit.vulnerabilities["fast-glob"].via = [
      "micromatch", "unapproved-high-advisory",
    ];
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "fast-glob advisory provenance changed",
    );
  });

  it("rejects every new critical advisory", () => {
    const fullAudit = createFullAudit() as ReturnType<typeof createFullAudit> & {
      vulnerabilities: Record<string, unknown>;
    };
    fullAudit.vulnerabilities["critical-package"] = {
      name: "critical-package", severity: "critical", isDirect: false,
      via: [], effects: [], nodes: ["node_modules/critical-package"],
    };
    fullAudit.metadata.vulnerabilities.critical = 1;
    fullAudit.metadata.vulnerabilities.total = 12;
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "critical vulnerabilities increased to 1",
    );
  });

  it("rejects production high findings without applying the exception", () => {
    const productionAudit = createProductionAudit() as ReturnType<
      typeof createProductionAudit
    > & { vulnerabilities: Record<string, unknown> };
    productionAudit.vulnerabilities.braces = {
      name: "braces", severity: "high", isDirect: false,
      via: [], effects: [], nodes: ["node_modules/braces"],
    };
    productionAudit.metadata.vulnerabilities.high = 1;
    productionAudit.metadata.vulnerabilities.total = 7;
    const failures = evaluate({ productionAudit }).failures.join("\n");
    expect(failures).toContain("braces is present in the production dependency audit");
    expect(failures).toContain("unapproved high vulnerabilities increased to 1");
  });

  it("rejects changed dependency provenance", () => {
    const packageLock = createPackageLock();
    delete (packageLock.packages["node_modules/fast-glob"].dependencies as Partial<
      Record<"micromatch", string>
    >).micromatch;
    expect(evaluate({ packageLock }).failures.join("\n")).toContain(
      "fast-glob no longer directly depends on micromatch",
    );
  });

  it("rejects an unexpected affected package version", () => {
    const packageLock = createPackageLock();
    packageLock.packages["node_modules/braces"].version = "3.0.4";
    expect(evaluate({ packageLock }).failures.join("\n")).toContain(
      "braces version changed from approved 3.0.3 to 3.0.4",
    );
  });

  it("rejects development-only packages found in Next.js runtime traces", () => {
    const result = evaluate({
      runtimeTrace: {
        inspected: true,
        fileCount: 29,
        packageNames: ["braces"],
      },
    });
    expect(result.failures.join("\n")).toContain(
      "approved development-only packages appeared in runtime traces: braces",
    );
  });

  it("rejects a stale exception after the root advisory disappears", () => {
    const fullAudit = createFullAudit();
    delete (fullAudit.vulnerabilities as Partial<
      Record<"braces", unknown>
    >).braces;
    fullAudit.metadata.vulnerabilities.high = 4;
    fullAudit.metadata.vulnerabilities.total = 10;
    expect(evaluate({ fullAudit }).failures.join("\n")).toContain(
      "braces is absent from the audit; the stale exception must be removed",
    );
  });

  it("rejects a chain package that is no longer development-only", () => {
    const packageLock = createPackageLock();
    packageLock.packages["node_modules/braces"].dev = false;
    expect(evaluate({ packageLock }).failures.join("\n")).toContain(
      "braces is not marked development-only in package-lock.json",
    );
  });

  it("rejects missing or malformed exception metadata", () => {
    expect(evaluate({ exception: null }).failures.join("\n")).toContain(
      "exception metadata is missing",
    );
    const malformed = clone(approvedException);
    delete malformed.approvalOwner;
    expect(evaluate({ exception: malformed }).failures.join("\n")).toContain(
      "approvalOwner does not match",
    );
  });

  it("preserves unrelated high and baseline restrictions", () => {
    const fullAudit = createFullAudit() as ReturnType<typeof createFullAudit> & {
      vulnerabilities: Record<string, unknown>;
    };
    fullAudit.vulnerabilities["unapproved-package"] = {
      name: "unapproved-package", severity: "high", isDirect: false,
      via: [], effects: [], nodes: ["node_modules/unapproved-package"],
    };
    fullAudit.metadata.vulnerabilities.high = 6;
    fullAudit.metadata.vulnerabilities.total = 12;
    const failures = evaluate({ fullAudit }).failures.join("\n");
    expect(failures).toContain("unwaived high vulnerabilities found: unapproved-package");
    expect(failures).toContain("total vulnerabilities increased to 12");
  });

  it("reports raw vulnerability counts without subtracting accepted findings", () => {
    const result = evaluate();
    expect(result.rawCounts.full).toEqual({
      info: 0, low: 0, moderate: 6, high: 5, critical: 0, total: 11,
    });
    expect(result.full.effectiveHighCount).toBe(0);
  });

  it("accounts for five derived entries as one approved advisory", () => {
    const result = evaluate();
    expect(result.acceptedExceptions).toHaveLength(1);
    expect(result.acceptedExceptions[0].advisoryId).toBe("GHSA-vfj7-8cjw-p6xm");
    expect(result.acceptedHighPackages).toEqual(chain);
    expect(result.acceptedExceptions[0].derivedPackageNames).toEqual(chain);
  });
});
