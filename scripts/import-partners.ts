import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { buildPartnerImportPlanFromFile } from "../src/features/partners/import/plan";
import {
  applyPartnerImportPlan,
  createDrizzlePartnerImportDb,
  executePartnerImportPlan,
  validateApplyAuthorization,
} from "../src/features/partners/import/execute";

function printUsageAndExit(): never {
  console.log(`
Usage:
  npm run partners:import -- --file "<path-to-xlsx>" (--dry-run | --apply)

Options:
  --file, -f    Path to client Excel workbook (.xlsx) [required]
  --dry-run     Run parsing, normalization, and invariant gates without modifying database
  --apply       Apply the verified plan to the explicitly authorized target
`);
  process.exit(1);
}

export function parseArgs(args: string[]): { filePath: string | null; isDryRun: boolean; modeProvided: boolean; modeConflict: boolean } {
  let filePath: string | null = null;
  let isDryRun = false;
  let modeProvided = false;
  let modeConflict = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file" || arg === "-f") {
      filePath = args[i + 1] ?? null;
      i++;
    } else if (arg.startsWith("--file=")) {
      filePath = arg.slice("--file=".length);
    } else if (arg === "--dry-run") {
      isDryRun = true;
      if (modeProvided) modeConflict = true;
      modeProvided = true;
    } else if (arg === "--apply") {
      isDryRun = false;
      if (modeProvided) modeConflict = true;
      modeProvided = true;
    }
  }

  return { filePath, isDryRun, modeProvided, modeConflict };
}

async function main() {
  console.log("=========================================================");
  console.log(" Uniwave Go Freight — Partner Master Import Pipeline");
  console.log("=========================================================\n");

  const { filePath, isDryRun, modeProvided, modeConflict } = parseArgs(process.argv.slice(2));

  if (!modeProvided || modeConflict) {
    console.error("[ERROR] Provide exactly one execution mode: --dry-run or --apply.");
    printUsageAndExit();
  }

  if (!filePath) {
    console.error("[ERROR] Missing required --file argument.");
    printUsageAndExit();
  }

  const resolvedPath = resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) {
    console.error(`[ERROR] File not found at path: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`Target Workbook: ${filePath}`);
  console.log(`Execution Mode:  ${isDryRun ? "DRY RUN (zero DB mutations)" : "APPLY"}\n`);

  console.log("Reading workbook, computing SHA-256 fingerprint, parsing and normalizing...");
  const plan = await buildPartnerImportPlanFromFile(resolvedPath, {
    enforceCanonicalInvariants: true,
  });

  let report;
  if (!isDryRun) {
    const target = validateApplyAuthorization(process.env, {
      dryRun: false,
      expectedHost: process.env.PARTNER_IMPORT_EXPECTED_HOST,
      expectedDatabase: process.env.PARTNER_IMPORT_EXPECTED_DATABASE,
    });
    console.log(`Authorized database target: host=${target.targetHost}, database=${target.targetDatabase}`);
    const { db } = await import("../src/lib/db/client");
    report = await applyPartnerImportPlan(
      plan,
      createDrizzlePartnerImportDb(db),
      process.env,
      {
        dryRun: false,
        expectedHost: process.env.PARTNER_IMPORT_EXPECTED_HOST,
        expectedDatabase: process.env.PARTNER_IMPORT_EXPECTED_DATABASE,
      },
    );
  } else {
    report = await executePartnerImportPlan(plan, { dryRun: true });
  }

  console.log("\n---------------------------------------------------------");
  console.log(" Real-Client Import Plan & Invariant Verification Report");
  console.log("---------------------------------------------------------");
  console.log(`Workbook Fingerprint (SHA-256):    ${plan.workbookFingerprint}`);
  console.log(`Workbook Fingerprint Prefix:        ${plan.workbookFingerprintPrefix}`);
  console.log(`File Size:                          ${plan.fileSizeBytes.toLocaleString()} bytes\n`);

  console.log("Source & Entity Statistics:");
  console.log(`  Source Category-Presence Entities: ${plan.stats.sourceCategoryPresenceEntities} (Expected: 99)`);
  console.log(`  Unresolved TBA Placeholders:       ${plan.stats.tbaPlaceholders} (Expected: 2)`);
  console.log(`  Named Category Presences:          ${plan.stats.namedCategoryPresences} (Expected: 97)`);
  console.log(`  Unique Named Business Partners:    ${plan.stats.uniqueNamedBusinessPartners} (Expected: 94)\n`);

  console.log("Contact Statistics:");
  console.log(`  Source Contact Rows:               ${plan.stats.sourceContactRows} (Expected: 349)`);
  console.log(`  Unresolved TBA Contact Rows:       ${plan.stats.unresolvedTbaContactRows} (Expected: 2)`);
  console.log(`  Exact Duplicate Contact Rows:      ${plan.stats.exactDuplicateContactRows} (Expected: 16)`);
  console.log(`  Canonical Contact Candidates:      ${plan.stats.canonicalContactCandidates} (Expected: 331)\n`);

  console.log("Category & Membership Statistics:");
  console.log(`  Canonical Partner Categories:      ${plan.stats.categories} (Expected: 7)`);
  console.log(`  Named Category Memberships:        ${plan.stats.categoryMemberships} (Expected: 97)\n`);

  console.log("Quarantine & Integrity:");
  console.log(`  Quarantined Rows:                  ${plan.quarantinedRows.length}`);
  for (const q of plan.quarantinedRows) {
    console.log(`    - Row ${q.rowNumber} [${q.categoryHeader}]: ${q.reason} (Company: ${q.rawValues.companyName || "N/A"})`);
  }

  console.log("\nExecution Summary:");
  console.log(`  Status:                            ${report.status}`);
  console.log(`  Applied Database Writes:           ${report.appliedDatabaseWrites}`);
  console.log(`  Message:                           ${report.message}`);
  console.log("---------------------------------------------------------\n");
  console.log(`[SUCCESS] ${isDryRun ? "All canonical C0 invariants verified. Dry run completed safely." : "Partner import apply completed."}`);
}

main().catch((err) => {
  console.error("\n[FATAL ERROR] Import pipeline failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
