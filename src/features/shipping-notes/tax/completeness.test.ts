import { describe, expect, it } from "vitest";

import {
  isChargeTaxComplete,
  summarizeTaxCompleteness,
  TAX_COMPLETENESS_ERROR,
} from "./completeness";

const completeTaxableCharge = {
  section: "selling" as const,
  taxRuleId: "tax-rule-1",
  taxRuleCodeSnapshot: "SELLING-VAT10",
  taxRuleNameSnapshot: "Selling VAT 10",
  taxTreatmentSnapshot: "taxable" as const,
  taxDecisionSource: null,
  taxDecisionReason: null,
  taxDecisionById: null,
  taxDecisionAt: null,
  inputVatInvoiceStatus: null,
  inputVatInvoiceReference: null,
  inputVatDeductible: null,
  vatPercent: "10.00",
  vatAmount: "10.00",
  isOverride: false,
  overrideReason: null,
  amountVnd: "100.00",
};

describe("charge tax completeness", () => {
  it("requires tax rule snapshots and deterministic VAT amount", () => {
    expect(isChargeTaxComplete(completeTaxableCharge)).toBe(true);

    expect(isChargeTaxComplete({
      ...completeTaxableCharge,
      taxRuleCodeSnapshot: null,
    })).toBe(false);

    expect(isChargeTaxComplete({
      ...completeTaxableCharge,
      vatAmount: "9.99",
    })).toBe(false);
  });

  it("treats legacy null snapshots as incomplete even when VAT fields are zero", () => {
    expect(isChargeTaxComplete({
      section: "selling",
      taxRuleId: null,
      taxRuleCodeSnapshot: null,
      taxRuleNameSnapshot: null,
      taxTreatmentSnapshot: null,
      taxDecisionSource: null,
      taxDecisionReason: null,
      taxDecisionById: null,
      taxDecisionAt: null,
      inputVatInvoiceStatus: null,
      inputVatInvoiceReference: null,
      inputVatDeductible: null,
      vatPercent: "0.00",
      vatAmount: "0.00",
      isOverride: false,
      overrideReason: null,
      amountVnd: "0.00",
    })).toBe(false);
  });

  it("requires override reasons and blocks overrides on zero/non-tax treatments", () => {
    expect(isChargeTaxComplete({
      ...completeTaxableCharge,
      isOverride: true,
      overrideReason: "Manual contract rate",
    })).toBe(true);

    expect(isChargeTaxComplete({
      ...completeTaxableCharge,
      isOverride: true,
      overrideReason: " ",
    })).toBe(false);

    expect(isChargeTaxComplete({
      ...completeTaxableCharge,
      taxTreatmentSnapshot: "zero_rated",
      vatPercent: "0.00",
      vatAmount: "0.00",
      isOverride: true,
      overrideReason: "Manual override",
    })).toBe(false);
  });

  it("summarizes active charge classification completeness", () => {
    expect(summarizeTaxCompleteness([
      completeTaxableCharge,
      { ...completeTaxableCharge, taxRuleNameSnapshot: null },
    ])).toStrictEqual({
      taxComplete: false,
      unclassifiedChargeCount: 1,
    });

    expect(TAX_COMPLETENESS_ERROR).toMatch(/tax classification/);
  });

  it("accepts a complete manual decision without manufacturing a Tax Rule", () => {
    expect(isChargeTaxComplete({
      ...completeTaxableCharge,
      taxRuleId: null,
      taxRuleCodeSnapshot: null,
      taxRuleNameSnapshot: null,
      taxDecisionSource: "manual",
      taxDecisionReason: "Reviewed against the customer invoice",
      taxDecisionById: "accountant-1",
      taxDecisionAt: new Date("2026-11-09T00:00:00.000Z"),
    })).toBe(true);
  });

  it("requires explicit buying invoice and deduction evidence", () => {
    const buying = {
      ...completeTaxableCharge,
      section: "buying" as const,
      inputVatInvoiceStatus: "available" as const,
      inputVatInvoiceReference: "INV-001",
      inputVatDeductible: true,
    };

    expect(isChargeTaxComplete(buying)).toBe(true);
    expect(isChargeTaxComplete({
      ...buying,
      inputVatInvoiceStatus: "missing",
      inputVatInvoiceReference: null,
      inputVatDeductible: false,
    })).toBe(false);
    expect(isChargeTaxComplete({
      ...buying,
      taxTreatmentSnapshot: "non_taxable",
      vatPercent: "0.00",
      vatAmount: "0.00",
      inputVatDeductible: true,
    })).toBe(false);
  });
});
