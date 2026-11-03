import type {
  ChargeSection,
  ShippingMode,
  TaxTreatment,
} from "../constants";

export type DefaultTaxRuleCandidate = {
  id: string;
  code: string;
  name: string;
  shippingMode: ShippingMode;
  chargeSection: ChargeSection;
  chargeNamePattern: string;
  taxTreatment: TaxTreatment;
  vatPercent: string;
  isActive: boolean;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
};

export type ChargeTaxDefaultCategory = "freight_zero" | "standard_eight";

const FREIGHT_ZERO_CODE_PREFIXES = [
  "AF",
  "AIR-FREIGHT",
  "AIRFREIGHT",
  "OF",
  "OCEAN-FREIGHT",
  "OCEANFREIGHT",
  "SEA-FREIGHT",
  "SEAFREIGHT",
] as const;

function normalizeCatalogCode(code: string): string {
  return code.trim().toUpperCase().replace(/[_\s]+/g, "-");
}

function hasStablePrefix(code: string, prefix: string): boolean {
  return code === prefix || code.startsWith(`${prefix}-`);
}

export function classifyChargeTaxDefault(input: {
  catalogCode: string | null;
  catalogVatRate: string | null;
}): ChargeTaxDefaultCategory | null {
  if (!input.catalogCode) {
    return null;
  }

  const code = normalizeCatalogCode(input.catalogCode);
  if (FREIGHT_ZERO_CODE_PREFIXES.some((prefix) => hasStablePrefix(code, prefix))) {
    return "freight_zero";
  }

  return Number(input.catalogVatRate) === 8 ? "standard_eight" : null;
}

export function doesTaxRulePatternMatch(pattern: string, stableCode: string): boolean {
  const normalizedPattern = pattern.trim().toUpperCase();
  if (normalizedPattern === "*") {
    return true;
  }

  const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`, "u").test(stableCode);
}

function isEffective(rule: DefaultTaxRuleCandidate, at: Date): boolean {
  return (
    rule.isActive &&
    (!rule.effectiveFrom || rule.effectiveFrom <= at) &&
    (!rule.effectiveTo || rule.effectiveTo >= at)
  );
}

export function resolveDefaultTaxRule(input: {
  catalogCode: string | null;
  catalogVatRate: string | null;
  shippingMode: ShippingMode;
  chargeSection: ChargeSection;
  rules: readonly DefaultTaxRuleCandidate[];
  at: Date;
}): DefaultTaxRuleCandidate | null {
  const category = classifyChargeTaxDefault(input);
  if (!category || !input.catalogCode) {
    return null;
  }

  const stableCode = normalizeCatalogCode(input.catalogCode);
  const matches = input.rules.filter((rule) => {
    if (
      !isEffective(rule, input.at) ||
      rule.shippingMode !== input.shippingMode ||
      rule.chargeSection !== input.chargeSection ||
      !doesTaxRulePatternMatch(rule.chargeNamePattern, stableCode)
    ) {
      return false;
    }

    return category === "freight_zero"
      ? rule.taxTreatment === "zero_rated" && Number(rule.vatPercent) === 0
      : rule.taxTreatment === "taxable" && Number(rule.vatPercent) === 8;
  });

  return matches.length === 1 ? matches[0] ?? null : null;
}
