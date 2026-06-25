/**
 * Pure calculation helpers for shipping note charge amounts.
 *
 * All functions are pure and have no DB or auth dependencies.
 * Inputs are typed JS values (from Zod-validated mutations).
 * Outputs are database-ready numeric strings matching schema precision.
 *
 * Schema precision:
 *   quantity        numeric(18,3)
 *   unitPrice       numeric(18,4)
 *   exchangeRate    numeric(18,6)
 *   amountOriginal  numeric(20,4)
 *   amountVnd       numeric(20,2)
 */

import type { CurrencyCode } from "@/features/shipping-notes/constants";

export type ChargeAmountInput = {
  quantity: number;
  unitPrice: number;
  currency: CurrencyCode;
  /**
   * Required for USD (must be positive).
   * Ignored for VND — always normalized to 1.
   */
  exchangeRate: number;
};

export type ChargeAmountResult = {
  /** Normalized quantity as DB string (3 decimal places). */
  quantity: string;
  /** Normalized unit price as DB string (4 decimal places). */
  unitPrice: string;
  /** Effective exchange rate as DB string (6 decimal places). */
  exchangeRate: string;
  /** amountOriginal = quantity * unitPrice (4 decimal places). */
  amountOriginal: string;
  /** amountVnd = amountOriginal for VND; amountOriginal * exchangeRate for USD (2 decimal places). */
  amountVnd: string;
};

/**
 * Normalize and validate the exchange rate for a given currency.
 *
 * VND: always returns 1 regardless of supplied value.
 * USD: requires a finite positive number; throws if missing/invalid.
 */
export function normalizeExchangeRate(
  currency: CurrencyCode,
  exchangeRate: number,
): number {
  if (currency === "VND") {
    return 1;
  }

  // USD — must be explicitly positive and finite.
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error(
      "Exchange rate is required and must be a positive number for USD charges.",
    );
  }

  return exchangeRate;
}

/**
 * Calculate charge amounts from validated numeric inputs.
 *
 * Returns database-ready strings at the schema-defined precision.
 * Throws if the exchange rate is invalid for USD.
 */
export function calculateChargeAmounts(
  input: ChargeAmountInput,
): ChargeAmountResult {
  const effectiveRate = normalizeExchangeRate(input.currency, input.exchangeRate);

  const amountOriginal = input.quantity * input.unitPrice;
  const amountVnd =
    input.currency === "VND" ? amountOriginal : amountOriginal * effectiveRate;

  return {
    quantity: input.quantity.toFixed(3),
    unitPrice: input.unitPrice.toFixed(4),
    exchangeRate: effectiveRate.toFixed(6),
    amountOriginal: amountOriginal.toFixed(4),
    amountVnd: amountVnd.toFixed(2),
  };
}
