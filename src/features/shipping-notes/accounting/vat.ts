import type { TaxTreatment } from "../constants";
import {
  assertTaxTreatmentPercentConsistency,
  calculateVatAmount,
  normalizeVatPercent,
} from "../tax/calculations";

export const ACCOUNTING_VAT_OVERRIDE_RATES = [0, 5, 8, 10] as const;

export type AccountingVatRate =
  (typeof ACCOUNTING_VAT_OVERRIDE_RATES)[number];

export function isAccountingVatRate(value: number): value is AccountingVatRate {
  return ACCOUNTING_VAT_OVERRIDE_RATES.some((rate) => rate === value);
}

export function parseAccountingVatRate(
  value: string | number | null | undefined,
): AccountingVatRate | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || !isAccountingVatRate(numericValue)) {
    throw new Error("VAT rate must be one of 0, 5, 8, or 10.");
  }

  return numericValue;
}

export function getEffectiveAccountingVatRate(input: {
  taxRuleVatRate: string | number | null;
  vatOverrideRate: string | number | null;
}): string | null {
  const override = parseAccountingVatRate(input.vatOverrideRate);
  if (override !== null) {
    return normalizeVatPercent(String(override));
  }

  return input.taxRuleVatRate === null
    ? null
    : normalizeVatPercent(String(input.taxRuleVatRate));
}

export function getPersistedChargeAccountingVat(input: {
  taxRuleId: string | null;
  vatPercent: string | number;
  vatOverrideRate: string | number | null;
  isOverride: boolean;
}): {
  accountingBaselineVatRate: string | null;
  effectiveAccountingVatRate: string | null;
} {
  if (!input.taxRuleId) {
    return {
      accountingBaselineVatRate: null,
      effectiveAccountingVatRate: null,
    };
  }

  const appliedRate = normalizeVatPercent(String(input.vatPercent));
  const overrideRate = parseAccountingVatRate(input.vatOverrideRate);
  const normalizedOverrideRate = overrideRate === null
    ? null
    : normalizeVatPercent(String(overrideRate));
  if (normalizedOverrideRate !== null && normalizedOverrideRate !== appliedRate) {
    throw new Error("Persisted VAT override does not match applied VAT percent.");
  }

  const accountingBaselineVatRate = input.isOverride ? null : appliedRate;
  return {
    accountingBaselineVatRate,
    // vat_percent is the existing persisted final-applied Accounting rate.
    // Keeping it authoritative also preserves legacy overrides created before
    // vat_override_rate existed.
    effectiveAccountingVatRate: appliedRate,
  };
}

export function buildTaxRuleAccountingVat(input: {
  amountVnd: string;
  taxTreatment: TaxTreatment;
  taxRuleVatRate: string;
}) {
  const vatPercent = assertTaxTreatmentPercentConsistency(
    input.taxTreatment,
    input.taxRuleVatRate,
  );
  return {
    vatPercent,
    vatAmount: calculateVatAmount({
      amountVnd: input.amountVnd,
      vatPercent,
      treatment: input.taxTreatment,
    }),
    vatOverrideRate: null,
    isOverride: false,
    overrideReason: null,
  } as const;
}

export function buildAccountingVatOverride(input: {
  amountVnd: string;
  vatOverrideRate: string | number;
  reason: string;
}) {
  const override = parseAccountingVatRate(input.vatOverrideRate);
  if (override === null) {
    throw new Error("VAT override is required.");
  }
  const vatPercent = normalizeVatPercent(String(override));
  return {
    vatPercent,
    vatAmount: calculateVatAmount({
      amountVnd: input.amountVnd,
      vatPercent,
      treatment: "taxable",
    }),
    vatOverrideRate: vatPercent,
    isOverride: true,
    overrideReason: input.reason.trim(),
  } as const;
}
