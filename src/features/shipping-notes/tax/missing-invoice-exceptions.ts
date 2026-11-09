import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  shippingNoteCharges,
  shippingNoteMissingInvoiceExceptions,
  shippingNotes,
  type ShippingNoteMissingInvoiceException,
  type User as DbUser,
} from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import type { ShippingNoteStatus } from "../constants";
import { deriveFinancialReviewRevision } from "../financial-review-revision";
import type { MissingInvoiceExceptionEvidence } from "./types";
import type {
  DecideMissingInvoiceExceptionInput,
  RequestMissingInvoiceExceptionInput,
  RevokeMissingInvoiceExceptionInput,
} from "./validators";

const EXCEPTION_MUTABLE_STATUSES = ["submitted", "accounting_reviewing"] as const;
const ACTIVE_EXCEPTION_STATUSES = ["pending", "approved"] as const;

export const MISSING_INVOICE_EXCEPTION_STALE_ERROR =
  "The financial review changed. Refresh the shipping note and review the current missing-invoice evidence before continuing.";

type ExceptionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ExceptionExecutor = Pick<ExceptionTransaction, "select">;

type LockedExceptionContext = {
  note: {
    id: string;
    status: ShippingNoteStatus;
    shippingMode: string;
    exchangeRate: string;
    updatedAt: Date;
  };
  charge: {
    id: string;
    shippingNoteId: string;
    section: "selling" | "buying";
    inputVatInvoiceStatus: "available" | "missing" | null;
    inputVatDeductible: boolean | null;
  };
};

function requireActiveActor(user: DbUser): void {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }
}

function assertExceptionMutableStatus(status: ShippingNoteStatus): void {
  if (!EXCEPTION_MUTABLE_STATUSES.includes(
    status as (typeof EXCEPTION_MUTABLE_STATUSES)[number],
  )) {
    throw new AuthorizationError();
  }
}

function assertMissingNonDeductibleBuyingCharge(
  charge: LockedExceptionContext["charge"],
): void {
  if (
    charge.section !== "buying" ||
    charge.inputVatInvoiceStatus !== "missing" ||
    charge.inputVatDeductible !== false
  ) {
    throw new Error(
      "A closure exception requires a Buying Charge with a missing invoice and explicitly non-deductible input VAT.",
    );
  }
}

async function lockExceptionContextByCharge(
  tx: ExceptionTransaction,
  chargeId: string,
): Promise<LockedExceptionContext> {
  const [identity] = await tx
    .select({ shippingNoteId: shippingNoteCharges.shippingNoteId })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!identity) {
    throw new AuthorizationError();
  }

  const [note] = await tx
    .select({
      id: shippingNotes.id,
      status: shippingNotes.status,
      shippingMode: shippingNotes.shippingMode,
      exchangeRate: shippingNotes.exchangeRate,
      updatedAt: shippingNotes.updatedAt,
    })
    .from(shippingNotes)
    .where(
      and(
        eq(shippingNotes.id, identity.shippingNoteId),
        isNull(shippingNotes.deletedAt),
      ),
    )
    .limit(1)
    .for("update");

  if (!note) {
    throw new AuthorizationError();
  }

  const [charge] = await tx
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
      section: shippingNoteCharges.section,
      inputVatInvoiceStatus: shippingNoteCharges.inputVatInvoiceStatus,
      inputVatDeductible: shippingNoteCharges.inputVatDeductible,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.shippingNoteId, note.id),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1)
    .for("update");

  if (!charge) {
    throw new AuthorizationError();
  }

  return { note, charge };
}

async function lockExceptionContextByException(
  tx: ExceptionTransaction,
  exceptionId: string,
): Promise<LockedExceptionContext & {
  exception: ShippingNoteMissingInvoiceException;
}> {
  const [identity] = await tx
    .select({
      buyingChargeId: shippingNoteMissingInvoiceExceptions.buyingChargeId,
    })
    .from(shippingNoteMissingInvoiceExceptions)
    .where(eq(shippingNoteMissingInvoiceExceptions.id, exceptionId))
    .limit(1);

  if (!identity) {
    throw new AuthorizationError();
  }

  const context = await lockExceptionContextByCharge(tx, identity.buyingChargeId);
  const [exception] = await tx
    .select()
    .from(shippingNoteMissingInvoiceExceptions)
    .where(
      and(
        eq(shippingNoteMissingInvoiceExceptions.id, exceptionId),
        eq(
          shippingNoteMissingInvoiceExceptions.shippingNoteId,
          context.note.id,
        ),
        eq(
          shippingNoteMissingInvoiceExceptions.buyingChargeId,
          context.charge.id,
        ),
      ),
    )
    .limit(1)
    .for("update");

  if (!exception) {
    throw new AuthorizationError();
  }

  return { ...context, exception };
}

