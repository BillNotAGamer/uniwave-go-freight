import ExcelJS from "exceljs";

import type { PartnerCategoryCode } from "../constants";

export const CATEGORY_HEADER_TO_CODE: Record<string, PartnerCategoryCode> = {
  "FACTORY SEA": "factory_sea",
  "AIR FACTORY DATA": "air_factory",
  "DATA HÃNG BAY": "airline",
  "CO_LOADER BUYING": "co_loader_buying",
  "CO_LOADER SELLING": "co_loader_selling",
  "AGENT OVERSEA SELLING": "oversea_agent_selling",
  "AGENT OVERSEA BUYING": "oversea_agent_buying",
};

export function extractCellValueText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((t: unknown) =>
          t && typeof t === "object" && "text" in t
            ? String((t as { text: unknown }).text)
            : "",
        )
        .join("")
        .trim();
    }

    if (obj.text !== undefined && obj.text !== null) {
      if (typeof obj.text === "object") {
        return extractCellValueText(obj.text);
      }
      return String(obj.text).trim();
    }

    if (obj.result !== undefined && obj.result !== null) {
      return String(obj.result).trim();
    }
  }

  return String(value).trim();
}

export interface RawParsedSourceRow {
  rowNumber: number;
  categoryCode: PartnerCategoryCode;
  categoryHeader: string;
  stt: string | null;
  vendorCode: string | null;
  companyName: string;
  address: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  pic: string | null;
}

export interface ParseWorkbookResult {
  sheetName: string;
  totalRows: number;
  dataRows: RawParsedSourceRow[];
  categoryHeadersFound: string[];
}

export async function parseWorkbookFile(
  filePath: string,
): Promise<ParseWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  return parseWorkbook(workbook);
}

export async function parseWorkbookBuffer(
  buffer: Buffer,
): Promise<ParseWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  return parseWorkbook(workbook);
}

export function parseWorkbook(workbook: ExcelJS.Workbook): ParseWorkbookResult {
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Workbook contains no worksheets.");
  }

  let currentCategoryCode: PartnerCategoryCode | null = null;
  let currentCategoryHeader: string | null = null;
  const categoryHeadersFound: string[] = [];
  const dataRows: RawParsedSourceRow[] = [];

  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);

    const colA = extractCellValueText(row.getCell(1).value);
    const colB = extractCellValueText(row.getCell(2).value);
    const colC = extractCellValueText(row.getCell(3).value);
    const colD = extractCellValueText(row.getCell(4).value);
    const colE = extractCellValueText(row.getCell(5).value);
    const colF = extractCellValueText(row.getCell(6).value);
    const colG = extractCellValueText(row.getCell(7).value);
    const colH = extractCellValueText(row.getCell(8).value);

    // Skip the top table header row (e.g. "STT", "VENDOR CODE", "COMPANY NAME")
    if (
      colA.toUpperCase() === "STT" &&
      colB.toUpperCase().includes("VENDOR")
    ) {
      continue;
    }

    // Check if this row is a Category Header: colB has text, while colA and colC are empty
    if (colB && !colA && !colC && !colD && !colE && !colF && !colG && !colH) {
      const mappedCode = CATEGORY_HEADER_TO_CODE[colB];
      if (!mappedCode) {
        throw new Error(
          `Unrecognized category header "${colB}" at row ${r}. Pipeline fails closed.`,
        );
      }

      currentCategoryCode = mappedCode;
      currentCategoryHeader = colB;
      categoryHeadersFound.push(colB);
      continue;
    }

    // Check if row is completely empty across columns 1 to 8
    if (!colA && !colB && !colC && !colD && !colE && !colF && !colG && !colH) {
      continue;
    }

    if (!currentCategoryCode || !currentCategoryHeader) {
      throw new Error(
        `Encountered data row at row ${r} before any category header was declared.`,
      );
    }

    dataRows.push({
      rowNumber: r,
      categoryCode: currentCategoryCode,
      categoryHeader: currentCategoryHeader,
      stt: colA || null,
      vendorCode: colB || null,
      companyName: colC,
      address: colD || null,
      taxId: colE || null,
      email: colF || null,
      phone: colG || null,
      pic: colH || null,
    });
  }

  return {
    sheetName: sheet.name,
    totalRows: sheet.rowCount,
    dataRows,
    categoryHeadersFound,
  };
}
