import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { INTERNAL_PDF_FONT_FAMILY, INTERNAL_PDF_LAYOUT_VERSION } from "../constants";
import {
  formatTaxRuleSnapshotForExport,
  formatTaxTreatmentForExport,
} from "../read-model";
import type {
  InternalExportBuyingCharge,
  InternalExportCharge,
  InternalShippingNoteExportDto,
} from "../types";

type InternalShippingNotePdfDocumentProps = {
  exportData: InternalShippingNoteExportDto;
  generatedAt: Date;
};

type InfoItem = {
  label: string;
  value: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: INTERNAL_PDF_FONT_FAMILY,
    fontSize: 8.5,
    lineHeight: 1.35,
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 10,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.8,
    color: "#475569",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 4,
  },
  metaBlock: {
    minWidth: 145,
    alignItems: "flex-end",
  },
  metaLine: {
    fontSize: 8,
    color: "#475569",
    marginBottom: 2,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#cbd5e1",
  },
  infoCell: {
    width: "25%",
    minHeight: 34,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    padding: 5,
  },
  label: {
    fontSize: 7,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  value: {
    fontSize: 8.5,
  },
  chargeCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginBottom: 6,
    padding: 6,
  },
  chargeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  chargeTitle: {
    fontSize: 9.5,
    fontWeight: 700,
  },
  chargeMeta: {
    color: "#475569",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailCell: {
    width: "24%",
    marginRight: 4,
    marginBottom: 4,
  },
  detailCellWide: {
    width: "49%",
    marginRight: 4,
    marginBottom: 4,
  },
  taxNote: {
    marginTop: 3,
    color: "#334155",
  },
  summaryBox: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  summaryFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 7,
    backgroundColor: "#f8fafc",
  },
  summaryLabel: {
    fontWeight: 700,
  },
  empty: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 8,
    color: "#64748b",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#64748b",
    fontSize: 7,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    marginTop: 12,
  },
});

