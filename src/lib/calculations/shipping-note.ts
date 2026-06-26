import type { SellingChargeSummary } from "@/features/shipping-notes/types";

type ChargeRow = {
  currency: "VND" | "USD";
  amountOriginal: string;
  amountVnd: string;
};

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

/**
 * Pure calculation helper for summarizing selling charges.
 * Computes the total VND and original amounts by currency.
 * Returns deterministic database-ready string formats (not display strings).
 */
export function summarizeSellingCharges(
  charges: ChargeRow[]
): SellingChargeSummary {
  const totalVndValues: string[] = [];
  const originalValuesByCurrency: Record<"VND" | "USD", string[]> = {
    VND: [],
    USD: [],
  };

  for (const charge of charges) {
    totalVndValues.push(charge.amountVnd);
    originalValuesByCurrency[charge.currency].push(charge.amountOriginal);
  }

  return {
    chargeCount: charges.length,
    totalVnd: addDecimalStrings(totalVndValues, 2),
    totalsByCurrency: [
      {
        currency: "VND",
        amountOriginal: addDecimalStrings(originalValuesByCurrency.VND, 4),
      },
      {
        currency: "USD",
        amountOriginal: addDecimalStrings(originalValuesByCurrency.USD, 4),
      },
    ],
  };
}
