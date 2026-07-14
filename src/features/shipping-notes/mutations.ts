import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { logAuditEvent } from "@/lib/audit/log";
import {
  AuthorizationError,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  shippingNotes,
  shippingNoteCharges,
  type User as DbUser,
} from "@/lib/db/schema";

import {
  type CreateBuyingChargeInput,
  type CreateShippingNoteDraftInput,
  type CreateSellingChargeInput,
  type MarkShippingNoteCheckedInput,
  type StartAccountingReviewInput,
  type SubmitShippingNoteInput,
  type UpdateBuyingChargeInput,
  type UpdateShippingNoteDraftInput,
  type UpdateSellingChargeInput,
} from "./validators";
import type {
  BuyingChargeDetail,
  SellingChargeDetail,
  ShippingNoteDetail,
} from "./types";
import type { ShippingNoteStatus } from "./constants";
import {
  getShippingNoteById,
  getShippingNoteForUser,
  shippingNoteDetailSelect,
} from "./queries";
import { calculateChargeAmounts } from "@/lib/calculations/money";

function normalizeOptionalDate(value: Date | undefined): Date | null {
  return value ?? null;
}

function normalizeOptionalText(value: string | undefined): string | null {
  return value ?? null;
}

function normalizeOptionalNumber(value: number | undefined): string | null {
  return value === undefined ? null : value.toString();
}

function requireShippingNoteAccess(
  user: DbUser,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
): void {
  requireAnyPermission(user.role, permission);
}

async function assertJobsheetNoIsUnique(
  jobsheetNo: string,
  excludeId?: string,
): Promise<void> {
  const conditions = [eq(shippingNotes.jobsheetNo, jobsheetNo)];

  if (excludeId) {
    conditions.push(ne(shippingNotes.id, excludeId));
  }

  const existing = await db
    .select({ id: shippingNotes.id })
    .from(shippingNotes)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Jobsheet No already exists.");
  }
}

function ensureDraftAccess(note: ShippingNoteDetail | null, user: DbUser): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (note.status !== "draft") {
    throw new AuthorizationError();
  }

  if (user.role === "sale" && note.createdById !== user.id) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureAccountingTransitionAccess(
  note: ShippingNoteDetail | null,
  expectedStatus: ShippingNoteStatus,
): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (note.status !== expectedStatus) {
    throw new AuthorizationError();
  }

  return note;
}

export async function createShippingNoteDraft(
  input: CreateShippingNoteDraftInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_CREATE_OWN);

  await assertJobsheetNoIsUnique(input.jobsheetNo);

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(shippingNotes)
        .values({
          jobsheetNo: input.jobsheetNo,
          shippingMode: input.shippingMode,
          mawbHawbNo: normalizeOptionalText(input.mawbHawbNo),
          shipperText: normalizeOptionalText(input.shipperText),
          consigneeText: normalizeOptionalText(input.consigneeText),
          customerText: normalizeOptionalText(input.customerText),
          agentText: normalizeOptionalText(input.agentText),
          aol: normalizeOptionalText(input.aol),
          aod: normalizeOptionalText(input.aod),
          finalDestination: normalizeOptionalText(input.finalDestination),
          etd: normalizeOptionalDate(input.etd),
          eta: normalizeOptionalDate(input.eta),
          volumeValue: normalizeOptionalNumber(input.volumeValue),
          volumeUnit: input.volumeUnit ?? null,
          exchangeRate: (input.exchangeRate ?? 1).toString(),
          status: "draft",
          createdById: user.id,
        })
        .returning(shippingNoteDetailSelect);

      if (!created) {
        throw new Error("Failed to create shipping note draft.");
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.create_draft",
        entityType: "shipping_note",
        entityId: created.id,
        after: created,
      });

      return created;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to create shipping note draft.");
  }
}

export async function updateShippingNoteDraft(
  id: string,
  input: UpdateShippingNoteDraftInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);

  const current = ensureDraftAccess(await getShippingNoteById(id), user);

  if (input.jobsheetNo !== current.jobsheetNo) {
    await assertJobsheetNoIsUnique(input.jobsheetNo, id);
  }

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          jobsheetNo: input.jobsheetNo,
          shippingMode: input.shippingMode,
          mawbHawbNo: normalizeOptionalText(input.mawbHawbNo),
          shipperText: normalizeOptionalText(input.shipperText),
          consigneeText: normalizeOptionalText(input.consigneeText),
          customerText: normalizeOptionalText(input.customerText),
          agentText: normalizeOptionalText(input.agentText),
          aol: normalizeOptionalText(input.aol),
          aod: normalizeOptionalText(input.aod),
          finalDestination: normalizeOptionalText(input.finalDestination),
          etd: normalizeOptionalDate(input.etd),
          eta: normalizeOptionalDate(input.eta),
          volumeValue: normalizeOptionalNumber(input.volumeValue),
          volumeUnit: input.volumeUnit ?? null,
          exchangeRate: (input.exchangeRate ?? 1).toString(),
        })
        .where(and(eq(shippingNotes.id, id), eq(shippingNotes.status, "draft")))
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.update_draft",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to update shipping note draft.");
  }
}

