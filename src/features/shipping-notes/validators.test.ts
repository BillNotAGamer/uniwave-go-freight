import { describe, expect, it } from "vitest";

import {
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  markShippingNoteCheckedInputSchema,
  shippingNoteDraftInputSchema,
  startAccountingReviewInputSchema,
  submitShippingNoteInputSchema,
  updateShippingNoteDraftInputSchema,
} from "./validators";

const baseSellingChargeInput = {
  shippingNoteId: "note-1",
  chargeName: "Freight",
  quantity: "1.000",
  unit: "shipment",
  unitPrice: "10.0000",
  currency: "VND",
} as const;

describe("shipping note validation schemas", () => {
  it("normalizes draft jobsheet numbers and trims provided optional text", () => {
    const parsed = shippingNoteDraftInputSchema.parse({
      jobsheetNo: " js   001 ",
      shippingMode: "sea_export",
      mawbHawbNo: "  MAWB-1  ",
      volumeValue: "12.5",
      volumeUnit: "cbm",
      exchangeRate: "25000",
      unexpected: "stripped",
    });

    expect(parsed.jobsheetNo).toBe("JS 001");
    expect(parsed.mawbHawbNo).toBe("MAWB-1");
    expect(parsed.shipperText).toBeUndefined();
    expect(parsed.volumeValue).toBe(12.5);
    expect(parsed.exchangeRate).toBe(25000);
    expect("unexpected" in parsed).toBe(false);
  });

  it("rejects explicit blank optional text at the pure schema boundary", () => {
    expect(() => shippingNoteDraftInputSchema.parse({
      jobsheetNo: "JS-1",
      shippingMode: "sea_export",
      shipperText: "   ",
    })).toThrow();
  });

  it("rejects invalid draft enums and non-positive numbers", () => {
    expect(() => shippingNoteDraftInputSchema.parse({
      jobsheetNo: "JS-1",
      shippingMode: "rail",
    })).toThrow();
    expect(() => shippingNoteDraftInputSchema.parse({
      jobsheetNo: "JS-1",
      shippingMode: "sea_export",
      volumeUnit: "pallet",
    })).toThrow();
    expect(() => shippingNoteDraftInputSchema.parse({
      jobsheetNo: "JS-1",
      shippingMode: "sea_export",
      exchangeRate: 0,
    })).toThrow();
  });

  it("requires non-blank identifiers for update and transition actions", () => {
    expect(() => updateShippingNoteDraftInputSchema.parse({
      id: " ",
      jobsheetNo: "JS-1",
      shippingMode: "sea_export",
    })).toThrow();
    expect(() => submitShippingNoteInputSchema.parse({ id: " " })).toThrow();
    expect(() => startAccountingReviewInputSchema.parse({ id: "" })).toThrow();
    expect(() => markShippingNoteCheckedInputSchema.parse({ id: "" })).toThrow();
  });

  it("requires USD exchange rate and allows VND without one", () => {
    const vndCharge = createSellingChargeInputSchema.parse(baseSellingChargeInput);

    expect(vndCharge.currency).toBe("VND");
    expect(vndCharge).not.toHaveProperty("exchangeRate");
    expect(() => createSellingChargeInputSchema.parse({
      ...baseSellingChargeInput,
      currency: "USD",
    })).toThrow(/Exchange rate is required/);
    expect(createSellingChargeInputSchema.parse({
      ...baseSellingChargeInput,
      currency: "USD",
      exchangeRate: "25000.000000",
    })).toMatchObject({
      currency: "USD",
      exchangeRate: "25000.000000",
    });
  });

  it("validates charge decimal precision and minimums", () => {
    expect(() => createSellingChargeInputSchema.parse({
      ...baseSellingChargeInput,
      quantity: "0.000",
    })).toThrow(/must be positive/);
    expect(createSellingChargeInputSchema.parse({
      ...baseSellingChargeInput,
      unitPrice: "0",
    }).unitPrice).toBe("0");
    expect(() => createSellingChargeInputSchema.parse({
      ...baseSellingChargeInput,
      unitPrice: "1.00001",
    })).toThrow(/Expected at most 4 decimal places/);
  });

  it("rejects unsupported currency and overlong buying vendor text", () => {
    expect(() => createSellingChargeInputSchema.parse({
      ...baseSellingChargeInput,
      currency: "EUR",
    })).toThrow();
    expect(() => createBuyingChargeInputSchema.parse({
      ...baseSellingChargeInput,
      vendorOrAgentText: "x".repeat(201),
    })).toThrow();
  });
});
