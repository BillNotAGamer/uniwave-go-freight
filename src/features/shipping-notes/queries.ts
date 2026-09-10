import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import { requireAnyPermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import type { ShippingNoteStatus } from "./constants";
import {
  shippingNotes,
  shippingNoteCharges,
  type User as DbUser,
} from "@/lib/db/schema";

import type {
  BuyingChargeDetail,
  FinancialSummary,
  FinancialSummaryChargeRow,
  SellingChargeDetail,
  ShippingNoteDetail,
  ShippingNoteCancellationMetadata,
  ShippingNoteListItem,
  SellingChargeSummary,
} from "./types";
import type { ShippingNotesListFilters } from "./list-filters";
import {
  summarizeFinancialCharges,
  summarizeSellingCharges,
} from "@/lib/calculations/shipping-note";

const FINANCIAL_SUMMARY_ELIGIBLE_STATUSES = new Set<ShippingNoteStatus>([
  "submitted",
  "accounting_reviewing",
  "checked",
  "approved",
  "exported",
  "locked",
  "cancelled",
]);

function getShippingNoteAccessConditions(user: DbUser) {
  const conditions = [isNull(shippingNotes.deletedAt)];

  if (user.role === "sale") {
    conditions.push(eq(shippingNotes.createdById, user.id));
  }

  return conditions;
}

export function escapeShippingNoteJobsheetLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export function buildShippingNotesListWhere(
  user: DbUser,
  filters: ShippingNotesListFilters = {},
): SQL {
  const conditions = getShippingNoteAccessConditions(user);

  if (filters.jobsheet) {
    conditions.push(
      ilike(
        shippingNotes.jobsheetNo,
        `%${escapeShippingNoteJobsheetLikePattern(filters.jobsheet)}%`,
      ),
    );
  }

  if (filters.etdFrom) {
    conditions.push(gte(shippingNotes.etd, filters.etdFrom));
  }

  if (filters.etdToExclusive) {
    conditions.push(lt(shippingNotes.etd, filters.etdToExclusive));
  }

  return and(...conditions)!;
}

const shippingNoteListColumns = {
  id: shippingNotes.id,
  jobsheetNo: shippingNotes.jobsheetNo,
  shippingMode: shippingNotes.shippingMode,
  shipperText: shippingNotes.shipperText,
  consigneeText: shippingNotes.consigneeText,
  status: shippingNotes.status,
  createdAt: shippingNotes.createdAt,
} as const;

const shippingNoteDetailColumns = {
  ...shippingNoteListColumns,
  shipperPartnerId: shippingNotes.shipperPartnerId,
  consigneePartnerId: shippingNotes.consigneePartnerId,
  customerPartnerId: shippingNotes.customerPartnerId,
  agentPartnerId: shippingNotes.agentPartnerId,
  mawbHawbNo: shippingNotes.mawbHawbNo,
  customerText: shippingNotes.customerText,
  agentText: shippingNotes.agentText,
  domesticOrigin: shippingNotes.domesticOrigin,
  domesticDestination: shippingNotes.domesticDestination,
  airOrigin: shippingNotes.aol,
  airDestination: shippingNotes.aod,
  aol: shippingNotes.aol,
  aod: shippingNotes.aod,
  portOfLoading: shippingNotes.portOfLoading,
  portOfDischarge: shippingNotes.portOfDischarge,
  finalDestination: shippingNotes.finalDestination,
  mawbNo: shippingNotes.mawbNo,
  hawbNo: shippingNotes.hawbNo,
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
  createdById: shippingNotes.createdById,
  submittedAt: shippingNotes.submittedAt,
  updatedAt: shippingNotes.updatedAt,
} as const;

export async function listShippingNotesForUser(
  user: DbUser,
  filters: ShippingNotesListFilters = {},
): Promise<ShippingNoteListItem[]> {
  const where = buildShippingNotesListWhere(user, filters);

  return db
    .select(shippingNoteListColumns)
    .from(shippingNotes)
    .where(where)
    .orderBy(desc(shippingNotes.createdAt));
}

export async function getShippingNoteForUser(
  id: string,
  user: DbUser,
): Promise<ShippingNoteDetail | null> {
  const conditions = [...getShippingNoteAccessConditions(user), eq(shippingNotes.id, id)];

  const [note] = await db
    .select(shippingNoteDetailColumns)
    .from(shippingNotes)
    .where(and(...conditions))
    .limit(1);

  return note ?? null;
}

export async function getShippingNoteById(
  id: string,
): Promise<ShippingNoteDetail | null> {
  const [note] = await db
    .select(shippingNoteDetailColumns)
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, id), isNull(shippingNotes.deletedAt)))
    .limit(1);

  return note ?? null;
}

export const shippingNoteDetailSelect = shippingNoteDetailColumns;

