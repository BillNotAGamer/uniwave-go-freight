export const SHIPPING_NOTE_DOCUMENT_TYPES = [
  "pre_alert_hbl",
  "pre_alert_mbl",
  "contract",
  "invoice",
] as const;

export type ShippingNoteDocumentType =
  (typeof SHIPPING_NOTE_DOCUMENT_TYPES)[number];

export const SHIPPING_NOTE_DOCUMENT_TYPE_LABELS: Record<
  ShippingNoteDocumentType,
  string
> = {
  pre_alert_hbl: "Pre-alert HBL",
  pre_alert_mbl: "Pre-alert MBL",
  contract: "Contract",
  invoice: "Invoice",
};

export const SHIPPING_NOTE_DOCUMENT_STORAGE_PROVIDERS = [
  "r2",
  "google_drive",
] as const;

export type ShippingNoteDocumentStorageProvider =
  (typeof SHIPPING_NOTE_DOCUMENT_STORAGE_PROVIDERS)[number];
