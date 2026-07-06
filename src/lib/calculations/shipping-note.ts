import {
  CURRENCY_CODES,
  type CurrencyCode,
} from "@/features/shipping-notes/constants";
import type {
  FinancialCurrencyTotal,
  FinancialSummary,
  FinancialSummaryChargeRow,
  SellingChargeSummary,
} from "@/features/shipping-notes/types";

type SellingSummaryChargeRow = Pick<
  FinancialSummaryChargeRow,
  "currency" | "amountOriginal" | "amountVnd"
>;

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

function parseDecimalToScaledInteger(value: string, scale: number): bigint {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new Error(`Invalid decimal value: "${value}".`);
  }

  const isNegative = value.startsWith("-");
  const unsignedValue = isNegative ? value.slice(1) : value;
  const [integerPart, fractionalPart = ""] = unsignedValue.split(".");

  if (fractionalPart.length > scale) {
    throw new Error(
      `Invalid decimal precision for "${value}". Expected at most ${scale} decimal places.`,
    );
  }

  const paddedFraction = fractionalPart.padEnd(scale, "0");
  const scaledValue = BigInt(`${integerPart}${paddedFraction}`);

  return isNegative ? scaledValue * BigInt(-1) : scaledValue;
}

function formatScaledInteger(value: bigint, scale: number): string {
  const isNegative = value < BigInt(0);
  const absoluteValue = isNegative ? value * BigInt(-1) : value;
  const scaleFactor = BigInt(10) ** BigInt(scale);
  const integerPart = absoluteValue / scaleFactor;
  const fractionalPart = (absoluteValue % scaleFactor)
    .toString()
    .padStart(scale, "0");

  return `${isNegative ? "-" : ""}${integerPart.toString()}.${fractionalPart}`;
}

function addDecimalStrings(values: readonly string[], scale: number): string {
  let total = BigInt(0);

  for (const value of values) {
    total += parseDecimalToScaledInteger(value, scale);
  }

  return formatScaledInteger(total, scale);
}

function subtractDecimalStrings(
  left: string,
  right: string,
  scale: number,
): string {
  const difference =
    parseDecimalToScaledInteger(left, scale) -
    parseDecimalToScaledInteger(right, scale);

  return formatScaledInteger(difference, scale);
}

function createCurrencyBuckets(): Record<CurrencyCode, string[]> {
  return {
    VND: [],
    USD: [],
  };
}

function buildCurrencyTotals(
  buckets: Record<CurrencyCode, readonly string[]>,
): FinancialCurrencyTotal[] {
  return CURRENCY_CODES.map((currency) => ({
    currency,
    amountOriginal: addDecimalStrings(buckets[currency], 4),
  }));
}

/**
 * Pure calculation helper for summarizing selling charges.
 * Computes the total VND and original amounts by currency.
 * Returns deterministic database-ready string formats (not display strings).
 */
export function summarizeSellingCharges(
  charges: readonly SellingSummaryChargeRow[],
): SellingChargeSummary {
  const totalVndValues: string[] = [];
  const originalValuesByCurrency = createCurrencyBuckets();

  for (const charge of charges) {
    totalVndValues.push(charge.amountVnd);
    originalValuesByCurrency[charge.currency].push(charge.amountOriginal);
  }

  return {
    chargeCount: charges.length,
    totalVnd: addDecimalStrings(totalVndValues, 2),
    totalsByCurrency: buildCurrencyTotals(originalValuesByCurrency),
  };
}

/**
 * Pure calculation helper for accountant/admin financial summary totals.
 * Computes selling, buying, and gross profit using database-ready strings.
 */
export function summarizeFinancialCharges(
  charges: readonly FinancialSummaryChargeRow[],
): FinancialSummary {
  const sellingVndValues: string[] = [];
  const buyingVndValues: string[] = [];
  const sellingOriginalValuesByCurrency = createCurrencyBuckets();
  const buyingOriginalValuesByCurrency = createCurrencyBuckets();

  let sellingChargeCount = 0;
  let buyingChargeCount = 0;

  for (const charge of charges) {
    if (charge.section === "selling") {
      sellingChargeCount += 1;
      sellingVndValues.push(charge.amountVnd);
      sellingOriginalValuesByCurrency[charge.currency].push(charge.amountOriginal);
      continue;
    }

    buyingChargeCount += 1;
    buyingVndValues.push(charge.amountVnd);
    buyingOriginalValuesByCurrency[charge.currency].push(charge.amountOriginal);
  }

  const totalSellingVnd = addDecimalStrings(sellingVndValues, 2);
  const totalBuyingVnd = addDecimalStrings(buyingVndValues, 2);

  return {
    sellingChargeCount,
    buyingChargeCount,
    totalSellingVnd,
    totalBuyingVnd,
    grossProfitVnd: subtractDecimalStrings(totalSellingVnd, totalBuyingVnd, 2),
    sellingTotalsByCurrency: buildCurrencyTotals(sellingOriginalValuesByCurrency),
    buyingTotalsByCurrency: buildCurrencyTotals(buyingOriginalValuesByCurrency),
  };
}
