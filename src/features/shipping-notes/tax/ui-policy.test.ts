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
import type { ChargeTaxDetail, ChargeTaxRuleOption } from "./types";

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
  taxDecisionSource: "tax_rule",
  taxDecisionReason: null,
  taxDecisionById: "accountant-1",
  taxDecisionAt: new Date("2026-11-09T00:00:00.000Z"),
  inputVatInvoiceStatus: null,
  inputVatInvoiceReference: null,
  inputVatDeductible: null,
  vatPercent: "10.00",
  vatAmount: "10.00",
  isOverride: false,
  overrideReason: null,
  vatOverrideRate: null,
  serviceCatalogItemId: null,
  catalogCodeSnapshot: null,
  catalogNameSnapshot: null,
  catalogUnitSnapshot: null,
  catalogVatRateSnapshot: null,
  accountingBaselineVatRate: "10.00",
  effectiveAccountingVatRate: "10.00",
  lineTotalIncludingVatVnd: "110.00",
  taxComplete: true,
  incompleteReason: null,
};

const rule: ChargeTaxRuleOption = {
  id: "rule-1",
  code: "SELL-VAT",
  name: "Selling VAT",
  chargeSection: "selling",
  taxTreatment: "taxable",
  vatPercent: "10.00",
  isActive: true,
  applicableChargeIds: ["charge-1"],
};

describe("tax UI policy helpers", () => {
  it("keeps sale tax capability denied and grants accountant/admin operations", () => {
    expect(getTaxCapability("sale")).toStrictEqual({
      canReadTax: false,
      canAssignTax: false,
      canClassifyManually: false,
      canOverrideTax: false,
      canManageTaxRules: false,
      canRequestMissingInvoiceException: false,
      canDecideMissingInvoiceException: false,
    });
    expect(getTaxCapability("accountant")).toMatchObject({
      canReadTax: true,
      canAssignTax: true,
      canClassifyManually: true,
      canOverrideTax: true,
      canManageTaxRules: false,
      canRequestMissingInvoiceException: true,
      canDecideMissingInvoiceException: false,
    });
    expect(getTaxCapability("admin")).toMatchObject({
      canManageTaxRules: true,
      canRequestMissingInvoiceException: true,
      canDecideMissingInvoiceException: true,
    });
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
    })).toStrictEqual(["Taxable", "Tax Rule", "Override"]);
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
    expect(filterTaxRulesForChargeSection([rule], "selling", "charge-1"))
      .toHaveLength(1);
    expect(filterTaxRulesForChargeSection([rule], "selling", "charge-2"))
      .toHaveLength(0);
  });

  it("keeps deactivation confirmation wording historically accurate", () => {
    expect(getTaxRuleDeactivateConfirmationText()).toMatch(
      /Existing charge snapshots remain unchanged/,
    );
  });
});
