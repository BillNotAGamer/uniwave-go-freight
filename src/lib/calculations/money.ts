/**
 * Pure calculation helpers for shipping note charge amounts.
 *
 * All functions are pure and have no DB or auth dependencies.
 * Inputs are validated decimal strings from server-side schemas.
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
import {
  multiplyDecimalStrings,
  normalizeDecimalString,
  roundDecimalString,
  validateDecimalString,
} from "@/lib/calculations/decimal";

const QUANTITY_SCALE = 3;
const UNIT_PRICE_SCALE = 4;
const EXCHANGE_RATE_SCALE = 6;
const RAW_AMOUNT_ORIGINAL_SCALE = QUANTITY_SCALE + UNIT_PRICE_SCALE;
const AMOUNT_ORIGINAL_SCALE = 4;
const AMOUNT_VND_SCALE = 2;

const QUANTITY_INTEGER_DIGITS = 15;
const UNIT_PRICE_INTEGER_DIGITS = 14;
const EXCHANGE_RATE_INTEGER_DIGITS = 12;
const AMOUNT_ORIGINAL_INTEGER_DIGITS = 16;
const AMOUNT_VND_INTEGER_DIGITS = 18;

export type ChargeAmountInput = {
  quantity: string;
  unitPrice: string;
  currency: CurrencyCode;
  /**
   * Required for USD (must be positive).
   * Ignored for VND and always normalized to 1.000000.
   */
  exchangeRate?: string;
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

function normalizeQuantity(quantity: string): string {
  return normalizeDecimalString(
    validateDecimalString(quantity, {
      scale: QUANTITY_SCALE,
      maxIntegerDigits: QUANTITY_INTEGER_DIGITS,
      minimum: "positive",
    }),
    QUANTITY_SCALE,
  );
}

function normalizeUnitPrice(unitPrice: string): string {
  return normalizeDecimalString(
    validateDecimalString(unitPrice, {
      scale: UNIT_PRICE_SCALE,
      maxIntegerDigits: UNIT_PRICE_INTEGER_DIGITS,
      minimum: "nonNegative",
    }),
    UNIT_PRICE_SCALE,
  );
}

function assertAmountOriginalPrecision(amountOriginal: string): string {
  return normalizeDecimalString(
    validateDecimalString(amountOriginal, {
      scale: AMOUNT_ORIGINAL_SCALE,
      maxIntegerDigits: AMOUNT_ORIGINAL_INTEGER_DIGITS,
      minimum: "nonNegative",
    }),
    AMOUNT_ORIGINAL_SCALE,
  );
}

function assertAmountVndPrecision(amountVnd: string): string {
  return normalizeDecimalString(
    validateDecimalString(amountVnd, {
      scale: AMOUNT_VND_SCALE,
      maxIntegerDigits: AMOUNT_VND_INTEGER_DIGITS,
      minimum: "nonNegative",
    }),
    AMOUNT_VND_SCALE,
  );
}

/**
 * Normalize and validate the exchange rate for a given currency.
 *
 * VND: always returns 1 regardless of supplied value.
 * USD: requires a positive decimal string; throws if missing/invalid.
 */
export function normalizeExchangeRate(
  currency: CurrencyCode,
  exchangeRate?: string,
): string {
  if (currency === "VND") {
    return normalizeDecimalString("1", EXCHANGE_RATE_SCALE);
  }

  if (exchangeRate === undefined) {
    throw new Error(
      "Exchange rate is required and must be a positive decimal value for USD charges.",
    );
  }

  return normalizeDecimalString(
    validateDecimalString(exchangeRate, {
      scale: EXCHANGE_RATE_SCALE,
      maxIntegerDigits: EXCHANGE_RATE_INTEGER_DIGITS,
      minimum: "positive",
    }),
    EXCHANGE_RATE_SCALE,
  );
}

/**
 * Calculate charge amounts from validated decimal-string inputs.
 *
 * Returns database-ready strings at the schema-defined precision.
 * Throws if the exchange rate is invalid for USD.
 */
export function calculateChargeAmounts(
  input: ChargeAmountInput,
): ChargeAmountResult {
  const quantity = normalizeQuantity(input.quantity);
  const unitPrice = normalizeUnitPrice(input.unitPrice);
  const effectiveRate = normalizeExchangeRate(input.currency, input.exchangeRate);
  const rawAmountOriginal = multiplyDecimalStrings(
    quantity,
    QUANTITY_SCALE,
    unitPrice,
    UNIT_PRICE_SCALE,
    RAW_AMOUNT_ORIGINAL_SCALE,
  );

  const amountOriginal = assertAmountOriginalPrecision(
    roundDecimalString(
      rawAmountOriginal,
      RAW_AMOUNT_ORIGINAL_SCALE,
      AMOUNT_ORIGINAL_SCALE,
    ),
  );

  const amountVnd = assertAmountVndPrecision(
    input.currency === "VND"
      ? roundDecimalString(
          rawAmountOriginal,
          RAW_AMOUNT_ORIGINAL_SCALE,
          AMOUNT_VND_SCALE,
        )
      : multiplyDecimalStrings(
          rawAmountOriginal,
          RAW_AMOUNT_ORIGINAL_SCALE,
          effectiveRate,
          EXCHANGE_RATE_SCALE,
          AMOUNT_VND_SCALE,
        ),
  );

  return {
    quantity,
    unitPrice,
    exchangeRate: effectiveRate,
    amountOriginal,
    amountVnd,
  };
}
