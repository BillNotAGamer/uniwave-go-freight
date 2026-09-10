import { describe, expect, it } from "vitest";

import {
  ACCOUNTING_VAT_OVERRIDE_RATES,
  buildAccountingVatOverride,
  buildTaxRuleAccountingVat,
  getEffectiveAccountingVatRate,
  getPersistedChargeAccountingVat,
  parseAccountingVatRate,
} from "./vat";

describe("Accounting VAT domain", () => {
  it("accepts exactly the nullable 0/5/8/10 override domain", () => {
    expect(ACCOUNTING_VAT_OVERRIDE_RATES).toEqual([0, 5, 8, 10]);
    expect(parseAccountingVatRate(null)).toBeNull();
    for (const rate of ACCOUNTING_VAT_OVERRIDE_RATES) {
      expect(parseAccountingVatRate(rate)).toBe(rate);
      expect(parseAccountingVatRate(`${rate}.00`)).toBe(rate);
    }
    for (const invalid of [-1, 1, 7, 9, 11, 69]) {
      expect(() => parseAccountingVatRate(invalid)).toThrow();
    }
  });

  it.each([
    ["10.00", null, 10],
    ["10.00", "0.00", 0],
    ["10.00", "5.00", 5],
    ["10.00", "8.00", 8],
    ["10.00", "10.00", 10],
    [null, null, null],
    [null, "10.00", 10],
  ] as const)("resolves Tax Rule %s and override %s to %s", (taxRule, override, expected) => {
    expect(getEffectiveAccountingVatRate({
      taxRuleVatRate: taxRule,
      vatOverrideRate: override,
    })).toBe(expected === null ? null : `${expected}.00`);
  });

  it("keeps catalog provenance separate when Catalog and Tax Rule VAT differ", () => {
    const catalogVatRateSnapshot = 8;
    expect(getEffectiveAccountingVatRate({
      taxRuleVatRate: 10,
      vatOverrideRate: null,
    })).toBe("10.00");
    expect(catalogVatRateSnapshot).toBe(8);
  });

  it("restores the Tax Rule rate after an override is cleared", () => {
    expect(getEffectiveAccountingVatRate({
      taxRuleVatRate: 10,
      vatOverrideRate: 5,
    })).toBe("5.00");
    expect(getEffectiveAccountingVatRate({
      taxRuleVatRate: 10,
      vatOverrideRate: null,
    })).toBe("10.00");
  });

  it("treats an unclassified manual charge as having no Accounting VAT", () => {
    expect(getPersistedChargeAccountingVat({
      taxRuleId: null,
      vatPercent: "0.00",
      vatOverrideRate: null,
      isOverride: false,
    })).toEqual({
      accountingBaselineVatRate: null,
      effectiveAccountingVatRate: null,
    });
  });

  it("preserves an authoritative fractional Tax Rule rate", () => {
    expect(getEffectiveAccountingVatRate({
      taxRuleVatRate: "8.50",
      vatOverrideRate: null,
    })).toBe("8.50");
  });

  it("fails closed when persisted override and applied VAT disagree", () => {
    expect(() => getPersistedChargeAccountingVat({
      taxRuleId: "rule-1",
      vatPercent: "10.00",
      vatOverrideRate: "5.00",
      isOverride: true,
    })).toThrow(/does not match/);
  });

  it("keeps a legacy pre-column override readable from final applied vatPercent", () => {
    expect(getPersistedChargeAccountingVat({
      taxRuleId: "rule-1",
      vatPercent: "12.50",
      vatOverrideRate: null,
      isOverride: true,
    })).toEqual({
      accountingBaselineVatRate: null,
      effectiveAccountingVatRate: "12.50",
    });
  });

  it("uses one effective override rate for both vatPercent and vatAmount", () => {
    expect(buildAccountingVatOverride({
      amountVnd: "200.00",
      vatOverrideRate: 5,
      reason: "Approved",
    })).toEqual({
      vatPercent: "5.00",
      vatAmount: "10.00",
      vatOverrideRate: "5.00",
      isOverride: true,
      overrideReason: "Approved",
    });

    expect(buildAccountingVatOverride({
      amountVnd: "200.00",
      vatOverrideRate: 0,
      reason: "Approved zero",
    }).vatAmount).toBe("0.00");
  });

  it("makes a newly assigned Tax Rule the baseline and resets stale override state", () => {
    const changedRule = buildTaxRuleAccountingVat({
      amountVnd: "200.00",
      taxTreatment: "taxable",
      taxRuleVatRate: "10.00",
    });

    expect(changedRule).toEqual({
      vatPercent: "10.00",
      vatAmount: "20.00",
      vatOverrideRate: null,
      isOverride: false,
      overrideReason: null,
    });
    expect(getEffectiveAccountingVatRate({
      taxRuleVatRate: changedRule.vatPercent,
      vatOverrideRate: changedRule.vatOverrideRate,
    })).toBe("10.00");
  });

  it("ignores Catalog NULL when a Tax Rule supplies the Accounting baseline", () => {
    const catalogVatRateSnapshot = null;
    expect(getEffectiveAccountingVatRate({
      taxRuleVatRate: 8,
      vatOverrideRate: null,
    })).toBe("8.00");
    expect(catalogVatRateSnapshot).toBeNull();
  });
});
