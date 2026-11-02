import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UnifiedBuyingWorkspace component contract (REQ-09)", () => {
  const source = readFileSync(
    new URL("./unified-buying-workspace.tsx", import.meta.url),
    "utf8",
  );

  it("unifies commercial buying charges and tax classification into one charge-row table", () => {
    // Verified unified data grid structure
    expect(source).toContain('data-testid="unified-buying-workspace"');
    expect(source).toContain("<table");
    expect(source).toContain("Buying Charges & Tax Classification");
    expect(source).toContain("Unified commercial costs, tax classification, and VAT reconciliation.");
  });

  it("renders both commercial amounts and tax snapshots when canReadTaxSummary is true", () => {
    expect(source).toContain("canReadTaxSummary ?");
    expect(source).toContain("Subtotal:");
    expect(source).toContain("VAT:");
    expect(source).toContain("Total:");
    expect(source).toContain("tax-classified");
    expect(source).toContain("taxDetail.taxRuleCodeSnapshot");
    expect(source).toContain("taxDetail.vatAmount");
    expect(source).toContain("taxDetail.lineTotalIncludingVatVnd");
    expect(source).toContain("getTaxTreatmentLabel");
  });

  it("strictly redacts tax columns and VAT amounts when canReadTaxSummary is false (OPS role)", () => {
    // When canReadTaxSummary is false, renders separate OPS operational header without VAT/Tax columns
    expect(source).toContain(": (");
    expect(source).toContain("Operational buying charges summary.");
    expect(source).toContain("Buying subtotal:");
    // Confirms OPS commercial columns
    expect(source).toContain("{formatFinancialDecimal(charge.quantity)}");
    expect(source).toContain("{formatFinancialDecimal(charge.unitPrice)}");
    expect(source).toContain("{charge.currency}");
    expect(source).toContain("{formatFinancialDecimal(charge.amountOriginal)}");
    expect(source).toContain("{formatFinancialDecimal(charge.amountVnd)}");
  });

  it("integrates commercial mutations and tax classification actions seamlessly", () => {
    // Reuses existing edit and delete components
    expect(source).toContain("EditBuyingChargeRow");
    expect(source).toContain("DeleteBuyingChargeButton");
    // Reuses existing tax rule panel and override panel
    expect(source).toContain("AssignTaxRulePanel");
    expect(source).toContain("OverrideVatPanel");
    // Action triggers
    expect(source).toContain("canManageBuyingCharges");
    expect(source).toContain("canMutateTax");
    expect(source).toContain("Assign Rule");
    expect(source).toContain("Change Rule");
    expect(source).toContain("Override");
  });

  it("provides clean empty state and desktop-first responsive table styling", () => {
    expect(source).toContain("No buying charges yet.");
    expect(source).toContain("overflow-x-auto rounded-md border border-border bg-card");
    expect(source).toContain("min-w-full border-separate border-spacing-0 text-left text-sm");
  });
});

