import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";

import {
  auditLogs,
  shippingNoteDocuments,
  shippingNotes,
} from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { issueShippingNoteEditGrant } from "@/features/shipping-notes/edit-grants";
import { getFinancialReviewRevisionForNote } from "@/features/shipping-notes/financial-review-revision";
import {
  createBuyingChargeForNote,
  createSellingChargeForNote,
  lockShippingNote,
  markShippingNoteChecked,
  reopenShippingNoteForCorrection,
  startAccountingReview,
  submitShippingNote,
  updateBuyingCharge,
  updateShippingNotePostSubmit,
} from "@/features/shipping-notes/mutations";
import {
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  updateBuyingChargeInputSchema,
} from "@/features/shipping-notes/validators";
import {
  hardDeleteShippingNoteDocument,
  registerShippingNoteDocumentMetadata,
} from "@/features/shipping-notes/documents/mutations";

import { createDraftFor, draftInput } from "./fixtures/shipping-notes";
import { createTaxRuleFixture, classifyNoteCharges } from "./fixtures/tax-rules";
import {
  createIntegrationActors,
  createIntegrationUser,
  type IntegrationActors,
} from "./fixtures/users";
import { listAuditLogsForEntity } from "./helpers/audit";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { db, ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("BLK");
let actors: IntegrationActors;
let sellingTaxRuleId: string;
let buyingTaxRuleId: string;
let opsActor: Awaited<ReturnType<typeof createIntegrationUser>>;

function sellingInput(noteId: string, label: string) {
  return createSellingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-SELL-${label}`,
    quantity: "1.000",
    unit: "shipment",
    unitPrice: "100.0000",
    currency: "VND",
  });
}

function buyingInput(noteId: string, label: string, unitPrice = "50.0000") {
  return createBuyingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-BUY-${label}`,
    quantity: "1.000",
    unit: "shipment",
    unitPrice,
    currency: "VND",
    vendorOrAgentText: `${runId} vendor ${label}`,
  });
}

async function createReviewingNote(label: string) {
  const draft = await createDraftFor(actors.saleA, runId, label);
  await createSellingChargeForNote(sellingInput(draft.id, label), actors.saleA);
  const submitted = await submitShippingNote({ id: draft.id }, actors.saleA);
  const buying = await createBuyingChargeForNote(
    submitted.id,
    buyingInput(submitted.id, label),
    actors.accountant,
  );
  await classifyNoteCharges({
    noteId: submitted.id,
    actor: actors.accountant,
    sellingTaxRuleId,
    buyingTaxRuleId,
  });
  const reviewing = await startAccountingReview(
    { id: submitted.id },
    actors.accountant,
  );
  return { reviewing, buying };
}

async function markCurrentStateChecked(noteId: string) {
  const expectedFinancialRevision = await getFinancialReviewRevisionForNote(noteId);
  if (!expectedFinancialRevision) {
    throw new Error("Expected a financial review revision.");
  }
  return markShippingNoteChecked({
    id: noteId,
    expectedFinancialRevision,
    sellingVerified: true,
    buyingVerified: true,
    taxVerified: true,
  }, actors.accountant);
}

async function createCheckedNote(label: string) {
  const { reviewing, buying } = await createReviewingNote(label);
  const checked = await markCurrentStateChecked(reviewing.id);
  return { checked, buying };
}

async function holdNoteRowLock(noteId: string) {
  let releaseLock: (() => void) | undefined;
  let signalLocked: (() => void) | undefined;
  const locked = new Promise<void>((resolve) => {
    signalLocked = resolve;
  });
  const released = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const transaction = db.transaction(async (tx) => {
    await tx
      .select({ id: shippingNotes.id })
      .from(shippingNotes)
      .where(eq(shippingNotes.id, noteId))
      .limit(1)
      .for("update");
    signalLocked?.();
    await released;
  });

  await locked;
  return {
    release: () => releaseLock?.(),
    completed: transaction,
  };
}

