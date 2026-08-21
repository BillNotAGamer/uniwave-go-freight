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
  INTERNAL_XLSX_TAX_DETAIL_BUYING_ROWS,
  INTERNAL_XLSX_TAX_DETAIL_COLUMNS,
  INTERNAL_XLSX_TAX_DETAIL_SELLING_ROWS,
  INTERNAL_XLSX_TAX_DETAILS_WORKSHEET_NAME,
  INTERNAL_XLSX_TAX_SUMMARY_CELLS,
  INTERNAL_XLSX_TEMPLATE_SHA256,
  INTERNAL_XLSX_TEMPLATE_VERSION,
  INTERNAL_XLSX_WORKSHEET_NAME,
} from "./constants";
import { ExportError, EXPORT_ERROR_CODES } from "./errors";
import { buildInternalXlsxFileName } from "./filename";
import {
  formatTaxRuleSnapshotForExport,
  formatTaxTreatmentForExport,
} from "./read-model";
import type {
  InternalExportBuyingCharge,
  InternalExportCharge,
  InternalShippingNoteExportDto,
} from "./types";

export { buildInternalXlsxFileName } from "./filename";

type TemplateRowRange = {
  start: number;
  end: number;
};

type TemplateRowMapping = TemplateRowRange & {
  headerRow: number;
  sectionLabelCell: string;
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

function getTaxDetailsWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const worksheet = workbook.getWorksheet(INTERNAL_XLSX_TAX_DETAILS_WORKSHEET_NAME);

  if (!worksheet) {
    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_INVALID,
      500,
      "Internal XLSX tax details worksheet is missing.",
    );
  }

  if (worksheet.getCell("A1").value !== "INTERNAL TAX DETAILS") {
    throw new ExportError(
      EXPORT_ERROR_CODES.TEMPLATE_INVALID,
      500,
      "Internal XLSX tax details worksheet does not match the pinned layout.",
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
    const sellingVatVnd = addDecimalStrings(
      exportData.sellingCharges.map((charge) => charge.vatAmount),
      AMOUNT_VND_SCALE,
    );
    const buyingVatVnd = addDecimalStrings(
      exportData.buyingCharges.map((charge) => charge.vatAmount),
      AMOUNT_VND_SCALE,
    );
    const sellingTotalIncludingVatVnd = addDecimalStrings(
      exportData.sellingCharges.map((charge) => charge.totalIncludingVatVnd),
      AMOUNT_VND_SCALE,
    );
    const buyingTotalIncludingVatVnd = addDecimalStrings(
      exportData.buyingCharges.map((charge) => charge.totalIncludingVatVnd),
      AMOUNT_VND_SCALE,
    );

    if (
      totalSellingVnd !== exportData.summary.totalSellingVnd ||
      totalBuyingVnd !== exportData.summary.totalBuyingVnd ||
      grossProfitVnd !== exportData.summary.grossProfitVnd ||
      totalSellingVnd !== exportData.summary.sellingSubtotalExcludingVatVnd ||
      totalBuyingVnd !== exportData.summary.buyingSubtotalExcludingVatVnd ||
      sellingVatVnd !== exportData.summary.sellingVatVnd ||
      buyingVatVnd !== exportData.summary.buyingVatVnd ||
      sellingTotalIncludingVatVnd !==
        exportData.summary.sellingTotalIncludingVatVnd ||
      buyingTotalIncludingVatVnd !==
        exportData.summary.buyingTotalIncludingVatVnd ||
      grossProfitVnd !== exportData.summary.grossProfitExcludingVatVnd
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

function clearTaxDetailRows(
  worksheet: ExcelJS.Worksheet,
  rowRange: TemplateRowRange,
): void {
  for (let rowNumber = rowRange.start; rowNumber <= rowRange.end; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.hidden = true;

    for (const column of Object.values(INTERNAL_XLSX_TAX_DETAIL_COLUMNS)) {
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

function writeTaxDetailRows(
  worksheet: ExcelJS.Worksheet,
  rowRange: TemplateRowMapping,
  sectionLabel: string,
  charges: readonly InternalExportCharge[],
): void {
  clearTaxDetailRows(worksheet, rowRange);

  const firstWrittenRow = rowRange.start;

  charges.forEach((charge, index) => {
    const rowNumber = firstWrittenRow + index;
    const row = worksheet.getRow(rowNumber);
    row.hidden = false;

    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.section}${rowNumber}`,
    ).value = sectionLabel;
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.chargeName}${rowNumber}`,
    ).value = charge.chargeName;
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.taxRule}${rowNumber}`,
    ).value = formatTaxRuleSnapshotForExport(charge);
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.taxTreatment}${rowNumber}`,
    ).value = formatTaxTreatmentForExport(charge.taxTreatmentSnapshot);
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.baseExcludingVatVnd}${rowNumber}`,
    ).value = toExcelNumber(charge.amountVnd);
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.vatPercent}${rowNumber}`,
    ).value = toExcelNumber(charge.vatPercent);
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.vatAmountVnd}${rowNumber}`,
    ).value = toExcelNumber(charge.vatAmount);
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.totalIncludingVatVnd}${rowNumber}`,
    ).value = toExcelNumber(charge.totalIncludingVatVnd);
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.overrideFlag}${rowNumber}`,
    ).value = charge.isOverride ? "Override" : "";
    worksheet.getCell(
      `${INTERNAL_XLSX_TAX_DETAIL_COLUMNS.overrideReason}${rowNumber}`,
    ).value = charge.overrideReason ?? "";
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

function writeTaxSummary(
  worksheet: ExcelJS.Worksheet,
  exportData: InternalShippingNoteExportDto,
): void {
  worksheet.getCell(
    INTERNAL_XLSX_TAX_SUMMARY_CELLS.sellingSubtotalExcludingVatVnd,
  ).value = toExcelNumber(exportData.summary.sellingSubtotalExcludingVatVnd);
  worksheet.getCell(INTERNAL_XLSX_TAX_SUMMARY_CELLS.sellingVatVnd).value =
    toExcelNumber(exportData.summary.sellingVatVnd);
  worksheet.getCell(
    INTERNAL_XLSX_TAX_SUMMARY_CELLS.sellingTotalIncludingVatVnd,
  ).value = toExcelNumber(exportData.summary.sellingTotalIncludingVatVnd);
  worksheet.getCell(
    INTERNAL_XLSX_TAX_SUMMARY_CELLS.buyingSubtotalExcludingVatVnd,
  ).value = toExcelNumber(exportData.summary.buyingSubtotalExcludingVatVnd);
  worksheet.getCell(INTERNAL_XLSX_TAX_SUMMARY_CELLS.buyingVatVnd).value =
    toExcelNumber(exportData.summary.buyingVatVnd);
  worksheet.getCell(
    INTERNAL_XLSX_TAX_SUMMARY_CELLS.buyingTotalIncludingVatVnd,
  ).value = toExcelNumber(exportData.summary.buyingTotalIncludingVatVnd);
  worksheet.getCell(
    INTERNAL_XLSX_TAX_SUMMARY_CELLS.grossProfitExcludingVatVnd,
  ).value = toExcelNumber(exportData.summary.grossProfitExcludingVatVnd, true);
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
  const taxDetailsWorksheet = getTaxDetailsWorksheet(workbook);

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
  writeTaxDetailRows(
    taxDetailsWorksheet,
    INTERNAL_XLSX_TAX_DETAIL_SELLING_ROWS,
    "Selling",
    exportData.sellingCharges,
  );
  writeTaxDetailRows(
    taxDetailsWorksheet,
    INTERNAL_XLSX_TAX_DETAIL_BUYING_ROWS,
    "Buying",
    exportData.buyingCharges,
  );
  writeTaxSummary(taxDetailsWorksheet, exportData);

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
