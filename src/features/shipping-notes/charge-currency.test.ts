import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  formatPositiveChargeExchangeRate,
  getExchangeRateAfterCurrencyChange,
} from "./charge-currency";
import { CURRENCY_CODES } from "./constants";

describe("charge currency behavior", () => {
  it("exposes only the canonical three-currency domain", () => {
    expect(CURRENCY_CODES).toEqual(["VND", "USD", "EUR"]);
  });

  it("formats the legacy note-level rate without floating-point conversion", () => {
    expect(formatPositiveChargeExchangeRate("25450.000000")).toBe("25450");
    expect(formatPositiveChargeExchangeRate("25450.125000")).toBe("25450.125");
    expect(formatPositiveChargeExchangeRate("0")).toBeNull();
    expect(formatPositiveChargeExchangeRate("invalid")).toBeNull();
  });

  it("uses the note-level rate only when switching a new Buying Charge to USD", () => {
    expect(getExchangeRateAfterCurrencyChange({
      previousCurrency: "VND",
      nextCurrency: "USD",
      currentExchangeRate: "1",
      usdDefaultExchangeRate: "25450.125000",
    })).toBe("25450.125");
  });

  it("never carries a foreign exchange rate across USD/EUR changes", () => {
    expect(getExchangeRateAfterCurrencyChange({
      previousCurrency: "USD",
      nextCurrency: "EUR",
      currentExchangeRate: "26000",
      usdDefaultExchangeRate: "25500",
    })).toBe("");
    expect(getExchangeRateAfterCurrencyChange({
      previousCurrency: "EUR",
      nextCurrency: "USD",
      currentExchangeRate: "28000",
    })).toBe("");
    expect(getExchangeRateAfterCurrencyChange({
      previousCurrency: "EUR",
      nextCurrency: "USD",
      currentExchangeRate: "28000",
      usdDefaultExchangeRate: "25500",
    })).toBe("25500");
  });

  it("forces VND to one and preserves an unchanged persisted foreign rate", () => {
    expect(getExchangeRateAfterCurrencyChange({
      previousCurrency: "EUR",
      nextCurrency: "VND",
      currentExchangeRate: "28000",
    })).toBe("1");
    expect(getExchangeRateAfterCurrencyChange({
      previousCurrency: "EUR",
      nextCurrency: "EUR",
      currentExchangeRate: "28000",
    })).toBe("28000");
  });
});

describe("charge form HTML constraints", () => {
  const formSources = [
    "./components/selling-charge-form.tsx",
    "./components/buying-charge-form.tsx",
    "./components/selling-charges-list.tsx",
    "./components/buying-charges-list.tsx",
  ].map((relativePath) =>
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  );

  it("allows signed Unit Price while retaining positive Quantity", () => {
    for (const source of formSources) {
      expect(source).not.toMatch(/name="unitPrice"[\s\S]{0,100}min="0"/);
      expect(source).toMatch(/name="quantity"[\s\S]{0,100}min="0\.001"/);
    }
  });

  it("keeps the positive exchange-rate constraint in the shared fields", () => {
    const source = readFileSync(
      new URL("./components/charge-currency-fields.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('min="0.000001"');
    expect(source).toContain('required={!isVnd}');
    expect(source).toContain('readOnly={isVnd}');
    expect(source).toContain("${currency}/VND Exchange Rate (Required)");
  });
});
