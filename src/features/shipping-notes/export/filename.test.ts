import { describe, expect, it } from "vitest";

import {
  buildInternalXlsxFileName,
  formatUtcTimestamp,
  sanitizeFilenamePart,
} from "./filename";
import type { InternalShippingNoteExportDto } from "./types";

function exportDto(jobsheetNo: string): InternalShippingNoteExportDto {
  return {
    note: {
      id: "note-1",
      jobsheetNo,
      mawbHawbNo: null,
      shippingMode: "sea_export",
      shipperText: null,
      consigneeText: null,
      customerText: null,
      agentText: null,
      aol: null,
      aod: null,
      finalDestination: null,
      etd: null,
      eta: null,
      volumeValue: null,
      volumeUnit: null,
      exchangeRate: "1",
      status: "checked",
    },
    sellingCharges: [],
    buyingCharges: [],
    summary: {
      sellingChargeCount: 0,
      buyingChargeCount: 0,
      totalSellingVnd: "0.00",
      totalBuyingVnd: "0.00",
      grossProfitVnd: "0.00",
      sellingTotalsByCurrency: [],
      buyingTotalsByCurrency: [],
    },
  };
}

describe("internal XLSX export filenames", () => {
  it("formats timestamps in UTC", () => {
    expect(formatUtcTimestamp(new Date(Date.UTC(2026, 6, 29, 5, 6, 7)))).toBe(
      "20260729-050607",
    );
  });

  it("sanitizes unsafe filename parts", () => {
    expect(sanitizeFilenamePart(" ABC  001/SEA:?* ")).toBe("ABC_001_SEA");
    expect(sanitizeFilenamePart("...")).toBe("shipping-note");
    expect(sanitizeFilenamePart("x".repeat(80))).toHaveLength(72);
  });

  it("builds deterministic internal XLSX filenames", () => {
    const generatedAt = new Date(Date.UTC(2026, 6, 29, 5, 6, 7));

    expect(buildInternalXlsxFileName(
      exportDto(" ABC  001/SEA "),
      generatedAt,
    )).toBe("ShippingNote_ABC_001_SEA_20260729-050607.xlsx");
  });

  it("falls back when the jobsheet number has no usable filename characters", () => {
    const generatedAt = new Date(Date.UTC(2026, 6, 29, 5, 6, 7));

    expect(buildInternalXlsxFileName(exportDto("///***"), generatedAt)).toBe(
      "ShippingNote_shipping-note_20260729-050607.xlsx",
    );
  });
});
