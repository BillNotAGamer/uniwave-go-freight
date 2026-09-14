import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({ createBuyingChargeAction: vi.fn() }));
vi.mock("./charge-catalog-selector", () => ({
  ChargeCatalogSelector: () => null,
}));

import { BuyingChargeForm } from "./buying-charge-form";

function exchangeRateInputValue(defaultExchangeRate?: string | null): string {
  const html = renderToStaticMarkup(createElement(BuyingChargeForm, {
    shippingNoteId: "note-1",
    canManageBuyingCharges: true,
    defaultExchangeRate,
  }));
  const exchangeRateInput = html.match(/<input[^>]*name="exchangeRate"[^>]*value="([^"]*)"/);

  if (!exchangeRateInput?.[1]) throw new Error("Buying Charge exchange rate input was not rendered.");
  return exchangeRateInput[1];
}

describe("BuyingChargeForm exchange-rate prefill", () => {
  it("uses the Shipping Note rate for a new Buying Charge without floating-point conversion", () => {
    expect(exchangeRateInputValue("25450.000000")).toBe("25450");
    expect(exchangeRateInputValue("25450.125000")).toBe("25450.125");
  });

  it.each([
    [undefined, "1"],
    [null, "1"],
    ["1.000000", "1"],
    ["0", "1"],
    ["-1.000000", "1"],
    ["invalid", "1"],
  ] as const)("falls back safely from %s to %s", (defaultExchangeRate, expected) => {
    expect(exchangeRateInputValue(defaultExchangeRate)).toBe(expected);
  });

  it("keeps existing Buying Charge editing bound to the charge's own saved rate", () => {
    const source = readFileSync(new URL("./buying-charges-list.tsx", import.meta.url), "utf8");

    expect(source).toContain("defaultValue={charge.exchangeRate}");
    expect(source).not.toContain("defaultExchangeRate");
  });
});
