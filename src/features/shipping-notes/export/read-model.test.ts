import { describe, expect, it } from "vitest";

import { buildInternalExportSections } from "./read-model";
import type { InternalExportChargeSourceRow } from "./read-model";

function row(
  overrides: Partial<InternalExportChargeSourceRow> = {},
): InternalExportChargeSourceRow {
  return {
    section: "selling",
    chargeName: "Freight",
    description: null,
    quantity: "1.000",
    unit: "shipment",
    unitPrice: "100000.0000",
    currency: "VND",
    exchangeRate: "1.000000",
    amountOriginal: "100000.0000",
    amountVnd: "100000.00",
    vendorOrAgentText: null,
    taxRuleCodeSnapshot: "VAT10",
    taxRuleNameSnapshot: "Taxable 10",
    taxTreatmentSnapshot: "taxable",
    vatPercent: "10.00",
    vatAmount: "10000.00",
    isOverride: false,
    overrideReason: null,
    ...overrides,
  };
}

describe("internal export read model", () => {
  it("maps stored charge tax snapshots without live tax-rule lookup", () => {
    const sections = buildInternalExportSections([
      row(),
      row({
        chargeName: "Zero rated handling",
        amountOriginal: "200000.0000",
        amountVnd: "200000.00",
        taxRuleCodeSnapshot: "ZR",
        taxRuleNameSnapshot: "Zero rated",
        taxTreatmentSnapshot: "zero_rated",
        vatPercent: "0.00",
        vatAmount: "0.00",
      }),
      row({
        chargeName: "Manual override",
        amountOriginal: "50000.0000",
        amountVnd: "50000.00",
        vatPercent: "12.50",
        vatAmount: "6250.00",
        isOverride: true,
        overrideReason: "Manual accounting adjustment",
      }),
      row({
        section: "buying",
        chargeName: "Non-taxable vendor cost",
        amountOriginal: "40000.0000",
        amountVnd: "40000.00",
        vendorOrAgentText: "Vendor A",
        taxRuleCodeSnapshot: "NT",
        taxRuleNameSnapshot: "Non-taxable",
        taxTreatmentSnapshot: "non_taxable",
        vatPercent: "0.00",
        vatAmount: "0.00",
      }),
    ]);

    expect(sections.sellingCharges).toHaveLength(3);
    expect(sections.buyingCharges).toHaveLength(1);
    expect(sections.sellingCharges[0]).toMatchObject({
      taxRuleCodeSnapshot: "VAT10",
      taxRuleNameSnapshot: "Taxable 10",
      taxTreatmentSnapshot: "taxable",
      vatPercent: "10.00",
      vatAmount: "10000.00",
      totalIncludingVatVnd: "110000.00",
      isOverride: false,
    });
    expect(sections.sellingCharges[1]).toMatchObject({
      taxTreatmentSnapshot: "zero_rated",
      vatAmount: "0.00",
      totalIncludingVatVnd: "200000.00",
    });
    expect(sections.sellingCharges[2]).toMatchObject({
      isOverride: true,
      overrideReason: "Manual accounting adjustment",
      vatPercent: "12.50",
      vatAmount: "6250.00",
      totalIncludingVatVnd: "56250.00",
    });
    expect(sections.buyingCharges[0]).toMatchObject({
      vendorOrAgentText: "Vendor A",
      taxTreatmentSnapshot: "non_taxable",
      vatAmount: "0.00",
      totalIncludingVatVnd: "40000.00",
    });
    expect(sections.summary).toMatchObject({
      sellingSubtotalExcludingVatVnd: "350000.00",
      sellingVatVnd: "16250.00",
      sellingTotalIncludingVatVnd: "366250.00",
      buyingSubtotalExcludingVatVnd: "40000.00",
      buyingVatVnd: "0.00",
      buyingTotalIncludingVatVnd: "40000.00",
      grossProfitExcludingVatVnd: "310000.00",
    });
  });

  it("represents legacy incomplete snapshots as unclassified instead of inventing rule data", () => {
    const sections = buildInternalExportSections([
      row({
        taxRuleCodeSnapshot: null,
        taxRuleNameSnapshot: null,
        taxTreatmentSnapshot: null,
        vatPercent: "0.00",
        vatAmount: "0.00",
      }),
    ]);

    expect(sections.sellingCharges[0]).toMatchObject({
      taxRuleCodeSnapshot: null,
      taxRuleNameSnapshot: null,
      taxTreatmentSnapshot: null,
      vatAmount: "0.00",
      totalIncludingVatVnd: "100000.00",
    });
  });
});
