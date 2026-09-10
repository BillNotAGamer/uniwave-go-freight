import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

import { buildInternalExportSections } from "./read-model";
import type { InternalExportChargeSourceRow } from "./read-model";
import {
  INTERNAL_XLSX_TAX_DETAILS_WORKSHEET_NAME,
  INTERNAL_XLSX_TEMPLATE_RELATIVE_PATH,
  INTERNAL_XLSX_TEMPLATE_SHA256,
  INTERNAL_XLSX_TEMPLATE_VERSION,
} from "./constants";
import type { InternalShippingNoteExportDto } from "./types";

vi.mock("server-only", () => ({}));

function row(
  overrides: Partial<InternalExportChargeSourceRow> = {},
): InternalExportChargeSourceRow {
  return {
    section: "selling",
    chargeName: "Taxable freight",
    description: "Stored taxable snapshot",
    quantity: "1.000",
    unit: "shipment",
    unitPrice: "100000.0000",
    currency: "VND",
    exchangeRate: "1.000000",
    amountOriginal: "100000.0000",
    amountVnd: "100000.00",
    vendorOrAgentText: null,
    taxRuleCodeSnapshot: "VAT10",
    taxRuleNameSnapshot: "Stored Taxable 10",
    taxTreatmentSnapshot: "taxable",
    vatPercent: "10.00",
    vatAmount: "10000.00",
    isOverride: false,
    overrideReason: null,
    ...overrides,
  };
}

function buildExportData(): InternalShippingNoteExportDto {
  const sections = buildInternalExportSections([
    row(),
    row({
      chargeName: "Zero rated handling",
      description: "Stored zero rated snapshot",
      amountOriginal: "200000.0000",
      amountVnd: "200000.00",
      taxRuleCodeSnapshot: "ZR",
      taxRuleNameSnapshot: "Stored Zero Rated",
      taxTreatmentSnapshot: "zero_rated",
      vatPercent: "0.00",
      vatAmount: "0.00",
    }),
    row({
      section: "buying",
      chargeName: "Taxable vendor",
      description: "Stored buying VAT snapshot",
      amountOriginal: "25000.0000",
      amountVnd: "25000.00",
      vendorOrAgentText: "Vendor B",
      vatAmount: "2500.00",
    }),
    row({
      section: "buying",
      chargeName: "Non-taxable vendor",
      description: "Stored non-taxable snapshot",
      amountOriginal: "40000.0000",
      amountVnd: "40000.00",
      vendorOrAgentText: "Vendor A",
      taxRuleCodeSnapshot: "NT",
      taxRuleNameSnapshot: "Stored Non-taxable",
      taxTreatmentSnapshot: "non_taxable",
      vatPercent: "0.00",
      vatAmount: "0.00",
      isOverride: true,
      overrideReason: "Stored override reason",
    }),
  ]);

  return {
    note: {
      id: "note-1",
      jobsheetNo: "ABC/001 SEA",
      mawbHawbNo: "MAWB-1",
      shippingMode: "sea_export",
      shipperText: "Shipper",
      consigneeText: "Consignee",
      customerText: "Customer",
      agentText: "Agent",
      aol: "SGN",
      aod: "HAN",
      finalDestination: "HAN",
      etd: new Date("2026-08-09T00:00:00.000Z"),
      eta: null,
      volumeValue: "1.000",
      volumeUnit: "cbm",
      exchangeRate: "1.000000",
      status: "checked",
    },
    ...sections,
  };
}

describe("internal XLSX generator tax-complete v2", () => {
  it("keeps the pinned v2 template hash", async () => {
    const templateBuffer = await readFile(INTERNAL_XLSX_TEMPLATE_RELATIVE_PATH);
    const actualHash = createHash("sha256")
      .update(templateBuffer)
      .digest("hex")
      .toUpperCase();

    expect(INTERNAL_XLSX_TEMPLATE_VERSION).toBe("internal-v2");
    expect(actualHash).toBe(INTERNAL_XLSX_TEMPLATE_SHA256);
  });

  it("writes exact stored tax snapshot values into the Tax Details worksheet", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const generated = await generateInternalShippingNoteXlsx(
      buildExportData(),
      new Date("2026-08-09T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet(INTERNAL_XLSX_TAX_DETAILS_WORKSHEET_NAME);

    expect(worksheet).toBeDefined();
    expect(generated.templateVersion).toBe("internal-v2");
    expect(worksheet?.getCell("E4").value).toBe(100000);
    expect(worksheet?.getCell("F4").value).toBe(10);
    expect(worksheet?.getCell("G4").value).toBe(10000);
    expect(worksheet?.getCell("H4").value).toBe(110000);
    expect(worksheet?.getCell("C4").value).toBe("VAT10 - Stored Taxable 10");
    expect(worksheet?.getCell("D4").value).toBe("Taxable");
    expect(worksheet?.getCell("D5").value).toBe("Zero-rated");
    expect(worksheet?.getCell("G15").value).toBe(2500);
    expect(worksheet?.getCell("D16").value).toBe("Non-taxable");
    expect(worksheet?.getCell("I16").value).toBe("Override");
    expect(worksheet?.getCell("J16").value).toBe("Stored override reason");
    expect(worksheet?.getCell("B29").value).toBe(10000);
    expect(worksheet?.getCell("B32").value).toBe(2500);
    expect(worksheet?.getCell("B30").value).toBe(310000);
    expect(worksheet?.getCell("B33").value).toBe(67500);
    expect(worksheet?.getCell("B34").value).toBe(235000);
  });
});
