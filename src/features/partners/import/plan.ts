import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";

import { PARTNER_CATEGORY_CODES } from "../constants";
import { normalizeSourceRows } from "./normalize";
import { parseWorkbookBuffer } from "./parse-workbook";
import type { ImportPlanStats, PartnerImportPlan } from "./types";
import {
  assertCanonicalInvariants,
  validateCandidateIntegrity,
} from "./validate";

export interface BuildPlanOptions {
  enforceCanonicalInvariants?: boolean;
  expectedInvariants?: ImportPlanStats;
}

export async function buildPartnerImportPlanFromFile(
  filePath: string,
  options: BuildPlanOptions = {},
): Promise<PartnerImportPlan> {
  const buffer = await fs.readFile(filePath);
  return buildPartnerImportPlanFromBuffer(buffer, options);
}

export async function buildPartnerImportPlanFromBuffer(
  buffer: Buffer,
  options: BuildPlanOptions = {},
): Promise<PartnerImportPlan> {
  const hash = createHash("sha256").update(buffer).digest("hex");
  const fingerprintPrefix = hash.slice(0, 16);

  const parsed = await parseWorkbookBuffer(buffer);
  const normalized = normalizeSourceRows(parsed.dataRows);

  validateCandidateIntegrity(normalized.partners, normalized.contacts);

  if (options.enforceCanonicalInvariants !== false) {
    assertCanonicalInvariants(normalized.stats, options.expectedInvariants);
  }

  return {
    workbookFingerprint: hash,
    workbookFingerprintPrefix: fingerprintPrefix,
    fileSizeBytes: buffer.length,
    categories: PARTNER_CATEGORY_CODES,
    partners: normalized.partners,
    contacts: normalized.contacts,
    categoryMemberships: normalized.categoryMemberships,
    quarantinedRows: normalized.quarantinedRows,
    stats: normalized.stats,
    warnings: normalized.warnings,
  };
}
