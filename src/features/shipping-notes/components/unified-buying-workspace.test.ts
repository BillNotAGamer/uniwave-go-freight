import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../actions", () => ({
  softDeleteBuyingChargeAction: vi.fn(),
  updateBuyingChargeAction: vi.fn(),
}));
vi.mock("../tax/actions", () => ({
  assignChargeTaxRuleAction: vi.fn(),
  classifyChargeTaxManuallyAction: vi.fn(),
  overrideChargeVatPercentAction: vi.fn(),
}));
vi.mock("./charge-catalog-selector", () => ({
  ChargeCatalogSelector: ({
    initialChargeName,
  }: {
    initialChargeName?: string;
  }) =>
    createElement("div", {
      "data-testid": "mock-catalog-selector",
      "data-initial-name": initialChargeName ?? "",
    }),
}));

import {
  computeUnifiedBuyingTotals,
  UnifiedBuyingWorkspace,
  type UnifiedBuyingWorkspaceProps,
} from "./unified-buying-workspace";
import type { BuyingChargeDetail } from "../types";
import type { ChargeTaxDetail } from "../tax/types";
import type { ChargeTaxRuleOption } from "../tax/types";

const now = new Date("2026-09-01T00:00:00.000Z");

function makeCharge(
  overrides: Partial<BuyingChargeDetail> = {},
): BuyingChargeDetail {
  return {
    id: "chg-1",
    shippingNoteId: "sn-1",
    chargeName: "Ocean Freight 20ft",
    description: "Main leg freight",
    quantity: "2.000",
    unit: "cont",
    unitPrice: "100.0000",
    currency: "USD",
    exchangeRate: "25450.000000",
    amountOriginal: "200.0000",
    amountVnd: "5090000.00",
    serviceCatalogItemId: "cat-1",
    catalogCodeSnapshot: "OF-20",
    catalogNameSnapshot: "Ocean Freight 20ft",
    catalogUnitSnapshot: "cont",
    catalogVatRateSnapshot: "8.00",
    vendorOrAgentText: "Maersk Line",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeTaxDetail(
  overrides: Partial<ChargeTaxDetail> = {},
): ChargeTaxDetail {
  return {
    chargeId: "chg-1",
    shippingNoteId: "sn-1",
    section: "buying",
    chargeName: "Ocean Freight 20ft",
    amountVnd: "5090000.00",
    taxRuleId: "rule-1",
    taxRuleCodeSnapshot: "VAT8",
    taxRuleNameSnapshot: "Standard VAT 8%",
    taxTreatmentSnapshot: "taxable",
    taxDecisionSource: "tax_rule",
    taxDecisionReason: null,
    taxDecisionById: "accountant-1",
    taxDecisionAt: now,
    inputVatInvoiceStatus: "available",
    inputVatInvoiceReference: "INV-001",
    inputVatDeductible: true,
    vatPercent: "8.00",
    vatAmount: "407200.00",
    lineTotalIncludingVatVnd: "5497200.00",
    isOverride: false,
    overrideReason: null,
    vatOverrideRate: null,
    taxComplete: true,
    incompleteReason: null,
    serviceCatalogItemId: "cat-1",
    catalogCodeSnapshot: "OF-20",
    catalogNameSnapshot: "Ocean Freight 20ft",
    catalogUnitSnapshot: "cont",
    catalogVatRateSnapshot: "8.00",
    accountingBaselineVatRate: "8.00",
    effectiveAccountingVatRate: "8.00",
    ...overrides,
  };
}

function makeTaxRule(
  overrides: Partial<ChargeTaxRuleOption> = {},
): ChargeTaxRuleOption {
  return {
    id: "rule-1",
    code: "VAT8",
    name: "Standard VAT 8%",
    chargeSection: "buying",
    taxTreatment: "taxable",
    vatPercent: "8.00",
    isActive: true,
    applicableChargeIds: ["chg-1"],
    ...overrides,
  };
}

function renderWorkspace(
  overrides: Partial<UnifiedBuyingWorkspaceProps> = {},
): string {
  const defaultProps: UnifiedBuyingWorkspaceProps = {
    charges: [makeCharge()],
    canManageBuyingCharges: true,
    canReadTaxSummary: true,
    canMutateTax: true,
    taxDetails: [makeTaxDetail()],
    activeTaxRules: [makeTaxRule()],
    status: "submitted",
    role: "accountant",
    financialReviewRevision: "a".repeat(64),
    ...overrides,
  };

  return renderToStaticMarkup(
    createElement(UnifiedBuyingWorkspace, defaultProps),
  );
}

describe("UnifiedBuyingWorkspace genuine component rendering & financial safety (REQ-09)", () => {
  it("renders empty state when there are no buying charges", () => {
    const accountantHtml = renderWorkspace({
      charges: [],
      taxDetails: [],
      canReadTaxSummary: true,
    });
    expect(accountantHtml).toContain("Buying Charges &amp; Tax Classification");
    expect(accountantHtml).toContain("No buying charges yet.");
    expect(accountantHtml).toContain(
      "No active buying charges require tax classification.",
    );
    expect(accountantHtml).not.toContain("<table");

    const opsHtml = renderWorkspace({
      charges: [],
      taxDetails: [],
      canReadTaxSummary: false,
      canMutateTax: false,
      role: "ops",
    });
    expect(opsHtml).toContain("Buying Charges");
    expect(opsHtml).toContain("No buying charges yet.");
    expect(opsHtml).not.toContain(
      "No active buying charges require tax classification.",
    );
    expect(opsHtml).not.toContain("<table");
  });

  it("renders commercial charge values, catalog VAT snapshot, and tax classification for Accountant/Admin", () => {
    const secondCharge = makeCharge({
      id: "chg-2",
      chargeName: "Terminal Handling",
      description: null,
      quantity: "1.000",
      unit: "shpt",
      unitPrice: "1500000.0000",
      currency: "VND",
      exchangeRate: "1.000000",
      amountOriginal: "1500000.0000",
      amountVnd: "1500000.00",
      serviceCatalogItemId: null,
      catalogCodeSnapshot: null,
      catalogNameSnapshot: null,
      catalogUnitSnapshot: null,
      catalogVatRateSnapshot: null,
      vendorOrAgentText: "Saigon Newport",
    });
    const secondTax = makeTaxDetail({
      chargeId: "chg-2",
      chargeName: "Terminal Handling",
      amountVnd: "1500000.00",
      taxRuleId: null,
      taxRuleCodeSnapshot: null,
      taxRuleNameSnapshot: null,
      taxTreatmentSnapshot: null,
      vatPercent: "0.00",
      vatAmount: "0.00",
      lineTotalIncludingVatVnd: "1500000.00",
      taxComplete: false,
      catalogVatRateSnapshot: null,
      accountingBaselineVatRate: null,
      effectiveAccountingVatRate: null,
    });

    const html = renderWorkspace({
      charges: [makeCharge(), secondCharge],
      taxDetails: [
        makeTaxDetail({
          isOverride: true,
          overrideReason: "Special customs ruling",
          vatOverrideRate: "10.00",
          effectiveAccountingVatRate: "10.00",
          vatPercent: "10.00",
          vatAmount: "509000.00",
          lineTotalIncludingVatVnd: "5599000.00",
        }),
        secondTax,
      ],
      canReadTaxSummary: true,
      canMutateTax: true,
      canManageBuyingCharges: true,
    });

    // Commercial values formatted via formatFinancialDecimal
    expect(html).toContain("Ocean Freight 20ft");
    expect(html).toContain("[OF-20]");
    expect(html).toContain("Main leg freight");
    expect(html).toContain("Maersk Line");
    expect(html).toContain("100 ");
    expect(html).toContain("USD");
    expect(html).toContain("@ 25,450");
    expect(html).toContain("200 USD");
    expect(html).toContain("5,090,000");
    expect(html).toContain("Terminal Handling");
    expect(html).toContain("Saigon Newport");

    // Catalog VAT invariant: 8% vs Unspecified (never 0% when null)
    expect(html).toContain("Catalog VAT: 8%");
    expect(html).toContain("Catalog VAT: Unspecified");

    // Tax rule snapshot, badges, override reason, and VAT values
    expect(html).toContain("VAT8");
    expect(html).toContain("(10%)");
    expect(html).toContain("Standard VAT 8%");
    expect(html).toContain("Override");
    expect(html).toContain("Reason: Special customs ruling");
    expect(html).toContain("509,000");
    expect(html).toContain("5,599,000");
    expect(html).toContain("Complete");
    expect(html).toContain("Unclassified");

    // Header VND summary totals: 5,090,000 + 1,500,000 = 6,590,000; VAT = 509,000; Total = 7,099,000
    expect(html).toContain("Subtotal (Excl. VAT):");
    expect(html).toContain("6,590,000 VND");
    expect(html).toContain("509,000 VND");
    expect(html).toContain("7,099,000 VND");
    expect(html).toContain("1/2 tax-classified");
  });

  it("strictly redacts all tax columns, VAT amounts, Catalog VAT, and tax controls for OPS even if tax props are supplied", () => {
    const html = renderWorkspace({
      charges: [makeCharge()],
      taxDetails: [makeTaxDetail()],
      activeTaxRules: [makeTaxRule()],
      canReadTaxSummary: false,
      canMutateTax: true, // Even if misconfigured true, canReadTaxSummary=false must block it
      canManageBuyingCharges: true,
      role: "ops",
      status: "submitted",
    });

    // OPS sees operational header and commercial values
    expect(html).toContain("Operational buying charges summary.");
    expect(html).toContain("Buying subtotal: 5,090,000 VND");
    expect(html).toContain("Ocean Freight 20ft");
    expect(html).toContain("[OF-20]");
    expect(html).toContain("Maersk Line");
    expect(html).toContain("Edit");
    expect(html).toContain("Delete");

    // OPS never sees tax headers, snapshots, Catalog VAT, VAT amounts, or tax controls
    expect(html).not.toContain("Buying Charges &amp; Tax Classification");
    expect(html).not.toContain("Tax Rule");
    expect(html).not.toContain("Excl. VAT");
    expect(html).not.toContain("Incl. VAT");
    expect(html).not.toContain("tax-classified");
    expect(html).not.toContain("Catalog VAT:");
    expect(html).not.toContain("VAT8");
    expect(html).not.toContain("Standard VAT 8%");
    expect(html).not.toContain("407,200");
    expect(html).not.toContain("5,497,200");
    expect(html).not.toContain("Assign tax rule");
    expect(html).not.toContain("Change tax rule");
    expect(html).not.toContain("Override VAT");
  });

  it("safely aggregates mixed currencies (USD, EUR, VND) and negative charges in canonical VND without floating-point or cross-currency addition", () => {
    const usdCharge = makeCharge({
      id: "chg-usd",
      currency: "USD",
      quantity: "2.000",
      unitPrice: "100.0500",
      exchangeRate: "25450.000000",
      amountOriginal: "200.1000",
      amountVnd: "5092545.00",
    });
    const eurCharge = makeCharge({
      id: "chg-eur",
      chargeName: "Origin Documentation",
      currency: "EUR",
      quantity: "1.000",
      unitPrice: "50.2000",
      exchangeRate: "27500.000000",
      amountOriginal: "50.2000",
      amountVnd: "1380500.00",
    });
    const negativeVndCharge = makeCharge({
      id: "chg-vnd-neg",
      chargeName: "Vendor Credit Adjustment",
      currency: "VND",
      quantity: "1.000",
      unitPrice: "-500000.0000",
      exchangeRate: "1.000000",
      amountOriginal: "-500000.0000",
      amountVnd: "-500000.00",
    });

    const taxDetails: ChargeTaxDetail[] = [
      makeTaxDetail({
        chargeId: "chg-usd",
        amountVnd: "5092545.00",
        vatAmount: "407403.60",
        lineTotalIncludingVatVnd: "5499948.60",
        taxComplete: true,
      }),
      makeTaxDetail({
        chargeId: "chg-eur",
        amountVnd: "1380500.00",
        vatAmount: "0.00",
        lineTotalIncludingVatVnd: "1380500.00",
        taxTreatmentSnapshot: "zero_rated",
        vatPercent: "0.00",
        taxComplete: true,
      }),
      makeTaxDetail({
        chargeId: "chg-vnd-neg",
        amountVnd: "-500000.00",
        vatAmount: "-50000.00",
        lineTotalIncludingVatVnd: "-550000.00",
        vatPercent: "10.00",
        taxComplete: true,
      }),
    ];

    const totals = computeUnifiedBuyingTotals(
      [usdCharge, eurCharge, negativeVndCharge],
      taxDetails,
      true,
    );

    // Canonical VND totals:
    // Subtotal: 5092545.00 + 1380500.00 - 500000.00 = 5973045.00
    // VAT: 407403.60 + 0.00 - 50000.00 = 357403.60
    // Total Incl. VAT: 5973045.00 + 357403.60 = 6330448.60
    expect(totals.subtotalExcludingVatVnd).toBe("5973045.00");
    expect(totals.totalVatVnd).toBe("357403.60");
    expect(totals.totalIncludingVatVnd).toBe("6330448.60");
    expect(totals.completeTaxCount).toBe(3);

    // Original currency buckets remain strictly separated
    expect(totals.totalsByCurrency).toEqual([
      { currency: "VND", amountOriginal: "-500000.0000" },
      { currency: "USD", amountOriginal: "200.1000" },
      { currency: "EUR", amountOriginal: "50.2000" },
    ]);

    // Verify rendered HTML displays canonical VND totals and per-charge currencies
    const html = renderWorkspace({
      charges: [usdCharge, eurCharge, negativeVndCharge],
      taxDetails,
      canReadTaxSummary: true,
    });
    expect(html).toContain("5,973,045 VND");
    expect(html).toContain("357,403.6 VND");
    expect(html).toContain("6,330,448.6 VND");
    expect(html).toContain("200.1 USD");
    expect(html).toContain("50.2 EUR");
    expect(html).toContain("-500,000");
    // Must never contain raw cross-currency sum (200.1 + 50.2 - 500000 = -499749.7)
    expect(html).not.toContain("-499,749");
  });

  it("gates tax classification and override controls by permission, status, and tax treatment", () => {
    // 1. Mutable taxable classified charge -> shows both Change tax rule and Override VAT
    const mutableHtml = renderWorkspace({
      canReadTaxSummary: true,
      canMutateTax: true,
      status: "submitted",
      role: "accountant",
    });
    expect(mutableHtml).toContain("Change tax rule");
    expect(mutableHtml).toContain('name="taxRuleId"');
    expect(mutableHtml).toContain("Apply rule");
    expect(mutableHtml).toContain("Override VAT");
    expect(mutableHtml).toContain('name="vatPercent"');
    expect(mutableHtml).toContain("Save override");

    // 2. Unclassified charge -> shows Assign tax rule, but NOT Override VAT
    const unclassifiedHtml = renderWorkspace({
      taxDetails: [
        makeTaxDetail({
          taxRuleId: null,
          taxRuleCodeSnapshot: null,
          taxTreatmentSnapshot: null,
          taxComplete: false,
        }),
      ],
      canReadTaxSummary: true,
      canMutateTax: true,
    });
    expect(unclassifiedHtml).toContain("Assign tax rule");
    expect(unclassifiedHtml).not.toContain("Override VAT");

    // 3. Zero applicable buying tax rules -> shows empty rule notice
    const noRulesHtml = renderWorkspace({
      activeTaxRules: [],
      canReadTaxSummary: true,
      canMutateTax: true,
    });
    expect(noRulesHtml).toContain("No applicable Tax Rules available");

    // 4. Read-only statuses (draft, checked, locked) -> hides tax mutation forms and shows status helper
    const draftHtml = renderWorkspace({
      canReadTaxSummary: true,
      canMutateTax: false,
      status: "draft",
    });
    expect(draftHtml).toContain(
      "Tax classification is available after submission.",
    );
    expect(draftHtml).not.toContain("Change tax rule");
    expect(draftHtml).not.toContain("Override VAT");

    const checkedHtml = renderWorkspace({
      canReadTaxSummary: true,
      canMutateTax: false,
      status: "checked",
    });
    expect(checkedHtml).toContain(
      "Tax values are read-only because this note is checked.",
    );
    expect(checkedHtml).not.toContain("Change tax rule");
  });

  it("maintains exact table column counts and EditBuyingChargeRow colSpan across all role and permission combinations", () => {
    const countTags = (segment: string, tag: string) =>
      (segment.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;

    // Combination 1: Accountant with commercial + tax actions (10 columns)
    const accMutableHtml = renderWorkspace({
      canReadTaxSummary: true,
      canManageBuyingCharges: true,
      canMutateTax: true,
    });
    const accMutableHead = accMutableHtml.split("<thead>")[1].split("</thead>")[0];
    const accMutableBody = accMutableHtml.split("<tbody>")[1].split("</tbody>")[0];
    expect(countTags(accMutableHead, "th")).toBe(10);
    expect(countTags(accMutableBody, "td")).toBe(10);

    // Verify EditBuyingChargeRow colSpan matches 10 columns for Accountant
    const accEditingHtml = renderWorkspace({
      canReadTaxSummary: true,
      canManageBuyingCharges: true,
      canMutateTax: true,
      initialEditingId: "chg-1",
    });
    expect(accEditingHtml).toContain("Edit Buying Charge");
    expect(accEditingHtml).toContain('colSpan="10"');

    // Combination 2: Accountant read-only (9 columns — Actions column omitted cleanly)
    const accReadOnlyHtml = renderWorkspace({
      canReadTaxSummary: true,
      canManageBuyingCharges: false,
      canMutateTax: false,
      status: "locked",
    });
    const accReadOnlyHead = accReadOnlyHtml.split("<thead>")[1].split("</thead>")[0];
    const accReadOnlyBody = accReadOnlyHtml.split("<tbody>")[1].split("</tbody>")[0];
    expect(countTags(accReadOnlyHead, "th")).toBe(9);
    expect(countTags(accReadOnlyBody, "td")).toBe(9);
    expect(accReadOnlyHtml).not.toContain("Edit");
    expect(accReadOnlyHtml).not.toContain("Delete");

    // Combination 3: OPS with commercial actions (11 columns)
    const opsMutableHtml = renderWorkspace({
      canReadTaxSummary: false,
      canManageBuyingCharges: true,
      canMutateTax: false,
      role: "ops",
    });
    const opsMutableHead = opsMutableHtml.split("<thead>")[1].split("</thead>")[0];
    const opsMutableBody = opsMutableHtml.split("<tbody>")[1].split("</tbody>")[0];
    expect(countTags(opsMutableHead, "th")).toBe(11);
    expect(countTags(opsMutableBody, "td")).toBe(11);

    // Verify EditBuyingChargeRow colSpan matches 11 columns for OPS
    const opsEditingHtml = renderWorkspace({
      canReadTaxSummary: false,
      canManageBuyingCharges: true,
      canMutateTax: false,
      role: "ops",
      initialEditingId: "chg-1",
    });
    expect(opsEditingHtml).toContain("Edit Buying Charge");
    expect(opsEditingHtml).toContain('colSpan="11"');

    // Combination 4: OPS read-only (10 columns — Actions column omitted cleanly)
    const opsReadOnlyHtml = renderWorkspace({
      canReadTaxSummary: false,
      canManageBuyingCharges: false,
      canMutateTax: false,
      role: "ops",
      status: "accounting_reviewing",
    });
    const opsReadOnlyHead = opsReadOnlyHtml.split("<thead>")[1].split("</thead>")[0];
    const opsReadOnlyBody = opsReadOnlyHtml.split("<tbody>")[1].split("</tbody>")[0];
    expect(countTags(opsReadOnlyHead, "th")).toBe(10);
    expect(countTags(opsReadOnlyBody, "td")).toBe(10);
  });
});
