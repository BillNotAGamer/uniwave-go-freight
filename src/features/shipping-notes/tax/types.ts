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
};

export type ChargeTaxDetail = ChargeTaxSnapshot & {
  chargeId: string;
  shippingNoteId: string;
  section: "selling" | "buying";
  chargeName: string;
  amountVnd: string;
  lineTotalIncludingVatVnd: string;
  taxComplete: boolean;
};

export type TaxCompletenessResult = {
  taxComplete: boolean;
  unclassifiedChargeCount: number;
};
