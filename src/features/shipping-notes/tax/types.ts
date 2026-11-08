import type {
  ChargeSection,
  InputVatInvoiceStatus,
  TaxDecisionSource,
  TaxTreatment,
} from "../constants";

export type ChargeTaxRuleOption = {
  id: string;
  code: string;
  name: string;
  chargeSection: ChargeSection;
  taxTreatment: TaxTreatment;
  vatPercent: string;
  isActive: boolean;
  applicableChargeIds: string[];
};

export type ChargeTaxSnapshot = {
  taxRuleId: string | null;
  taxRuleCodeSnapshot: string | null;
  taxRuleNameSnapshot: string | null;
  taxTreatmentSnapshot: TaxTreatment | null;
  taxDecisionSource: TaxDecisionSource | null;
  taxDecisionReason: string | null;
  taxDecisionById: string | null;
  taxDecisionAt: Date | null;
  inputVatInvoiceStatus: InputVatInvoiceStatus | null;
  inputVatInvoiceReference: string | null;
  inputVatDeductible: boolean | null;
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
  incompleteReason: string | null;
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
