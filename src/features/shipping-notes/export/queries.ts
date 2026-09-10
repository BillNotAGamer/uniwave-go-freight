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
      note: {
        id: shippingNotes.id,
        jobsheetNo: shippingNotes.jobsheetNo,
        mawbHawbNo: shippingNotes.mawbHawbNo,
        shippingMode: shippingNotes.shippingMode,
        customModeName: shippingNotes.customModeName,
        customOrigin: shippingNotes.customOrigin,
        customDestination: shippingNotes.customDestination,
        shipperText: shippingNotes.shipperText,
        consigneeText: shippingNotes.consigneeText,
        customerText: shippingNotes.customerText,
        agentText: shippingNotes.agentText,
        aol: shippingNotes.aol,
        aod: shippingNotes.aod,
        finalDestination: shippingNotes.finalDestination,
        etd: shippingNotes.etd,
        eta: shippingNotes.eta,
        volumeValue: shippingNotes.volumeValue,
        volumeUnit: shippingNotes.volumeUnit,
        exchangeRate: shippingNotes.exchangeRate,
        status: shippingNotes.status,
      },
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
