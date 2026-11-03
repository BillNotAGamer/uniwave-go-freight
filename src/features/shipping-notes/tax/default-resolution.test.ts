import { describe, expect, it } from "vitest";

import type { DefaultTaxRuleCandidate } from "./default-resolution";
import { classifyChargeTaxDefault, resolveDefaultTaxRule } from "./default-resolution";

const now = new Date("2026-10-20T00:00:00.000Z");

function rule(overrides: Partial<DefaultTaxRuleCandidate> = {}): DefaultTaxRuleCandidate {
  return {
    id: "rule-1",
    code: "VAT8",
    name: "VAT 8%",
    shippingMode: "sea_export",
    chargeSection: "buying",
    chargeNamePattern: "*",
    taxTreatment: "taxable",
    vatPercent: "8.00",
    isActive: true,
    effectiveFrom: null,
    effectiveTo: null,
    ...overrides,
  };
}

describe("charge-type VAT default resolution", () => {
  it.each(["OF", "OF-20", "AIR-FREIGHT", "AF-EXPORT"])(
    "classifies stable freight code %s for zero rating",
    (catalogCode) => {
      expect(classifyChargeTaxDefault({ catalogCode, catalogVatRate: "8.00" }))
        .toBe("freight_zero");
    },
  );

  it("uses the catalog-configured 8% category for eligible non-freight charges", () => {
    expect(classifyChargeTaxDefault({ catalogCode: "TRK-DOM", catalogVatRate: "8.00" }))
      .toBe("standard_eight");
  });

  it.each([
    { catalogCode: "DOC", catalogVatRate: null },
    { catalogCode: "EXEMPT", catalogVatRate: "0.00" },
    { catalogCode: "VAT10", catalogVatRate: "10.00" },
    { catalogCode: null, catalogVatRate: "8.00" },
  ])("leaves noneligible or uncatalogued charges unclassified", (input) => {
    expect(classifyChargeTaxDefault(input)).toBeNull();
  });

  it("selects a unique effective zero-rated rule for Ocean Freight on a sea note", () => {
    const zero = rule({ code: "VAT0", taxTreatment: "zero_rated", vatPercent: "0.00" });
    expect(resolveDefaultTaxRule({
      catalogCode: "OF-20",
      catalogVatRate: "8.00",
      shippingMode: "sea_export",
      chargeSection: "buying",
      rules: [zero, rule()],
      at: now,
    })).toEqual(zero);
  });

  it("selects a unique effective 8% rule for trucking on a sea note", () => {
    const eight = rule({ chargeNamePattern: "TRK-*" });
    expect(resolveDefaultTaxRule({
      catalogCode: "TRK-DOM",
      catalogVatRate: "8.00",
      shippingMode: "sea_export",
      chargeSection: "buying",
      rules: [eight],
      at: now,
    })).toEqual(eight);
  });

  it("leaves the charge unclassified when matching rules are missing or ambiguous", () => {
    const input = {
      catalogCode: "TRK-DOM",
      catalogVatRate: "8.00",
      shippingMode: "sea_export" as const,
      chargeSection: "buying" as const,
      at: now,
    };
    expect(resolveDefaultTaxRule({ ...input, rules: [] })).toBeNull();
    expect(resolveDefaultTaxRule({ ...input, rules: [rule(), rule({ id: "rule-2" })] }))
      .toBeNull();
  });

  it("rejects expired, future, wrong-mode, and pattern-inapplicable rules", () => {
    const invalidRules = [
      rule({ effectiveTo: new Date("2026-10-19T23:59:59.000Z") }),
      rule({ effectiveFrom: new Date("2026-10-21T00:00:00.000Z") }),
      rule({ shippingMode: "air_export" }),
      rule({ chargeNamePattern: "DOC-*" }),
    ];
    expect(resolveDefaultTaxRule({
      catalogCode: "TRK-DOM",
      catalogVatRate: "8.00",
      shippingMode: "sea_export",
      chargeSection: "buying",
      rules: invalidRules,
      at: now,
    })).toBeNull();
  });
});
