import { describe, expect, it } from "vitest";

import {
  assertTaxTreatmentPercentConsistency,
  calculateLineTotalIncludingVat,
  calculateVatAmount,
  normalizeVatPercent,
} from "./calculations";

describe("charge VAT calculations", () => {
  it("normalizes VAT percentages to scale 2", () => {
    expect(normalizeVatPercent(" 10 ")).toBe("10.00");
    expect(normalizeVatPercent("0.5")).toBe("0.50");
  });

  it("calculates tax-exclusive per-line VAT with half-up rounding", () => {
    expect(calculateVatAmount({
      amountVnd: "100.00",
      vatPercent: "10.00",
      treatment: "taxable",
    })).toBe("10.00");

    expect(calculateVatAmount({
      amountVnd: "0.05",
      vatPercent: "10.00",
      treatment: "taxable",
    })).toBe("0.01");
  });

  it("requires zero VAT percent for zero-rated and non-taxable treatments", () => {
    expect(calculateVatAmount({
      amountVnd: "100.00",
      vatPercent: "0",
      treatment: "zero_rated",
    })).toBe("0.00");

    expect(() => assertTaxTreatmentPercentConsistency(
      "non_taxable",
      "10.00",
    )).toThrow(/requires a 0.00 VAT percentage/);
  });

  it("calculates tax-inclusive line totals without changing gross profit basis", () => {
    expect(calculateLineTotalIncludingVat("120.00", "12.34")).toBe("132.34");
  });

  it.each([
    ["-92587.50", "10.00", "-9258.75", "-101846.25"],
    ["-350.00", "8.00", "-28.00", "-378.00"],
  ])(
    "preserves the sign for base %s at %s percent",
    (amountVnd, vatPercent, expectedVat, expectedTotal) => {
      const vatAmount = calculateVatAmount({
        amountVnd,
        vatPercent,
        treatment: "taxable",
      });

      expect(vatAmount).toBe(expectedVat);
      expect(calculateLineTotalIncludingVat(amountVnd, vatAmount)).toBe(
        expectedTotal,
      );
    },
  );

  it("keeps nonnegative VAT-rate rules for a negative taxable base", () => {
    expect(() => calculateVatAmount({
      amountVnd: "-100.00",
      vatPercent: "-1.00",
      treatment: "taxable",
    })).toThrow(/must not be negative|not allowed/);
    expect(calculateVatAmount({
      amountVnd: "-100.00",
      vatPercent: "0",
      treatment: "non_taxable",
    })).toBe("0.00");
  });
});
