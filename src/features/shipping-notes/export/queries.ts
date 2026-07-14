import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { shippingNotes, shippingNoteCharges, type User as DbUser } from "@/lib/db/schema";
import { summarizeFinancialCharges } from "@/lib/calculations/shipping-note";
import type { FinancialSummaryChargeRow } from "../types";
import type {
  InternalExportCharge,
  InternalExportBuyingCharge,
  InternalShippingNoteExportDto,
} from "./types";

/**
 * Server-only read model for the internal XLSX export.
 * Safely fetches the note and active charges in a single joined snapshot.
 * Requires exactly the SHIPPING_NOTES_EXPORT_INTERNAL permission.
 * Denies access if the note is not exactly in the 'checked' status.
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
  if (note.status !== "checked") {
    throw new Error("Shipping note must be in 'checked' status to be exported.");
  }

  // 4. Group charges into arrays
  const sellingCharges: InternalExportCharge[] = [];
  const buyingCharges: InternalExportBuyingCharge[] = [];
  const financialChargeRows: FinancialSummaryChargeRow[] = [];

  for (const row of rows) {
    if (!row.charge) continue;
    const { charge } = row;

    financialChargeRows.push({
      section: charge.section,
      currency: charge.currency,
      amountOriginal: charge.amountOriginal,
      amountVnd: charge.amountVnd,
    });

    if (charge.section === "selling") {
      sellingCharges.push({
        chargeName: charge.chargeName,
        description: charge.description,
        quantity: charge.quantity,
        unit: charge.unit,
        unitPrice: charge.unitPrice,
        currency: charge.currency,
        exchangeRate: charge.exchangeRate,
        amountOriginal: charge.amountOriginal,
        amountVnd: charge.amountVnd,
      });
    } else if (charge.section === "buying") {
      buyingCharges.push({
        chargeName: charge.chargeName,
        description: charge.description,
        quantity: charge.quantity,
        unit: charge.unit,
        unitPrice: charge.unitPrice,
        currency: charge.currency,
        exchangeRate: charge.exchangeRate,
        amountOriginal: charge.amountOriginal,
        amountVnd: charge.amountVnd,
        vendorOrAgentText: charge.vendorOrAgentText,
      });
    }
  }

  // 5. Derive financial summary using bigint-safe helpers
  const summary = summarizeFinancialCharges(financialChargeRows);

  return {
    note: {
      ...note,
      status: "checked",
    },
    sellingCharges,
    buyingCharges,
    summary,
  };
}
