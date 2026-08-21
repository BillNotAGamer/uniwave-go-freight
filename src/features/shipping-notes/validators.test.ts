import { describe, expect, it } from "vitest";

import {
  cancelFinalizedShippingNoteInputSchema,
  cancelShippingNoteInputSchema,
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  approveShippingNoteInputSchema,
  markShippingNoteCheckedInputSchema,
  lockShippingNoteInputSchema,
  reopenShippingNoteForCorrectionInputSchema,
  shippingNoteDraftInputSchema,
  startAccountingReviewInputSchema,
  submitShippingNoteInputSchema,
  unlockShippingNoteInputSchema,
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
    expect(() => approveShippingNoteInputSchema.parse({ id: "" })).toThrow();
    expect(() => lockShippingNoteInputSchema.parse({ id: "" })).toThrow();
    expect(() => unlockShippingNoteInputSchema.parse({
      id: "",
      unlockReason: "Correction required",
    })).toThrow();
  });

  it("normalizes lock and unlock workflow reasons", () => {
    expect(lockShippingNoteInputSchema.parse({ id: "note-1" })).toStrictEqual({
      id: "note-1",
    });
    expect(lockShippingNoteInputSchema.parse({
      id: "note-1",
      lockReason: "  Period finalized  ",
    })).toStrictEqual({
      id: "note-1",
      lockReason: "Period finalized",
    });
    expect(lockShippingNoteInputSchema.parse({
      id: "note-1",
      lockReason: "   ",
    })).toStrictEqual({
      id: "note-1",
      lockReason: undefined,
    });
    expect(unlockShippingNoteInputSchema.parse({
      id: "note-1",
      unlockReason: "  Fix customer name  ",
    })).toStrictEqual({
      id: "note-1",
      unlockReason: "Fix customer name",
    });
    expect(() => unlockShippingNoteInputSchema.parse({
      id: "note-1",
      unlockReason: "   ",
    })).toThrow(/Unlock reason is required/);
  });

  it("validates normal cancellation input and optional reason normalization", () => {
    expect(cancelShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "draft",
    })).toStrictEqual({
      id: "note-1",
      expectedStatus: "draft",
    });
    expect(cancelShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "submitted",
      cancelReason: "  Customer withdrew shipment  ",
    })).toStrictEqual({
      id: "note-1",
      expectedStatus: "submitted",
      cancelReason: "Customer withdrew shipment",
    });
    expect(cancelShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "accounting_reviewing",
      cancelReason: "   ",
    })).toStrictEqual({
      id: "note-1",
      expectedStatus: "accounting_reviewing",
      cancelReason: undefined,
    });
    expect(() => cancelShippingNoteInputSchema.parse({
      id: "",
      expectedStatus: "draft",
    })).toThrow();
    expect(() => cancelShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "checked",
    })).toThrow();
  });

  it("requires a non-blank finalized cancellation reason", () => {
    expect(cancelFinalizedShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "checked",
      cancelReason: "  Duplicate accounting record  ",
    })).toStrictEqual({
      id: "note-1",
      expectedStatus: "checked",
      cancelReason: "Duplicate accounting record",
    });
    expect(() => cancelFinalizedShippingNoteInputSchema.parse({
      id: "",
      expectedStatus: "checked",
      cancelReason: "Duplicate accounting record",
    })).toThrow();
    expect(() => cancelFinalizedShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "checked",
      cancelReason: "",
    })).toThrow(/Cancellation reason is required/);
    expect(() => cancelFinalizedShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "approved",
      cancelReason: "   ",
    })).toThrow(/Cancellation reason is required/);
    expect(() => cancelFinalizedShippingNoteInputSchema.parse({
      id: "note-1",
      expectedStatus: "locked",
      cancelReason: "Locked is not a direct source",
    })).toThrow();
  });

  it("requires a valid source and non-blank reason for correction reopen", () => {
    expect(reopenShippingNoteForCorrectionInputSchema.parse({
      id: "note-1",
      expectedStatus: "checked",
      reason: "  Vendor invoice correction  ",
    })).toStrictEqual({
      id: "note-1",
      expectedStatus: "checked",
      reason: "Vendor invoice correction",
    });
    expect(reopenShippingNoteForCorrectionInputSchema.parse({
      id: "note-1",
      expectedStatus: "approved",
      reason: "Tax correction",
    })).toStrictEqual({
      id: "note-1",
      expectedStatus: "approved",
      reason: "Tax correction",
    });
    expect(() => reopenShippingNoteForCorrectionInputSchema.parse({
      id: "",
      expectedStatus: "checked",
      reason: "Vendor invoice correction",
    })).toThrow();
    expect(() => reopenShippingNoteForCorrectionInputSchema.parse({
      id: "note-1",
      expectedStatus: "checked",
      reason: "",
    })).toThrow(/Correction reason is required/);
    expect(() => reopenShippingNoteForCorrectionInputSchema.parse({
      id: "note-1",
      expectedStatus: "approved",
      reason: "   ",
    })).toThrow(/Correction reason is required/);

    for (const expectedStatus of [
      "draft",
      "submitted",
      "accounting_reviewing",
      "locked",
      "cancelled",
      "exported",
    ]) {
      expect(() => reopenShippingNoteForCorrectionInputSchema.parse({
        id: "note-1",
        expectedStatus,
        reason: "Invalid source",
      })).toThrow();
    }
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