async function assertCurrentFinancialRevision(
  tx: ExceptionTransaction,
  context: LockedExceptionContext,
  expectedFinancialRevision: string,
): Promise<void> {
  const current = await deriveFinancialReviewRevision(tx, context.note);
  if (current !== expectedFinancialRevision) {
    throw new Error(MISSING_INVOICE_EXCEPTION_STALE_ERROR);
  }
}

function toEvidence(
  row: ShippingNoteMissingInvoiceException,
): MissingInvoiceExceptionEvidence {
  return {
    id: row.id,
    shippingNoteId: row.shippingNoteId,
    buyingChargeId: row.buyingChargeId,
    status: row.status,
    requestedById: row.requestedById,
    requestedAt: row.requestedAt,
    requestReason: row.requestReason,
    invoiceStatusSnapshot: "missing",
    inputVatDeductibleSnapshot: false,
    requestedFinancialRevision: row.requestedFinancialRevision,
    decisionById: row.decisionById,
    decidedAt: row.decidedAt,
    decisionReason: row.decisionReason,
    selfApproved: row.selfApproved,
    invalidatedById: row.invalidatedById,
    invalidatedAt: row.invalidatedAt,
    invalidationReason: row.invalidationReason,
  };
}

export async function requestMissingInvoiceException(
  input: RequestMissingInvoiceExceptionInput,
  user: DbUser,
): Promise<MissingInvoiceExceptionEvidence> {
  requireActiveActor(user);
  if (user.role !== "accountant" && user.role !== "admin") {
    throw new AuthorizationError();
  }

  return db.transaction(async (tx) => {
    const context = await lockExceptionContextByCharge(tx, input.chargeId);
    assertExceptionMutableStatus(context.note.status);
    assertMissingNonDeductibleBuyingCharge(context.charge);
    await assertCurrentFinancialRevision(
      tx,
      context,
      input.expectedFinancialRevision,
    );

    const [existingActive] = await tx
      .select({ id: shippingNoteMissingInvoiceExceptions.id })
      .from(shippingNoteMissingInvoiceExceptions)
      .where(
        and(
          eq(
            shippingNoteMissingInvoiceExceptions.buyingChargeId,
            context.charge.id,
          ),
          inArray(
            shippingNoteMissingInvoiceExceptions.status,
            ACTIVE_EXCEPTION_STATUSES,
          ),
        ),
      )
      .limit(1)
      .for("update");
    if (existingActive) {
      throw new Error(
        "This Buying Charge already has a pending or approved missing-invoice exception.",
      );
    }

    const requestedAt = new Date();
    const [created] = await tx
      .insert(shippingNoteMissingInvoiceExceptions)
      .values({
        shippingNoteId: context.note.id,
        buyingChargeId: context.charge.id,
        status: "pending",
        requestedById: user.id,
        requestedAt,
        requestReason: input.reason,
        invoiceStatusSnapshot: "missing",
        inputVatDeductibleSnapshot: false,
        requestedFinancialRevision: input.expectedFinancialRevision,
        selfApproved: false,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to request the missing-invoice exception.");
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note_charge.missing_invoice_exception.requested",
      entityType: "missing_invoice_exception",
      entityId: created.id,
      after: created,
      reason: input.reason,
    });

    return toEvidence(created);
  });
}

export async function decideMissingInvoiceException(
  input: DecideMissingInvoiceExceptionInput,
  user: DbUser,
): Promise<MissingInvoiceExceptionEvidence> {
  requireActiveActor(user);
  if (user.role !== "admin") {
    throw new AuthorizationError();
  }

  return db.transaction(async (tx) => {
    const context = await lockExceptionContextByException(tx, input.exceptionId);
    assertExceptionMutableStatus(context.note.status);
    assertMissingNonDeductibleBuyingCharge(context.charge);
    if (context.exception.status !== "pending") {
      throw new AuthorizationError();
    }
    await assertCurrentFinancialRevision(
      tx,
      context,
      input.expectedFinancialRevision,
    );

    const decidedAt = new Date();
    const selfApproved =
      input.decision === "approved" &&
      context.exception.requestedById === user.id;
    const [updated] = await tx
      .update(shippingNoteMissingInvoiceExceptions)
      .set({
        status: input.decision,
        decisionById: user.id,
        decidedAt,
        decisionReason: input.reason,
        selfApproved,
        updatedAt: decidedAt,
      })
      .where(
        and(
          eq(shippingNoteMissingInvoiceExceptions.id, context.exception.id),
          eq(shippingNoteMissingInvoiceExceptions.status, "pending"),
        ),
      )
      .returning();

    if (!updated) {
      throw new AuthorizationError();
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: input.decision === "approved"
        ? "shipping_note_charge.missing_invoice_exception.approved"
        : "shipping_note_charge.missing_invoice_exception.rejected",
      entityType: "missing_invoice_exception",
      entityId: updated.id,
      before: context.exception,
      after: updated,
      reason: input.reason,
    });

    return toEvidence(updated);
  });
}

