import type { TaxTreatment } from "../constants";

export type ChargeTaxSnapshot = {
  taxRuleId: string | null;
  taxRuleCodeSnapshot: string | null;
  taxRuleNameSnapshot: string | null;
  taxTreatmentSnapshot: TaxTreatment | null;
  vatPercent: string;
  vatAmount: string;
  isOverride: boolean;
  overrideReason: string | null;
  vatOverrideRate?: string | null;
};

export type ChargeTaxDetail = ChargeTaxSnapshot & {
  chargeId: string;
  shippingNoteId: string;
  section: "selling" | "buying";
  chargeName: string;
  amountVnd: string;
  lineTotalIncludingVatVnd: string;
  taxComplete: boolean;
  vatOverrideRate: string | null;
  serviceCatalogItemId: string | null;
  catalogCodeSnapshot: string | null;
  catalogNameSnapshot: string | null;
  catalogUnitSnapshot: string | null;
  catalogVatRateSnapshot: string | null;
  accountingBaselineVatRate: string | null;
  effectiveAccountingVatRate: string | null;
};

export type TaxCompletenessResult = {
  taxComplete: boolean;
  unclassifiedChargeCount: number;
};
