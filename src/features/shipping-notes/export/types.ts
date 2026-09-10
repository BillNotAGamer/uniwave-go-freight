import type {
  CurrencyCode,
  ShippingMode,
  ShippingNoteStatus,
  TaxTreatment,
  VolumeUnit,
} from "../constants";
import type { FinancialSummary } from "../types";

export type InternalExportCharge = {
  chargeName: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  currency: CurrencyCode;
  exchangeRate: string;
  amountOriginal: string;
  amountVnd: string;
  taxRuleCodeSnapshot: string | null;
  taxRuleNameSnapshot: string | null;
  taxTreatmentSnapshot: TaxTreatment | null;
  vatPercent: string;
  vatAmount: string;
  totalIncludingVatVnd: string;
  isOverride: boolean;
  overrideReason: string | null;
};

export type InternalExportBuyingCharge = InternalExportCharge & {
  vendorOrAgentText: string | null;
};

export type InternalShippingNoteExportDto = {
  note: {
    id: string;
    jobsheetNo: string;
    mawbHawbNo: string | null;
    shippingMode: ShippingMode;
    customModeName?: string | null;
    customOrigin?: string | null;
    customDestination?: string | null;
    shipperText: string | null;
    consigneeText: string | null;
    customerText: string | null;
    agentText: string | null;
    aol: string | null;
    aod: string | null;
    finalDestination: string | null;
    etd: Date | null;
    eta: Date | null;
    volumeValue: string | null;
    volumeUnit: VolumeUnit | null;
    exchangeRate: string;
    status: Extract<ShippingNoteStatus, "checked" | "approved" | "locked">;
  };
  sellingCharges: InternalExportCharge[];
  buyingCharges: InternalExportBuyingCharge[];
  summary: FinancialSummary;
};