export async function getCancellationMetadataForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<ShippingNoteCancellationMetadata | null> {
  requireAnyPermission(user.role, PERMISSIONS.SHIPPING_NOTES_READ_ALL);

  const note = await getShippingNoteForUser(noteId, user);

  if (!note || note.status !== "cancelled") {
    return null;
  }

  const [row] = await db
    .select({
      cancelledById: shippingNotes.cancelledById,
      cancelledAt: shippingNotes.cancelledAt,
      cancelReason: shippingNotes.cancelReason,
    })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)))
    .limit(1);

  return row ?? null;
}

// ---------------------------------------------------------------------------
// Selling charge queries
// ---------------------------------------------------------------------------

/** Safe columns returned for selling charges — no override, tax, audit, or buying fields. */
const sellingChargeColumns = {
  id: shippingNoteCharges.id,
  shippingNoteId: shippingNoteCharges.shippingNoteId,
  chargeName: shippingNoteCharges.chargeName,
  description: shippingNoteCharges.description,
  quantity: shippingNoteCharges.quantity,
  unit: shippingNoteCharges.unit,
  unitPrice: shippingNoteCharges.unitPrice,
  currency: shippingNoteCharges.currency,
  exchangeRate: shippingNoteCharges.exchangeRate,
  amountOriginal: shippingNoteCharges.amountOriginal,
  amountVnd: shippingNoteCharges.amountVnd,
  serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
  catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
  catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
  catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
  catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
  createdAt: shippingNoteCharges.createdAt,
  updatedAt: shippingNoteCharges.updatedAt,
} as const;

/** Safe columns returned for buying charges — no tax, override, or audit fields. */
const buyingChargeColumns = {
  id: shippingNoteCharges.id,
  shippingNoteId: shippingNoteCharges.shippingNoteId,
  chargeName: shippingNoteCharges.chargeName,
  description: shippingNoteCharges.description,
  quantity: shippingNoteCharges.quantity,
  unit: shippingNoteCharges.unit,
  unitPrice: shippingNoteCharges.unitPrice,
  currency: shippingNoteCharges.currency,
  exchangeRate: shippingNoteCharges.exchangeRate,
  amountOriginal: shippingNoteCharges.amountOriginal,
  amountVnd: shippingNoteCharges.amountVnd,
  serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
  catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
  catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
  catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
  catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
  vendorOrAgentText: shippingNoteCharges.vendorOrAgentText,
  createdAt: shippingNoteCharges.createdAt,
  updatedAt: shippingNoteCharges.updatedAt,
} as const;

const financialSummaryChargeColumns = {
  section: shippingNoteCharges.section,
  currency: shippingNoteCharges.currency,
  amountOriginal: shippingNoteCharges.amountOriginal,
  amountVnd: shippingNoteCharges.amountVnd,
  vatAmount: shippingNoteCharges.vatAmount,
} as const;

/**
 * Returns selling charges for a shipping note the user can access.
 * Never returns buying charges or deleted charges.
 */
export async function listSellingChargesForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<SellingChargeDetail[]> {
  // First verify the user can access the parent note.
  const note = await getShippingNoteForUser(noteId, user);

  if (!note) {
    return [];
  }

  return db
    .select(sellingChargeColumns)
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, noteId),
        eq(shippingNoteCharges.section, "selling"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.createdAt));

}

export async function getSellingChargesAndSummaryForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<{ charges: SellingChargeDetail[]; summary: SellingChargeSummary }> {
  const charges = await listSellingChargesForNoteForUser(noteId, user);
  const summary = summarizeSellingCharges(charges);
  return { charges, summary };
}

export async function listBuyingChargesForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<BuyingChargeDetail[]> {
  requireAnyPermission(user.role, PERMISSIONS.BUYING_CHARGES_READ);

  const note = await getShippingNoteForUser(noteId, user);

  if (!note) {
    return [];
  }

  return db
    .select(buyingChargeColumns)
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, noteId),
        eq(shippingNoteCharges.section, "buying"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.createdAt));

}

export async function getFinancialSummaryForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<FinancialSummary | null> {
  requireAnyPermission(user.role, PERMISSIONS.FINANCIAL_SUMMARY_READ);

  const note = await getShippingNoteForUser(noteId, user);

  if (!note) {
    return null;
  }

  if (!FINANCIAL_SUMMARY_ELIGIBLE_STATUSES.has(note.status)) {
    return null;
  }

  const chargeRows = await db
    .select(financialSummaryChargeColumns)
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, noteId),
        inArray(shippingNoteCharges.section, ["selling", "buying"]),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.createdAt));

  return summarizeFinancialCharges(chargeRows as FinancialSummaryChargeRow[]);
}
