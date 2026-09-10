import {
  CURRENCY_CODES,
  type CurrencyCode,
} from "@/features/shipping-notes/constants";
import {
  addDecimalStrings,
  subtractDecimalStrings,
} from "@/lib/calculations/decimal";
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
  const sellingVatValues: string[] = [];
  const buyingVatValues: string[] = [];
  const sellingOriginalValuesByCurrency = createCurrencyBuckets();
  const buyingOriginalValuesByCurrency = createCurrencyBuckets();

  let sellingChargeCount = 0;
  let buyingChargeCount = 0;

  for (const charge of charges) {
    if (charge.section === "selling") {
      sellingChargeCount += 1;
      sellingVndValues.push(charge.amountVnd);
      sellingVatValues.push(charge.vatAmount ?? "0.00");
      sellingOriginalValuesByCurrency[charge.currency].push(charge.amountOriginal);
      continue;
    }

    buyingChargeCount += 1;
    buyingVndValues.push(charge.amountVnd);
    buyingVatValues.push(charge.vatAmount ?? "0.00");
    buyingOriginalValuesByCurrency[charge.currency].push(charge.amountOriginal);
  }

  const totalSellingVnd = addDecimalStrings(sellingVndValues, 2);
  const totalBuyingVnd = addDecimalStrings(buyingVndValues, 2);
  const sellingVatVnd = addDecimalStrings(sellingVatValues, 2);
  const buyingVatVnd = addDecimalStrings(buyingVatValues, 2);

  return {
    sellingChargeCount,
    buyingChargeCount,
    totalSellingVnd,
    totalBuyingVnd,
    grossProfitVnd: subtractDecimalStrings(totalSellingVnd, totalBuyingVnd, 2),
    sellingSubtotalExcludingVatVnd: totalSellingVnd,
    sellingVatVnd,
    sellingTotalIncludingVatVnd: addDecimalStrings([totalSellingVnd, sellingVatVnd], 2),
    buyingSubtotalExcludingVatVnd: totalBuyingVnd,
    buyingVatVnd,
    buyingTotalIncludingVatVnd: addDecimalStrings([totalBuyingVnd, buyingVatVnd], 2),
    grossProfitExcludingVatVnd: subtractDecimalStrings(totalSellingVnd, totalBuyingVnd, 2),
    sellingTotalsByCurrency: buildCurrencyTotals(sellingOriginalValuesByCurrency),
    buyingTotalsByCurrency: buildCurrencyTotals(buyingOriginalValuesByCurrency),
  };
}
