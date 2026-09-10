import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { shippingNoteCharges, shippingNotes, type User as DbUser } from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requirePermission } from "@/lib/permissions/require-permission";
import { summarizeFinancialCharges } from "@/lib/calculations/shipping-note";

import { calculateLineTotalIncludingVat } from "./calculations";
import { isChargeTaxComplete, summarizeTaxCompleteness } from "./completeness";
import type { ChargeTaxDetail, TaxCompletenessResult } from "./types";
import type { FinancialSummary, FinancialSummaryChargeRow } from "../types";
import { getPersistedChargeAccountingVat } from "../accounting/vat";

const chargeTaxColumns = {
  chargeId: shippingNoteCharges.id,
  shippingNoteId: shippingNoteCharges.shippingNoteId,
  section: shippingNoteCharges.section,
  chargeName: shippingNoteCharges.chargeName,
  amountVnd: shippingNoteCharges.amountVnd,
  taxRuleId: shippingNoteCharges.taxRuleId,
  taxRuleCodeSnapshot: shippingNoteCharges.taxRuleCodeSnapshot,
  taxRuleNameSnapshot: shippingNoteCharges.taxRuleNameSnapshot,
  taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
  vatPercent: shippingNoteCharges.vatPercent,
  vatAmount: shippingNoteCharges.vatAmount,
  isOverride: shippingNoteCharges.isOverride,
  overrideReason: shippingNoteCharges.overrideReason,
  vatOverrideRate: shippingNoteCharges.vatOverrideRate,
  serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
  catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
  catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
  catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
  catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
} as const;

export async function listChargeTaxDetailsForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<ChargeTaxDetail[]> {
  requirePermission(user.role, PERMISSIONS.TAX_SUMMARY_READ);

  const noteConditions = [eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)];

  const rows = await db
    .select(chargeTaxColumns)
    .from(shippingNoteCharges)
    .innerJoin(shippingNotes, eq(shippingNotes.id, shippingNoteCharges.shippingNoteId))
    .where(
      and(
        ...noteConditions,
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.createdAt), asc(shippingNoteCharges.id));

  return rows.map((row) => {
    const accountingVat = getPersistedChargeAccountingVat(row);
    return {
      ...row,
      ...accountingVat,
      lineTotalIncludingVatVnd: calculateLineTotalIncludingVat(
        row.amountVnd,
        row.vatAmount,
      ),
      taxComplete: isChargeTaxComplete(row),
    };
  });
}

export async function getTaxCompletenessForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<TaxCompletenessResult | null> {
  const details = await listChargeTaxDetailsForNoteForUser(noteId, user);

  if (details.length === 0) {
    const [note] = await db
      .select({ id: shippingNotes.id })
      .from(shippingNotes)
      .where(and(eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)))
      .limit(1);

    if (!note) {
      return null;
    }
  }

  return summarizeTaxCompleteness(details);
}

export async function getTaxSummaryForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<FinancialSummary | null> {
  requirePermission(user.role, PERMISSIONS.TAX_SUMMARY_READ);

  const [note] = await db
    .select({ id: shippingNotes.id })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)))
    .limit(1);

  if (!note) {
    return null;
  }

  const rows = await db
    .select({
      section: shippingNoteCharges.section,
      currency: shippingNoteCharges.currency,
      amountOriginal: shippingNoteCharges.amountOriginal,
      amountVnd: shippingNoteCharges.amountVnd,
      vatAmount: shippingNoteCharges.vatAmount,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, noteId),
        inArray(shippingNoteCharges.section, ["selling", "buying"]),
        isNull(shippingNoteCharges.deletedAt),
      ),
    );

  return summarizeFinancialCharges(rows as FinancialSummaryChargeRow[]);
}
