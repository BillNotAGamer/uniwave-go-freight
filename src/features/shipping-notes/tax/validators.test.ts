import { describe, expect, it } from "vitest";

import {
  manualChargeTaxDecisionInputSchema,
  overrideChargeVatPercentInputSchema,
} from "./validators";

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

describe("manual Accounting tax decision validation", () => {
  const base = {
    chargeId: "charge-1",
    reason: "Accounting reviewed the supporting documents.",
    expectedFinancialRevision: "a".repeat(64),
  };

  it.each(["0", "8", "10"])("accepts taxable VAT %s", (vatPercent) => {
    const parsed = manualChargeTaxDecisionInputSchema.parse({
      ...base,
      taxTreatment: "taxable",
      vatPercent,
    });
    expect(parsed.vatPercent).toBe(`${vatPercent}.00`);
    expect(parsed.inputVatInvoiceStatus).toBeNull();
  });

  it.each(["zero_rated", "non_taxable"] as const)(
    "keeps %s distinct while requiring zero VAT",
    (taxTreatment) => {
      expect(manualChargeTaxDecisionInputSchema.parse({
        ...base,
        taxTreatment,
        vatPercent: "0",
      }).taxTreatment).toBe(taxTreatment);
      expect(() => manualChargeTaxDecisionInputSchema.parse({
        ...base,
        taxTreatment,
        vatPercent: "8",
      })).toThrow(/requires a 0.00 VAT percentage/);
    },
  );

  it("requires a reason and an authoritative revision", () => {
    expect(() => manualChargeTaxDecisionInputSchema.parse({
      ...base,
      reason: " ",
      taxTreatment: "taxable",
      vatPercent: "8",
    })).toThrow();
    expect(() => manualChargeTaxDecisionInputSchema.parse({
      ...base,
      expectedFinancialRevision: "stale",
      taxTreatment: "taxable",
      vatPercent: "8",
    })).toThrow();
  });
});
