export const INTERNAL_XLSX_METADATA_VERSION = 2;

export const INTERNAL_XLSX_TEMPLATE_VERSION = "internal-v2";

export const INTERNAL_XLSX_TEMPLATE_RELATIVE_PATH =
  "assets/export-templates/shipping-note/internal-v2.xlsx";

export const INTERNAL_XLSX_TEMPLATE_SHA256 =
  "CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57";

export const INTERNAL_XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const INTERNAL_PDF_METADATA_VERSION = 1;

export const INTERNAL_PDF_LAYOUT_VERSION = "internal-pdf-v1";

export const INTERNAL_PDF_MIME_TYPE = "application/pdf";

export const INTERNAL_PDF_FONT_FAMILY = "Noto Sans";

export const INTERNAL_PDF_FONT_REGULAR_RELATIVE_PATH =
  "assets/fonts/noto-sans/NotoSans-Regular.ttf";

export const INTERNAL_PDF_FONT_BOLD_RELATIVE_PATH =
  "assets/fonts/noto-sans/NotoSans-Bold.ttf";

export const INTERNAL_XLSX_WORKSHEET_NAME = "AK";

export const INTERNAL_XLSX_TAX_DETAILS_WORKSHEET_NAME = "Tax Details";

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

export const INTERNAL_XLSX_TAX_DETAIL_COLUMNS = {
  section: "A",
  chargeName: "B",
  taxRule: "C",
  taxTreatment: "D",
  baseExcludingVatVnd: "E",
  vatPercent: "F",
  vatAmountVnd: "G",
  totalIncludingVatVnd: "H",
  overrideFlag: "I",
  overrideReason: "J",
} as const;

export const INTERNAL_XLSX_TAX_DETAIL_SELLING_ROWS = {
  sectionLabelCell: "A2",
  headerRow: 3,
  start: 4,
  end: 11,
} as const;

export const INTERNAL_XLSX_TAX_DETAIL_BUYING_ROWS = {
  sectionLabelCell: "A13",
  headerRow: 14,
  start: 15,
  end: 25,
} as const;

export const INTERNAL_XLSX_TAX_SUMMARY_CELLS = {
  sellingSubtotalExcludingVatVnd: "B28",
  sellingVatVnd: "B29",
  sellingTotalIncludingVatVnd: "B30",
  buyingSubtotalExcludingVatVnd: "B31",
  buyingVatVnd: "B32",
  buyingTotalIncludingVatVnd: "B33",
  grossProfitExcludingVatVnd: "B34",
} as const;
