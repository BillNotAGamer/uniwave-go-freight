import type { TaxTreatment } from "../constants";
import {
  assertTaxTreatmentPercentConsistency,
  calculateVatAmount,
} from "./calculations";
import type { ChargeTaxSnapshot, TaxCompletenessResult } from "./types";

type ChargeTaxCompletenessRow = ChargeTaxSnapshot & {
  section: "selling" | "buying";
  amountVnd: string;
  deletedAt?: Date | null;
};

function isValidTreatment(value: string | null): value is TaxTreatment {
  return value === "taxable" ||
    value === "zero_rated" ||
    value === "non_taxable";
}

function getDecisionSource(
  charge: ChargeTaxCompletenessRow,
): "tax_rule" | "manual" | null {
  if (charge.taxDecisionSource) {
    return charge.taxDecisionSource;
  }

  return charge.taxRuleId ? "tax_rule" : null;
}

export function getChargeTaxIncompleteReason(
  charge: ChargeTaxCompletenessRow,
): string | null {
  if (charge.deletedAt) {
    return null;
  }

  const source = getDecisionSource(charge);
  if (!source || !isValidTreatment(charge.taxTreatmentSnapshot)) {
    return "No valid tax classification has been persisted.";
  }

  if (source === "tax_rule") {
    if (
      !charge.taxRuleId ||
      !charge.taxRuleCodeSnapshot ||
      !charge.taxRuleNameSnapshot ||
      charge.taxDecisionReason
    ) {
      return "The Tax Rule evidence is incomplete or conflicts with a manual decision.";
    }

    if (
      charge.taxDecisionSource === "tax_rule" &&
      (!charge.taxDecisionById || !charge.taxDecisionAt)
    ) {
      return "The Tax Rule decision actor or timestamp is missing.";
    }
  } else {
    if (
      charge.taxRuleId ||
      charge.taxRuleCodeSnapshot ||
      charge.taxRuleNameSnapshot ||
      !charge.taxDecisionReason?.trim() ||
      !charge.taxDecisionById ||
      !charge.taxDecisionAt ||
      charge.isOverride ||
      charge.vatOverrideRate
    ) {
      return "The manual Accounting decision evidence is incomplete or conflicting.";
    }
  }

  let normalizedPercent: string;

  try {
    normalizedPercent = assertTaxTreatmentPercentConsistency(
      charge.taxTreatmentSnapshot,
      charge.vatPercent,
    );
  } catch {
    return "The tax treatment and VAT percentage are inconsistent.";
  }

  if (charge.vatPercent !== normalizedPercent) {
    return "The persisted VAT percentage is not canonical.";
  }

  const reason = charge.overrideReason?.trim() ?? "";

  if (charge.isOverride && reason.length === 0) {
    return "The VAT override reason is missing.";
  }

  if (
    (charge.taxTreatmentSnapshot === "zero_rated" ||
      charge.taxTreatmentSnapshot === "non_taxable") &&
    (normalizedPercent !== "0.00" ||
      charge.vatAmount !== "0.00" ||
      charge.isOverride)
  ) {
    return "Zero-rated and non-taxable charges must persist zero VAT without an override.";
  }

  try {
    if (charge.vatAmount !== calculateVatAmount({
      amountVnd: charge.amountVnd,
      vatPercent: normalizedPercent,
      treatment: charge.taxTreatmentSnapshot,
    })) {
      return "The persisted VAT amount does not match the classified charge.";
    }
  } catch {
    return "The VAT amount cannot be verified from the persisted charge.";
  }

  if (charge.section === "selling") {
    return charge.inputVatInvoiceStatus ||
      charge.inputVatInvoiceReference ||
      charge.inputVatDeductible !== null
      ? "Selling charges cannot carry input VAT invoice evidence."
      : null;
  }

  if (charge.inputVatInvoiceStatus === "missing") {
    return "The input VAT invoice is missing; no closure exception is configured.";
  }

  if (charge.inputVatInvoiceStatus !== "available") {
    return "Input VAT invoice availability has not been confirmed.";
  }

  if (!charge.inputVatInvoiceReference?.trim()) {
    return "The available input VAT invoice needs an evidence reference.";
  }

  if (charge.inputVatDeductible === null) {
    return "Accounting has not confirmed input VAT deduction eligibility.";
  }

  if (
    charge.inputVatDeductible &&
    (charge.taxTreatmentSnapshot !== "taxable" ||
      Number(normalizedPercent) <= 0)
  ) {
    return "Input VAT cannot be recorded as deductible for this treatment and rate.";
  }

  return null;
}

export function isChargeTaxComplete(
  charge: ChargeTaxCompletenessRow,
): boolean {
  return getChargeTaxIncompleteReason(charge) === null;
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
