import { describe, expect, it } from "vitest";

import { calculateChargeAmounts, normalizeExchangeRate } from "./money";

describe("charge money calculations", () => {
  it("calculates VND charges and forces exchange rate to one", () => {
    expect(calculateChargeAmounts({
      quantity: "2.500",
      unitPrice: "10.1250",
      currency: "VND",
      exchangeRate: "999.000000",
    })).toStrictEqual({
      quantity: "2.500",
      unitPrice: "10.1250",
      exchangeRate: "1.000000",
      amountOriginal: "25.3125",
      amountVnd: "25.31",
    });
  });

  it("rounds VND amounts half up to two decimals", () => {
    expect(calculateChargeAmounts({
      quantity: "1.000",
      unitPrice: "1.0050",
      currency: "VND",
    }).amountVnd).toBe("1.01");
    expect(calculateChargeAmounts({
      quantity: "1.000",
      unitPrice: "1.0049",
      currency: "VND",
    }).amountVnd).toBe("1.00");
  });

  it("calculates USD amount VND from original amount and exchange rate", () => {
    expect(calculateChargeAmounts({
      quantity: "2.000",
      unitPrice: "10.0000",
      currency: "USD",
      exchangeRate: "25000.000000",
    })).toStrictEqual({
      quantity: "2.000",
      unitPrice: "10.0000",
      exchangeRate: "25000.000000",
      amountOriginal: "20.0000",
      amountVnd: "500000.00",
    });
  });

  it.each([
    {
      label: "VND signed amount",
      input: {
        quantity: "2.000",
        unitPrice: "-10.1250",
        currency: "VND" as const,
      },
      expectedOriginal: "-20.2500",
      expectedVnd: "-20.25",
    },
    {
      label: "VND negative half-up boundary",
      input: {
        quantity: "1.000",
        unitPrice: "-0.0050",
        currency: "VND" as const,
      },
      expectedOriginal: "-0.0050",
      expectedVnd: "-0.01",
    },
    {
      label: "USD signed conversion",
      input: {
        quantity: "3.000",
        unitPrice: "-1.2345",
        currency: "USD" as const,
        exchangeRate: "25000.000000",
      },
      expectedOriginal: "-3.7035",
      expectedVnd: "-92587.50",
    },
    {
      label: "EUR signed conversion",
      input: {
        quantity: "0.125",
        unitPrice: "-0.1000",
        currency: "EUR" as const,
        exchangeRate: "28000.000000",
      },
      expectedOriginal: "-0.0125",
      expectedVnd: "-350.00",
    },
  ])("calculates $label exactly", ({ input, expectedOriginal, expectedVnd }) => {
    const result = calculateChargeAmounts(input);

    expect(result.amountOriginal).toBe(expectedOriginal);
    expect(result.amountVnd).toBe(expectedVnd);
  });

  it("allows zero unit price but rejects zero quantity", () => {
    expect(calculateChargeAmounts({
      quantity: "1.000",
      unitPrice: "0",
      currency: "VND",
    }).amountVnd).toBe("0.00");
    expect(() => calculateChargeAmounts({
      quantity: "0.000",
      unitPrice: "1.0000",
      currency: "VND",
    })).toThrow(/must be positive/);
  });

  it("requires positive USD and EUR exchange rates", () => {
    expect(() => normalizeExchangeRate("USD")).toThrow(/Exchange rate is required/);
    expect(() => normalizeExchangeRate("USD", "0")).toThrow(/must be positive/);
    expect(normalizeExchangeRate("USD", "001.250000")).toBe("1.250000");
    expect(() => normalizeExchangeRate("EUR")).toThrow(/EUR charges/);
    expect(() => normalizeExchangeRate("EUR", "-1")).toThrow(
      /must be positive|not allowed/,
    );
    expect(normalizeExchangeRate("EUR", "28000")).toBe("28000.000000");
    expect(normalizeExchangeRate("VND", "99999")).toBe("1.000000");
  });

  it("preserves large supported negative values without sign loss", () => {
    expect(calculateChargeAmounts({
      quantity: "1.000",
      unitPrice: "-99999999999999.9999",
      currency: "VND",
    })).toMatchObject({
      unitPrice: "-99999999999999.9999",
      amountOriginal: "-99999999999999.9999",
      amountVnd: "-100000000000000.00",
    });
  });

  it("rejects decimals outside schema precision and supported magnitude", () => {
    expect(() => calculateChargeAmounts({
      quantity: "1.0001",
      unitPrice: "1.0000",
      currency: "VND",
    })).toThrow(/Expected at most 3 decimal places/);
    expect(() => calculateChargeAmounts({
      quantity: "1.000",
      unitPrice: "100000000000000.0000",
      currency: "VND",
    })).toThrow(/exceeds maximum supported digits/);
  });
});