function formatOptional(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

function formatDate(value: Date | null): string {
  if (!value) return "-";

  const year = value.getUTCFullYear().toString().padStart(4, "0");
  const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = value.getUTCDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateTime(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, "0");
  const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = value.getUTCDate().toString().padStart(2, "0");
  const hour = value.getUTCHours().toString().padStart(2, "0");
  const minute = value.getUTCMinutes().toString().padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

function formatDecimalString(value: string): string {
  const sign = value.startsWith("-") ? "-" : "";
  const unsignedValue = sign ? value.slice(1) : value;
  const [integerPart = "0", fractionalPart] = unsignedValue.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${sign}${groupedInteger}${fractionalPart === undefined ? "" : `.${fractionalPart}`}`;
}

function formatVolume(note: InternalShippingNoteExportDto["note"]): string {
  return [note.volumeValue, note.volumeUnit]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ") || "-";
}

function buildHeaderItems(note: InternalShippingNoteExportDto["note"]): InfoItem[] {
  return [
    { label: "Jobsheet No", value: note.jobsheetNo },
    { label: "MAWB / HAWB", value: formatOptional(note.mawbHawbNo) },
    { label: "Shipping Mode", value: note.shippingMode },
    { label: "Shipper", value: formatOptional(note.shipperText) },
    { label: "Consignee", value: formatOptional(note.consigneeText) },
    { label: "Customer", value: formatOptional(note.customerText) },
    { label: "Agent", value: formatOptional(note.agentText) },
    { label: "AOL", value: formatOptional(note.aol) },
    { label: "AOD", value: formatOptional(note.aod) },
    { label: "Final Destination", value: formatOptional(note.finalDestination) },
    { label: "ETD", value: formatDate(note.etd) },
    { label: "ETA", value: formatDate(note.eta) },
    { label: "Volume", value: formatVolume(note) },
    { label: "Exchange Rate", value: formatDecimalString(note.exchangeRate) },
    { label: "Status", value: note.status },
    { label: "Layout", value: INTERNAL_PDF_LAYOUT_VERSION },
  ];
}

function DetailCell({
  label,
  value,
  wide = false,
}: Readonly<{
  label: string;
  value: string;
  wide?: boolean;
}>) {
  return (
    <View style={wide ? styles.detailCellWide : styles.detailCell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ChargeRows({
  charges,
  section,
}: Readonly<{
  charges: readonly (InternalExportCharge | InternalExportBuyingCharge)[];
  section: "Selling" | "Buying";
}>) {
  if (charges.length === 0) {
    return <Text style={styles.empty}>No active {section.toLowerCase()} charges.</Text>;
  }

  return (
    <>
      {charges.map((charge, index) => {
        const vendorOrAgentText =
          "vendorOrAgentText" in charge ? charge.vendorOrAgentText : null;

        return (
          <View
            key={`${section}-${charge.chargeName}-${index.toString()}`}
            style={styles.chargeCard}
          >
            <View style={styles.chargeHeader}>
              <Text style={styles.chargeTitle}>
                {index + 1}. {charge.chargeName}
              </Text>
              <Text style={styles.chargeMeta}>{section}</Text>
            </View>
            <View style={styles.detailGrid}>
              <DetailCell
                label="Description"
                value={formatOptional(charge.description)}
                wide
              />
              <DetailCell
                label="Quantity / Unit"
                value={`${formatDecimalString(charge.quantity)}${charge.unit ? ` ${charge.unit}` : ""}`}
              />
              <DetailCell
                label="Unit Price"
                value={`${formatDecimalString(charge.unitPrice)} ${charge.currency}`}
              />
              <DetailCell
                label="Exchange Rate"
                value={formatDecimalString(charge.exchangeRate)}
              />
              <DetailCell
                label="Base excl. VAT"
                value={`${formatDecimalString(charge.amountVnd)} VND`}
              />
              <DetailCell
                label="VAT %"
                value={formatDecimalString(charge.vatPercent)}
              />
              <DetailCell
                label="VAT Amount"
                value={`${formatDecimalString(charge.vatAmount)} VND`}
              />
              <DetailCell
                label="Total incl. VAT"
                value={`${formatDecimalString(charge.totalIncludingVatVnd)} VND`}
              />
              <DetailCell
                label="Tax Rule"
                value={formatTaxRuleSnapshotForExport(charge)}
                wide
              />
              <DetailCell
                label="Treatment"
                value={formatTaxTreatmentForExport(charge.taxTreatmentSnapshot)}
              />
              {vendorOrAgentText !== null ? (
                <DetailCell
                  label="Vendor / Agent"
                  value={formatOptional(vendorOrAgentText)}
                  wide
                />
              ) : null}
            </View>
            {charge.isOverride ? (
              <Text style={styles.taxNote}>
                Override: {formatOptional(charge.overrideReason)}
              </Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function SummaryRow({
  label,
  value,
  final = false,
}: Readonly<{
  label: string;
  value: string;
  final?: boolean;
}>) {
  return (
    <View style={final ? styles.summaryFinalRow : styles.summaryRow}>
      <Text style={final ? styles.summaryLabel : undefined}>{label}</Text>
      <Text style={final ? styles.summaryLabel : undefined}>
        {formatDecimalString(value)} VND
      </Text>
    </View>
  );
}

export function InternalShippingNotePdfDocument({
  exportData,
  generatedAt,
}: InternalShippingNotePdfDocumentProps) {
  const { note, summary } = exportData;

  return (
    <Document
      title={`Internal Shipping Note ${note.jobsheetNo}`}
      author="Uniwave Go Freight"
      creator="Uniwave Go Freight"
      producer="Uniwave Go Freight"
      creationDate={generatedAt}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>UNIWAVE GO FREIGHT</Text>
            <Text style={styles.title}>INTERNAL SHIPPING NOTE</Text>
            <Text style={styles.metaLine}>Jobsheet No: {note.jobsheetNo}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>Status: {note.status}</Text>
            <Text style={styles.metaLine}>Generated: {formatDateTime(generatedAt)}</Text>
            <Text style={styles.metaLine}>Layout: {INTERNAL_PDF_LAYOUT_VERSION}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Information</Text>
          <View style={styles.infoGrid}>
            {buildHeaderItems(note).map((item) => (
              <View key={item.label} style={styles.infoCell}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selling Charges</Text>
          <ChargeRows charges={exportData.sellingCharges} section="Selling" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buying Charges</Text>
          <ChargeRows charges={exportData.buyingCharges} section="Buying" />
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Internal Financial Summary</Text>
          <View style={styles.summaryBox}>
            <SummaryRow
              label="Selling subtotal excl. VAT"
              value={summary.sellingSubtotalExcludingVatVnd}
            />
            <SummaryRow label="Selling VAT" value={summary.sellingVatVnd} />
            <SummaryRow
              label="Selling total incl. VAT"
              value={summary.sellingTotalIncludingVatVnd}
            />
            <SummaryRow
              label="Buying subtotal excl. VAT"
              value={summary.buyingSubtotalExcludingVatVnd}
            />
            <SummaryRow label="Buying VAT" value={summary.buyingVatVnd} />
            <SummaryRow
              label="Buying total incl. VAT"
              value={summary.buyingTotalIncludingVatVnd}
            />
            <SummaryRow
              label="Gross profit excl. VAT"
              value={summary.grossProfitExcludingVatVnd}
              final
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{INTERNAL_PDF_LAYOUT_VERSION}</Text>
          <Text>Generated: {formatDateTime(generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}