export async function submitShippingNote(
  input: SubmitShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);

  const current = ensureDraftAccess(await getShippingNoteById(input.id), user);

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "submitted",
          submittedAt: new Date(),
        })
        .where(and(eq(shippingNotes.id, input.id), eq(shippingNotes.status, "draft")))
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.submit",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to submit shipping note.");
  }
}

export async function startAccountingReview(
  input: StartAccountingReviewInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_ACCOUNTING_REVIEW);

  const current = ensureAccountingTransitionAccess(
    await getShippingNoteForUser(input.id, user),
    "submitted",
  );

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "accounting_reviewing",
        })
        .where(
          and(
            eq(shippingNotes.id, input.id),
            eq(shippingNotes.status, "submitted"),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.accounting_review.start",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to start accounting review.");
  }
}

export async function markShippingNoteChecked(
  input: MarkShippingNoteCheckedInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_MARK_CHECKED);

  const current = ensureAccountingTransitionAccess(
    await getShippingNoteForUser(input.id, user),
    "accounting_reviewing",
  );

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "checked",
          checkedById: user.id,
        })
        .where(
          and(
            eq(shippingNotes.id, input.id),
            eq(shippingNotes.status, "accounting_reviewing"),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.accounting_review.checked",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: {
          ...updated,
          checkedById: user.id,
        },
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to mark shipping note as checked.");
  }
}

// ---------------------------------------------------------------------------
// Selling charge mutations
// ---------------------------------------------------------------------------

/** Safe columns to return after charge mutation — mirrors query select. */
const chargeReturnColumns = {
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
  createdAt: shippingNoteCharges.createdAt,
  updatedAt: shippingNoteCharges.updatedAt,
} as const;

const buyingChargeReturnColumns = {
  ...chargeReturnColumns,
  vendorOrAgentText: shippingNoteCharges.vendorOrAgentText,
} as const;

const BUYING_CHARGE_MUTABLE_STATUSES = new Set<ShippingNoteStatus>([
  "submitted",
  "accounting_reviewing",
]);

/**
 * Ensures the user can mutate selling charges on the given draft note.
 * Only sale (own draft) and admin (any draft) are allowed.
 * Accountant is denied.
 */
function ensureChargeMutationAccess(note: ShippingNoteDetail | null, user: DbUser): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (note.status !== "draft") {
    throw new AuthorizationError();
  }

  // Accountant cannot mutate charges.
  if (user.role === "accountant") {
    throw new AuthorizationError();
  }

  // Sale can only mutate on own notes.
  if (user.role === "sale" && note.createdById !== user.id) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureBuyingChargeMutationAccess(
  note: ShippingNoteDetail | null,
): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (!BUYING_CHARGE_MUTABLE_STATUSES.has(note.status)) {
    throw new AuthorizationError();
  }

  return note;
}

export async function createSellingChargeForNote(
  input: CreateSellingChargeInput,
  user: DbUser,
): Promise<SellingChargeDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);

  const note = ensureChargeMutationAccess(
    await getShippingNoteById(input.shippingNoteId),
    user,
  );

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(shippingNoteCharges)
        .values({
          shippingNoteId: note.id,
          section: "selling",
          chargeName: input.chargeName,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unit: input.unit,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
          vatPercent: "0",
          vatAmount: "0",
          vendorOrAgentText: null,
          isOverride: false,
          overrideReason: null,
          createdById: user.id,
        })
        .returning(chargeReturnColumns);

      if (!created) {
        throw new Error("Failed to create selling charge.");
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.create",
        entityType: "shipping_note_charge",
        entityId: created.id,
        after: created,
      });

      return created;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to create selling charge.");
  }
}

