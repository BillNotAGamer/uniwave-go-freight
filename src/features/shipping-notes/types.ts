import type { User } from "@/lib/db/schema";

import type {
  CurrencyCode,
  ShippingMode,
  ShippingNoteStatus,
  VolumeUnit,
} from "./constants";

export type ShippingNoteListItem = {
  id: string;
  jobsheetNo: string;
  shippingMode: ShippingMode;
  customModeName?: string | null;
  shipperText: string | null;
  consigneeText: string | null;
  status: ShippingNoteStatus;
  createdAt: Date;
};

export type ShippingNoteDetail = ShippingNoteListItem & {
  shipperPartnerId: string | null;
  consigneePartnerId: string | null;
  customerPartnerId: string | null;
  agentPartnerId: string | null;
  mawbHawbNo: string | null;
  customerText: string | null;
  agentText: string | null;
  domesticOrigin: string | null;
  domesticDestination: string | null;
  customModeName?: string | null;
  customOrigin?: string | null;
  customDestination?: string | null;
  airOrigin: string | null;
  airDestination: string | null;
  /** Legacy aliases retained while existing callers still use AOL/AOD. */
  aol: string | null;
  aod: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  finalDestination: string | null;
  mawbNo: string | null;
  hawbNo: string | null;
  mblNo: string | null;
  hblNo: string | null;
  flightNo: string | null;
  vesselName: string | null;
  voyageNo: string | null;
  etd: Date | null;
  eta: Date | null;
  volumeValue: string | null;
  volumeUnit: VolumeUnit | null;
  exchangeRate: string;
  createdById: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
};

export type ShippingNoteActor = Pick<User, "id" | "role">;

export type ShippingNoteCancellationMetadata = {
  cancelledById: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
};

/** Safe selling charge fields returned by queries. */
export type SellingChargeDetail = {
  id: string;
  shippingNoteId: string;
  chargeName: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  currency: CurrencyCode;
  exchangeRate: string;
  amountOriginal: string;
  amountVnd: string;
  serviceCatalogItemId: string | null;
  catalogCodeSnapshot: string | null;
  catalogNameSnapshot: string | null;
  catalogUnitSnapshot: string | null;
  catalogVatRateSnapshot: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Safe buying charge fields returned by accountant/admin queries. */
export type BuyingChargeDetail = {
  id: string;
  shippingNoteId: string;
  chargeName: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  currency: CurrencyCode;
  exchangeRate: string;
  amountOriginal: string;
  amountVnd: string;
  serviceCatalogItemId: string | null;
  catalogCodeSnapshot: string | null;
  catalogNameSnapshot: string | null;
  catalogUnitSnapshot: string | null;
  catalogVatRateSnapshot: string | null;
  vendorOrAgentText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SellingChargeSummary = {
  chargeCount: number;
  totalVnd: string;
  totalsByCurrency: FinancialCurrencyTotal[];
};

export type BuyingChargeInput = {
  chargeName: string;
  description?: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  currency: CurrencyCode;
  exchangeRate?: string;
  vendorOrAgentText?: string;
};

export type BuyingChargeActionState =
  | { ok: true }
  | { ok: false; error: string };

export type FinancialCurrencyTotal = {
  currency: CurrencyCode;
  amountOriginal: string;
};

export type FinancialSummaryChargeRow = {
  section: "selling" | "buying";
  currency: CurrencyCode;
  amountOriginal: string;
  amountVnd: string;
  vatAmount?: string;
};

export type FinancialSummary = {
  sellingChargeCount: number;
  buyingChargeCount: number;
  totalSellingVnd: string;
  totalBuyingVnd: string;
  grossProfitVnd: string;
  sellingSubtotalExcludingVatVnd: string;
  sellingVatVnd: string;
  sellingTotalIncludingVatVnd: string;
  buyingSubtotalExcludingVatVnd: string;
  buyingVatVnd: string;
  buyingTotalIncludingVatVnd: string;
  grossProfitExcludingVatVnd: string;
  sellingTotalsByCurrency: FinancialCurrencyTotal[];
  buyingTotalsByCurrency: FinancialCurrencyTotal[];
};
