export const SHIPPING_MODES = [
  "domestic_truck",
  "sea_export",
  "sea_import",
  "air_export",
  "air_import",
  "custom",
] as const;

export type ShippingMode = (typeof SHIPPING_MODES)[number];

export const VOLUME_UNITS = ["kgs", "cbm", "cont_20", "cont_40", "rt"] as const;

export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export const CONTAINER_TYPE_VALUES = [
  "20_dry_standard",
  "40_dry_standard",
  "40_dry_high",
  "45_dry_high",
  "20_tank",
  "40_tank",
  "20_reefer_standard",
  "40_reefer_high",
  "40_reefer_standard",
  "20_open_top",
  "40_open_top",
  "40_open_top_high",
  "40_flat_standard",
  "40_flat_high",
] as const;

export type ContainerType = (typeof CONTAINER_TYPE_VALUES)[number];

export const CONTAINER_TYPE_GROUPS = [
  {
    label: "General Sized Cargo",
    options: [
      { value: "20_dry_standard", label: "20 Dry Standard" },
      { value: "40_dry_standard", label: "40 Dry Standard" },
      { value: "40_dry_high", label: "40 Dry High" },
      { value: "45_dry_high", label: "45 Dry High" },
      { value: "20_tank", label: "20 Tank" },
      { value: "40_tank", label: "40 Tank" },
    ],
  },
  {
    label: "Reefer Container",
    options: [
      { value: "20_reefer_standard", label: "20 Reefer Standard" },
      { value: "40_reefer_high", label: "40 Reefer High" },
      { value: "40_reefer_standard", label: "40 Reefer Standard" },
    ],
  },
  {
    label: "Odd Sized Container",
    options: [
      { value: "20_open_top", label: "20 Open Top" },
      { value: "40_open_top", label: "40 Open Top" },
      { value: "40_open_top_high", label: "40 Open Top High" },
      { value: "40_flat_standard", label: "40 Flat Standard" },
      { value: "40_flat_high", label: "40 Flat High" },
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  options: ReadonlyArray<{ value: ContainerType; label: string }>;
}>;

export function getContainerTypeLabel(value: string | null | undefined): string | null | undefined {
  if (!value) return value;

  for (const group of CONTAINER_TYPE_GROUPS) {
    const option = group.options.find((item) => item.value === value);
    if (option) return option.label;
  }

  return value;
}

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

export const TAX_TREATMENTS = [
  "taxable",
  "zero_rated",
  "non_taxable",
] as const;

export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

export const CHARGE_SECTIONS = ["selling", "buying"] as const;

export type ChargeSection = (typeof CHARGE_SECTIONS)[number];
