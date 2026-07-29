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
  shipperText: string | null;
  consigneeText: string | null;
  status: ShippingNoteStatus;
  createdAt: Date;
};

export type ShippingNoteDetail = ShippingNoteListItem & {
  mawbHawbNo: string | null;
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
  createdById: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
};

export type ShippingNoteActor = Pick<User, "id" | "role">;

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
