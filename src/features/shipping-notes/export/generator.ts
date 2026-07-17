import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import {
  addDecimalStrings,
  subtractDecimalStrings,
  validateDecimalString,
} from "@/lib/calculations/decimal";

import {
  INTERNAL_XLSX_TEMPLATE_RELATIVE_PATH,
  INTERNAL_XLSX_BUYING_ROWS,
  INTERNAL_XLSX_HEADER_CELLS,
  INTERNAL_XLSX_PROFIT_CELL,
  INTERNAL_XLSX_SELLING_ROWS,
  INTERNAL_XLSX_TEMPLATE_SHA256,
  INTERNAL_XLSX_TEMPLATE_VERSION,
  INTERNAL_XLSX_WORKSHEET_NAME,
} from "./constants";
import { ExportError, EXPORT_ERROR_CODES } from "./errors";
import type {
  InternalExportBuyingCharge,
  InternalExportCharge,
  InternalShippingNoteExportDto,
} from "./types";

type TemplateRowRange = {
  start: number;
  end: number;
};

export type InternalXlsxGenerationResult = {
  buffer: ArrayBuffer;
  fileName: string;
  checksumSha256: string;
  templateVersion: string;
};

const AMOUNT_VND_SCALE = 2;
const MAX_EXCEL_INTEGER_DIGITS = 13;

function getTemplatePath(): string {
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    INTERNAL_XLSX_TEMPLATE_RELATIVE_PATH,
  );
}

function sha256(buffer: Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function formatUtcTimestamp(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const second = date.getUTCSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function sanitizeFilenamePart(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.+/g, ".")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_ .-]+|[_ .-]+$/g, "");

  return sanitized.slice(0, 72) || "shipping-note";
}

export function buildInternalXlsxFileName(
  exportData: InternalShippingNoteExportDto,
  generatedAt = new Date(),
): string {
  const jobsheetPart = sanitizeFilenamePart(exportData.note.jobsheetNo);
  const timestampPart = formatUtcTimestamp(generatedAt);

  return `ShippingNote_${jobsheetPart}_${timestampPart}.xlsx`;
}

function assertTemplateHash(templateBuffer: Buffer): void {
  if (sha256(templateBuffer) !== INTERNAL_XLSX_TEMPLATE_SHA256) {
    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_HASH_MISMATCH,
      500,
      "Internal XLSX template hash does not match the pinned version.",
    );
  }
}

async function assertTemplateFile(): Promise<void> {
  try {
    const buffer = await readFile(getTemplatePath());
    assertTemplateHash(buffer);
  } catch (error) {
    if (error instanceof ExportError) {
      throw error;
    }

    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_NOT_FOUND,
      500,
      "Internal XLSX template is missing or unreadable.",
    );
  }
}

function getWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const worksheet = workbook.getWorksheet(INTERNAL_XLSX_WORKSHEET_NAME);

  if (!worksheet) {
    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_INVALID,
      500,
      "Internal XLSX template worksheet is missing.",
    );
  }

  if (worksheet.rowCount < 38 || worksheet.columnCount < 5) {
    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_INVALID,
      500,
      "Internal XLSX template does not contain the required export area.",
    );
  }

  if (
    worksheet.getCell(INTERNAL_XLSX_PROFIT_CELL.labelCell).value !==
    INTERNAL_XLSX_PROFIT_CELL.label
  ) {
    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_INVALID,
      500,
      "Internal XLSX template profit label does not match the pinned layout.",
    );
  }

  return worksheet;
}

function assertCapacity(
  charges: readonly unknown[],
  rowRange: TemplateRowRange,
  label: string,
): void {
  const capacity = rowRange.end - rowRange.start + 1;

  if (charges.length > capacity) {
    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_CAPACITY_EXCEEDED,
      422,
      `${label} charges exceed the internal XLSX template row capacity.`,
    );
  }
}

