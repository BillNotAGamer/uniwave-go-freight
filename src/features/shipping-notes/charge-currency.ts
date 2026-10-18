import type { CurrencyCode } from "./constants";
import { validateDecimalString } from "@/lib/calculations/decimal";

export function formatPositiveChargeExchangeRate(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;

  try {
    const normalized = validateDecimalString(value, {
      scale: 6,
      maxIntegerDigits: 12,
      minimum: "positive",
    });
    const [integerPart, fractionalPart = ""] = normalized.split(".");
    const significantFraction = fractionalPart.replace(/0+$/, "");

    return significantFraction.length > 0
      ? `${integerPart}.${significantFraction}`
      : integerPart;
  } catch {
    return null;
  }
}

export function getExchangeRateAfterCurrencyChange({
  previousCurrency,
  nextCurrency,
  currentExchangeRate,
  usdDefaultExchangeRate,
}: {
  previousCurrency: CurrencyCode;
  nextCurrency: CurrencyCode;
  currentExchangeRate: string;
  usdDefaultExchangeRate?: string | null;
}): string {
  if (nextCurrency === previousCurrency) {
    return currentExchangeRate;
  }

  if (nextCurrency === "VND") {
    return "1";
  }

  if (nextCurrency === "USD") {
    return formatPositiveChargeExchangeRate(usdDefaultExchangeRate) ?? "";
  }

  // EUR must always start blank; an explicit EUR/VND rate is required.
  return "";
}
