import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { describe, expect, it, vi } from "vitest";

import { buildInternalExportSections } from "../read-model";
import type { InternalExportChargeSourceRow } from "../read-model";
import type { InternalShippingNoteExportDto } from "../types";
import {
  INTERNAL_PDF_LAYOUT_VERSION,
  INTERNAL_PDF_METADATA_VERSION,
  INTERNAL_PDF_MIME_TYPE,
} from "../constants";
import { generateInternalShippingNotePdf } from "./generator";

vi.mock("server-only", () => ({}));

function row(
  overrides: Partial<InternalExportChargeSourceRow> = {},
): InternalExportChargeSourceRow {
  return {
    section: "selling",
    chargeName: "Cước vận chuyển taxable",
    description: "Dịch vụ logistics nội bộ",
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

function buildExportData(status: "checked" | "approved" | "locked" = "locked"): InternalShippingNoteExportDto {
  const chargeRows: InternalExportChargeSourceRow[] = [
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
      chargeName: "Vendor taxable cost",
      description: "Stored buying VAT snapshot",
      amountOriginal: "25000.0000",
      amountVnd: "25000.00",
      vendorOrAgentText: "Công ty Đại Lý",
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
      overrideReason: "Điều chỉnh VAT theo hợp đồng nội bộ",
    }),
  ];

  for (let index = 0; index < 28; index += 1) {
    chargeRows.push(row({
      chargeName: `Selling long line ${index + 1}`,
      description: "Long description that must wrap without truncation in the generated PDF document.",
      amountOriginal: "1000.0000",
      amountVnd: "1000.00",
      vatAmount: "100.00",
    }));
    chargeRows.push(row({
      section: "buying",
      chargeName: `Buying long line ${index + 1}`,
      description: "Long buying description that must remain visible on later pages.",
      amountOriginal: "500.0000",
      amountVnd: "500.00",
      vendorOrAgentText: "Late page vendor",
      vatAmount: "50.00",
    }));
  }

  const sections = buildInternalExportSections(chargeRows);

  return {
    note: {
      id: "note-1",
      jobsheetNo: "PDF-VN-001",
      mawbNo: "MAWB-123",
      hawbNo: "HAWB-456",
      mawbHawbNo: null,
      shippingMode: "air_export",
      shipperText: "Công ty Gửi Hàng",
      consigneeText: "Người nhận hàng",
      customerText: "Khách hàng Việt Nam",
      agentText: "Đại lý vận chuyển",
      commodityHsCode: "Electronics / 8517",
      aol: "SGN",
      aod: "HAN",
      finalDestination: "Hà Nội",
      etd: new Date("2026-08-21T00:00:00.000Z"),
      eta: new Date("2026-08-22T00:00:00.000Z"),
      volumeValue: "1.000",
      volumeUnit: "cbm",
      exchangeRate: "1.000000",
      status,
    },
    ...sections,
  };
}

