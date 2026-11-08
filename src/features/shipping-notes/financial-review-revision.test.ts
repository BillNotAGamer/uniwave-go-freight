import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));

import {
  createFinancialReviewRevision,
  type FinancialReviewNoteState,
} from "./financial-review-revision";

const note: FinancialReviewNoteState = {
  id: "note-1",
  status: "accounting_reviewing",
  shippingMode: "sea_export",
  exchangeRate: "25000.000000",
  updatedAt: new Date("2026-11-04T00:00:00.000Z"),
};

describe("financial review revision", () => {
  it("is deterministic for canonical financial state regardless of object key order", () => {
    const first = createFinancialReviewRevision(note, [
      { id: "charge-1", amountVnd: "100.00", currency: "VND" },
    ]);
    const second = createFinancialReviewRevision(note, [
      { currency: "VND", id: "charge-1", amountVnd: "100.00" },
    ]);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it.each([
    ["selling value", [{ id: "charge-1", section: "selling", amountVnd: "101.00" }]],
    ["buying value", [{ id: "charge-1", section: "buying", amountVnd: "100.00" }]],
    ["tax classification", [{ id: "charge-1", taxRuleId: "tax-2", vatPercent: "8.00" }]],
    ["manual decision", [{ id: "charge-1", taxDecisionSource: "manual", taxDecisionReason: "Reviewed" }]],
    ["invoice evidence", [{ id: "charge-1", inputVatInvoiceStatus: "available", inputVatInvoiceReference: "INV-1", inputVatDeductible: true }]],
  ])("changes when %s changes", (_label, charges) => {
    const baseline = createFinancialReviewRevision(note, [
      { id: "charge-1", section: "selling", amountVnd: "100.00", taxRuleId: "tax-1" },
    ]);

    expect(createFinancialReviewRevision(note, charges)).not.toBe(baseline);
  });

  it("changes across reopen or an operational correction revision", () => {
    const baseline = createFinancialReviewRevision(note, []);

    expect(createFinancialReviewRevision({
      ...note,
      updatedAt: new Date("2026-11-04T00:00:01.000Z"),
    }, [])).not.toBe(baseline);
  });
});
