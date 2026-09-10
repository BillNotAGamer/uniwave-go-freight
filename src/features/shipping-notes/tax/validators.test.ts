import { describe, expect, it } from "vitest";

import { overrideChargeVatPercentInputSchema } from "./validators";

describe("Accounting VAT override validation", () => {
  it.each([0, 5, 8, 10])("accepts %s percent with a required reason", (vatPercent) => {
    expect(overrideChargeVatPercentInputSchema.parse({
      chargeId: "charge-1",
      vatPercent: String(vatPercent),
      reason: "Approved adjustment",
    }).vatPercent).toBe(`${vatPercent}.00`);
  });

  it("ensures explicit zero '0' parses to 0.00 and does not become null", () => {
    const result = overrideChargeVatPercentInputSchema.parse({
      chargeId: "charge-1",
      vatPercent: "0",
      reason: "Tax exemption zero",
    });
    expect(result.vatPercent).toBe("0.00");
  });

  it.each(["none", "", null])("accepts %s as null override (no override)", (val) => {
    const result = overrideChargeVatPercentInputSchema.parse({
      chargeId: "charge-1",
      vatPercent: val,
    });
    expect(result.vatPercent).toBeNull();
  });

  it("requires reason when setting an override rate", () => {
    expect(() => overrideChargeVatPercentInputSchema.parse({
      chargeId: "charge-1",
      vatPercent: "5",
      reason: "   ",
    })).toThrow(/Reason is required/);
  });

  it.each([-1, 1, 7, 9, 11, 69])("rejects %s percent", (vatPercent) => {
    expect(() => overrideChargeVatPercentInputSchema.parse({
      chargeId: "charge-1",
      vatPercent: String(vatPercent),
      reason: "Invalid adjustment",
    })).toThrow();
  });
});
