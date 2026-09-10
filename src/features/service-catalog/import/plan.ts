import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";

import type { ServiceCatalogImportPlan } from "../types";
import { normalizeServiceCatalogRows } from "./normalize";
import { parseServiceCatalogWorkbookBuffer } from "./parse-workbook";
import { assertServiceCatalogInvariants } from "./validate";

export interface BuildServiceCatalogPlanOptions {
  enforceCanonicalInvariants?: boolean;
}

export async function buildServiceCatalogImportPlanFromFile(
  filePath: string,
  options: BuildServiceCatalogPlanOptions = {},
): Promise<ServiceCatalogImportPlan> {
  const buffer = await fs.readFile(filePath);
  return buildServiceCatalogImportPlanFromBuffer(buffer, options);
}

export async function buildServiceCatalogImportPlanFromBuffer(
  buffer: Buffer,
  options: BuildServiceCatalogPlanOptions = {},
): Promise<ServiceCatalogImportPlan> {
  const workbookFingerprint = createHash("sha256").update(buffer).digest("hex");
  const parsed = await parseServiceCatalogWorkbookBuffer(buffer);
  const normalized = normalizeServiceCatalogRows(parsed.rows);

  if (options.enforceCanonicalInvariants !== false) {
    assertServiceCatalogInvariants(
      normalized.stats,
      normalized.duplicateGroups,
    );
  }

  return {
    workbookFingerprint,
    workbookFingerprintPrefix: workbookFingerprint.slice(0, 16),
    fileSizeBytes: buffer.length,
    worksheet: parsed.worksheet,
    items: normalized.items,
    unitConversions: normalized.unitConversions,
    duplicateGroups: normalized.duplicateGroups,
    quarantines: [],
    warnings: normalized.warnings,
    stats: normalized.stats,
  };
}
