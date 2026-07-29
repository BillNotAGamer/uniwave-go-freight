import { describe, expect, it } from "vitest";

import { createTaxRuleInputSchema } from "./validators";

const validRuleInput = {
  code: " selling vat 10 ",
  name: "Selling VAT 10",
  description: " Standard selling VAT ",
  shippingMode: "sea_export",
  chargeSection: "selling",
  chargeNamePattern: "*",
  taxTreatment: "taxable",
  vatPercent: "10",
};

describe("tax rule validators", () => {
  it("normalizes codes, optional text, and VAT percentages", () => {
    expect(createTaxRuleInputSchema.parse(validRuleInput)).toMatchObject({
      code: "SELLING-VAT-10",
      description: "Standard selling VAT",
      vatPercent: "10.00",
    });
  });

  it("rejects non-zero VAT percent for zero-rated and non-taxable rules", () => {
    expect(createTaxRuleInputSchema.safeParse({
      ...validRuleInput,
      taxTreatment: "zero_rated",
      vatPercent: "10.00",
    }).success).toBe(false);

    expect(createTaxRuleInputSchema.parse({
      ...validRuleInput,
      code: "NON TAX",
      taxTreatment: "non_taxable",
      vatPercent: "0",
    }).vatPercent).toBe("0.00");
  });

  it("rejects date windows where effectiveTo is before effectiveFrom", () => {
    expect(createTaxRuleInputSchema.safeParse({
      ...validRuleInput,
      effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
      effectiveTo: new Date("2026-01-01T00:00:00.000Z"),
    }).success).toBe(false);
  });
});