function buildOceanExportData(): InternalShippingNoteExportDto {
  const exportData = buildExportData();

  return {
    ...exportData,
    note: {
      ...exportData.note,
      jobsheetNo: "UNI2609001-SE",
      mawbNo: null,
      hawbNo: null,
      mawbHawbNo: null,
      shippingMode: "sea_export",
      mblNo: "276301562",
      hblNo: "SLT-2609001",
      portOfLoading: "HCM",
      portOfDischarge: "MIAMI",
      finalDestination: "MIAMI",
      vesselName: "MAERSK PORT KLANG",
      voyageNo: "638N",
      aol: null,
      aod: null,
    },
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("internal PDF generator", () => {
  it("generates a real PDF binary with internal-pdf-v1 metadata", async () => {
    expect(INTERNAL_PDF_METADATA_VERSION).toBe(1);
    expect(INTERNAL_PDF_LAYOUT_VERSION).toBe("internal-pdf-v1");
    expect(INTERNAL_PDF_MIME_TYPE).toBe("application/pdf");

    const generatedAt = new Date("2026-08-21T12:00:00.000Z");
    const generated = await generateInternalShippingNotePdf(
      buildExportData(),
      generatedAt,
    );

    expect(generated.fileName).toBe("ShippingNote_PDF-VN-001_20260821-120000.pdf");
    expect(generated.layoutVersion).toBe("internal-pdf-v1");
    expect(generated.buffer.length).toBeGreaterThan(10_000);
    expect(generated.buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(generated.checksumSha256).toMatch(/^[A-F0-9]{64}$/);
  });

  it("extracts required accounting, tax, override, and Vietnamese Unicode content", async () => {
    const generated = await generateInternalShippingNotePdf(
      buildExportData(),
      new Date("2026-08-21T12:00:00.000Z"),
    );
    const parsed = await pdfParse(generated.buffer);
    const text = normalizeText(parsed.text);

    expect(text).toContain("PDF-VN-001");
    expect(text).toContain("MAWB-123 / HAWB-456");
    expect(text).toContain("locked");
    expect(text).toContain("Cước vận chuyển taxable");
    expect(text).toContain("Vendor taxable cost");
    expect(text).toContain("Taxable");
    expect(text).toContain("10.00");
    expect(text).toContain("10,000.00 VND");
    expect(text).toContain("Điều chỉnh VAT theo hợp đồng nội bộ");
    expect(text).toContain("Selling VAT");
    expect(text).toContain("Buying VAT");
    expect(text).toContain("Gross profit excl. VAT");
    expect(text).toContain("Khách hàng Việt Nam");
    expect(text).toContain("COMMODITY");
    expect(text).toContain("HS CODE");
    expect(text).toContain("Electronics / 8517");
    expect(text).not.toContain("COMMODITY / HS CODE");
  });

  it("supports multi-page charge output without fixed XLSX row capacity", async () => {
    const generated = await generateInternalShippingNotePdf(
      buildExportData(),
      new Date("2026-08-21T12:00:00.000Z"),
    );
    const parsed = await pdfParse(generated.buffer);
    const text = normalizeText(parsed.text);

    expect(parsed.numpages).toBeGreaterThan(1);
    expect(text).toContain("Selling long line 28");
    expect(text).toContain("Buying long line 28");
    expect(text).toContain("INTERNAL FINANCIAL SUMMARY");
  });

  it("uses Ocean bills, routing, and transport labels instead of Air labels", async () => {
    const generated = await generateInternalShippingNotePdf(
      buildOceanExportData(),
      new Date("2026-09-01T12:00:00.000Z"),
    );
    const parsed = await pdfParse(generated.buffer);
    const text = normalizeText(parsed.text);

    expect(text).toContain("MBL / HBL");
    expect(text).toContain("276301562 / SLT-2609001");
    expect(text).toContain("POL");
    expect(text).toContain("HCM");
    expect(text).toContain("POD");
    expect(text).toContain("MIAMI");
    expect(text).toContain("FINAL DESTINATION");
    expect(text).toContain("VESSEL");
    expect(text).toContain("MAERSK PORT KLANG");
    expect(text).toContain("VOYAGE");
    expect(text).toContain("638N");
    expect(text).not.toContain("MAWB / HAWB");
  });

  it("exports separate Commodity and HS Code in PDF and preserves leading zeros", async () => {
    const exportData = buildExportData();
    exportData.note.commodity = "Frozen Seafood";
    exportData.note.hsCode = "01012100";
    exportData.note.commodityHsCode = null;

    const generated = await generateInternalShippingNotePdf(
      exportData,
      new Date("2026-08-21T12:00:00.000Z"),
    );
    const parsed = await pdfParse(generated.buffer);
    const text = normalizeText(parsed.text);

    expect(text).toContain("COMMODITY");
    expect(text).toContain("Frozen Seafood");
    expect(text).toContain("HS CODE");
    expect(text).toContain("01012100");
  });

  it("renders Sea transport documents, cargo weight, and enforces mode isolation in PDF", async () => {
    const oceanData = buildOceanExportData();
    oceanData.note.containerNo = "MSCU1234567";
    oceanData.note.sealNo = "SL987654";
    oceanData.note.carrierName = "Maersk";
    oceanData.note.grossWeight = "18,500 KGS";
    // Extraneous fields that must NOT leak into Sea PDF
    oceanData.note.chargeableWeight = "15000 KGS";
    oceanData.note.licensePlate = "51C-999.99";
    oceanData.note.driverInformation = "Le Van C";
    oceanData.note.vehiclePayloadCapacity = "10 TONS";

    const generated = await generateInternalShippingNotePdf(
      oceanData,
      new Date("2026-09-01T12:00:00.000Z"),
    );
    const parsed = await pdfParse(generated.buffer);
    const text = normalizeText(parsed.text);

    expect(text).toContain("CONTAINER NO.");
    expect(text).toContain("MSCU1234567");
    expect(text).toContain("SEAL NO.");
    expect(text).toContain("SL987654");
    expect(text).toContain("CARRIER NAME");
    expect(text).toContain("Maersk");
    expect(text).toContain("GROSS WEIGHT");
    expect(text).toContain("18,500 KGS");

    // Mode isolation
    expect(text).not.toContain("CHARGEABLE WEIGHT");
    expect(text).not.toContain("LICENSE PLATE");
    expect(text).not.toContain("DRIVER INFORMATION");
    expect(text).not.toContain("VEHICLE PAYLOAD CAPACITY");
  });

  it("renders Air weights and enforces mode isolation in PDF", async () => {
    const airData = buildExportData();
    airData.note.shippingMode = "air_export";
    airData.note.chargeableWeight = "200 KGS";
    airData.note.grossWeight = "180 KGS";
    // Extraneous fields that must NOT leak into Air PDF
    airData.note.containerNo = "MSCU1234567";
    airData.note.sealNo = "SL987654";
    airData.note.carrierName = "Maersk";
    airData.note.licensePlate = "51C-123.45";

    const generated = await generateInternalShippingNotePdf(
      airData,
      new Date("2026-08-21T12:00:00.000Z"),
    );
    const parsed = await pdfParse(generated.buffer);
    const text = normalizeText(parsed.text);

    expect(text).toContain("CHARGEABLE WEIGHT");
    expect(text).toContain("200 KGS");
    expect(text).toContain("GROSS WEIGHT");
    expect(text).toContain("180 KGS");

    // Mode isolation
    expect(text).not.toContain("CONTAINER NO.");
    expect(text).not.toContain("SEAL NO.");
    expect(text).not.toContain("CARRIER NAME");
    expect(text).not.toContain("LICENSE PLATE");
    expect(text).not.toContain("DRIVER INFORMATION");
    expect(text).not.toContain("VEHICLE PAYLOAD CAPACITY");
  });

  it("renders Domestic vehicle, multiline driver info, and enforces mode isolation in PDF", async () => {
    const domesticData = buildExportData();
    const driverInfo = "Nguyen Van A\nCCCD: 012345678901\nDOB: 1990-01-01";
    domesticData.note.shippingMode = "domestic_truck";
    domesticData.note.domesticOrigin = "Kho Song Than";
    domesticData.note.domesticDestination = "Kho Tan Binh";
    domesticData.note.licensePlate = "51C-123.45";
    domesticData.note.vehiclePayloadCapacity = "5 TONS";
    domesticData.note.driverInformation = driverInfo;
    // Extraneous Sea/Air fields
    domesticData.note.mblNo = "276301562";
    domesticData.note.hblNo = "SLT-2609001";
    domesticData.note.containerNo = "MSCU1234567";
    domesticData.note.sealNo = "SL987654";
    domesticData.note.chargeableWeight = "200 KGS";

    const generated = await generateInternalShippingNotePdf(
      domesticData,
      new Date("2026-08-21T12:00:00.000Z"),
    );
    const parsed = await pdfParse(generated.buffer);
    const text = normalizeText(parsed.text);

    expect(text).toContain("FROM");
    expect(text).toContain("Kho Song Than");
    expect(text).toContain("TO");
    expect(text).toContain("Kho Tan Binh");
    expect(text).toContain("LICENSE PLATE");
    expect(text).toContain("51C-123.45");
    expect(text).toContain("VEHICLE PAYLOAD CAPACITY");
    expect(text).toContain("5 TONS");
    expect(text).toContain("DRIVER INFORMATION");
    expect(text).toContain("Nguyen Van A CCCD: 012345678901 DOB: 1990-01-01");

    // Mode isolation
    expect(text).not.toContain("MBL / HBL");
    expect(text).not.toContain("MAWB / HAWB");
    expect(text).not.toContain("CONTAINER NO.");
    expect(text).not.toContain("SEAL NO.");
    expect(text).not.toContain("CHARGEABLE WEIGHT");
  });
});