function assertSummaryMatchesCharges(
  exportData: InternalShippingNoteExportDto,
): void {
  try {
    const totalSellingVnd = addDecimalStrings(
      exportData.sellingCharges.map((charge) => charge.amountVnd),
      AMOUNT_VND_SCALE,
    );
    const totalBuyingVnd = addDecimalStrings(
      exportData.buyingCharges.map((charge) => charge.amountVnd),
      AMOUNT_VND_SCALE,
    );
    const grossProfitVnd = subtractDecimalStrings(
      totalSellingVnd,
      totalBuyingVnd,
      AMOUNT_VND_SCALE,
    );

    if (
      totalSellingVnd !== exportData.summary.totalSellingVnd ||
      totalBuyingVnd !== exportData.summary.totalBuyingVnd ||
      grossProfitVnd !== exportData.summary.grossProfitVnd
    ) {
      throw new Error("Summary totals do not match charge rows.");
    }
  } catch (error) {
    throw new ExportError(
      EXPORT_ERROR_CODES.INVALID_DATA,
      422,
      error instanceof Error
        ? error.message
        : "Internal export data contains invalid decimal values.",
    );
  }
}

function toExcelNumber(value: string, allowNegative = false): number {
  const normalizedValue = validateDecimalString(value, {
    scale: AMOUNT_VND_SCALE,
    maxIntegerDigits: MAX_EXCEL_INTEGER_DIGITS,
    allowNegative,
  });
  const excelNumber = Number(normalizedValue);

  if (!Number.isFinite(excelNumber)) {
    throw new ExportError(
      EXPORT_ERROR_CODES.INVALID_DATA,
      422,
      "Internal export data contains a value that cannot be serialized safely.",
    );
  }

  return excelNumber;
}

function setCellValue(
  worksheet: ExcelJS.Worksheet,
  cellAddress: string,
  value: ExcelJS.CellValue,
): void {
  worksheet.getCell(cellAddress).value = value;
}

function clearChargeRows(
  worksheet: ExcelJS.Worksheet,
  rowRange: TemplateRowRange,
): void {
  for (let rowNumber = rowRange.start; rowNumber <= rowRange.end; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.hidden = true;

    for (const column of ["C", "D", "E"]) {
      worksheet.getCell(`${column}${rowNumber}`).value = null;
    }
  }
}

