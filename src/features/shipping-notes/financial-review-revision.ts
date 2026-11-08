import "server-only";

import { createHash } from "node:crypto";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { shippingNoteCharges, shippingNotes } from "@/lib/db/schema";

import type { ShippingNoteStatus } from "./constants";

const financialReviewChargeColumns = {
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
  serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
  catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
  catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
  catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
  catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
  taxRuleId: shippingNoteCharges.taxRuleId,
  taxRuleCodeSnapshot: shippingNoteCharges.taxRuleCodeSnapshot,
  taxRuleNameSnapshot: shippingNoteCharges.taxRuleNameSnapshot,
  taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
  taxDecisionSource: shippingNoteCharges.taxDecisionSource,
  taxDecisionReason: shippingNoteCharges.taxDecisionReason,
  taxDecisionById: shippingNoteCharges.taxDecisionById,
  taxDecisionAt: shippingNoteCharges.taxDecisionAt,
  inputVatInvoiceStatus: shippingNoteCharges.inputVatInvoiceStatus,
  inputVatInvoiceReference: shippingNoteCharges.inputVatInvoiceReference,
  inputVatDeductible: shippingNoteCharges.inputVatDeductible,
  vatPercent: shippingNoteCharges.vatPercent,
  vatAmount: shippingNoteCharges.vatAmount,
  vatOverrideRate: shippingNoteCharges.vatOverrideRate,
  isOverride: shippingNoteCharges.isOverride,
  overrideReason: shippingNoteCharges.overrideReason,
} as const;

export const financialReviewNoteColumns = {
  id: shippingNotes.id,
  status: shippingNotes.status,
  shippingMode: shippingNotes.shippingMode,
  exchangeRate: shippingNotes.exchangeRate,
  updatedAt: shippingNotes.updatedAt,
} as const;

export type FinancialReviewNoteState = {
  id: string;
  status: ShippingNoteStatus;
  shippingMode: string;
  exchangeRate: string;
  updatedAt: Date;
};

type FinancialReviewExecutor = Pick<
  Parameters<Parameters<typeof db.transaction>[0]>[0],
  "select"
>;

function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalSerialize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`)
    .join(",")}}`;
}

export function createFinancialReviewRevision(
  note: FinancialReviewNoteState,
  charges: readonly unknown[],
): string {
  const canonicalState = {
    note: {
      id: note.id,
      status: note.status,
      shippingMode: note.shippingMode,
      exchangeRate: note.exchangeRate,
      updatedAt: note.updatedAt,
    },
    charges,
  };

  return createHash("sha256")
    .update(canonicalSerialize(canonicalState), "utf8")
    .digest("hex");
}

export async function deriveFinancialReviewRevision(
  executor: FinancialReviewExecutor,
  note: FinancialReviewNoteState,
): Promise<string> {
  const charges = await executor
    .select(financialReviewChargeColumns)
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, note.id),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.id));

  return createFinancialReviewRevision(note, charges);
}

export async function getFinancialReviewRevisionForNote(
  noteId: string,
): Promise<string | null> {
  const [note] = await db
    .select(financialReviewNoteColumns)
    .from(shippingNotes)
    .where(
      and(eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)),
    )
    .limit(1);

  if (!note) {
    return null;
  }

  return deriveFinancialReviewRevision(db, note);
}
