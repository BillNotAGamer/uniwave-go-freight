import ExcelJS from "exceljs";

import { SERVICE_CATALOG_SOURCE_ROWS } from "../constants";
import type { ParsedServiceCatalogRow } from "../types";

const EXPECTED_HEADERS = {
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

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function extractResolvedCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;

  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    if ("result" in value && value.result !== null && value.result !== undefined) {
      return normalizeWhitespace(String(value.result));
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return normalizeWhitespace(value.richText.map((part) => part.text).join(""));
    }
  }

  // ExcelJS resolves shared-string indexes before exposing cell.text/value.
  return normalizeWhitespace(cell.text || String(value));
}

function optionalCellText(cell: ExcelJS.Cell): string | null {
  return extractResolvedCellText(cell) || null;
}

function assertWorkbookShape(sheet: ExcelJS.Worksheet): void {
  for (const [column, expected] of Object.entries(EXPECTED_HEADERS)) {
    const actual = extractResolvedCellText(
      sheet.getCell(SERVICE_CATALOG_SOURCE_ROWS.header, Number(column)),
    );
    if (actual !== expected) {
      throw new Error(
        `Unexpected Service Catalog header at ${sheet.getColumn(Number(column)).letter}${SERVICE_CATALOG_SOURCE_ROWS.header}: expected "${expected}", received "${actual}".`,
      );
    }
  }

  const summaryCode = extractResolvedCellText(
    sheet.getCell(SERVICE_CATALOG_SOURCE_ROWS.summaryRow, 2),
  );
  const summaryLabel = extractResolvedCellText(
    sheet.getCell(SERVICE_CATALOG_SOURCE_ROWS.summaryRow, 3),
  );
  if (summaryCode || summaryLabel !== "Tổng") {
    throw new Error(
      `Expected the non-business summary row at row ${SERVICE_CATALOG_SOURCE_ROWS.summaryRow}.`,
    );
  }
}

export interface ParsedServiceCatalogWorkbook {
  worksheet: string;
  worksheetRowCount: number;
  rows: ParsedServiceCatalogRow[];
  summaryRowExcluded: number;
}

export async function parseServiceCatalogWorkbookFile(
  filePath: string,
): Promise<ParsedServiceCatalogWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return parseServiceCatalogWorkbook(workbook);
}

export async function parseServiceCatalogWorkbookBuffer(
  buffer: Buffer,
): Promise<ParsedServiceCatalogWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return parseServiceCatalogWorkbook(workbook);
}

export function parseServiceCatalogWorkbook(
  workbook: ExcelJS.Workbook,
): ParsedServiceCatalogWorkbook {
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Service Catalog workbook contains no worksheet.");

  assertWorkbookShape(sheet);

  const rows: ParsedServiceCatalogRow[] = [];
  for (
    let rowNumber = SERVICE_CATALOG_SOURCE_ROWS.firstBusinessRow;
    rowNumber <= SERVICE_CATALOG_SOURCE_ROWS.lastBusinessRow;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    rows.push({
      worksheet: sheet.name,
      rowNumber,
      sourceCode: extractResolvedCellText(row.getCell(2)),
      name: extractResolvedCellText(row.getCell(3)),
      sourceNature: extractResolvedCellText(row.getCell(5)),
      sourceStatus: extractResolvedCellText(row.getCell(45)),
      primaryUnit: optionalCellText(row.getCell(7)),
      vatSourceValue: optionalCellText(row.getCell(33)),
      // C:AS is the complete non-conversion business metadata range.
      coreMetadataValues: Array.from({ length: 43 }, (_, index) =>
        optionalCellText(row.getCell(index + 3)),
      ),
      convertedUnit: optionalCellText(row.getCell(50)),
      conversionFactorSource: optionalCellText(row.getCell(51)),
      conversionOperationSource: optionalCellText(row.getCell(52)),
      conversionDescription: optionalCellText(row.getCell(53)),
    });
  }

  return {
    worksheet: sheet.name,
    worksheetRowCount: sheet.rowCount,
    rows,
    summaryRowExcluded: SERVICE_CATALOG_SOURCE_ROWS.summaryRow,
  };
}
