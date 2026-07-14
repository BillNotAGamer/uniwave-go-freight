import type { CurrencyCode, ShippingMode, VolumeUnit } from "../constants";

export type InternalExportCurrencyTotal = {
  currency: CurrencyCode;
  amountOriginal: string;
};

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
    status: "checked";
  };
  sellingCharges: InternalExportCharge[];
  buyingCharges: InternalExportBuyingCharge[];
  summary: {
    sellingChargeCount: number;
    buyingChargeCount: number;
    totalSellingVnd: string;
    totalBuyingVnd: string;
    grossProfitVnd: string;
    sellingTotalsByCurrency: InternalExportCurrencyTotal[];
    buyingTotalsByCurrency: InternalExportCurrencyTotal[];
  };
};
