import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { InternalPrintActions } from "@/components/shipping-notes/internal-print-actions";
import { INTERNAL_XLSX_PROFIT_CELL } from "@/features/shipping-notes/export/constants";
import { getInternalShippingNoteExportDataForUser } from "@/features/shipping-notes/export/queries";
import type {
  InternalExportBuyingCharge,
  InternalExportCharge,
  InternalShippingNoteExportDto,
} from "@/features/shipping-notes/export/types";

import styles from "./internal-print.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Internal Shipping Note Print",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

type InternalPrintPageProps = {
  params: Promise<{ id: string }>;
};

type InfoItem = {
  label: string;
  value: string;
};

function formatOptional(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function formatDate(value: Date | null): string {
  if (!value) return "";

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

function renderValue(value: string): string {
  return value;
}

function formatVolume(note: InternalShippingNoteExportDto["note"]): string {
  return [note.volumeValue, note.volumeUnit]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
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
  ];
}

function ChargeRows({
  charges,
  partyFallback,
  partyLabel,
  section,
}: Readonly<{
  charges: readonly (InternalExportCharge | InternalExportBuyingCharge)[];
  partyFallback: string;
  partyLabel: string;
  section: "SELLING" | "BUYING";
}>) {
  return (
    <section className={styles.section} aria-labelledby={`${section.toLowerCase()}-title`}>
      <h2 className={styles.sectionTitle} id={`${section.toLowerCase()}-title`}>
        {section}
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Charge</th>
              <th scope="col">Description</th>
              <th scope="col">Quantity / Unit</th>
              <th scope="col">Unit Price</th>
              <th scope="col">Currency</th>
              <th scope="col">Exchange Rate</th>
              <th scope="col">Amount Original</th>
              <th scope="col">Amount VND</th>
              <th scope="col">{partyLabel}</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td className={styles.empty} colSpan={10}>
                  No active {section.toLowerCase()} charges.
                </td>
              </tr>
            ) : (
              charges.map((charge, index) => {
                const partyText =
                  "vendorOrAgentText" in charge
                    ? charge.vendorOrAgentText ?? partyFallback
                    : partyFallback;

                return (
                  <tr key={`${section}-${charge.chargeName}-${index.toString()}`}>
                    <td className={styles.numeric}>{(index + 1).toString()}</td>
                    <td>{renderValue(charge.chargeName)}</td>
                    <td>{formatOptional(charge.description)}</td>
                    <td>
                      {formatDecimalString(charge.quantity)}
                      {charge.unit ? ` ${charge.unit}` : ""}
                    </td>
                    <td className={styles.numeric}>{formatDecimalString(charge.unitPrice)}</td>
                    <td>{charge.currency}</td>
                    <td className={styles.numeric}>{formatDecimalString(charge.exchangeRate)}</td>
                    <td className={styles.numeric}>{formatDecimalString(charge.amountOriginal)}</td>
                    <td className={styles.numeric}>{formatDecimalString(charge.amountVnd)}</td>
                    <td>{formatOptional(partyText)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function InternalShippingNotePrintPage({
  params,
}: InternalPrintPageProps) {
  const { user } = await requireAuthenticatedUser();
  const { id } = await params;

  let exportData: InternalShippingNoteExportDto | null;

  try {
    exportData = await getInternalShippingNoteExportDataForUser(id, user);
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      (error instanceof Error && error.message.includes("checked"))
    ) {
      notFound();
    }

    throw error;
  }

  if (!exportData) {
    notFound();
  }

  const { note, summary } = exportData;
  const renderedAt = new Date();
  const headerItems = buildHeaderItems(note);
  const backHref = `/shipping-notes/${note.id}`;
  const sellingPartyText = note.customerText ?? note.agentText ?? "";
  const buyingPartyText = note.agentText ?? "";

  return (
    <main className={styles.pageShell}>
      <InternalPrintActions backHref={backHref} />
      <article className={styles.paper}>
        <div className={styles.document}>
          <header className={styles.header}>
            <div>
              <p className={styles.eyebrow}>Uniwave Go Freight</p>
              <h1 className={styles.title}>Internal Shipping Note</h1>
              <p className={styles.meta}>Jobsheet No: {note.jobsheetNo}</p>
            </div>
            <div>
              <p className={styles.eyebrow}>Internal Checked View</p>
              <p className={styles.meta}>Status: {note.status}</p>
              <p className={styles.meta}>Rendered: {formatDateTime(renderedAt)}</p>
            </div>
          </header>

          <section className={styles.section} aria-labelledby="shipment-info-title">
            <h2 className={styles.sectionTitle} id="shipment-info-title">
              Shipment Information
            </h2>
            <div className={styles.infoGrid}>
              {headerItems.map((item) => (
                <div className={styles.infoCell} key={item.label}>
                  <span className={styles.label}>{item.label}</span>
                  <span className={styles.value}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <ChargeRows
            charges={exportData.sellingCharges}
            partyFallback={sellingPartyText}
            partyLabel="Customer / Agent"
            section="SELLING"
          />

          <section className={styles.section} aria-labelledby="selling-total-title">
            <h2 className={styles.sectionTitle} id="selling-total-title">
              TOTAL SELLING
            </h2>
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>Total Selling (VND)</span>
                <span>{formatDecimalString(summary.totalSellingVnd)}</span>
              </div>
            </div>
          </section>

          <ChargeRows
            charges={exportData.buyingCharges}
            partyFallback={buyingPartyText}
            partyLabel="Vendor / Agent"
            section="BUYING"
          />

          <section className={styles.section} aria-labelledby="financial-total-title">
            <h2 className={styles.sectionTitle} id="financial-total-title">
              Internal Financial Summary
            </h2>
            <div className={styles.totals}>
              <div className={styles.totalRow}>
                <span>TOTAL SELLING</span>
                <span>{formatDecimalString(summary.totalSellingVnd)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>TOTAL BUYING</span>
                <span>{formatDecimalString(summary.totalBuyingVnd)}</span>
              </div>
              <div className={`${styles.totalRow} ${styles.profitRow}`}>
                {/*
                  The application internally calls this derived value Gross Profit.
                  The client requires the printable document label NET PROFIT (USD).
                  Do not change this label without explicit client approval.
                */}
                <span>{INTERNAL_XLSX_PROFIT_CELL.label}</span>
                <span>{formatDecimalString(summary.grossProfitVnd)}</span>
              </div>
            </div>
          </section>

          <p className={styles.printMeta}>Rendered for print at {formatDateTime(renderedAt)}</p>
        </div>
      </article>
    </main>
  );
}