export async function revokeMissingInvoiceException(
  input: RevokeMissingInvoiceExceptionInput,
  user: DbUser,
): Promise<MissingInvoiceExceptionEvidence> {
  requireActiveActor(user);
  if (user.role !== "admin") {
    throw new AuthorizationError();
  }

  return db.transaction(async (tx) => {
    const context = await lockExceptionContextByException(tx, input.exceptionId);
    assertExceptionMutableStatus(context.note.status);
    if (context.exception.status !== "approved") {
      throw new AuthorizationError();
    }
    await assertCurrentFinancialRevision(
      tx,
      context,
      input.expectedFinancialRevision,
    );

    const invalidatedAt = new Date();
    const [updated] = await tx
      .update(shippingNoteMissingInvoiceExceptions)
      .set({
        status: "revoked",
        invalidatedById: user.id,
        invalidatedAt,
        invalidationReason: input.reason,
        updatedAt: invalidatedAt,
      })
      .where(
        and(
          eq(shippingNoteMissingInvoiceExceptions.id, context.exception.id),
          eq(shippingNoteMissingInvoiceExceptions.status, "approved"),
        ),
      )
      .returning();

    if (!updated) {
      throw new AuthorizationError();
    }

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note_charge.missing_invoice_exception.revoked",
      entityType: "missing_invoice_exception",
      entityId: updated.id,
      before: context.exception,
      after: updated,
      reason: input.reason,
    });

    return toEvidence(updated);
  });
}

export async function invalidateMissingInvoiceExceptionsForNote(
  tx: ExceptionTransaction,
  input: {
    shippingNoteId: string;
    actorUserId: string;
    reason: string;
  },
): Promise<number> {
  const active = await tx
    .select()
    .from(shippingNoteMissingInvoiceExceptions)
    .where(
      and(
        eq(
          shippingNoteMissingInvoiceExceptions.shippingNoteId,
          input.shippingNoteId,
        ),
        inArray(
          shippingNoteMissingInvoiceExceptions.status,
          ACTIVE_EXCEPTION_STATUSES,
        ),
      ),
    )
    .orderBy(desc(shippingNoteMissingInvoiceExceptions.createdAt))
    .for("update");

  const invalidatedAt = new Date();
  for (const exception of active) {
    const [updated] = await tx
      .update(shippingNoteMissingInvoiceExceptions)
      .set({
        status: "invalidated",
        invalidatedById: input.actorUserId,
        invalidatedAt,
        invalidationReason: input.reason,
        updatedAt: invalidatedAt,
      })
      .where(
        and(
          eq(shippingNoteMissingInvoiceExceptions.id, exception.id),
          inArray(
            shippingNoteMissingInvoiceExceptions.status,
            ACTIVE_EXCEPTION_STATUSES,
          ),
        ),
      )
      .returning();

    if (!updated) {
      throw new AuthorizationError();
    }

    await logAuditEvent(tx, {
      actorUserId: input.actorUserId,
      action: "shipping_note_charge.missing_invoice_exception.invalidated",
      entityType: "missing_invoice_exception",
      entityId: updated.id,
      before: exception,
      after: updated,
      reason: input.reason,
    });
  }

  return active.length;
}

export async function listLatestMissingInvoiceExceptionsByCharge(
  executor: ExceptionExecutor,
  shippingNoteId: string,
): Promise<Map<string, MissingInvoiceExceptionEvidence>> {
  const rows = await executor
    .select()
    .from(shippingNoteMissingInvoiceExceptions)
    .where(
      eq(
        shippingNoteMissingInvoiceExceptions.shippingNoteId,
        shippingNoteId,
      ),
    )
    .orderBy(
      desc(shippingNoteMissingInvoiceExceptions.createdAt),
      desc(shippingNoteMissingInvoiceExceptions.id),
    );

  const latestByCharge = new Map<string, MissingInvoiceExceptionEvidence>();
  for (const row of rows) {
    if (!latestByCharge.has(row.buyingChargeId)) {
      latestByCharge.set(row.buyingChargeId, toEvidence(row));
    }
  }

  return latestByCharge;
}
