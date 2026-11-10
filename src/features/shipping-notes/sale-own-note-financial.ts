import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { summarizeFinancialCharges } from "@/lib/calculations/shipping-note";
import { db } from "@/lib/db/client";
import {
  shippingNoteCharges,
  shippingNotes,
  type User as DbUser,
} from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";

import type { CurrencyCode } from "./constants";
import type { FinancialSummaryChargeRow } from "./types";

export type SaleOwnNoteBuyingRate = {
  id: string;
  chargeName: string;
  description: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  currency: CurrencyCode;
  amountOriginal: string;
};

export type SaleOwnNoteFinancialView = {
  buyingRates: SaleOwnNoteBuyingRate[];
  grossProfitVnd: string;
};

const saleOwnNoteFinancialChargeColumns = {
  id: shippingNoteCharges.id,
  section: shippingNoteCharges.section,
  chargeName: shippingNoteCharges.chargeName,
  description: shippingNoteCharges.description,
  quantity: shippingNoteCharges.quantity,
  unit: shippingNoteCharges.unit,
  unitPrice: shippingNoteCharges.unitPrice,
  currency: shippingNoteCharges.currency,
  amountOriginal: shippingNoteCharges.amountOriginal,
  amountVnd: shippingNoteCharges.amountVnd,
} as const;

export function buildSaleOwnNoteFinancialOwnershipWhere(
  noteId: string,
  userId: string,
) {
  return and(
    eq(shippingNotes.id, noteId),
    eq(shippingNotes.createdById, userId),
    isNull(shippingNotes.deletedAt),
  );
}

/**
 * Returns the narrow Buying Rate and Gross Profit read model approved for a
 * Sale user who created the requested Shipping Note. It deliberately excludes
 * vendors, tax data, audit evidence, edit capabilities, and broad summaries.
 */
export async function getSaleOwnNoteFinancialViewForUser(
  noteId: string,
  user: DbUser,
): Promise<SaleOwnNoteFinancialView | null> {
  requireAnyPermission(
    user.role,
    PERMISSIONS.SHIPPING_NOTES_READ_OWN_FINANCIALS,
  );

  if (user.role !== "sale") {
    throw new AuthorizationError();
  }

  const [ownedNote] = await db
    .select({ id: shippingNotes.id })
    .from(shippingNotes)
    .where(buildSaleOwnNoteFinancialOwnershipWhere(noteId, user.id))
    .limit(1);

  if (!ownedNote) {
    return null;
  }

  const rows = await db
    .select(saleOwnNoteFinancialChargeColumns)
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, ownedNote.id),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.createdAt));

  const summary = summarizeFinancialCharges(
    rows.map((row) => ({
      section: row.section,
      currency: row.currency,
      amountOriginal: row.amountOriginal,
      amountVnd: row.amountVnd,
    })) satisfies FinancialSummaryChargeRow[],
  );

  return {
    buyingRates: rows
      .filter((row) => row.section === "buying")
      .map((row) => ({
        id: row.id,
        chargeName: row.chargeName,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        unitPrice: row.unitPrice,
        currency: row.currency,
        amountOriginal: row.amountOriginal,
      })),
    grossProfitVnd: summary.grossProfitVnd,
  };
}
