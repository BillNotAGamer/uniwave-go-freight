import { describe, expect, it } from "vitest";

import {
  canOverrideChargeTax,
  canShowTaxMutationControls,
  filterTaxRulesForChargeSection,
  formatTaxRuleOption,
  getChargeTaxBadges,
  getMarkCheckedDisabledReason,
  getTaxCapability,
  getTaxCompletenessCounts,
  getTaxCompletenessMessage,
  getTaxRuleDeactivateConfirmationText,
  getTaxTreatmentLabel,
} from "./ui-policy";
import type { ChargeTaxDetail } from "./types";
import type { TaxRuleDetail } from "@/features/tax-rules/types";

const taxableCharge: ChargeTaxDetail = {
  chargeId: "charge-1",
  shippingNoteId: "note-1",
  section: "selling",
  chargeName: "Freight",
  amountVnd: "100.00",
  taxRuleId: "rule-1",
  taxRuleCodeSnapshot: "SELL-VAT",
  taxRuleNameSnapshot: "Selling VAT",
  taxTreatmentSnapshot: "taxable",
  vatPercent: "10.00",
  vatAmount: "10.00",
  isOverride: false,
  overrideReason: null,
  lineTotalIncludingVatVnd: "110.00",
  taxComplete: true,
};

const rule: TaxRuleDetail = {
  id: "rule-1",
  code: "SELL-VAT",
  name: "Selling VAT",
  description: null,
  shippingMode: "sea_export",
  chargeSection: "selling",
  chargeNamePattern: "*",
  taxTreatment: "taxable",
  vatPercent: "10.00",
  isActive: true,
  effectiveFrom: null,
  effectiveTo: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("tax UI policy helpers", () => {
  it("keeps sale tax capability denied and grants accountant/admin operations", () => {
    expect(getTaxCapability("sale")).toStrictEqual({
      canReadTax: false,
      canAssignTax: false,
      canOverrideTax: false,
      canManageTaxRules: false,
    });
    expect(getTaxCapability("accountant")).toMatchObject({
      canReadTax: true,
      canAssignTax: true,
      canOverrideTax: true,
      canManageTaxRules: false,
    });
    expect(getTaxCapability("admin").canManageTaxRules).toBe(true);
  });

  it("allows tax mutation controls only for submitted and accounting-reviewing statuses", () => {
    expect(canShowTaxMutationControls({
      role: "accountant",
      status: "draft",
    })).toBe(false);
    expect(canShowTaxMutationControls({
      role: "accountant",
      status: "submitted",
    })).toBe(true);
    expect(canShowTaxMutationControls({
      role: "admin",
      status: "accounting_reviewing",
    })).toBe(true);
    expect(canShowTaxMutationControls({
      role: "admin",
      status: "checked",
    })).toBe(false);
  });

  it("labels classifications and override badges clearly", () => {
    expect(getTaxTreatmentLabel(null)).toBe("Unclassified");
    expect(getTaxTreatmentLabel("taxable")).toBe("Taxable");
    expect(getTaxTreatmentLabel("zero_rated")).toBe("Zero-rated");
    expect(getTaxTreatmentLabel("non_taxable")).toBe("Non-taxable");
    expect(getChargeTaxBadges({
      ...taxableCharge,
      isOverride: true,
      overrideReason: "Manual rate",
    })).toStrictEqual(["Taxable", "Override"]);
  });

  it("allows override only for classified taxable charges in mutable statuses", () => {
    expect(canOverrideChargeTax({
      role: "accountant",
      status: "submitted",
      charge: taxableCharge,
    })).toBe(true);
    expect(canOverrideChargeTax({
      role: "accountant",
      status: "submitted",
      charge: {
        ...taxableCharge,
        taxTreatmentSnapshot: "zero_rated",
      },
    })).toBe(false);
    expect(canOverrideChargeTax({
      role: "admin",
      status: "checked",
      charge: taxableCharge,
    })).toBe(false);
  });

  it("summarizes completeness and mark-checked disabled reasons", () => {
    const counts = getTaxCompletenessCounts([
      taxableCharge,
      {
        ...taxableCharge,
        chargeId: "charge-2",
        section: "buying",
        taxTreatmentSnapshot: null,
        taxComplete: false,
      },
    ]);

    expect(counts).toStrictEqual({
      unclassifiedSellingCount: 0,
      unclassifiedBuyingCount: 1,
      totalUnclassifiedCount: 1,
      taxComplete: false,
    });
    expect(getTaxCompletenessMessage({
      status: "submitted",
      taxComplete: false,
    })).toMatch(/incomplete/);
    expect(getTaxCompletenessMessage({
      status: "checked",
      taxComplete: true,
    })).toMatch(/locked/);
    expect(getMarkCheckedDisabledReason({
      status: "accounting_reviewing",
      canMarkChecked: true,
      taxComplete: false,
    })).toMatch(/Assign a tax classification/);
  });

  it("formats and filters tax rule options", () => {
    expect(formatTaxRuleOption(rule)).toContain("SELL-VAT - Selling VAT");
    expect(filterTaxRulesForChargeSection([
      rule,
      { ...rule, id: "rule-2", chargeSection: "buying" },
      { ...rule, id: "rule-3", isActive: false },
    ], "selling")).toHaveLength(1);
  });

  it("keeps deactivation confirmation wording historically accurate", () => {
    expect(getTaxRuleDeactivateConfirmationText()).toMatch(
      /Existing charge snapshots remain unchanged/,
    );
  });
});
