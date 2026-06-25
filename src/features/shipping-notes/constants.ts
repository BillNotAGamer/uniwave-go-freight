export const SHIPPING_MODES = [
  "domestic_truck",
  "sea_export",
  "sea_import",
  "air_export",
  "air_import",
] as const;

export type ShippingMode = (typeof SHIPPING_MODES)[number];

export const VOLUME_UNITS = ["kgs", "cbm", "cont_20", "cont_40", "rt"] as const;

export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export const SHIPPING_NOTE_STATUSES = [
  "draft",
  "submitted",
  "accounting_reviewing",
  "checked",
  "approved",
  "exported",
  "locked",
  "cancelled",
] as const;

export type ShippingNoteStatus = (typeof SHIPPING_NOTE_STATUSES)[number];

export const CURRENCY_CODES = ["VND", "USD"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];
