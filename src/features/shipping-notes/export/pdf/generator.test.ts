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
      mawbHawbNo: "MAWB-1",
      shippingMode: "sea_export",
      shipperText: "Công ty Gửi Hàng",
      consigneeText: "Người nhận hàng",
      customerText: "Khách hàng Việt Nam",
      agentText: "Đại lý vận chuyển",
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
});