async function allowWaiterToQueue(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

describe("final acceptance blocker invariants", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
    opsActor = await createIntegrationUser({
      runId,
      label: "ops",
      role: "ops",
    });
    const sellingRule = await createTaxRuleFixture({
      runId,
      label: "S8",
      actor: actors.admin,
      chargeSection: "selling",
      vatPercent: "8.00",
    });
    const buyingRule = await createTaxRuleFixture({
      runId,
      label: "B8",
      actor: actors.admin,
      chargeSection: "buying",
      vatPercent: "8.00",
    });
    sellingTaxRuleId = sellingRule.id;
    buyingTaxRuleId = buyingRule.id;
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("requires explicit reasoned reopen before a checked delegated correction", async () => {
    const { checked } = await createCheckedNote("EXPLICIT-REOPEN");
    await issueShippingNoteEditGrant({
      shippingNoteId: checked.id,
      recipientUserId: actors.saleA.id,
      reason: "Operational correction",
    }, actors.admin);
    const operationalInput = {
      ...draftInput(runId, "EXPLICIT-REOPEN"),
      id: checked.id,
      expectedUpdatedAt: checked.updatedAt,
      vesselName: "Corrected Vessel",
    };

    await expect(updateShippingNotePostSubmit(
      operationalInput,
      actors.saleA,
    )).rejects.toBeInstanceOf(AuthorizationError);
    await expect(reopenShippingNoteForCorrection({
      id: checked.id,
      expectedStatus: "checked",
      reason: "   ",
    }, actors.admin)).rejects.toThrow();

    const reopened = await reopenShippingNoteForCorrection({
      id: checked.id,
      expectedStatus: "checked",
      reason: "Correct vessel after carrier confirmation",
    }, actors.admin);
    await expect(updateShippingNotePostSubmit({
      ...operationalInput,
      expectedUpdatedAt: reopened.updatedAt,
    }, actors.saleA)).resolves.toMatchObject({
      status: "accounting_reviewing",
      vesselName: "Corrected Vessel",
    });

    const auditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "shipping_note.selling_rate_reopened",
        actorUserId: actors.admin.id,
        reason: "Correct vessel after carrier confirmation",
        before: expect.objectContaining({ status: "checked" }),
        after: expect.objectContaining({ status: "accounting_reviewing" }),
      }),
    ]));
  });

  it("rejects a stale reviewed revision after a committed buying mutation", async () => {
    const { reviewing, buying } = await createReviewingNote("STALE-REVISION");
    const staleRevision = await getFinancialReviewRevisionForNote(reviewing.id);
    await updateBuyingCharge(
      buying.id,
      updateBuyingChargeInputSchema.parse({
        ...buyingInput(reviewing.id, "STALE-REVISION-UPDATED", "75.0000"),
        id: buying.id,
      }),
      actors.accountant,
    );

    await expect(markShippingNoteChecked({
      id: reviewing.id,
      expectedFinancialRevision: staleRevision ?? "",
      sellingVerified: true,
      buyingVerified: true,
      taxVerified: true,
    }, actors.accountant)).rejects.toThrow(/Financial or tax data changed/);

    expect((await db.select({ status: shippingNotes.status })
      .from(shippingNotes)
      .where(eq(shippingNotes.id, reviewing.id))
      .limit(1))[0]?.status).toBe("accounting_reviewing");
    expect((await listAuditLogsForEntity("shipping_note", reviewing.id)).some(
      (row) => row.action === "shipping_note.accounting_review.checked",
    )).toBe(false);
  });

  it("serializes a queued financial edit ahead of Mark Checked and rejects stale confirmation", async () => {
    const { reviewing, buying } = await createReviewingNote("PARALLEL-REVIEW");
    const expectedFinancialRevision = await getFinancialReviewRevisionForNote(reviewing.id);
    const blocker = await holdNoteRowLock(reviewing.id);

    const editPromise = updateBuyingCharge(
      buying.id,
      updateBuyingChargeInputSchema.parse({
        ...buyingInput(reviewing.id, "PARALLEL-UPDATED", "80.0000"),
        id: buying.id,
      }),
      actors.accountant,
    );
    await allowWaiterToQueue();
    const checkedPromise = markShippingNoteChecked({
      id: reviewing.id,
      expectedFinancialRevision: expectedFinancialRevision ?? "",
      sellingVerified: true,
      buyingVerified: true,
      taxVerified: true,
    }, actors.accountant);
    await allowWaiterToQueue();
    blocker.release();

    await expect(editPromise).resolves.toMatchObject({ unitPrice: "80.0000" });
    await expect(checkedPromise).rejects.toThrow(/Financial or tax data changed/);
    await blocker.completed;
  });

  it("rejects queued OPS document registration when Close commits first", async () => {
    const { checked } = await createCheckedNote("DOC-CLOSE-REGISTER");
    const blocker = await holdNoteRowLock(checked.id);
    const closePromise = lockShippingNote({ id: checked.id }, actors.admin);
    await allowWaiterToQueue();
    const registrationPromise = registerShippingNoteDocumentMetadata({
      shippingNoteId: checked.id,
      documentType: "pre_alert_hbl",
      originalFileName: "synthetic-hbl.pdf",
      storageProvider: "r2",
      storageKey: `documents/${runId}/close-race-hbl.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 128,
    }, opsActor);
    await allowWaiterToQueue();
    blocker.release();

    await expect(closePromise).resolves.toMatchObject({ status: "locked" });
    await expect(registrationPromise).rejects.toBeInstanceOf(AuthorizationError);
    await blocker.completed;

    const visibleDocuments = await db
      .select({ id: shippingNoteDocuments.id })
      .from(shippingNoteDocuments)
      .where(
        and(
          eq(shippingNoteDocuments.shippingNoteId, checked.id),
          isNull(shippingNoteDocuments.deletedAt),
        ),
      );
    expect(visibleDocuments).toHaveLength(0);
  });

  it("rejects queued document deletion when Close commits first", async () => {
    const { checked } = await createCheckedNote("DOC-CLOSE-DELETE");
    const document = await registerShippingNoteDocumentMetadata({
      shippingNoteId: checked.id,
      documentType: "pre_alert_mbl",
      originalFileName: "synthetic-mbl.pdf",
      storageProvider: "r2",
      storageKey: `documents/${runId}/close-race-mbl.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 256,
    }, opsActor);
    const blocker = await holdNoteRowLock(checked.id);
    const closePromise = lockShippingNote({ id: checked.id }, actors.admin);
    await allowWaiterToQueue();
    const deletePromise = hardDeleteShippingNoteDocument({
      id: document.id,
      shippingNoteId: checked.id,
      reason: "Concurrent removal",
    }, opsActor);
    await allowWaiterToQueue();
    blocker.release();

    await expect(closePromise).resolves.toMatchObject({ status: "locked" });
    await expect(deletePromise).rejects.toBeInstanceOf(AuthorizationError);
    await blocker.completed;

    const [persisted] = await db
      .select({ id: shippingNoteDocuments.id })
      .from(shippingNoteDocuments)
      .where(eq(shippingNoteDocuments.id, document.id))
      .limit(1);
    expect(persisted?.id).toBe(document.id);
    expect((await db.select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityId, document.id),
          eq(auditLogs.action, "shipping_note.document.hard_delete"),
        ),
      )).length).toBe(0);
  });
});
