import { summarizeFinancialCharges } from "@/lib/calculations/shipping-note";

import type {
  ChargeSection,
  CurrencyCode,
  TaxTreatment,
} from "../constants";
import type { FinancialSummary, FinancialSummaryChargeRow } from "../types";
import { calculateLineTotalIncludingVat } from "../tax/calculations";
import { getTaxTreatmentLabel } from "../tax/ui-policy";
import type {
  InternalExportBuyingCharge,
  InternalExportCharge,
} from "./types";

export type InternalExportChargeSourceRow = {
  section: ChargeSection;
  chargeName: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  currency: CurrencyCode;
  exchangeRate: string;
  amountOriginal: string;
  amountVnd: string;
  vendorOrAgentText: string | null;
  taxRuleCodeSnapshot: string | null;
  taxRuleNameSnapshot: string | null;
  taxTreatmentSnapshot: TaxTreatment | null;
  vatPercent: string;
  vatAmount: string;
  isOverride: boolean;
  overrideReason: string | null;
};

export type InternalExportSections = {
  sellingCharges: InternalExportCharge[];
  buyingCharges: InternalExportBuyingCharge[];
  summary: FinancialSummary;
};

function toBaseExportCharge(
  charge: InternalExportChargeSourceRow,
): InternalExportCharge {
  return {
    chargeName: charge.chargeName,
    description: charge.description,
    quantity: charge.quantity,
    unit: charge.unit,
    unitPrice: charge.unitPrice,
    currency: charge.currency,
    exchangeRate: charge.exchangeRate,
    amountOriginal: charge.amountOriginal,
    amountVnd: charge.amountVnd,
    taxRuleCodeSnapshot: charge.taxRuleCodeSnapshot,
    taxRuleNameSnapshot: charge.taxRuleNameSnapshot,
    taxTreatmentSnapshot: charge.taxTreatmentSnapshot,
    vatPercent: charge.vatPercent,
    vatAmount: charge.vatAmount,
    totalIncludingVatVnd: calculateLineTotalIncludingVat(
      charge.amountVnd,
      charge.vatAmount,
    ),
    isOverride: charge.isOverride,
    overrideReason: charge.overrideReason,
  };
}

export function buildInternalExportSections(
  chargeRows: readonly InternalExportChargeSourceRow[],
): InternalExportSections {
  const sellingCharges: InternalExportCharge[] = [];
  const buyingCharges: InternalExportBuyingCharge[] = [];
  const financialChargeRows: FinancialSummaryChargeRow[] = [];

  for (const charge of chargeRows) {
    const exportCharge = toBaseExportCharge(charge);

    financialChargeRows.push({
      section: charge.section,
      currency: charge.currency,
      amountOriginal: charge.amountOriginal,
      amountVnd: charge.amountVnd,
      vatAmount: charge.vatAmount,
    });

    if (charge.section === "selling") {
      sellingCharges.push(exportCharge);
      continue;
    }

    buyingCharges.push({
      ...exportCharge,
      vendorOrAgentText: charge.vendorOrAgentText,
    });
  }

  return {
    sellingCharges,
    buyingCharges,
    summary: summarizeFinancialCharges(financialChargeRows),
  };
}

export function formatTaxRuleSnapshotForExport(
  charge: Pick<
    InternalExportCharge,
    "taxRuleCodeSnapshot" | "taxRuleNameSnapshot"
  >,
): string {
  if (!charge.taxRuleCodeSnapshot && !charge.taxRuleNameSnapshot) {
    return "Unclassified";
  }

  return [charge.taxRuleCodeSnapshot, charge.taxRuleNameSnapshot]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" - ");
}

export function formatTaxTreatmentForExport(
  treatment: TaxTreatment | null,
): string {
  return getTaxTreatmentLabel(treatment);
}
