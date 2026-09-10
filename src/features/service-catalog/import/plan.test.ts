import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  DUPLICATE_CODE_CLASSIFICATION,
  EXPECTED_DUPLICATE_CODE_COUNTS,
} from "../constants";
import type { ParsedServiceCatalogRow } from "../types";
import {
  DuplicateCodeCoreMetadataConflictError,
  normalizeServiceCatalogRows,
  normalizeSourceNature,
  normalizeSourceVatRate,
} from "./normalize";
import { parseServiceCatalogWorkbookBuffer } from "./parse-workbook";
import { buildServiceCatalogImportPlanFromBuffer } from "./plan";
import {
  CANONICAL_SERVICE_CATALOG_INVARIANTS,
  ServiceCatalogInvariantViolationError,
  assertServiceCatalogInvariants,
} from "./validate";
import {
  serviceCatalogVatRateSchema,
  sourceCatalogVatRateSchema,
} from "../validators";

const HEADERS = {
  2: "Mã",
  3: "Tên",
  4: "Giảm thuế theo quy định",
  5: "Tính chất",
  6: "Nhóm VTHH",
  7: "Đơn vị tính chính",
  33: "Thuế suất GTGT",
  50: "Đơn vị chuyển đổi",
  51: "Tỷ lệ chuyển đổi",
  52: "Phép tính",
  53: "Mô tả",
} as const;

function parsedRow(
  overrides: Partial<ParsedServiceCatalogRow> = {},
): ParsedServiceCatalogRow {
  const name = overrides.name ?? "Synthetic handling service";
  const nature = overrides.sourceNature ?? "Dịch vụ";
  const unit = overrides.primaryUnit === undefined ? "BILL" : overrides.primaryUnit;
  const vat = overrides.vatSourceValue === undefined ? "8" : overrides.vatSourceValue;
  return {
    worksheet: "Synthetic",
    rowNumber: 5,
    sourceCode: "SYN",
    name,
    sourceNature: nature,
    sourceStatus: "Đang sử dụng",
    primaryUnit: unit,
    vatSourceValue: vat,
    coreMetadataValues: [name, nature, unit, vat],
    convertedUnit: null,
    conversionFactorSource: "0",
    conversionOperationSource: null,
    conversionDescription: null,
    ...overrides,
  };
}

async function canonicalSyntheticWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Synthetic Service Catalog");
  for (const [column, header] of Object.entries(HEADERS)) {
    sheet.getCell(4, Number(column)).value = header;
  }

  const sourceItems: Array<{
    code: string;
    count: number;
    nature: "Dịch vụ" | "Công cụ dụng cụ" | "Hàng hóa";
    vat: string | null;
  }> = Object.entries(EXPECTED_DUPLICATE_CODE_COUNTS).map(([code, count]) => ({
    code,
    count,
    nature: "Dịch vụ",
    vat: "8",
  }));

  for (let index = 1; index <= 63; index++) {
    sourceItems.push({
      code: `SYN${String(index).padStart(3, "0")}`,
      count: 1,
      nature:
        index <= 3
          ? "Hàng hóa"
          : index <= 15
            ? "Công cụ dụng cụ"
            : "Dịch vụ",
      vat: index <= 30 ? null : index === 31 ? "10" : "8",
    });
  }

  let rowNumber = 5;
  let singletonIndex = 0;
  for (const item of sourceItems) {
    const isSingleton = item.count === 1;
    if (isSingleton) singletonIndex++;
    for (let variant = 1; variant <= item.count; variant++) {
      const row = sheet.getRow(rowNumber);
      row.getCell(1).value = rowNumber - 4;
      row.getCell(2).value = item.code;
      row.getCell(3).value = `Synthetic item ${item.code}`;
      row.getCell(4).value = "Chưa xác định";
      row.getCell(5).value = item.nature;
      row.getCell(6).value =
        item.nature === "Dịch vụ"
          ? "DV"
          : item.nature === "Hàng hóa"
            ? "HH"
            : "CCDC";
      row.getCell(7).value = "Base unit";
      row.getCell(33).value = item.vat;
      row.getCell(45).value = "Đang sử dụng";

      const hasConversion = !isSingleton || singletonIndex <= 14;
      row.getCell(51).value = hasConversion ? "1" : "0";
      if (hasConversion) {
        row.getCell(50).value = `Converted ${variant}`;
        row.getCell(52).value = "Phép nhân";
        row.getCell(53).value = `1 Converted ${variant} = 1 Base unit`;
      }
      rowNumber++;
    }
  }
  sheet.getCell(102, 3).value = "Tổng";
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("Service Catalog workbook parser", () => {
  it("accepts rows 5-101, excludes summary row 102, and resolves displayed string values", async () => {
    const buffer = await canonicalSyntheticWorkbook();
    const parsed = await parseServiceCatalogWorkbookBuffer(buffer);

    expect(parsed.rows).toHaveLength(97);
    expect(parsed.rows[0]?.rowNumber).toBe(5);
    expect(parsed.rows.at(-1)?.rowNumber).toBe(101);
    expect(parsed.summaryRowExcluded).toBe(102);
    expect(parsed.rows.some((row) => row.name === "Tổng")).toBe(false);
    expect(parsed.rows[0]?.vatSourceValue).toBe("8");
    expect(parsed.rows[0]?.vatSourceValue).not.toBe("69");
  });
});

