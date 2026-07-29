import type { TaxTreatment } from "../constants";
import {
  calculateVatAmount,
  normalizeVatPercent,
} from "./calculations";
import type { ChargeTaxSnapshot, TaxCompletenessResult } from "./types";

type ChargeTaxCompletenessRow = ChargeTaxSnapshot & {
  amountVnd: string;
  deletedAt?: Date | null;
};

function isValidTreatment(value: string | null): value is TaxTreatment {
  return value === "taxable" ||
    value === "zero_rated" ||
    value === "non_taxable";
}

export function isChargeTaxComplete(
  charge: ChargeTaxCompletenessRow,
): boolean {
  if (charge.deletedAt) {
    return true;
  }

  if (
    !charge.taxRuleCodeSnapshot ||
    !charge.taxRuleNameSnapshot ||
    !isValidTreatment(charge.taxTreatmentSnapshot)
  ) {
    return false;
  }

  let normalizedPercent: string;

  try {
    normalizedPercent = normalizeVatPercent(charge.vatPercent);
  } catch {
    return false;
  }

  if (charge.vatPercent !== normalizedPercent) {
    return false;
  }

  const reason = charge.overrideReason?.trim() ?? "";

  if (charge.isOverride && reason.length === 0) {
    return false;
  }

  if (
    (charge.taxTreatmentSnapshot === "zero_rated" ||
      charge.taxTreatmentSnapshot === "non_taxable") &&
    (normalizedPercent !== "0.00" ||
      charge.vatAmount !== "0.00" ||
      charge.isOverride)
  ) {
    return false;
  }

  try {
    return charge.vatAmount === calculateVatAmount({
      amountVnd: charge.amountVnd,
      vatPercent: normalizedPercent,
      treatment: charge.taxTreatmentSnapshot,
    });
  } catch {
    return false;
  }
}

export function summarizeTaxCompleteness(
  charges: readonly ChargeTaxCompletenessRow[],
): TaxCompletenessResult {
  const unclassifiedChargeCount = charges.filter(
    (charge) => !isChargeTaxComplete(charge),
  ).length;

  return {
    taxComplete: unclassifiedChargeCount === 0,
    unclassifiedChargeCount,
  };
}

export const TAX_COMPLETENESS_ERROR =
  "All active charges must have a valid tax classification before the shipping note can be checked.";
