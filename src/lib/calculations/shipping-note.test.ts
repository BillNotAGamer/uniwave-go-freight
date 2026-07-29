import { describe, expect, it } from "vitest";

import {
  summarizeFinancialCharges,
  summarizeSellingCharges,
} from "./shipping-note";

describe("shipping note summaries", () => {
  it("returns zeroed selling totals when no charges are supplied", () => {
    expect(summarizeSellingCharges([])).toStrictEqual({
      chargeCount: 0,
      totalVnd: "0.00",
      totalsByCurrency: [
        { currency: "VND", amountOriginal: "0.0000" },
        { currency: "USD", amountOriginal: "0.0000" },
      ],
    });
  });

  it("summarizes selling totals by VND and original currency", () => {
    expect(summarizeSellingCharges([
      { currency: "VND", amountOriginal: "100.0000", amountVnd: "100.00" },
      { currency: "USD", amountOriginal: "1.0000", amountVnd: "25.50" },
      { currency: "USD", amountOriginal: "2.0000", amountVnd: "24.50" },
    ])).toStrictEqual({
      chargeCount: 3,
      totalVnd: "150.00",
      totalsByCurrency: [
        { currency: "VND", amountOriginal: "100.0000" },
        { currency: "USD", amountOriginal: "3.0000" },
      ],
    });
  });

  it("summarizes financial totals and gross profit", () => {
    expect(summarizeFinancialCharges([
      {
        section: "selling",
        currency: "VND",
        amountOriginal: "300.0000",
        amountVnd: "300.00",
      },
      {
        section: "buying",
        currency: "VND",
        amountOriginal: "120.0000",
        amountVnd: "120.00",
      },
    ])).toMatchObject({
      sellingChargeCount: 1,
      buyingChargeCount: 1,
      totalSellingVnd: "300.00",
      totalBuyingVnd: "120.00",
      grossProfitVnd: "180.00",
      sellingSubtotalExcludingVatVnd: "300.00",
      buyingSubtotalExcludingVatVnd: "120.00",
      grossProfitExcludingVatVnd: "180.00",
    });
  });

  it("summarizes tax totals from persisted per-line VAT amounts", () => {
    expect(summarizeFinancialCharges([
      {
        section: "selling",
        currency: "VND",
        amountOriginal: "100.0000",
        amountVnd: "100.00",
        vatAmount: "10.00",
      },
      {
        section: "buying",
        currency: "VND",
        amountOriginal: "40.0000",
        amountVnd: "40.00",
        vatAmount: "4.00",
      },
    ])).toMatchObject({
      sellingVatVnd: "10.00",
      sellingTotalIncludingVatVnd: "110.00",
      buyingVatVnd: "4.00",
      buyingTotalIncludingVatVnd: "44.00",
      grossProfitVnd: "60.00",
      grossProfitExcludingVatVnd: "60.00",
    });
  });

  it("supports negative and zero gross profit results", () => {
    expect(summarizeFinancialCharges([
      {
        section: "selling",
        currency: "VND",
        amountOriginal: "50.0000",
        amountVnd: "50.00",
      },
      {
        section: "buying",
        currency: "VND",
        amountOriginal: "75.0000",
        amountVnd: "75.00",
      },
    ]).grossProfitVnd).toBe("-25.00");

    expect(summarizeFinancialCharges([
      {
        section: "selling",
        currency: "VND",
        amountOriginal: "100.0000",
        amountVnd: "100.00",
      },
      {
        section: "buying",
        currency: "VND",
        amountOriginal: "100.0000",
        amountVnd: "100.00",
      },
    ]).grossProfitVnd).toBe("0.00");
  });
});
