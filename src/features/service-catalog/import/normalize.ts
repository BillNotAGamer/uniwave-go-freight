import {
  DUPLICATE_CODE_CLASSIFICATION,
  SOURCE_NATURE_TO_CODE,
  type ConversionOperation,
  type ServiceCatalogNature,
} from "../constants";
import type {
  CanonicalServiceCatalogItemCandidate,
  CanonicalUnitConversionCandidate,
  DuplicateCodeGroup,
  ParsedServiceCatalogRow,
  ServiceCatalogImportStats,
  SourceTrace,
} from "../types";
import {
  canonicalServiceCatalogItemSchema,
  canonicalUnitConversionSchema,
} from "../validators";

export class DuplicateCodeCoreMetadataConflictError extends Error {
  readonly conflictingCodes: string[];

  constructor(conflictingCodes: string[]) {
    super(
      `Duplicate Service Catalog codes contain conflicting core metadata: ${conflictingCodes.join(", ")}.`,
    );
    this.name = "DuplicateCodeCoreMetadataConflictError";
    this.conflictingCodes = conflictingCodes;
  }
}

export function normalizeCatalogText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function optionalText(value: string | null): string | null {
  if (value === null) return null;
  return normalizeCatalogText(value) || null;
}

export function normalizeServiceCode(value: string): string {
  return normalizeCatalogText(value).toUpperCase();
}

function comparisonText(value: string | null): string {
  return optionalText(value)?.toLowerCase() ?? "";
}

export function normalizeSourceNature(value: string): ServiceCatalogNature {
  const normalized = normalizeCatalogText(value);
  const nature = SOURCE_NATURE_TO_CODE[
    normalized as keyof typeof SOURCE_NATURE_TO_CODE
  ];
  if (!nature) {
    throw new Error(`Unknown Service Catalog nature "${normalized}".`);
  }
  return nature;
}

export function normalizeSourceVatRate(value: string | null): 8 | 10 | null {
  const normalized = optionalText(value);
  if (normalized === null) return null;

  const percent = normalized.replace(/\s*%$/, "");
  if (percent === "8") return 8;
  if (percent === "10") return 10;

  throw new Error(`Unexpected Service Catalog VAT value "${normalized}".`);
}

function normalizeConversionOperation(value: string | null): ConversionOperation {
  if (optionalText(value) === "Phép nhân") return "multiply";
  throw new Error(`Unknown unit conversion operation "${value ?? ""}".`);
}

function normalizeConversionFactor(value: string | null): string {
  const normalized = optionalText(value);
  if (normalized === null || !/^\d+(?:[.,]\d+)?$/.test(normalized)) {
    throw new Error(`Invalid unit conversion factor "${value ?? ""}".`);
  }

  const numericValue = Number(normalized.replace(",", "."));
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`Unit conversion factor must be positive, received "${value}".`);
  }
  return String(numericValue);
}

function traceFor(row: ParsedServiceCatalogRow): SourceTrace {
  return {
    worksheet: row.worksheet,
    rowNumber: row.rowNumber,
    sourceCode: normalizeCatalogText(row.sourceCode),
  };
}

function coreSignature(row: ParsedServiceCatalogRow): string {
  return JSON.stringify(row.coreMetadataValues.map(comparisonText));
}

export interface NormalizedServiceCatalog {
  items: CanonicalServiceCatalogItemCandidate[];
  unitConversions: CanonicalUnitConversionCandidate[];
  duplicateGroups: DuplicateCodeGroup[];
  stats: ServiceCatalogImportStats;
  warnings: string[];
}

