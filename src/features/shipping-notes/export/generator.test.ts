import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

import { buildInternalExportSections } from "./read-model";
import type { InternalExportChargeSourceRow } from "./read-model";
import {
  INTERNAL_XLSX_HEADER_CELLS,
  INTERNAL_XLSX_PROFIT_CELL,
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
      mawbNo: null,
      hawbNo: null,
      mawbHawbNo: null,
      shippingMode: "sea_export",
      shipperText: "Shipper",
      consigneeText: "Consignee",
      customerText: "Customer",
      agentText: "Agent",
      aol: null,
      aod: null,
      portOfLoading: "HCM",
      portOfDischarge: "MIAMI",
      finalDestination: "MIAMI",
      mblNo: "276301562",
      hblNo: "SLT-2609001",
      vesselName: "MAERSK PORT KLANG",
      voyageNo: "638N",
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

function buildAirGoldenExportData(): InternalShippingNoteExportDto {
  const sections = buildInternalExportSections([
    row({
      chargeName: "Air freight",
      currency: "USD",
      unitPrice: "1700.0000",
      exchangeRate: "26120.000000",
      amountOriginal: "1700.0000",
      amountVnd: "44404000.00",
      vatPercent: "0.00",
      vatAmount: "0.00",
    }),
  ]);

  return {
    note: {
      id: "air-golden-1",
      jobsheetNo: "UNI2609001-AE",
      mawbNo: "45964854462",
      hawbNo: "NIL",
      mawbHawbNo: null,
      shippingMode: "air_export",
      shipperText: "Air Shipper",
      consigneeText: "Air Consignee",
      customerText: "Air Customer",
      agentText: "DISCOVERY PLANET COMPANY LIMITED",
      commodityHsCode: "Electronics / 8517",
      aol: "SGN",
      aod: "LAX",
      finalDestination: "LOS ANGELES",
      flightNo: "VN300",
      etd: new Date("2026-09-01T00:00:00.000Z"),
      eta: new Date("2026-09-03T00:00:00.000Z"),
      volumeValue: "1.000",
      volumeUnit: "cbm",
      exchangeRate: "26.120000",
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

  it("uses canonical Ocean labels and values in the fixed workbook header", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const generated = await generateInternalShippingNoteXlsx(
      buildExportData(),
      new Date("2026-08-09T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");

    expect(worksheet?.getCell("A7").value).toBe("MBL / HBL");
    expect(worksheet?.getCell("C7").value).toBe("276301562 / SLT-2609001");
    expect(worksheet?.getCell("A11").value).toBe("POL");
    expect(worksheet?.getCell("C11").value).toBe("HCM");
    expect(worksheet?.getCell("A12").value).toBe("POD / FINAL DEST.");
    expect(worksheet?.getCell("C12").value).toBe("MIAMI");
    expect(worksheet?.getCell("A7").value).not.toBe("MAWB / HAWB");
  });

  it("writes the canonical Air header, VND amounts, blank no-override cells, and no stale identities", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const generated = await generateInternalShippingNoteXlsx(
      buildAirGoldenExportData(),
      new Date("2026-09-01T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");
    const taxDetails = workbook.getWorksheet(INTERNAL_XLSX_TAX_DETAILS_WORKSHEET_NAME);

    expect(worksheet?.getCell(INTERNAL_XLSX_HEADER_CELLS.jobsheetNo).value).toBe("UNI2609001-AE");
    expect(worksheet?.getCell("A7").value).toBe("MAWB / HAWB");
    expect(worksheet?.getCell("C7").value).toBe("45964854462 / NIL");
    expect(worksheet?.getCell("A11").value).toBe("AOL");
    expect(worksheet?.getCell("C11").value).toBe("SGN");
    expect(worksheet?.getCell("A12").value).toBe("AOD / FINAL DEST.");
    expect(worksheet?.getCell("C12").value).toBe("LAX / LOS ANGELES");
    expect((worksheet?.getCell("C14").value as Date).toISOString()).toBe(
      "2026-09-03T00:00:00.000Z",
    );
    expect(worksheet?.getCell("C16").value).toBe("DISCOVERY PLANET COMPANY LIMITED");
    expect(worksheet?.getCell("E15").value).toBe("26.120000");

    expect(worksheet?.getCell("D24").value).toBe(44404000);
    expect(worksheet?.getCell("D24").numFmt).toBe("#,##0.00");
    expect(worksheet?.getCell("E25").numFmt).toBe("#,##0.00");
    expect(worksheet?.getCell(INTERNAL_XLSX_PROFIT_CELL.valueCell).numFmt).toBe("#,##0.00");
    expect(worksheet?.getCell("D24").numFmt).not.toContain("$");
    expect(worksheet?.getCell("E24").value).not.toBe("Air Customer");
    expect(worksheet?.getCell(INTERNAL_XLSX_PROFIT_CELL.labelCell).value).toBe(
      "GROSS PROFIT (VND)",
    );

    expect(taxDetails?.getCell("I4").value).toBe("");
    expect(taxDetails?.getCell("J4").value).toBe("");
    expect(worksheet?.getCell("A46").value).toBeNull();
    expect(worksheet?.getCell("C46").value).toBeNull();
    expect(worksheet?.getCell("D46").value).toBeNull();
  });

  it("exports Commidity and HS Code separately in rows 8 and preserves leading zeros", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const exportData = buildExportData();

    // 1. New record with separate commodity and hsCode (with leading zero)
    exportData.note.commodity = "Frozen Seafood";
    exportData.note.hsCode = "01012100";
    exportData.note.commodityHsCode = null;

    const generated = await generateInternalShippingNoteXlsx(
      exportData,
      new Date("2026-08-09T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");

    expect(worksheet?.getCell("A8").value).toBe("COMMIDITY");
    expect(worksheet?.getCell("C8").value).toBe("Frozen Seafood");
    expect(worksheet?.getCell("D8").value).toBe("HS CODE");
    expect(worksheet?.getCell("E8").value).toBe("01012100");
  });

  it("falls back to commodityHsCode for legacy records and keeps HS Code blank in XLSX", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const exportData = buildExportData();
    exportData.note.commodity = null;
    exportData.note.hsCode = null;
    exportData.note.commodityHsCode = "Steel coils / HS 7210.49";

    const generated = await generateInternalShippingNoteXlsx(
      exportData,
      new Date("2026-08-09T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");

    expect(worksheet?.getCell("A8").value).toBe("COMMIDITY");
    expect(worksheet?.getCell("C8").value).toBe("Steel coils / HS 7210.49");
    expect(worksheet?.getCell("D8").value).toBe("HS CODE");
    expect(worksheet?.getCell("E8").value).toBe("");
  });

  it("exports Sea metadata and enforces mode isolation in XLSX", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const exportData = buildExportData();
    exportData.note.shippingMode = "sea_export";
    exportData.note.containerNo = "MSCU1234567";
    exportData.note.sealNo = "SL987654";
    exportData.note.carrierName = "Maersk";
    exportData.note.grossWeight = "18,500 KGS";
    // Irrelevant mode fields in DB that must NOT leak into Sea XLSX
    exportData.note.chargeableWeight = "15000 KGS";
    exportData.note.licensePlate = "51C-999.99";
    exportData.note.driverInformation = "Le Van C";
    exportData.note.vehiclePayloadCapacity = "10 TONS";

    const generated = await generateInternalShippingNoteXlsx(
      exportData,
      new Date("2026-08-09T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");

    // Sea fields present
    expect(worksheet?.getCell("D6").value).toBe("CONTAINER NO.");
    expect(worksheet?.getCell("E6").value).toBe("MSCU1234567");
    expect(worksheet?.getCell("D7").value).toBe("SEAL NO.");
    expect(worksheet?.getCell("E7").value).toBe("SL987654");
    expect(worksheet?.getCell("D14").value).toBe("GROSS WEIGHT");
    expect(worksheet?.getCell("E14").value).toBe("18,500 KGS");
    expect(worksheet?.getCell("D16").value).toBe("CARRIER");
    expect(worksheet?.getCell("E16").value).toBe("Maersk");

    // Mode isolation: Air/Domestic fields must not appear
    expect(worksheet?.getCell("D6").value).not.toBe("CHARGEABLE WT");
    expect(worksheet?.getCell("D6").value).not.toBe("LICENSE PLATE");
    expect(worksheet?.getCell("D16").value).not.toBe("DRIVER INFO");
    expect(worksheet?.getCell("E6").value).not.toBe("15000 KGS");
    expect(worksheet?.getCell("E6").value).not.toBe("51C-999.99");
    expect(worksheet?.getCell("E16").value).not.toBe("Le Van C");
  });

  it("exports Air metadata and enforces mode isolation in XLSX", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const exportData = buildAirGoldenExportData();
    exportData.note.chargeableWeight = "200 KGS";
    exportData.note.grossWeight = "180 KGS";
    // Extraneous DB fields that must NOT leak into Air XLSX
    exportData.note.containerNo = "MSCU1234567";
    exportData.note.sealNo = "SL987654";
    exportData.note.carrierName = "Maersk";
    exportData.note.licensePlate = "51C-123.45";

    const generated = await generateInternalShippingNoteXlsx(
      exportData,
      new Date("2026-09-01T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");

    // Air fields present
    expect(worksheet?.getCell("D6").value).toBe("CHARGEABLE WT");
    expect(worksheet?.getCell("E6").value).toBe("200 KGS");
    expect(worksheet?.getCell("D7").value).toBe("GROSS WEIGHT");
    expect(worksheet?.getCell("E7").value).toBe("180 KGS");

    // Mode isolation: Sea/Domestic fields must not appear
    expect(worksheet?.getCell("D6").value).not.toBe("CONTAINER NO.");
    expect(worksheet?.getCell("D6").value).not.toBe("LICENSE PLATE");
    expect(worksheet?.getCell("D7").value).not.toBe("SEAL NO.");
    expect(worksheet?.getCell("D16").value).not.toBe("CARRIER");
    expect(worksheet?.getCell("D16").value).not.toBe("DRIVER INFO");
  });

  it("exports Domestic metadata with multiline driver info and enforces mode isolation in XLSX", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const exportData = buildExportData();
    const driverInfo = "Nguyen Van A\nCCCD: 012345678901\nDOB: 1990-01-01";
    exportData.note.shippingMode = "domestic_truck";
    exportData.note.domesticOrigin = "Kho Song Than";
    exportData.note.domesticDestination = "Kho Tan Binh";
    exportData.note.licensePlate = "51C-123.45";
    exportData.note.vehiclePayloadCapacity = "5 TONS";
    exportData.note.driverInformation = driverInfo;
    // Extraneous Sea/Air fields that must NOT leak into Domestic XLSX
    exportData.note.mblNo = "276301562";
    exportData.note.hblNo = "SLT-2609001";
    exportData.note.containerNo = "MSCU1234567";
    exportData.note.sealNo = "SL987654";
    exportData.note.chargeableWeight = "200 KGS";

    const generated = await generateInternalShippingNoteXlsx(
      exportData,
      new Date("2026-08-09T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");

    // Domestic routing & metadata
    expect(worksheet?.getCell("A11").value).toBe("From");
    expect(worksheet?.getCell("C11").value).toBe("Kho Song Than");
    expect(worksheet?.getCell("A12").value).toBe("To");
    expect(worksheet?.getCell("C12").value).toBe("Kho Tan Binh");
    expect(worksheet?.getCell("D6").value).toBe("LICENSE PLATE");
    expect(worksheet?.getCell("E6").value).toBe("51C-123.45");
    expect(worksheet?.getCell("D7").value).toBe("PAYLOAD");
    expect(worksheet?.getCell("E7").value).toBe("5 TONS");
    expect(worksheet?.getCell("D16").value).toBe("DRIVER INFO");
    expect(worksheet?.getCell("E16").value).toBe(driverInfo);
    expect(worksheet?.getCell("E16").alignment?.wrapText).toBe(true);

    // Mode isolation: Sea/Air fields absent
    expect(worksheet?.getCell("A7").value).toBe("");
    expect(worksheet?.getCell("C7").value).toBe("");
    expect(worksheet?.getCell("D6").value).not.toBe("CONTAINER NO.");
    expect(worksheet?.getCell("D6").value).not.toBe("CHARGEABLE WT");
    expect(worksheet?.getCell("D7").value).not.toBe("SEAL NO.");
    expect(worksheet?.getCell("D16").value).not.toBe("CARRIER");
  });

  it("verifies financial formulas and VND formatting remain intact after header writing", async () => {
    const { generateInternalShippingNoteXlsx } = await import("./generator");
    const exportData = buildExportData();
    exportData.note.containerNo = "MSCU1234567";
    exportData.note.grossWeight = "18,500 KGS";

    const generated = await generateInternalShippingNoteXlsx(
      exportData,
      new Date("2026-08-09T12:00:00.000Z"),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(generated.buffer);
    const worksheet = workbook.getWorksheet("AK");

    // Check formulas
    expect(worksheet?.getCell("E25").value).toMatchObject({
      formula: "SUM(D17:D24)",
    });
    expect(worksheet?.getCell("E37").value).toMatchObject({
      formula: "SUM(D26:D36)",
    });
    expect(worksheet?.getCell("E38").value).toMatchObject({
      formula: "E25-E37",
    });

    // Check number formatting
    expect(worksheet?.getCell("E25").numFmt).toBe("#,##0.00");
    expect(worksheet?.getCell("E37").numFmt).toBe("#,##0.00");
    expect(worksheet?.getCell("E38").numFmt).toBe("#,##0.00");
  });
});
