import { EXPECTED_DUPLICATE_CODE_COUNTS } from "../constants";
import type {
  DuplicateCodeGroup,
  ServiceCatalogImportStats,
} from "../types";

export const CANONICAL_SERVICE_CATALOG_INVARIANTS: ServiceCatalogImportStats = {
  sourceBusinessRows: 97,
  nonblankCodeRows: 97,
  uniqueCodes: 78,
  duplicateCodeGroups: 15,
  rowsInDuplicateCodeGroups: 34,
  singletonCodeRows: 63,
  natureServiceRows: 82,
  natureToolSupplyRows: 12,
  natureGoodsRows: 3,
  vat8Rows: 66,
  vat10Rows: 1,
  vatNullRows: 30,
  vat69Rows: 0,
  unexpectedVatRows: 0,
  sourceRepresentationRows: 97,
  sourceRowsWithConversion: 48,
  canonicalItems: 78,
  canonicalUnitConversions: 48,
  exactDuplicateConversionRows: 0,
  conflictingCoreMetadataGroups: 0,
  quarantinedRows: 0,
};

export class ServiceCatalogInvariantViolationError extends Error {
  readonly discrepancies: string[];

  constructor(discrepancies: string[]) {
    super(`Service Catalog canonical invariants failed:\n${discrepancies.join("\n")}`);
    this.name = "ServiceCatalogInvariantViolationError";
    this.discrepancies = discrepancies;
  }
}

export function assertServiceCatalogInvariants(
  actual: ServiceCatalogImportStats,
  duplicateGroups: DuplicateCodeGroup[],
  expected: ServiceCatalogImportStats = CANONICAL_SERVICE_CATALOG_INVARIANTS,
): void {
  const discrepancies: string[] = [];

  for (const key of Object.keys(expected) as Array<keyof ServiceCatalogImportStats>) {
    if (actual[key] !== expected[key]) {
      discrepancies.push(
        `- ${key}: expected ${expected[key]}, received ${actual[key]}`,
      );
    }
  }

  const actualDuplicateCounts = Object.fromEntries(
    duplicateGroups.map((group) => [group.code, group.sourceRowCount]),
  );
  for (const [code, count] of Object.entries(EXPECTED_DUPLICATE_CODE_COUNTS)) {
    if (actualDuplicateCounts[code] !== count) {
      discrepancies.push(
        `- duplicate group ${code}: expected ${count}, received ${actualDuplicateCounts[code] ?? 0}`,
      );
    }
  }
  const unexpectedCodes = Object.keys(actualDuplicateCounts).filter(
    (code) => !(code in EXPECTED_DUPLICATE_CODE_COUNTS),
  );
  if (unexpectedCodes.length > 0) {
    discrepancies.push(`- unexpected duplicate groups: ${unexpectedCodes.join(", ")}`);
  }

  if (discrepancies.length > 0) {
    throw new ServiceCatalogInvariantViolationError(discrepancies);
  }
}