export function normalizeServiceCatalogRows(
  sourceRows: ParsedServiceCatalogRow[],
): NormalizedServiceCatalog {
  const rowsByCode = new Map<string, ParsedServiceCatalogRow[]>();
  let nonblankCodeRows = 0;
  let natureServiceRows = 0;
  let natureToolSupplyRows = 0;
  let natureGoodsRows = 0;
  let vat8Rows = 0;
  let vat10Rows = 0;
  let vatNullRows = 0;
  let vat69Rows = 0;
  let unexpectedVatRows = 0;

  for (const row of sourceRows) {
    const code = normalizeServiceCode(row.sourceCode);
    if (!code) {
      throw new Error(`Service Catalog row ${row.rowNumber} has a blank code.`);
    }
    nonblankCodeRows++;

    const name = normalizeCatalogText(row.name);
    if (!name) throw new Error(`Service Catalog row ${row.rowNumber} has a blank name.`);

    const nature = normalizeSourceNature(row.sourceNature);
    if (nature === "service") natureServiceRows++;
    if (nature === "tool_supply") natureToolSupplyRows++;
    if (nature === "goods") natureGoodsRows++;

    if (normalizeCatalogText(row.sourceStatus) !== "Đang sử dụng") {
      throw new Error(
        `Unknown Service Catalog status "${row.sourceStatus}" at row ${row.rowNumber}.`,
      );
    }

    try {
      const vatRate = normalizeSourceVatRate(row.vatSourceValue);
      if (vatRate === 8) vat8Rows++;
      if (vatRate === 10) vat10Rows++;
      if (vatRate === null) vatNullRows++;
    } catch (error) {
      if (optionalText(row.vatSourceValue)?.replace(/\s*%$/, "") === "69") {
        vat69Rows++;
      } else {
        unexpectedVatRows++;
      }
      throw error;
    }

    const group = rowsByCode.get(code) ?? [];
    group.push(row);
    rowsByCode.set(code, group);
  }

  const conflictingCodes = [...rowsByCode]
    .filter(([, rows]) => new Set(rows.map(coreSignature)).size !== 1)
    .map(([code]) => code)
    .sort();
  if (conflictingCodes.length > 0) {
    throw new DuplicateCodeCoreMetadataConflictError(conflictingCodes);
  }

  const items: CanonicalServiceCatalogItemCandidate[] = [];
  const duplicateGroups: DuplicateCodeGroup[] = [];
  const conversionMap = new Map<string, CanonicalUnitConversionCandidate>();
  let sourceRowsWithConversion = 0;

  for (const [code, rows] of [...rowsByCode].sort(([a], [b]) => a.localeCompare(b))) {
    const first = rows[0];
    if (!first) continue;

    const item: CanonicalServiceCatalogItemCandidate = {
      code,
      name: normalizeCatalogText(first.name),
      nature: normalizeSourceNature(first.sourceNature),
      primaryUnit: optionalText(first.primaryUnit),
      vatRate: normalizeSourceVatRate(first.vatSourceValue),
      isActive: true,
      sourceRows: rows.map((row) => row.rowNumber).sort((a, b) => a - b),
      sourceTrace: rows.map(traceFor),
    };
    canonicalServiceCatalogItemSchema.parse(item);
    items.push(item);

    if (rows.length > 1) {
      duplicateGroups.push({
        code,
        sourceRowCount: rows.length,
        sourceRows: item.sourceRows,
        classification: DUPLICATE_CODE_CLASSIFICATION,
      });
    }

    for (const row of rows) {
      const convertedUnit = optionalText(row.convertedUnit);
      if (convertedUnit === null) {
        const factor = optionalText(row.conversionFactorSource);
        if (factor !== null && factor !== "0") {
          throw new Error(
            `Service Catalog row ${row.rowNumber} has conversion data without a converted unit.`,
          );
        }
        if (row.conversionOperationSource || row.conversionDescription) {
          throw new Error(
            `Service Catalog row ${row.rowNumber} has incomplete conversion metadata.`,
          );
        }
        continue;
      }

      sourceRowsWithConversion++;
      const conversion: CanonicalUnitConversionCandidate = {
        itemCode: code,
        convertedUnit,
        conversionFactor: normalizeConversionFactor(row.conversionFactorSource),
        operation: normalizeConversionOperation(row.conversionOperationSource),
        sourceDescription: optionalText(row.conversionDescription),
        sourceRows: [row.rowNumber],
        sourceTrace: [traceFor(row)],
      };
      canonicalUnitConversionSchema.parse(conversion);

      const conversionKey = JSON.stringify([
        code,
        comparisonText(convertedUnit),
        conversion.conversionFactor,
        conversion.operation,
        comparisonText(conversion.sourceDescription),
      ]);
      const existing = conversionMap.get(conversionKey);
      if (existing) {
        existing.sourceRows.push(row.rowNumber);
        existing.sourceTrace.push(traceFor(row));
      } else {
        conversionMap.set(conversionKey, conversion);
      }
    }
  }

  const unitConversions = [...conversionMap.values()].sort((a, b) =>
    `${a.itemCode}\0${a.convertedUnit}`.localeCompare(
      `${b.itemCode}\0${b.convertedUnit}`,
    ),
  );
  const rowsInDuplicateCodeGroups = duplicateGroups.reduce(
    (total, group) => total + group.sourceRowCount,
    0,
  );

  return {
    items,
    unitConversions,
    duplicateGroups,
    warnings: [],
    stats: {
      sourceBusinessRows: sourceRows.length,
      nonblankCodeRows,
      uniqueCodes: rowsByCode.size,
      duplicateCodeGroups: duplicateGroups.length,
      rowsInDuplicateCodeGroups,
      singletonCodeRows: sourceRows.length - rowsInDuplicateCodeGroups,
      natureServiceRows,
      natureToolSupplyRows,
      natureGoodsRows,
      vat8Rows,
      vat10Rows,
      vatNullRows,
      vat69Rows,
      unexpectedVatRows,
      sourceRepresentationRows: sourceRows.length,
      sourceRowsWithConversion,
      canonicalItems: items.length,
      canonicalUnitConversions: unitConversions.length,
      exactDuplicateConversionRows: sourceRowsWithConversion - unitConversions.length,
      conflictingCoreMetadataGroups: 0,
      quarantinedRows: 0,
    },
  };
}
