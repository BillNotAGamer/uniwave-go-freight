export const INTERNAL_XLSX_METADATA_VERSION = 1;

export const INTERNAL_XLSX_TEMPLATE_VERSION = "internal-v1";

export const INTERNAL_XLSX_TEMPLATE_RELATIVE_PATH =
  "assets/export-templates/shipping-note/internal-v1.xlsx";

export const INTERNAL_XLSX_TEMPLATE_SHA256 =
  "57B04720F08D543DB1622865EA3A70508AD60841521FAF6723C08F5939143426";

export const INTERNAL_XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const INTERNAL_XLSX_WORKSHEET_NAME = "AK";

export const INTERNAL_XLSX_SELLING_ROWS = {
  start: 17,
  end: 24,
  totalCell: "E25",
  totalFormula: "SUM(D17:D24)",
} as const;

export const INTERNAL_XLSX_BUYING_ROWS = {
  start: 26,
  end: 36,
  totalCell: "E37",
  totalFormula: "SUM(D26:D36)",
} as const;

export const INTERNAL_XLSX_PROFIT_CELL = {
  labelCell: "A38",
  labelRange: "A38:C38",
  valueCell: "E38",
  label: "NET PROFIT (USD)",
  formula: "E25-E37",
} as const;

export const INTERNAL_XLSX_HEADER_CELLS = {
  jobsheetNo: "C6",
  mawbHawbNo: "C7",
  shipperText: "C9",
  consigneeText: "C10",
  aol: "C11",
  destination: "C12",
  etd: "C13",
  volume: "C15",
  exchangeRate: "E15",
} as const;
