import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { shippingNotes, shippingNoteCharges, type User as DbUser } from "@/lib/db/schema";
import { isInternalXlsxExportEligibleStatus } from "../status-policy";
import {
  buildInternalExportSections,
  type InternalExportChargeSourceRow,
} from "./read-model";
import type { InternalShippingNoteExportDto } from "./types";

export const internalShippingNoteExportNoteSelect = {
  id: shippingNotes.id,
  jobsheetNo: shippingNotes.jobsheetNo,
  mawbNo: shippingNotes.mawbNo,
  hawbNo: shippingNotes.hawbNo,
  mawbHawbNo: shippingNotes.mawbHawbNo,
  shippingMode: shippingNotes.shippingMode,
  customModeName: shippingNotes.customModeName,
  customOrigin: shippingNotes.customOrigin,
  customDestination: shippingNotes.customDestination,
  domesticOrigin: shippingNotes.domesticOrigin,
  domesticDestination: shippingNotes.domesticDestination,
  shipperText: shippingNotes.shipperText,
  consigneeText: shippingNotes.consigneeText,
  customerText: shippingNotes.customerText,
  agentText: shippingNotes.agentText,
  commodityHsCode: shippingNotes.commodityHsCode,
  commodity: shippingNotes.commodity,
  hsCode: shippingNotes.hsCode,
  containerNo: shippingNotes.containerNo,
  sealNo: shippingNotes.sealNo,
  carrierName: shippingNotes.carrierName,
  grossWeight: shippingNotes.grossWeight,
  chargeableWeight: shippingNotes.chargeableWeight,
  licensePlate: shippingNotes.licensePlate,
  driverInformation: shippingNotes.driverInformation,
  vehiclePayloadCapacity: shippingNotes.vehiclePayloadCapacity,
  aol: shippingNotes.aol,
  aod: shippingNotes.aod,
  portOfLoading: shippingNotes.portOfLoading,
  portOfDischarge: shippingNotes.portOfDischarge,
  finalDestination: shippingNotes.finalDestination,
  mblNo: shippingNotes.mblNo,
  hblNo: shippingNotes.hblNo,
  flightNo: shippingNotes.flightNo,
  vesselName: shippingNotes.vesselName,
  voyageNo: shippingNotes.voyageNo,
  etd: shippingNotes.etd,
  eta: shippingNotes.eta,
  volumeValue: shippingNotes.volumeValue,
  volumeUnit: shippingNotes.volumeUnit,
  exchangeRate: shippingNotes.exchangeRate,
  status: shippingNotes.status,
} as const;

/**
 * Server-only read model for the internal XLSX export.
 * Safely fetches the note and active charges in a single joined snapshot.
 * Requires exactly the SHIPPING_NOTES_EXPORT_INTERNAL permission.
 * Denies access if the note is not in a finalized export-eligible status.
 */
export async function getInternalShippingNoteExportDataForUser(
  noteId: string,
  user: DbUser,
): Promise<InternalShippingNoteExportDto | null> {
  // 1. Strict internal permission check
  requirePermission(user.role, PERMISSIONS.SHIPPING_NOTES_EXPORT_INTERNAL);

  // 2. Execute a single joined query to guarantee snapshot consistency
  const rows = await db
    .select({
      note: internalShippingNoteExportNoteSelect,
      charge: {
        id: shippingNoteCharges.id,
        section: shippingNoteCharges.section,
        chargeName: shippingNoteCharges.chargeName,
        description: shippingNoteCharges.description,
        quantity: shippingNoteCharges.quantity,
        unit: shippingNoteCharges.unit,
        unitPrice: shippingNoteCharges.unitPrice,
        currency: shippingNoteCharges.currency,
        exchangeRate: shippingNoteCharges.exchangeRate,
        amountOriginal: shippingNoteCharges.amountOriginal,
        amountVnd: shippingNoteCharges.amountVnd,
        vendorOrAgentText: shippingNoteCharges.vendorOrAgentText,
        taxRuleCodeSnapshot: shippingNoteCharges.taxRuleCodeSnapshot,
        taxRuleNameSnapshot: shippingNoteCharges.taxRuleNameSnapshot,
        taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
        vatPercent: shippingNoteCharges.vatPercent,
        vatAmount: shippingNoteCharges.vatAmount,
        isOverride: shippingNoteCharges.isOverride,
        overrideReason: shippingNoteCharges.overrideReason,
        createdAt: shippingNoteCharges.createdAt,
      },
    })
    .from(shippingNotes)
    .leftJoin(
      shippingNoteCharges,
      and(
        eq(shippingNoteCharges.shippingNoteId, shippingNotes.id),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .where(and(eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)))
    .orderBy(asc(shippingNoteCharges.createdAt), asc(shippingNoteCharges.id));

  if (rows.length === 0) {
    return null;
  }

  const { note } = rows[0];

  // 3. Strict status gate - no admin bypass
  if (!isInternalXlsxExportEligibleStatus(note.status)) {
    throw new Error(
      "Shipping note must be in 'checked', 'approved', or 'locked' status to be exported.",
    );
  }

  // 4. Group charges into arrays
  const chargeRows: InternalExportChargeSourceRow[] = [];

  for (const row of rows) {
    if (!row.charge) continue;
    chargeRows.push(row.charge);
  }

  // 5. Derive financial summary using bigint-safe helpers
  const { sellingCharges, buyingCharges, summary } =
    buildInternalExportSections(chargeRows);

  return {
    note: {
      ...note,
      status: note.status,
    },
    sellingCharges,
    buyingCharges,
    summary,
  };
}
