import type {
  ChargeSection,
  ShippingNoteStatus,
  TaxTreatment,
} from "../constants";
import type { ChargeTaxDetail } from "./types";
import type { TaxRuleDetail } from "@/features/tax-rules/types";
import type { Role } from "@/lib/permissions/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  taxable: "Taxable",
  zero_rated: "Zero-rated",
  non_taxable: "Non-taxable",
};

export type TaxCapability = {
  canReadTax: boolean;
  canAssignTax: boolean;
  canOverrideTax: boolean;
  canManageTaxRules: boolean;
};

export function getTaxCapability(role: Role): TaxCapability {
  return {
    canReadTax: hasPermission(role, PERMISSIONS.TAX_SUMMARY_READ),
    canAssignTax: hasPermission(role, PERMISSIONS.CHARGE_TAX_ASSIGN),
    canOverrideTax: hasPermission(role, PERMISSIONS.CHARGE_TAX_OVERRIDE),
    canManageTaxRules: hasPermission(role, PERMISSIONS.TAX_RULES_MANAGE),
  };
}

export function isTaxMutableStatus(status: ShippingNoteStatus): boolean {
  return status === "submitted" || status === "accounting_reviewing";
}

export function canShowTaxMutationControls(input: {
  role: Role;
  status: ShippingNoteStatus;
}): boolean {
  const capability = getTaxCapability(input.role);
  return capability.canAssignTax && isTaxMutableStatus(input.status);
}

export function getTaxTreatmentLabel(
  treatment: TaxTreatment | null,
): string {
  return treatment ? TAX_TREATMENT_LABELS[treatment] : "Unclassified";
}

export function getChargeTaxBadges(charge: ChargeTaxDetail): string[] {
  const badges = [getTaxTreatmentLabel(charge.taxTreatmentSnapshot)];

  if (charge.isOverride) {
    badges.push("Override");
  }

  if (!charge.taxComplete && !charge.taxTreatmentSnapshot) {
    return ["Unclassified"];
  }

  return badges;
}

export function canOverrideChargeTax(input: {
  role: Role;
  status: ShippingNoteStatus;
  charge: ChargeTaxDetail;
}): boolean {
  const capability = getTaxCapability(input.role);
  return (
    capability.canOverrideTax &&
    isTaxMutableStatus(input.status) &&
    input.charge.taxTreatmentSnapshot === "taxable" &&
    Boolean(input.charge.taxRuleId)
  );
}

export function getTaxCompletenessCounts(charges: readonly ChargeTaxDetail[]) {
  const unclassifiedSellingCount = charges.filter(
    (charge) => charge.section === "selling" && !charge.taxComplete,
  ).length;
  const unclassifiedBuyingCount = charges.filter(
    (charge) => charge.section === "buying" && !charge.taxComplete,
  ).length;

  return {
    unclassifiedSellingCount,
    unclassifiedBuyingCount,
    totalUnclassifiedCount:
      unclassifiedSellingCount + unclassifiedBuyingCount,
    taxComplete:
      unclassifiedSellingCount + unclassifiedBuyingCount === 0,
  };
}

export function getTaxCompletenessMessage(input: {
  status: ShippingNoteStatus;
  taxComplete: boolean;
}): string {
  if (input.status === "draft") {
    return "Tax classification becomes available after the shipping note is submitted.";
  }

  if (input.status === "checked") {
    return "Tax classification is locked because this shipping note is checked.";
  }

  if (isTaxMutableStatus(input.status) && !input.taxComplete) {
    return "Tax classification is incomplete. Assign a tax treatment to every active charge before marking this shipping note as checked.";
  }

  if (isTaxMutableStatus(input.status) && input.taxComplete) {
    return "All active charges have a valid tax classification.";
  }

  return "Tax classification is read-only for this status.";
}

export function getMarkCheckedDisabledReason(input: {
  status: ShippingNoteStatus;
  canMarkChecked: boolean;
  taxComplete: boolean;
}): string | null {
  if (input.status !== "accounting_reviewing") {
    return "Mark Checked is available only during accounting review.";
  }

  if (!input.canMarkChecked) {
    return "Your role cannot mark this shipping note as checked.";
  }

  if (!input.taxComplete) {
    return "Assign a tax classification to every active charge before marking checked.";
  }

  return null;
}

export function formatTaxRuleOption(rule: TaxRuleDetail): string {
  return `${rule.code} - ${rule.name} (${getTaxTreatmentLabel(rule.taxTreatment)}, ${rule.vatPercent}%)`;
}

export function filterTaxRulesForChargeSection(
  rules: readonly TaxRuleDetail[],
  section: ChargeSection,
): TaxRuleDetail[] {
  return rules.filter((rule) => rule.isActive && rule.chargeSection === section);
}

export function getTaxRuleDeactivateConfirmationText(): string {
  return "This rule will no longer be available for new assignments. Existing charge snapshots remain unchanged, and historical records are not removed.";
}
