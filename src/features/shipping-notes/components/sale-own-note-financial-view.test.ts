import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SaleOwnNoteFinancialView } from "./sale-own-note-financial-view";

describe("SaleOwnNoteFinancialView", () => {
  it("renders the narrow read-only multi-currency Buying Rate and Gross Profit view", () => {
    const html = renderToStaticMarkup(createElement(SaleOwnNoteFinancialView, {
      data: {
        buyingRates: [
          {
            id: "buying-1",
            chargeName: "Ocean Freight",
            description: "Carrier charge",
            quantity: "2.000",
            unit: "shipment",
            unitPrice: "125.5000",
            currency: "USD",
            amountOriginal: "251.0000",
          },
          {
            id: "buying-2",
            chargeName: "Documentation credit",
            description: null,
            quantity: "1.000",
            unit: "document",
            unitPrice: "-10.0000",
            currency: "EUR",
            amountOriginal: "-10.0000",
          },
        ],
        grossProfitVnd: "1250000.50",
      },
    }));

    expect(html).toContain("Own-note financial view");
    expect(html).toContain("Buying Rate &amp; Gross Profit");
    expect(html).toContain("125.50 USD");
    expect(html).toContain("251.00 USD");
    expect(html).toContain("-10.00 EUR");
    expect(html).toContain("1,250,000.50 VND");
    expect(html).toContain("Gross Profit excluding VAT (VND)");
    expect(html).not.toContain("Edit");
    expect(html).not.toContain("Delete");
    expect(html).not.toContain("Tax Rule");
    expect(html).not.toContain("Vendor");
  });

  it("shows an explicit empty state without implying broader authorization", () => {
    const html = renderToStaticMarkup(createElement(SaleOwnNoteFinancialView, {
      data: { buyingRates: [], grossProfitVnd: "0.00" },
    }));

    expect(html).toContain("No Buying Rates have been recorded");
    expect(html).toContain("0.00 VND");
  });
});
