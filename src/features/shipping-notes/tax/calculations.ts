import type { TaxTreatment } from "../constants";
import {
  addDecimalStrings,
  formatScaledInteger,
  parseDecimalToScaledInteger,
  roundScaledIntegerHalfUp,
  validateDecimalString,
} from "@/lib/calculations/decimal";

const AMOUNT_VND_SCALE = 2;
const VAT_PERCENT_SCALE = 2;
const VAT_AMOUNT_SCALE = 2;
const VAT_PERCENT_INTEGER_DIGITS = 4;
const VAT_AMOUNT_INTEGER_DIGITS = 18;

export type TaxCalculationInput = {
  amountVnd: string;
  vatPercent: string;
  treatment: TaxTreatment;
};

export function normalizeVatPercent(value: string): string {
  const normalized = validateDecimalString(value, {
    scale: VAT_PERCENT_SCALE,
    maxIntegerDigits: VAT_PERCENT_INTEGER_DIGITS,
    minimum: "nonNegative",
  });

  const scaled = parseDecimalToScaledInteger(normalized, VAT_PERCENT_SCALE);
  return formatScaledInteger(scaled, VAT_PERCENT_SCALE);
}

function normalizeAmountVnd(value: string): string {
  const normalized = validateDecimalString(value, {
    scale: AMOUNT_VND_SCALE,
    maxIntegerDigits: VAT_AMOUNT_INTEGER_DIGITS,
    minimum: "nonNegative",
  });

  return formatScaledInteger(
    parseDecimalToScaledInteger(normalized, AMOUNT_VND_SCALE),
    AMOUNT_VND_SCALE,
  );
}

function assertZeroPercent(vatPercent: string, treatment: TaxTreatment): void {
  if (parseDecimalToScaledInteger(vatPercent, VAT_PERCENT_SCALE) !== BigInt(0)) {
    throw new Error(`${treatment} tax treatment requires a 0.00 VAT percentage.`);
  }
}

export function assertTaxTreatmentPercentConsistency(
  treatment: TaxTreatment,
  vatPercent: string,
): string {
  const normalizedPercent = normalizeVatPercent(vatPercent);

  if (treatment === "zero_rated" || treatment === "non_taxable") {
    assertZeroPercent(normalizedPercent, treatment);
  }

  return normalizedPercent;
}

export function calculateVatAmount({
  amountVnd,
  vatPercent,
  treatment,
}: TaxCalculationInput): string {
  const normalizedAmount = normalizeAmountVnd(amountVnd);
  const normalizedPercent = assertTaxTreatmentPercentConsistency(
    treatment,
    vatPercent,
  );

  if (treatment === "zero_rated" || treatment === "non_taxable") {
    return "0.00";
  }

  const amount = parseDecimalToScaledInteger(normalizedAmount, AMOUNT_VND_SCALE);
  const percent = parseDecimalToScaledInteger(
    normalizedPercent,
    VAT_PERCENT_SCALE,
  );
  const product = amount * percent;

  return formatScaledInteger(
    roundScaledIntegerHalfUp(
      product,
      AMOUNT_VND_SCALE + VAT_PERCENT_SCALE + 2,
      VAT_AMOUNT_SCALE,
    ),
    VAT_AMOUNT_SCALE,
  );
}

export function calculateLineTotalIncludingVat(
  amountVnd: string,
  vatAmount: string,
): string {
  return addDecimalStrings([
    normalizeAmountVnd(amountVnd),
    normalizeAmountVnd(vatAmount),
  ], VAT_AMOUNT_SCALE);
}
