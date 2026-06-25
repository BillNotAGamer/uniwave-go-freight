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