describe("Service Catalog normalization", () => {
  it("collapses equivalent duplicate codes while preserving distinct conversions", () => {
    const first = parsedRow({
      rowNumber: 5,
      convertedUnit: "CBM",
      conversionFactorSource: "1",
      conversionOperationSource: "Phép nhân",
      conversionDescription: "1 CBM = 1 BILL",
    });
    const second = parsedRow({
      rowNumber: 6,
      convertedUnit: "Cont",
      conversionFactorSource: "1",
      conversionOperationSource: "Phép nhân",
      conversionDescription: "1 Cont = 1 BILL",
    });

    const result = normalizeServiceCatalogRows([first, second]);
    expect(result.items).toHaveLength(1);
    expect(result.unitConversions).toHaveLength(2);
    expect(result.duplicateGroups[0]?.classification).toBe(
      DUPLICATE_CODE_CLASSIFICATION,
    );
  });

  it("deduplicates exact conversion representations while retaining both source rows", () => {
    const conversion = {
      convertedUnit: "CBM",
      conversionFactorSource: "1",
      conversionOperationSource: "Phép nhân",
      conversionDescription: "1 CBM = 1 BILL",
    };
    const result = normalizeServiceCatalogRows([
      parsedRow({ rowNumber: 5, ...conversion }),
      parsedRow({ rowNumber: 6, ...conversion }),
    ]);

    expect(result.unitConversions).toHaveLength(1);
    expect(result.unitConversions[0]?.sourceRows).toEqual([5, 6]);
    expect(result.stats.exactDuplicateConversionRows).toBe(1);
  });

  it("keeps similar descriptions with different codes as separate items", () => {
    const result = normalizeServiceCatalogRows([
      parsedRow({ sourceCode: "ONE", rowNumber: 5 }),
      parsedRow({ sourceCode: "TWO", rowNumber: 6 }),
    ]);
    expect(result.items.map((item) => item.code)).toEqual(["ONE", "TWO"]);
  });

  it("fails closed when one code has conflicting non-conversion metadata", () => {
    expect(() =>
      normalizeServiceCatalogRows([
        parsedRow({ rowNumber: 5 }),
        parsedRow({
          rowNumber: 6,
          name: "Conflicting name",
          coreMetadataValues: ["Conflicting name", "Dịch vụ", "BILL", "8"],
        }),
      ]),
    ).toThrow(DuplicateCodeCoreMetadataConflictError);
  });

  it("maps all source natures and rejects unknown nature", () => {
    expect(normalizeSourceNature("Dịch vụ")).toBe("service");
    expect(normalizeSourceNature("Công cụ dụng cụ")).toBe("tool_supply");
    expect(normalizeSourceNature("Hàng hóa")).toBe("goods");
    expect(() => normalizeSourceNature("Unknown")).toThrow(/Unknown/);
  });

  it("maps VAT 8 and 10 while preserving blank as null, never zero", () => {
    expect(normalizeSourceVatRate("8%")).toBe(8);
    expect(normalizeSourceVatRate("10")).toBe(10);
    expect(normalizeSourceVatRate(null)).toBeNull();
    expect(normalizeSourceVatRate(" ")).toBeNull();
    expect(normalizeSourceVatRate(null)).not.toBe(0);
    expect(() => normalizeSourceVatRate("69")).toThrow(/Unexpected/);
  });

  it("separates application VAT support from the narrower source contract", () => {
    expect(serviceCatalogVatRateSchema.parse(0)).toBe(0);
    expect(serviceCatalogVatRateSchema.parse(5)).toBe(5);
    expect(sourceCatalogVatRateSchema.safeParse(0).success).toBe(false);
    expect(sourceCatalogVatRateSchema.safeParse(5).success).toBe(false);
  });
});

describe("Service Catalog canonical plan", () => {
  it("builds the accepted synthetic shape deterministically", async () => {
    const buffer = await canonicalSyntheticWorkbook();
    const plan = await buildServiceCatalogImportPlanFromBuffer(buffer);
    const repeatedPlan = await buildServiceCatalogImportPlanFromBuffer(buffer);

    expect(plan.items).toHaveLength(78);
    expect(plan.unitConversions).toHaveLength(48);
    expect(plan.duplicateGroups).toHaveLength(15);
    expect(plan.stats).toEqual(CANONICAL_SERVICE_CATALOG_INVARIANTS);
    expect(plan.quarantines).toEqual([]);
    expect(plan.workbookFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(repeatedPlan).toEqual(plan);
  });

  it("blocks acceptance when invariant counts differ", () => {
    expect(() =>
      assertServiceCatalogInvariants(
        { ...CANONICAL_SERVICE_CATALOG_INVARIANTS, sourceBusinessRows: 96 },
        [],
      ),
    ).toThrow(ServiceCatalogInvariantViolationError);
  });
});