export async function updateSellingCharge(
  input: UpdateSellingChargeInput,
  user: DbUser,
): Promise<SellingChargeDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);

  // Load the existing charge and verify it is a non-deleted selling charge.
  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
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
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, input.id),
        eq(shippingNoteCharges.section, "selling"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  // Verify the parent note is a draft the user can mutate.
  ensureChargeMutationAccess(
    await getShippingNoteById(existingCharge.shippingNoteId),
    user,
  );

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNoteCharges)
        .set({
          chargeName: input.chargeName,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unit: input.unit,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
        })
        .where(
          and(
            eq(shippingNoteCharges.id, input.id),
            eq(shippingNoteCharges.section, "selling"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning(chargeReturnColumns);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.update",
        entityType: "shipping_note_charge",
        entityId: updated.id,
        before: existingCharge,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to update selling charge.");
  }
}

export async function softDeleteSellingCharge(
  chargeId: string,
  shippingNoteId: string,
  user: DbUser,
): Promise<void> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);

  // Load existing charge and verify it is a non-deleted selling charge.
  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
      section: shippingNoteCharges.section,
      chargeName: shippingNoteCharges.chargeName,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.shippingNoteId, shippingNoteId),
        eq(shippingNoteCharges.section, "selling"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  // Verify the parent note is a draft the user can mutate.
  ensureChargeMutationAccess(
    await getShippingNoteById(existingCharge.shippingNoteId),
    user,
  );

  try {
    await db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(shippingNoteCharges)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(shippingNoteCharges.id, chargeId),
            eq(shippingNoteCharges.section, "selling"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning({ id: shippingNoteCharges.id });

      if (!deleted) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.delete",
        entityType: "shipping_note_charge",
        entityId: deleted.id,
        before: existingCharge,
      });
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to delete selling charge.");
  }
}

export async function createBuyingChargeForNote(
  noteId: string,
  input: CreateBuyingChargeInput,
  user: DbUser,
): Promise<BuyingChargeDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.BUYING_CHARGES_MANAGE);

  const note = ensureBuyingChargeMutationAccess(
    await getShippingNoteForUser(noteId, user),
  );

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(shippingNoteCharges)
        .values({
          shippingNoteId: note.id,
          section: "buying",
          chargeName: input.chargeName,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unit: input.unit,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
          vatPercent: "0",
          vatAmount: "0",
          vendorOrAgentText: normalizeOptionalText(input.vendorOrAgentText),
          isOverride: false,
          overrideReason: null,
          createdById: user.id,
        })
        .returning(buyingChargeReturnColumns);

      if (!created) {
        throw new Error("Failed to create buying charge.");
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.buying.create",
        entityType: "shipping_note_charge",
        entityId: created.id,
        after: created,
      });

      return created;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to create buying charge.");
  }
}

export async function updateBuyingCharge(
  chargeId: string,
  input: UpdateBuyingChargeInput,
  user: DbUser,
): Promise<BuyingChargeDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.BUYING_CHARGES_MANAGE);

  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
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
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.section, "buying"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  ensureBuyingChargeMutationAccess(
    await getShippingNoteForUser(existingCharge.shippingNoteId, user),
  );

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNoteCharges)
        .set({
          chargeName: input.chargeName,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unit: input.unit,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
          vendorOrAgentText: normalizeOptionalText(input.vendorOrAgentText),
          vatPercent: "0",
          vatAmount: "0",
          isOverride: false,
          overrideReason: null,
        })
        .where(
          and(
            eq(shippingNoteCharges.id, chargeId),
            eq(shippingNoteCharges.section, "buying"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning(buyingChargeReturnColumns);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.buying.update",
        entityType: "shipping_note_charge",
        entityId: updated.id,
        before: existingCharge,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to update buying charge.");
  }
}

export async function softDeleteBuyingCharge(
  chargeId: string,
  user: DbUser,
): Promise<string> {
  requireShippingNoteAccess(user, PERMISSIONS.BUYING_CHARGES_MANAGE);

  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
      section: shippingNoteCharges.section,
      chargeName: shippingNoteCharges.chargeName,
      vendorOrAgentText: shippingNoteCharges.vendorOrAgentText,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.section, "buying"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  ensureBuyingChargeMutationAccess(
    await getShippingNoteForUser(existingCharge.shippingNoteId, user),
  );

  try {
    await db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(shippingNoteCharges)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(shippingNoteCharges.id, chargeId),
            eq(shippingNoteCharges.section, "buying"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning({ id: shippingNoteCharges.id });

      if (!deleted) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.buying.delete",
        entityType: "shipping_note_charge",
        entityId: deleted.id,
        before: existingCharge,
      });
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to delete buying charge.");
  }

  return existingCharge.shippingNoteId;
}
