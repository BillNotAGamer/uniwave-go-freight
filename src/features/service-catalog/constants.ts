export const SERVICE_CATALOG_NATURES = [
  "service",
  "tool_supply",
  "goods",
] as const;

export type ServiceCatalogNature =
  (typeof SERVICE_CATALOG_NATURES)[number];

export const SOURCE_NATURE_TO_CODE = {
  "Dịch vụ": "service",
  "Công cụ dụng cụ": "tool_supply",
  "Hàng hóa": "goods",
} as const satisfies Record<string, ServiceCatalogNature>;

export const SERVICE_CATALOG_VAT_RATES = [0, 5, 8, 10] as const;
export const SERVICE_CATALOG_SOURCE_VAT_RATES = [8, 10] as const;

export const SERVICE_CATALOG_SOURCE_ROWS = {
  header: 4,
  firstBusinessRow: 5,
  lastBusinessRow: 101,
  summaryRow: 102,
} as const;

export const EXPECTED_DUPLICATE_CODE_COUNTS = {
  CPTK: 4,
  DHAND: 2,
  DTHC: 2,
  DTRUCKING: 2,
  DXRAY: 2,
  EBS: 2,
  ISPS: 2,
  LSS: 2,
  NUOC: 2,
  OCFS: 2,
  OF: 2,
  OHAND: 3,
  OLOLO: 2,
  OTHC: 2,
  TRUCKING: 3,
} as const;

export const DUPLICATE_CODE_CLASSIFICATION =
  "SAME_ITEM_CORE_METADATA_DIFFERENT_UNIT_CONVERSION" as const;

export const CONVERSION_OPERATIONS = ["multiply"] as const;
export type ConversionOperation = (typeof CONVERSION_OPERATIONS)[number];

export const SERVICE_CATALOG_IMPORT_CONFIRM_KEY =
  "IMPORT_UNIWAVE_SERVICE_CATALOG" as const;
export const SERVICE_CATALOG_IMPORT_VERSION = "C3B" as const;