function formatChargeDescription(charge: InternalExportCharge): string {
  const quantityLine = `${charge.quantity}${charge.unit ? ` ${charge.unit}` : ""}`;
  const unitPriceLine = `${charge.unitPrice} ${charge.currency}`;

  return [
    charge.chargeName,
    charge.description,
    quantityLine,
    unitPriceLine,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

function writeChargeRows(
  worksheet: ExcelJS.Worksheet,
  rowRange: TemplateRowRange,
  charges: readonly InternalExportCharge[],
  partyTextForCharge: (charge: InternalExportCharge) => string,
): void {
  clearChargeRows(worksheet, rowRange);

  const firstWrittenRow = rowRange.end - charges.length + 1;

  charges.forEach((charge, index) => {
    const rowNumber = firstWrittenRow + index;
    const row = worksheet.getRow(rowNumber);
    row.hidden = false;

    const descriptionCell = worksheet.getCell(`C${rowNumber}`);
    descriptionCell.value = formatChargeDescription(charge);
    descriptionCell.alignment = {
      ...descriptionCell.alignment,
      wrapText: true,
      vertical: "top",
    };

    worksheet.getCell(`D${rowNumber}`).value = toExcelNumber(charge.amountVnd);
    worksheet.getCell(`E${rowNumber}`).value = partyTextForCharge(charge);
  });
}

function formatDestination(exportData: InternalShippingNoteExportDto): string {
  return (
    exportData.note.finalDestination ??
    exportData.note.aod ??
    ""
  );
}

function formatVolume(exportData: InternalShippingNoteExportDto): string {
  return [exportData.note.volumeValue, exportData.note.volumeUnit]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function writeHeader(
  worksheet: ExcelJS.Worksheet,
  exportData: InternalShippingNoteExportDto,
): void {
  setCellValue(worksheet, INTERNAL_XLSX_HEADER_CELLS.jobsheetNo, exportData.note.jobsheetNo);
  setCellValue(
    worksheet,
    INTERNAL_XLSX_HEADER_CELLS.mawbHawbNo,
    exportData.note.mawbHawbNo ?? "",
  );
  setCellValue(
    worksheet,
    INTERNAL_XLSX_HEADER_CELLS.shipperText,
    exportData.note.shipperText ?? "",
  );
  setCellValue(
    worksheet,
    INTERNAL_XLSX_HEADER_CELLS.consigneeText,
    exportData.note.consigneeText ?? "",
  );
  setCellValue(worksheet, INTERNAL_XLSX_HEADER_CELLS.aol, exportData.note.aol ?? "");
  setCellValue(worksheet, INTERNAL_XLSX_HEADER_CELLS.destination, formatDestination(exportData));
  setCellValue(worksheet, INTERNAL_XLSX_HEADER_CELLS.etd, exportData.note.etd);
  setCellValue(worksheet, INTERNAL_XLSX_HEADER_CELLS.volume, formatVolume(exportData));
  setCellValue(
    worksheet,
    INTERNAL_XLSX_HEADER_CELLS.exchangeRate,
    exportData.note.exchangeRate,
  );
}

function writeFormulas(
  worksheet: ExcelJS.Worksheet,
  exportData: InternalShippingNoteExportDto,
): void {
  worksheet.getCell(INTERNAL_XLSX_SELLING_ROWS.totalCell).value = {
    formula: INTERNAL_XLSX_SELLING_ROWS.totalFormula,
    result: toExcelNumber(exportData.summary.totalSellingVnd),
  };
  worksheet.getCell(INTERNAL_XLSX_BUYING_ROWS.totalCell).value = {
    formula: INTERNAL_XLSX_BUYING_ROWS.totalFormula,
    result: toExcelNumber(exportData.summary.totalBuyingVnd),
  };

  // The app/read model uses Gross Profit. The client workbook keeps the
  // requested NET PROFIT (USD) label and derives the value from E25-E37.
  worksheet.getCell(INTERNAL_XLSX_PROFIT_CELL.labelCell).value =
    INTERNAL_XLSX_PROFIT_CELL.label;
  worksheet.getCell(INTERNAL_XLSX_PROFIT_CELL.valueCell).value = {
    formula: INTERNAL_XLSX_PROFIT_CELL.formula,
    result: toExcelNumber(exportData.summary.grossProfitVnd, true),
  };
}

export async function generateInternalShippingNoteXlsx(
  exportData: InternalShippingNoteExportDto,
  generatedAt = new Date(),
): Promise<InternalXlsxGenerationResult> {
  assertCapacity(exportData.sellingCharges, INTERNAL_XLSX_SELLING_ROWS, "Selling");
  assertCapacity(exportData.buyingCharges, INTERNAL_XLSX_BUYING_ROWS, "Buying");
  assertSummaryMatchesCharges(exportData);

  await assertTemplateFile();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(getTemplatePath());

  workbook.creator = "Uniwave Go Freight";
  workbook.lastModifiedBy = "Uniwave Go Freight";
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = getWorksheet(workbook);

  writeHeader(worksheet, exportData);
  writeChargeRows(
    worksheet,
    INTERNAL_XLSX_SELLING_ROWS,
    exportData.sellingCharges,
    () => exportData.note.customerText ?? exportData.note.agentText ?? "",
  );
  writeChargeRows(
    worksheet,
    INTERNAL_XLSX_BUYING_ROWS,
    exportData.buyingCharges,
    (charge) =>
      (charge as InternalExportBuyingCharge).vendorOrAgentText ??
      exportData.note.agentText ??
      "",
  );
  writeFormulas(worksheet, exportData);

  const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const outputArrayBuffer = outputBuffer.buffer.slice(
    outputBuffer.byteOffset,
    outputBuffer.byteOffset + outputBuffer.byteLength,
  ) as ArrayBuffer;

  return {
    buffer: outputArrayBuffer,
    fileName: buildInternalXlsxFileName(exportData, generatedAt),
    checksumSha256: sha256(outputBuffer),
    templateVersion: INTERNAL_XLSX_TEMPLATE_VERSION,
  };
}
