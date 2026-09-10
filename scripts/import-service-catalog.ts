import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  applyServiceCatalogImportPlan,
  createDrizzleServiceCatalogImportDb,
  executeServiceCatalogImportPlan,
  validateServiceCatalogApplyAuthorization,
} from "../src/features/service-catalog/import/execute";
import { buildServiceCatalogImportPlanFromFile } from "../src/features/service-catalog/import/plan";

export interface ServiceCatalogImportCliArgs {
  filePath: string | null;
  mode: "dry-run" | "apply" | null;
  modeConflict: boolean;
}

export function parseServiceCatalogImportArgs(
  args: string[],
): ServiceCatalogImportCliArgs {
  let filePath: string | null = null;
  let mode: ServiceCatalogImportCliArgs["mode"] = null;
  let modeConflict = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--file" || argument === "-f") {
      filePath = args[index + 1] ?? null;
      index++;
    } else if (argument?.startsWith("--file=")) {
      filePath = argument.slice("--file=".length);
    } else if (argument === "--dry-run" || argument === "--apply") {
      const requestedMode = argument === "--dry-run" ? "dry-run" : "apply";
      if (mode !== null) modeConflict = true;
      mode = requestedMode;
    } else {
      throw new Error(`Unknown argument "${argument}".`);
    }
  }

  return { filePath, mode, modeConflict };
}

function usage(): never {
  console.error(`
Usage:
  npm run service-catalog:import -- --file "<path-to-xlsx>" (--dry-run | --apply)

Options:
  --file, -f    Path to the Service Catalog workbook (.xlsx) [required]
  --dry-run     Parse, normalize, and validate with zero database connections/writes
  --apply       Apply through the explicitly authorized live database path
`);
  process.exit(1);
}

export async function main(): Promise<void> {
  const { filePath, mode, modeConflict } = parseServiceCatalogImportArgs(
    process.argv.slice(2),
  );
  if (!filePath || mode === null || modeConflict) usage();

  const resolvedPath = resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Workbook not found: ${resolvedPath}`);
  }

  const plan = await buildServiceCatalogImportPlanFromFile(resolvedPath);
  const stats = plan.stats;
  let report;

  if (mode === "apply") {
    const target = validateServiceCatalogApplyAuthorization(process.env, {
      dryRun: false,
      expectedHost: process.env.SERVICE_CATALOG_IMPORT_EXPECTED_HOST,
      expectedDatabase: process.env.SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE,
    });
    console.log(
      `Authorized database target: host=${target.targetHost}, database=${target.targetDatabase}, port=${target.targetPort}, SSL=${target.sslPresent ? "present" : "absent"}`,
    );

    // Keep dry-run DB-free: initialize the application database only here,
    // after all apply authorization and exact target gates have passed.
    const { db } = await import("../src/lib/db/client");
    report = await applyServiceCatalogImportPlan(
      plan,
      createDrizzleServiceCatalogImportDb(db),
      process.env,
      {
        dryRun: false,
        expectedHost: process.env.SERVICE_CATALOG_IMPORT_EXPECTED_HOST,
        expectedDatabase: process.env.SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE,
      },
    );
  } else {
    report = await executeServiceCatalogImportPlan(plan, { dryRun: true });
  }

  console.log("Uniwave Go Freight — Service Catalog import");
  console.log(`Execution mode: ${mode === "dry-run" ? "DRY RUN" : "APPLY"}`);
  console.log(`Worksheet: ${plan.worksheet}`);
  console.log(`Workbook Fingerprint (SHA-256): ${plan.workbookFingerprint}`);
  console.log(`Source business rows: ${stats.sourceBusinessRows}`);
  console.log(`Nonblank code rows: ${stats.nonblankCodeRows}`);
  console.log(`Unique codes / canonical items: ${stats.uniqueCodes}`);
  console.log(`Duplicate-code groups: ${stats.duplicateCodeGroups}`);
  console.log(`Rows in duplicate-code groups: ${stats.rowsInDuplicateCodeGroups}`);
  console.log(`Singleton-code rows: ${stats.singletonCodeRows}`);
  console.log(`Nature — Dịch vụ: ${stats.natureServiceRows}`);
  console.log(`Nature — Công cụ dụng cụ: ${stats.natureToolSupplyRows}`);
  console.log(`Nature — Hàng hóa: ${stats.natureGoodsRows}`);
  console.log(`VAT 8%: ${stats.vat8Rows}`);
  console.log(`VAT 10%: ${stats.vat10Rows}`);
  console.log(`VAT NULL / UNKNOWN: ${stats.vatNullRows}`);
  console.log(`VAT 69%: ${stats.vat69Rows}`);
  console.log(`Unexpected VAT values: ${stats.unexpectedVatRows}`);
  console.log(`Source representation rows: ${stats.sourceRepresentationRows}`);
  console.log(`Source rows with conversion: ${stats.sourceRowsWithConversion}`);
  console.log(`Canonical unit conversions: ${stats.canonicalUnitConversions}`);
  console.log(`Exact duplicate conversions removed: ${stats.exactDuplicateConversionRows}`);
  console.log(`Conflicting core metadata groups: ${stats.conflictingCoreMetadataGroups}`);
  console.log(`Quarantined rows: ${stats.quarantinedRows}`);
  console.log(`State before: ${report.stateBefore ?? "N/A"}`);
  console.log(`Status: ${report.status}`);
  console.log(`Items inserted: ${report.itemsInserted}`);
  console.log(`Conversions inserted: ${report.conversionsInserted}`);
  console.log(`Audit events written: ${report.auditEventsWritten}`);
  console.log(`Updates: ${report.updates}`);
  console.log(`Deletes: ${report.deletes}`);
  console.log(`Applied database writes: ${report.appliedDatabaseWrites}`);
  console.log(`[SUCCESS] ${report.message}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(
      "[FATAL ERROR] Service Catalog import failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
