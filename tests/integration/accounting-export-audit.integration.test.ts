import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";

import {
  shippingNoteCharges,
  shippingNoteExports,
  shippingNotes,
} from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  approveShippingNote,
  cancelFinalizedShippingNote,
  cancelShippingNote,
  createBuyingChargeForNote,
  createSellingChargeForNote,
  lockShippingNote,
  markShippingNoteChecked,
  reopenShippingNoteForCorrection,
  startAccountingReview,
  submitShippingNote,
  unlockShippingNote,
  updateBuyingCharge,
} from "@/features/shipping-notes/mutations";
import {
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  updateBuyingChargeInputSchema,
} from "@/features/shipping-notes/validators";
import { getInternalShippingNoteExportDataForUser } from "@/features/shipping-notes/export/queries";
import {
  createPendingInternalPdfExportRecord,
  createPendingInternalXlsxExportRecord,
  markInternalPdfExportFailed,
  markInternalPdfExportGenerated,
  markInternalXlsxExportGenerated,
} from "@/features/shipping-notes/export/mutations";
import { generateInternalShippingNotePdf } from "@/features/shipping-notes/export/pdf/generator";
import { persistGeneratedExportArtifact } from "@/features/shipping-notes/export/artifacts";
import { uploadShippingNoteExportToDrive } from "@/features/shipping-notes/export/drive/service";
import { getHistoricalExportDownloadForUser } from "@/features/shipping-notes/export/download";
import { listShippingNoteExportHistoryForUser } from "@/features/shipping-notes/export/history";
import { DRIVE_UPLOAD_STALE_AFTER_MS } from "@/features/shipping-notes/export/drive/service";
import { EXPORT_ERROR_CODES } from "@/features/shipping-notes/export/errors";
import { calculateArtifactSha256 } from "@/lib/artifact-storage/checksum";
import { ARTIFACT_STORAGE_ERROR_CODES } from "@/lib/artifact-storage/errors";
import { FakeArtifactStorage } from "@/lib/artifact-storage/fake";
import { getVerifiedArtifactBytes } from "@/lib/artifact-storage/verified";
import { DRIVE_ERROR_CODES, DriveError } from "@/lib/drive/errors";
import { FakeDriveArtifactUploader } from "@/lib/drive/fake";
import {
  getFinancialSummaryForNoteForUser,
  getShippingNoteForUser,
  listBuyingChargesForNoteForUser,
} from "@/features/shipping-notes/queries";
import {
  assignChargeTaxRule,
  overrideChargeVatPercent,
} from "@/features/shipping-notes/tax/mutations";
import { listChargeTaxDetailsForNoteForUser } from "@/features/shipping-notes/tax/queries";
import {
  assignChargeTaxRuleInputSchema,
  overrideChargeVatPercentInputSchema,
} from "@/features/shipping-notes/tax/validators";

import { createIntegrationActors, type IntegrationActors } from "./fixtures/users";
import { createDraftFor, softDeleteNote } from "./fixtures/shipping-notes";
import {
  classifyNoteCharges,
  createTaxRuleFixture,
} from "./fixtures/tax-rules";
import { listAuditLogsForEntity } from "./helpers/audit";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { db, ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("ACC");
let actors: IntegrationActors;
let sellingTaxRuleId: string;
let buyingTaxRuleId: string;

function sellingInput(noteId: string, label: string) {
  return createSellingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-ACC-SELL-${label}`,
    description: `${runId} accounting selling ${label}`,
    quantity: "1.000",
    unit: "shipment",
    unitPrice: "250.0000",
    currency: "VND",
  });
}

function buyingInput(noteId: string, label: string) {
  return createBuyingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-ACC-BUY-${label}`,
    description: `${runId} accounting buying ${label}`,
    quantity: "1.000",
    unit: "shipment",
    unitPrice: "100.0000",
    currency: "VND",
    vendorOrAgentText: `${runId} accounting vendor ${label}`,
  });
}

async function createSubmittedNote(label: string) {
  const note = await createDraftFor(actors.saleA, runId, label);
  await createSellingChargeForNote(sellingInput(note.id, `${label}-SELL`), actors.saleA);
  const submitted = await submitShippingNote({ id: note.id }, actors.saleA);
  await classifyNoteCharges({
    noteId: submitted.id,
    actor: actors.accountant,
    sellingTaxRuleId,
  });
  return submitted;
}

async function createCheckedNote(label: string) {
  const submitted = await createSubmittedNote(label);
  await createBuyingChargeForNote(
    submitted.id,
    buyingInput(submitted.id, `${label}-BUY`),
    actors.accountant,
  );
  await classifyNoteCharges({
    noteId: submitted.id,
    actor: actors.accountant,
    buyingTaxRuleId,
  });
  await startAccountingReview({ id: submitted.id }, actors.accountant);
  return markShippingNoteChecked({ id: submitted.id }, actors.accountant);
}

async function createApprovedNote(label: string) {
  const checked = await createCheckedNote(label);
  return approveShippingNote({ id: checked.id }, actors.admin);
}

async function createLockedNote(label: string, lockReason?: string) {
  const approved = await createApprovedNote(label);
  return lockShippingNote({ id: approved.id, lockReason }, actors.admin);
}

async function getCheckedTransitionMetadata(noteId: string): Promise<{
  checkedById: string | null;
  checkedAt: Date | null;
}> {
  const [row] = await db
    .select({
      checkedById: shippingNotes.checkedById,
      checkedAt: shippingNotes.checkedAt,
    })
    .from(shippingNotes)
    .where(eq(shippingNotes.id, noteId))
    .limit(1);

  return {
    checkedById: row?.checkedById ?? null,
    checkedAt: row?.checkedAt ?? null,
  };
}

async function getApprovalTransitionMetadata(noteId: string): Promise<{
  status: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
}> {
  const [row] = await db
    .select({
      status: shippingNotes.status,
      approvedById: shippingNotes.approvedById,
      approvedAt: shippingNotes.approvedAt,
    })
    .from(shippingNotes)
    .where(eq(shippingNotes.id, noteId))
    .limit(1);

  return {
    status: row?.status ?? null,
    approvedById: row?.approvedById ?? null,
    approvedAt: row?.approvedAt ?? null,
  };
}

async function getLockTransitionMetadata(noteId: string): Promise<{
  status: string | null;
  lockedById: string | null;
  lockedAt: Date | null;
  lockReason: string | null;
}> {
  const [row] = await db
    .select({
      status: shippingNotes.status,
      lockedById: shippingNotes.lockedById,
      lockedAt: shippingNotes.lockedAt,
      lockReason: shippingNotes.lockReason,
    })
    .from(shippingNotes)
    .where(eq(shippingNotes.id, noteId))
    .limit(1);

  return {
    status: row?.status ?? null,
    lockedById: row?.lockedById ?? null,
    lockedAt: row?.lockedAt ?? null,
    lockReason: row?.lockReason ?? null,
  };
}

async function getCancellationTransitionMetadata(noteId: string): Promise<{
  status: string | null;
  submittedAt: Date | null;
  checkedById: string | null;
  checkedAt: Date | null;
  approvedById: string | null;
  approvedAt: Date | null;
  lockedById: string | null;
  lockedAt: Date | null;
  lockReason: string | null;
  cancelledById: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  deletedAt: Date | null;
}> {
  const [row] = await db
    .select({
      status: shippingNotes.status,
      submittedAt: shippingNotes.submittedAt,
      checkedById: shippingNotes.checkedById,
      checkedAt: shippingNotes.checkedAt,
      approvedById: shippingNotes.approvedById,
      approvedAt: shippingNotes.approvedAt,
      lockedById: shippingNotes.lockedById,
      lockedAt: shippingNotes.lockedAt,
      lockReason: shippingNotes.lockReason,
      cancelledById: shippingNotes.cancelledById,
      cancelledAt: shippingNotes.cancelledAt,
      cancelReason: shippingNotes.cancelReason,
      deletedAt: shippingNotes.deletedAt,
    })
    .from(shippingNotes)
    .where(eq(shippingNotes.id, noteId))
    .limit(1);

  return {
    status: row?.status ?? null,
    submittedAt: row?.submittedAt ?? null,
    checkedById: row?.checkedById ?? null,
    checkedAt: row?.checkedAt ?? null,
    approvedById: row?.approvedById ?? null,
    approvedAt: row?.approvedAt ?? null,
    lockedById: row?.lockedById ?? null,
    lockedAt: row?.lockedAt ?? null,
    lockReason: row?.lockReason ?? null,
    cancelledById: row?.cancelledById ?? null,
    cancelledAt: row?.cancelledAt ?? null,
    cancelReason: row?.cancelReason ?? null,
    deletedAt: row?.deletedAt ?? null,
  };
}

async function getExportRecord(exportId: string) {
  const [row] = await db
    .select()
    .from(shippingNoteExports)
    .where(eq(shippingNoteExports.id, exportId))
    .limit(1);

  if (!row) {
    throw new Error("Expected export record fixture.");
  }

  return row;
}

async function createDurableGeneratedXlsxExport(input: {
  noteId: string;
  fileName: string;
  actor: typeof actors.accountant | typeof actors.admin;
  storage: FakeArtifactStorage;
  body?: Buffer;
}) {
  const body = input.body ?? Buffer.from(`${input.fileName}-artifact`);
  const checksumSha256 = calculateArtifactSha256(body);
  const pending = await createPendingInternalXlsxExportRecord({
    shippingNoteId: input.noteId,
    fileName: input.fileName,
    user: input.actor,
  });
  const storedArtifact = await persistGeneratedExportArtifact({
    exportId: pending.id,
    exportType: "excel",
    bytes: body,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    checksumSha256,
    storage: input.storage,
  });

  await markInternalXlsxExportGenerated({
    exportId: pending.id,
    fileName: input.fileName,
    checksumSha256,
    artifactStorageKey: storedArtifact.artifactStorageKey,
    artifactSizeBytes: storedArtifact.artifactSizeBytes,
    artifactMimeType: storedArtifact.artifactMimeType,
    sellingChargeCount: 1,
    buyingChargeCount: 1,
    generatedAt: new Date(),
    user: input.actor,
  });

  return getExportRecord(pending.id);
}

async function getActiveBuyingChargeId(noteId: string): Promise<string> {
  const [charge] = await db
    .select({ id: shippingNoteCharges.id })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, noteId),
        eq(shippingNoteCharges.section, "buying"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!charge) {
    throw new Error("Expected active buying charge fixture.");
  }

  return charge.id;
}

describe("accounting review transitions, export eligibility, and audits", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
    const [sellingTaxRule, buyingTaxRule] = await Promise.all([
      createTaxRuleFixture({
        runId,
        label: "ACC-SELL-TAX",
        actor: actors.admin,
        chargeSection: "selling",
      }),
      createTaxRuleFixture({
        runId,
        label: "ACC-BUY-TAX",
        actor: actors.admin,
        chargeSection: "buying",
      }),
    ]);
    sellingTaxRuleId = sellingTaxRule.id;
    buyingTaxRuleId = buyingTaxRule.id;
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("allows submitted to accounting_reviewing to checked and audits each transition", async () => {
    const submitted = await createSubmittedNote("TRANSITION-HAPPY");
    const reviewing = await startAccountingReview(
      { id: submitted.id },
      actors.accountant,
    );
    const checked = await markShippingNoteChecked(
      { id: submitted.id },
      actors.accountant,
    );

    expect(reviewing.status).toBe("accounting_reviewing");
    expect(checked.status).toBe("checked");
    const checkedMetadata = await getCheckedTransitionMetadata(checked.id);
    expect(checkedMetadata.checkedById).toBe(actors.accountant.id);
    expect(checkedMetadata.checkedAt).toBeInstanceOf(Date);

    const auditRows = await listAuditLogsForEntity("shipping_note", submitted.id);
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "shipping_note.submit",
        "shipping_note.accounting_review.start",
        "shipping_note.accounting_review.checked",
      ]),
    );
    expect(auditRows.find(
      (row) => row.action === "shipping_note.accounting_review.start",
    )?.before).toMatchObject({ status: "submitted" });
    expect(auditRows.find(
      (row) => row.action === "shipping_note.accounting_review.checked",
    )?.after).toMatchObject({
      status: "checked",
      checkedById: actors.accountant.id,
    });
    expect(
      auditRows.find(
        (row) => row.action === "shipping_note.accounting_review.checked",
      )?.after,
    ).toHaveProperty("checkedAt");
  });

  it("denies invalid accounting transitions without changing status", async () => {
    const draft = await createDraftFor(actors.saleA, runId, "TRANSITION-DRAFT");
    const submitted = await createSubmittedNote("TRANSITION-DIRECT-CHECK");
    const checked = await createCheckedNote("TRANSITION-CHECKED");

    await expect(
      startAccountingReview({ id: draft.id }, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      startAccountingReview({ id: draft.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      markShippingNoteChecked({ id: submitted.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      startAccountingReview({ id: checked.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      markShippingNoteChecked({ id: checked.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("allows admin to perform current accounting transitions", async () => {
    const submitted = await createSubmittedNote("TRANSITION-ADMIN");
    const reviewing = await startAccountingReview({ id: submitted.id }, actors.admin);
    const checked = await markShippingNoteChecked({ id: submitted.id }, actors.admin);

    expect(reviewing.status).toBe("accounting_reviewing");
    expect(checked.status).toBe("checked");
    const checkedMetadata = await getCheckedTransitionMetadata(checked.id);
    expect(checkedMetadata.checkedById).toBe(actors.admin.id);
    expect(checkedMetadata.checkedAt).toBeInstanceOf(Date);
  });

  it("allows admin to approve checked notes and audits the transition", async () => {
    const checked = await createCheckedNote("APPROVAL-HAPPY");
    const approved = await approveShippingNote({ id: checked.id }, actors.admin);

    expect(approved.status).toBe("approved");

    const approvalMetadata = await getApprovalTransitionMetadata(checked.id);
    expect(approvalMetadata.status).toBe("approved");
    expect(approvalMetadata.approvedById).toBe(actors.admin.id);
    expect(approvalMetadata.approvedAt).toBeInstanceOf(Date);

    const auditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    const approvalAudit = auditRows.find(
      (row) => row.action === "shipping_note.approve",
    );

    expect(approvalAudit?.actorUserId).toBe(actors.admin.id);
    expect(approvalAudit?.before).toMatchObject({
      status: "checked",
      approvedById: null,
      approvedAt: null,
    });
    expect(approvalAudit?.after).toMatchObject({
      status: "approved",
      approvedById: actors.admin.id,
    });
    expect(approvalAudit?.after).toHaveProperty("approvedAt");
  });

  it("allows the same admin to check and approve without a four-eyes rule", async () => {
    const submitted = await createSubmittedNote("APPROVAL-SAME-ADMIN");
    await createBuyingChargeForNote(
      submitted.id,
      buyingInput(submitted.id, "APPROVAL-SAME-ADMIN-BUY"),
      actors.admin,
    );
    await classifyNoteCharges({
      noteId: submitted.id,
      actor: actors.admin,
      buyingTaxRuleId,
    });
    await startAccountingReview({ id: submitted.id }, actors.admin);
    const checked = await markShippingNoteChecked({ id: submitted.id }, actors.admin);
    const approved = await approveShippingNote({ id: checked.id }, actors.admin);

    const checkedMetadata = await getCheckedTransitionMetadata(checked.id);
    const approvalMetadata = await getApprovalTransitionMetadata(checked.id);

    expect(checkedMetadata.checkedById).toBe(actors.admin.id);
    expect(approved.status).toBe("approved");
    expect(approvalMetadata.approvedById).toBe(actors.admin.id);
  });

  it("denies approval to sale and accountant without changing approval metadata", async () => {
    const checked = await createCheckedNote("APPROVAL-AUTHZ");

    await expect(
      approveShippingNote({ id: checked.id }, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      approveShippingNote({ id: checked.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const approvalMetadata = await getApprovalTransitionMetadata(checked.id);
    expect(approvalMetadata).toStrictEqual({
      status: "checked",
      approvedById: null,
      approvedAt: null,
    });

    const auditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    expect(auditRows.some((row) => row.action === "shipping_note.approve")).toBe(false);
  });

  it("rejects stale or invalid approval transitions without overwriting status", async () => {
    const submitted = await createSubmittedNote("APPROVAL-INVALID-SUBMITTED");
    const checked = await createCheckedNote("APPROVAL-STALE");
    await approveShippingNote({ id: checked.id }, actors.admin);

    await expect(
      approveShippingNote({ id: submitted.id }, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      approveShippingNote({ id: checked.id }, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(await getApprovalTransitionMetadata(submitted.id)).toStrictEqual({
      status: "submitted",
      approvedById: null,
      approvedAt: null,
    });
    expect((await getApprovalTransitionMetadata(checked.id)).status).toBe("approved");

    const staleAuditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    expect(staleAuditRows.filter(
      (row) => row.action === "shipping_note.approve",
    )).toHaveLength(1);
    const submittedAuditRows = await listAuditLogsForEntity("shipping_note", submitted.id);
    expect(submittedAuditRows.some(
      (row) => row.action === "shipping_note.approve",
    )).toBe(false);
  });

  it("allows admin to lock approved notes and audits the transition", async () => {
    const approved = await createApprovedNote("LOCK-HAPPY");
    const locked = await lockShippingNote(
      { id: approved.id, lockReason: "  Period finalized  " },
      actors.admin,
    );

    expect(locked.status).toBe("locked");

    const lockMetadata = await getLockTransitionMetadata(approved.id);
    expect(lockMetadata.status).toBe("locked");
    expect(lockMetadata.lockedById).toBe(actors.admin.id);
    expect(lockMetadata.lockedAt).toBeInstanceOf(Date);
    expect(lockMetadata.lockReason).toBe("Period finalized");

    const auditRows = await listAuditLogsForEntity("shipping_note", approved.id);
    const lockAudit = auditRows.find(
      (row) => row.action === "shipping_note.lock",
    );

    expect(lockAudit?.actorUserId).toBe(actors.admin.id);
    expect(lockAudit?.before).toMatchObject({
      status: "approved",
      lockedById: null,
      lockedAt: null,
      lockReason: null,
    });
    expect(lockAudit?.after).toMatchObject({
      status: "locked",
      lockedById: actors.admin.id,
      lockReason: "Period finalized",
    });
    expect(lockAudit?.after).toHaveProperty("lockedAt");
  });

  it("allows admin to unlock locked notes with a mandatory audit reason", async () => {
    const locked = await createLockedNote("UNLOCK-HAPPY", "Month close");
    const unlocked = await unlockShippingNote(
      { id: locked.id, unlockReason: "Correct approved shipment metadata" },
      actors.admin,
    );

    expect(unlocked.status).toBe("approved");
    expect(await getLockTransitionMetadata(locked.id)).toStrictEqual({
      status: "approved",
      lockedById: null,
      lockedAt: null,
      lockReason: null,
    });

    const auditRows = await listAuditLogsForEntity("shipping_note", locked.id);
    const unlockAudit = auditRows.find(
      (row) => row.action === "shipping_note.unlock",
    );

    expect(unlockAudit?.actorUserId).toBe(actors.admin.id);
    expect(unlockAudit?.reason).toBe("Correct approved shipment metadata");
    expect(unlockAudit?.before).toMatchObject({
      status: "locked",
      lockedById: actors.admin.id,
      lockReason: "Month close",
    });
    expect(unlockAudit?.before).toHaveProperty("lockedAt");
    expect(unlockAudit?.after).toMatchObject({
      status: "approved",
      lockedById: null,
      lockedAt: null,
      lockReason: null,
    });
  });

  it("denies lock and unlock to sale and accountant without metadata changes", async () => {
    const approved = await createApprovedNote("LOCK-AUTHZ");
    const locked = await createLockedNote("UNLOCK-AUTHZ", "Admin close");

    await expect(
      lockShippingNote({ id: approved.id }, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      lockShippingNote({ id: approved.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      unlockShippingNote({ id: locked.id, unlockReason: "Unauthorized attempt" }, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      unlockShippingNote(
        { id: locked.id, unlockReason: "Unauthorized attempt" },
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(await getLockTransitionMetadata(approved.id)).toStrictEqual({
      status: "approved",
      lockedById: null,
      lockedAt: null,
      lockReason: null,
    });
    const lockedMetadata = await getLockTransitionMetadata(locked.id);
    expect(lockedMetadata.status).toBe("locked");
    expect(lockedMetadata.lockedById).toBe(actors.admin.id);
    expect(lockedMetadata.lockReason).toBe("Admin close");

    const approvedAuditRows = await listAuditLogsForEntity("shipping_note", approved.id);
    expect(approvedAuditRows.some((row) => row.action === "shipping_note.lock")).toBe(false);
    const lockedAuditRows = await listAuditLogsForEntity("shipping_note", locked.id);
    expect(lockedAuditRows.filter(
      (row) => row.action === "shipping_note.unlock",
    )).toHaveLength(0);
  });

  it("rejects checked to locked to avoid implicit approval", async () => {
    const checked = await createCheckedNote("LOCK-CHECKED-DENIED");

    await expect(
      lockShippingNote({ id: checked.id }, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(await getLockTransitionMetadata(checked.id)).toStrictEqual({
      status: "checked",
      lockedById: null,
      lockedAt: null,
      lockReason: null,
    });
    const auditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    expect(auditRows.some((row) => row.action === "shipping_note.lock")).toBe(false);
  });

  it("rejects stale lock and unlock transitions without false audit rows", async () => {
    const approved = await createApprovedNote("LOCK-STALE");
    const locked = await lockShippingNote({ id: approved.id }, actors.admin);

    await expect(
      lockShippingNote({ id: locked.id }, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await unlockShippingNote(
      { id: locked.id, unlockReason: "Temporary correction" },
      actors.admin,
    );
    await expect(
      unlockShippingNote(
        { id: locked.id, unlockReason: "Second unlock" },
        actors.admin,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const auditRows = await listAuditLogsForEntity("shipping_note", locked.id);
    expect(auditRows.filter((row) => row.action === "shipping_note.lock")).toHaveLength(1);
    expect(auditRows.filter((row) => row.action === "shipping_note.unlock")).toHaveLength(1);
  });

  it("keeps locked notes immutable through normal business mutation paths", async () => {
    const locked = await createLockedNote("LOCKED-IMMUTABLE", "Immutable");
    const buyingChargeId = await getActiveBuyingChargeId(locked.id);

    await expect(
      updateBuyingCharge(
        buyingChargeId,
        updateBuyingChargeInputSchema.parse({
          id: buyingChargeId,
          chargeName: `${runId}-IMMUTABLE-BUY`,
          description: `${runId} immutable buying`,
          quantity: "2.000",
          unit: "shipment",
          unitPrice: "120.0000",
          currency: "VND",
          vendorOrAgentText: `${runId} immutable vendor`,
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      assignChargeTaxRule(
        assignChargeTaxRuleInputSchema.parse({
          chargeId: buyingChargeId,
          taxRuleId: buyingTaxRuleId,
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      overrideChargeVatPercent(
        overrideChargeVatPercentInputSchema.parse({
          chargeId: buyingChargeId,
          vatPercent: "12.00",
          reason: "Should not mutate locked charge",
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      approveShippingNote({ id: locked.id }, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const lockMetadata = await getLockTransitionMetadata(locked.id);
    expect(lockMetadata.status).toBe("locked");
    expect(lockMetadata.lockedById).toBe(actors.admin.id);
  });

  it("restricts internal XLSX export data to accountant/admin and checked notes", async () => {
    const checked = await createCheckedNote("EXPORT-CHECKED");

    await expect(
      getInternalShippingNoteExportDataForUser(checked.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const accountantExport = await getInternalShippingNoteExportDataForUser(
      checked.id,
      actors.accountant,
    );
    const adminExport = await getInternalShippingNoteExportDataForUser(
      checked.id,
      actors.admin,
    );

    expect(accountantExport?.note.jobsheetNo).toBe(`${runId}-EXPORT-CHECKED`);
    expect(accountantExport?.sellingCharges).toHaveLength(1);
    expect(accountantExport?.buyingCharges).toHaveLength(1);
    expect(accountantExport?.summary).toMatchObject({
      totalSellingVnd: "250.00",
      totalBuyingVnd: "100.00",
      grossProfitVnd: "150.00",
    });
    expect(adminExport?.note.id).toBe(checked.id);
  });

  it("keeps internal export available after approval without granting sale access", async () => {
    const checked = await createCheckedNote("EXPORT-APPROVED");
    const approved = await approveShippingNote({ id: checked.id }, actors.admin);

    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const accountantExport = await getInternalShippingNoteExportDataForUser(
      approved.id,
      actors.accountant,
    );
    const adminExport = await getInternalShippingNoteExportDataForUser(
      approved.id,
      actors.admin,
    );

    expect(accountantExport?.note.status).toBe("approved");
    expect(adminExport?.note.status).toBe("approved");
    expect(accountantExport?.summary).toMatchObject({
      totalSellingVnd: "250.00",
      totalBuyingVnd: "100.00",
      grossProfitVnd: "150.00",
    });
  });

  it("keeps internal export available while locked without mutating note status", async () => {
    const locked = await createLockedNote("EXPORT-LOCKED", "Exportable lock");

    await expect(
      getInternalShippingNoteExportDataForUser(locked.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const accountantExport = await getInternalShippingNoteExportDataForUser(
      locked.id,
      actors.accountant,
    );
    const adminExport = await getInternalShippingNoteExportDataForUser(
      locked.id,
      actors.admin,
    );

    expect(accountantExport?.note.status).toBe("locked");
    expect(adminExport?.note.status).toBe("locked");
    expect((await getLockTransitionMetadata(locked.id)).status).toBe("locked");
  });

  it("persists generated PDF export records without mutating Shipping Note status", async () => {
    const checked = await createCheckedNote("PDF-EXPORT-GENERATED");
    const exportData = await getInternalShippingNoteExportDataForUser(
      checked.id,
      actors.accountant,
    );

    if (!exportData) {
      throw new Error("Expected PDF export fixture data.");
    }

    const generatedAt = new Date();
    const generated = await generateInternalShippingNotePdf(
      exportData,
      generatedAt,
    );
    const pending = await createPendingInternalPdfExportRecord({
      shippingNoteId: checked.id,
      fileName: generated.fileName,
      user: actors.accountant,
    });

    await markInternalPdfExportGenerated({
      exportId: pending.id,
      fileName: generated.fileName,
      checksumSha256: generated.checksumSha256,
      artifactStorageKey: `shipping-note-exports/${pending.id}/artifact.pdf`,
      artifactSizeBytes: generated.buffer.byteLength,
      artifactMimeType: "application/pdf",
      sellingChargeCount: exportData.summary.sellingChargeCount,
      buyingChargeCount: exportData.summary.buyingChargeCount,
      generatedAt,
      user: actors.accountant,
    });

    expect(await getExportRecord(pending.id)).toMatchObject({
      exportType: "pdf",
      version: 1,
      status: "generated",
      fileName: generated.fileName,
      checksum: generated.checksumSha256,
      generatedById: actors.accountant.id,
      generatedAt,
    });
    expect((await getCancellationTransitionMetadata(checked.id)).status).toBe("checked");

    const auditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    expect(auditRows.some(
      (row) => row.action === "shipping_note.export.pdf.generated",
    )).toBe(true);
  });

  it("persists failed PDF export records with sanitized errors", async () => {
    const approved = await createApprovedNote("PDF-EXPORT-FAILED");
    const pending = await createPendingInternalPdfExportRecord({
      shippingNoteId: approved.id,
      fileName: `${runId}-failed.pdf`,
      user: actors.admin,
    });

    await markInternalPdfExportFailed({
      exportId: pending.id,
      errorCode: EXPORT_ERROR_CODES.GENERATION_FAILED,
      fileName: `${runId}-failed.pdf`,
      user: actors.admin,
    });

    expect(await getExportRecord(pending.id)).toMatchObject({
      exportType: "pdf",
      version: 1,
      status: "failed",
      fileName: `${runId}-failed.pdf`,
      checksum: null,
      errorMessage: EXPORT_ERROR_CODES.GENERATION_FAILED,
      generatedById: actors.admin.id,
      generatedAt: null,
    });
    expect((await getApprovalTransitionMetadata(approved.id)).status).toBe("approved");

    const auditRows = await listAuditLogsForEntity("shipping_note", approved.id);
    expect(auditRows.some(
      (row) => row.action === "shipping_note.export.pdf.failed",
    )).toBe(true);
  });

  it("persists generated XLSX artifact storage metadata using fake storage", async () => {
    const checked = await createCheckedNote("ARTIFACT-XLSX");
    const storage = new FakeArtifactStorage();
    const fileName = `${runId}-artifact.xlsx`;
    const pending = await createPendingInternalXlsxExportRecord({
      shippingNoteId: checked.id,
      fileName,
      user: actors.accountant,
    });
    const bytes = Buffer.from("xlsx artifact bytes");
    const checksumSha256 = calculateArtifactSha256(bytes);
    const storedArtifact = await persistGeneratedExportArtifact({
      exportId: pending.id,
      exportType: "excel",
      bytes,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksumSha256,
      storage,
    });
    const generatedAt = new Date();

    await markInternalXlsxExportGenerated({
      exportId: pending.id,
      fileName,
      checksumSha256,
      artifactStorageKey: storedArtifact.artifactStorageKey,
      artifactSizeBytes: storedArtifact.artifactSizeBytes,
      artifactMimeType: storedArtifact.artifactMimeType,
      sellingChargeCount: 1,
      buyingChargeCount: 1,
      generatedAt,
      user: actors.accountant,
    });

    const exportRecord = await getExportRecord(pending.id);
    expect(exportRecord).toMatchObject({
      exportType: "excel",
      status: "generated",
      driveUploadStatus: "not_uploaded",
      artifactStorageKey: storedArtifact.artifactStorageKey,
      artifactSizeBytes: bytes.byteLength,
      artifactMimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksum: checksumSha256,
    });
    await expect(getVerifiedArtifactBytes(exportRecord, storage)).resolves.toEqual(bytes);
  });

  it("persists generated PDF artifact storage metadata using fake storage", async () => {
    const checked = await createCheckedNote("ARTIFACT-PDF");
    const storage = new FakeArtifactStorage();
    const fileName = `${runId}-artifact.pdf`;
    const pending = await createPendingInternalPdfExportRecord({
      shippingNoteId: checked.id,
      fileName,
      user: actors.admin,
    });
    const bytes = Buffer.from("pdf artifact bytes");
    const checksumSha256 = calculateArtifactSha256(bytes);
    const storedArtifact = await persistGeneratedExportArtifact({
      exportId: pending.id,
      exportType: "pdf",
      bytes,
      mimeType: "application/pdf",
      checksumSha256,
      storage,
    });
    const generatedAt = new Date();

    await markInternalPdfExportGenerated({
      exportId: pending.id,
      fileName,
      checksumSha256,
      artifactStorageKey: storedArtifact.artifactStorageKey,
      artifactSizeBytes: storedArtifact.artifactSizeBytes,
      artifactMimeType: storedArtifact.artifactMimeType,
      sellingChargeCount: 1,
      buyingChargeCount: 1,
      generatedAt,
      user: actors.admin,
    });

    const exportRecord = await getExportRecord(pending.id);
    expect(exportRecord).toMatchObject({
      exportType: "pdf",
      status: "generated",
      driveUploadStatus: "not_uploaded",
      artifactStorageKey: storedArtifact.artifactStorageKey,
      artifactSizeBytes: bytes.byteLength,
      artifactMimeType: "application/pdf",
      checksum: checksumSha256,
    });
    await expect(getVerifiedArtifactBytes(exportRecord, storage)).resolves.toEqual(bytes);
  });

  it("marks export failed when artifact storage fails and leaves note status unchanged", async () => {
    const checked = await createCheckedNote("ARTIFACT-FAIL");
    const storage = new FakeArtifactStorage();
    storage.failNextPut();
    const fileName = `${runId}-artifact-failed.pdf`;
    const pending = await createPendingInternalPdfExportRecord({
      shippingNoteId: checked.id,
      fileName,
      user: actors.admin,
    });
    const bytes = Buffer.from("pdf artifact bytes");

    await expect(persistGeneratedExportArtifact({
      exportId: pending.id,
      exportType: "pdf",
      bytes,
      mimeType: "application/pdf",
      checksumSha256: calculateArtifactSha256(bytes),
      storage,
    })).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.WRITE_FAILED,
    });

    await markInternalPdfExportFailed({
      exportId: pending.id,
      errorCode: EXPORT_ERROR_CODES.ARTIFACT_STORAGE_WRITE_FAILED,
      fileName,
      user: actors.admin,
    });

    expect(await getExportRecord(pending.id)).toMatchObject({
      status: "failed",
      artifactStorageKey: null,
      artifactSizeBytes: null,
      artifactMimeType: null,
      errorMessage: EXPORT_ERROR_CODES.ARTIFACT_STORAGE_WRITE_FAILED,
    });
    expect((await getCancellationTransitionMetadata(checked.id)).status).toBe("checked");
  });

  it("rejects checksum mismatch and historical metadata-only artifact reads", async () => {
    const checked = await createCheckedNote("ARTIFACT-HISTORICAL");
    const storage = new FakeArtifactStorage();
    const [historicalExport] = await db
      .insert(shippingNoteExports)
      .values({
        shippingNoteId: checked.id,
        exportType: "excel",
        version: 2,
        status: "generated",
        fileName: `${runId}-historical.xlsx`,
        checksum: "HISTORICAL",
        generatedById: actors.accountant.id,
        generatedAt: new Date(),
      })
      .returning();

    if (!historicalExport) {
      throw new Error("Expected historical export fixture.");
    }

    await expect(getVerifiedArtifactBytes(historicalExport, storage)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.READ_FAILED,
    });

    await storage.put({
      key: `shipping-note-exports/${historicalExport.id}/artifact.xlsx`,
      body: Buffer.from("actual"),
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      checksumSha256: calculateArtifactSha256(Buffer.from("actual")),
      exportId: historicalExport.id,
    });

    await expect(getVerifiedArtifactBytes({
      artifactStorageKey: `shipping-note-exports/${historicalExport.id}/artifact.xlsx`,
      checksum: calculateArtifactSha256(Buffer.from("different")),
    }, storage)).rejects.toMatchObject({
      code: ARTIFACT_STORAGE_ERROR_CODES.CHECKSUM_MISMATCH,
    });
  });

  it("keeps internal export available after unlocking back to approved", async () => {
    const locked = await createLockedNote("EXPORT-UNLOCKED", "Unlock export");
    await unlockShippingNote(
      { id: locked.id, unlockReason: "Temporary approved-state export check" },
      actors.admin,
    );

    const accountantExport = await getInternalShippingNoteExportDataForUser(
      locked.id,
      actors.accountant,
    );
    const adminExport = await getInternalShippingNoteExportDataForUser(
      locked.id,
      actors.admin,
    );

    expect(accountantExport?.note.status).toBe("approved");
    expect(adminExport?.note.status).toBe("approved");
    expect(await getLockTransitionMetadata(locked.id)).toStrictEqual({
      status: "approved",
      lockedById: null,
      lockedAt: null,
      lockReason: null,
    });
  });

  it("rejects internal XLSX export data for draft, submitted, reviewing, and deleted notes", async () => {
    const draft = await createDraftFor(actors.saleA, runId, "EXPORT-DRAFT");
    const submitted = await createSubmittedNote("EXPORT-SUBMITTED");
    const reviewingBase = await createSubmittedNote("EXPORT-REVIEWING");
    const reviewing = await startAccountingReview(
      { id: reviewingBase.id },
      actors.accountant,
    );
    const deleted = await createCheckedNote("EXPORT-DELETED");
    await softDeleteNote(deleted.id);
    const exported = await createCheckedNote("EXPORT-EXPORTED");
    await db
      .update(shippingNotes)
      .set({ status: "exported" })
      .where(eq(shippingNotes.id, exported.id));

    for (const noteId of [draft.id, submitted.id, reviewing.id, exported.id]) {
      await expect(
        getInternalShippingNoteExportDataForUser(noteId, actors.accountant),
      ).rejects.toThrow(/checked.*approved.*locked.*status/);
    }

    expect(await getInternalShippingNoteExportDataForUser(
      deleted.id,
      actors.accountant,
    )).toBeNull();
  });

  it("allows admin to reopen checked notes and clears current finalization metadata", async () => {
    const checked = await createCheckedNote("REOPEN-CHECKED");
    const beforeMetadata = await getCancellationTransitionMetadata(checked.id);

    await expect(
      reopenShippingNoteForCorrection(
        { id: checked.id, expectedStatus: "checked", reason: "Sale denied reopen" },
        actors.saleA,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      reopenShippingNoteForCorrection(
        { id: checked.id, expectedStatus: "checked", reason: "Accountant denied reopen" },
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getCancellationTransitionMetadata(checked.id)).toMatchObject({
      status: "checked",
      checkedById: beforeMetadata.checkedById,
      checkedAt: beforeMetadata.checkedAt,
      approvedById: null,
      approvedAt: null,
    });
    expect((await listAuditLogsForEntity("shipping_note", checked.id)).some(
      (row) => row.action === "shipping_note.reopen_for_correction",
    )).toBe(false);

    const reopened = await reopenShippingNoteForCorrection(
      {
        id: checked.id,
        expectedStatus: "checked",
        reason: "  Correct vendor-side accounting  ",
      },
      actors.admin,
    );
    const afterMetadata = await getCancellationTransitionMetadata(checked.id);

    expect(reopened.status).toBe("accounting_reviewing");
    expect(afterMetadata).toMatchObject({
      status: "accounting_reviewing",
      submittedAt: beforeMetadata.submittedAt,
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
    });

    const auditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    const reopenAudit = auditRows.find(
      (row) => row.action === "shipping_note.reopen_for_correction",
    );
    expect(reopenAudit?.actorUserId).toBe(actors.admin.id);
    expect(reopenAudit?.reason).toBe("Correct vendor-side accounting");
    expect(reopenAudit?.before).toMatchObject({
      status: "checked",
      checkedById: beforeMetadata.checkedById,
      checkedAt: beforeMetadata.checkedAt?.toISOString(),
      approvedById: null,
      approvedAt: null,
    });
    expect(reopenAudit?.after).toMatchObject({
      status: "accounting_reviewing",
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
    });
  });

  it("allows admin to reopen approved notes and preserves old metadata in audit", async () => {
    const approved = await createApprovedNote("REOPEN-APPROVED");
    const beforeMetadata = await getCancellationTransitionMetadata(approved.id);

    await reopenShippingNoteForCorrection(
      {
        id: approved.id,
        expectedStatus: "approved",
        reason: "Approved accounting correction",
      },
      actors.admin,
    );

    expect(await getCancellationTransitionMetadata(approved.id)).toMatchObject({
      status: "accounting_reviewing",
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
    });

    const auditRows = await listAuditLogsForEntity("shipping_note", approved.id);
    const reopenAudit = auditRows.find(
      (row) => row.action === "shipping_note.reopen_for_correction",
    );
    expect(reopenAudit?.before).toMatchObject({
      status: "approved",
      checkedById: beforeMetadata.checkedById,
      checkedAt: beforeMetadata.checkedAt?.toISOString(),
      approvedById: beforeMetadata.approvedById,
      approvedAt: beforeMetadata.approvedAt?.toISOString(),
    });
    expect(reopenAudit?.after).toMatchObject({
      status: "accounting_reviewing",
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
    });
  });

  it("denies locked, cancelled, and stale reopen requests without false audits", async () => {
    const locked = await createLockedNote("REOPEN-LOCKED", "Locked close");
    await expect(
      reopenShippingNoteForCorrection(
        { id: locked.id, expectedStatus: "approved", reason: "No direct locked reopen" },
        actors.admin,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getCancellationTransitionMetadata(locked.id)).toMatchObject({
      status: "locked",
      lockedById: actors.admin.id,
      lockReason: "Locked close",
    });
    expect((await listAuditLogsForEntity("shipping_note", locked.id)).some(
      (row) => row.action === "shipping_note.reopen_for_correction",
    )).toBe(false);

    const cancelled = await createApprovedNote("REOPEN-CANCELLED");
    await cancelFinalizedShippingNote(
      { id: cancelled.id, expectedStatus: "approved", cancelReason: "Cancelled terminal" },
      actors.admin,
    );
    await expect(
      reopenShippingNoteForCorrection(
        { id: cancelled.id, expectedStatus: "approved", reason: "No cancelled restore" },
        actors.admin,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getCancellationTransitionMetadata(cancelled.id)).toMatchObject({
      status: "cancelled",
      cancelledById: actors.admin.id,
      cancelReason: "Cancelled terminal",
    });
    expect((await listAuditLogsForEntity("shipping_note", cancelled.id)).some(
      (row) => row.action === "shipping_note.reopen_for_correction",
    )).toBe(false);

    const staleChecked = await createCheckedNote("REOPEN-STALE-CHECKED");
    const staleCheckedRequest = {
      id: staleChecked.id,
      expectedStatus: "checked" as const,
      reason: "Prepared while checked",
    };
    await approveShippingNote({ id: staleChecked.id }, actors.admin);
    await expect(
      reopenShippingNoteForCorrection(staleCheckedRequest, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect((await getCancellationTransitionMetadata(staleChecked.id)).status).toBe("approved");

    const staleApproved = await createApprovedNote("REOPEN-STALE-APPROVED");
    const staleApprovedRequest = {
      id: staleApproved.id,
      expectedStatus: "approved" as const,
      reason: "Prepared before lock",
    };
    await lockShippingNote({ id: staleApproved.id, lockReason: "Concurrent lock" }, actors.admin);
    await expect(
      reopenShippingNoteForCorrection(staleApprovedRequest, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getCancellationTransitionMetadata(staleApproved.id)).toMatchObject({
      status: "locked",
      cancelledById: null,
      checkedById: actors.accountant.id,
      approvedById: actors.admin.id,
    });
    expect((await listAuditLogsForEntity("shipping_note", staleApproved.id)).some(
      (row) => row.action === "shipping_note.reopen_for_correction",
    )).toBe(false);
  });

  it("restores accounting mutability after reopen while selling remains draft-only", async () => {
    const approved = await createApprovedNote("REOPEN-MUTABILITY");
    const buyingChargeId = await getActiveBuyingChargeId(approved.id);

    await reopenShippingNoteForCorrection(
      {
        id: approved.id,
        expectedStatus: "approved",
        reason: "Correct buying charge and tax",
      },
      actors.admin,
    );

    const updatedBuying = await updateBuyingCharge(
      buyingChargeId,
      updateBuyingChargeInputSchema.parse({
        id: buyingChargeId,
        chargeName: `${runId}-REOPENED-BUY`,
        description: `${runId} reopened buying correction`,
        quantity: "2.000",
        unit: "shipment",
        unitPrice: "120.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} reopened vendor`,
      }),
      actors.accountant,
    );
    expect(updatedBuying.amountVnd).toBe("240.00");

    const correctionTaxRule = await createTaxRuleFixture({
      runId,
      label: "RBT",
      actor: actors.admin,
      chargeSection: "buying",
      vatPercent: "8.00",
    });
    const correctedTax = await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: buyingChargeId,
        taxRuleId: correctionTaxRule.id,
      }),
      actors.accountant,
    );
    expect(correctedTax.vatPercent).toBe("8.00");

    await expect(
      createSellingChargeForNote(
        sellingInput(approved.id, "REOPENED-SELL-DENIED"),
        actors.admin,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("preserves exports, blocks export while reopened, and restores export after recheck", async () => {
    const approved = await createApprovedNote("REOPEN-EXPORT");
    const originalFileName = `${runId}-reopen-original.xlsx`;
    const originalPending = await createPendingInternalXlsxExportRecord({
      shippingNoteId: approved.id,
      fileName: originalFileName,
      user: actors.accountant,
    });
    await markInternalXlsxExportGenerated({
      exportId: originalPending.id,
      fileName: originalFileName,
      checksumSha256: "abc123reopenoriginal",
      artifactStorageKey: `shipping-note-exports/${originalPending.id}/artifact.xlsx`,
      artifactSizeBytes: 123,
      artifactMimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sellingChargeCount: 1,
      buyingChargeCount: 1,
      generatedAt: new Date(),
      user: actors.accountant,
    });
    const beforeReopenExport = await getExportRecord(originalPending.id);

    await reopenShippingNoteForCorrection(
      { id: approved.id, expectedStatus: "approved", reason: "Correction before new export" },
      actors.admin,
    );

    expect(await getExportRecord(originalPending.id)).toMatchObject({
      id: beforeReopenExport.id,
      version: beforeReopenExport.version,
      status: beforeReopenExport.status,
      fileName: beforeReopenExport.fileName,
      checksum: beforeReopenExport.checksum,
    });
    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.accountant),
    ).rejects.toThrow(/checked.*approved.*locked.*status/);
    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.admin),
    ).rejects.toThrow(/checked.*approved.*locked.*status/);

    const buyingChargeId = await getActiveBuyingChargeId(approved.id);
    await updateBuyingCharge(
      buyingChargeId,
      updateBuyingChargeInputSchema.parse({
        id: buyingChargeId,
        chargeName: `${runId}-REOPEN-EXPORT-BUY`,
        description: `${runId} rechecked export buying`,
        quantity: "1.000",
        unit: "shipment",
        unitPrice: "140.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} rechecked export vendor`,
      }),
      actors.accountant,
    );
    const checkedAgain = await markShippingNoteChecked(
      { id: approved.id },
      actors.accountant,
    );
    const recheckedMetadata = await getCheckedTransitionMetadata(approved.id);
    expect(checkedAgain.status).toBe("checked");
    expect(recheckedMetadata.checkedById).toBe(actors.accountant.id);
    expect(recheckedMetadata.checkedAt).toBeInstanceOf(Date);

    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect((await getInternalShippingNoteExportDataForUser(
      approved.id,
      actors.accountant,
    ))?.note.status).toBe("checked");
    expect((await getInternalShippingNoteExportDataForUser(
      approved.id,
      actors.admin,
    ))?.note.status).toBe("checked");

    const newFileName = `${runId}-reopen-rechecked.xlsx`;
    const newPending = await createPendingInternalXlsxExportRecord({
      shippingNoteId: approved.id,
      fileName: newFileName,
      user: actors.accountant,
    });
    await markInternalXlsxExportGenerated({
      exportId: newPending.id,
      fileName: newFileName,
      checksumSha256: "abc123reopenrechecked",
      artifactStorageKey: `shipping-note-exports/${newPending.id}/artifact.xlsx`,
      artifactSizeBytes: 124,
      artifactMimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sellingChargeCount: 1,
      buyingChargeCount: 1,
      generatedAt: new Date(),
      user: actors.accountant,
    });
    const newExport = await getExportRecord(newPending.id);
    expect(newExport.id).not.toBe(beforeReopenExport.id);
    expect(newExport.version).toBe(beforeReopenExport.version);
    expect(await getExportRecord(originalPending.id)).toMatchObject({
      id: beforeReopenExport.id,
      version: beforeReopenExport.version,
      status: beforeReopenExport.status,
      checksum: beforeReopenExport.checksum,
    });

    const reapproved = await approveShippingNote({ id: approved.id }, actors.admin);
    expect(reapproved.status).toBe("approved");
    const approvalMetadata = await getApprovalTransitionMetadata(approved.id);
    expect(approvalMetadata.approvedById).toBe(actors.admin.id);
    expect(approvalMetadata.approvedAt).toBeInstanceOf(Date);
  });

  it("enforces normal cancellation rules for draft, submitted, and reviewing notes", async () => {
    const ownDraft = await createDraftFor(actors.saleA, runId, "CANCEL-DRAFT-OWN");
    const cancelledOwnDraft = await cancelShippingNote(
      { id: ownDraft.id, expectedStatus: "draft" },
      actors.saleA,
    );

    expect(cancelledOwnDraft.status).toBe("cancelled");
    expect(await getCancellationTransitionMetadata(ownDraft.id)).toMatchObject({
      status: "cancelled",
      cancelledById: actors.saleA.id,
      cancelReason: null,
      deletedAt: null,
    });
    expect((await listAuditLogsForEntity("shipping_note", ownDraft.id)).some(
      (row) => row.action === "shipping_note.cancel",
    )).toBe(true);

    const nonOwnerDraft = await createDraftFor(
      actors.saleA,
      runId,
      "CANCEL-DRAFT-NONOWNER",
    );
    await expect(
      cancelShippingNote(
        { id: nonOwnerDraft.id, expectedStatus: "draft" },
        actors.saleB,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      cancelShippingNote(
        { id: nonOwnerDraft.id, expectedStatus: "draft", cancelReason: "Accountant cannot cancel draft" },
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      cancelShippingNote(
        { id: nonOwnerDraft.id, expectedStatus: "draft" },
        actors.admin,
      ),
    ).rejects.toThrow(/Cancellation reason is required/);
    expect((await listAuditLogsForEntity("shipping_note", nonOwnerDraft.id)).some(
      (row) => row.action === "shipping_note.cancel",
    )).toBe(false);
    await cancelShippingNote(
      { id: nonOwnerDraft.id, expectedStatus: "draft", cancelReason: "  Admin voided duplicate draft  " },
      actors.admin,
    );
    expect(await getCancellationTransitionMetadata(nonOwnerDraft.id)).toMatchObject({
      status: "cancelled",
      cancelledById: actors.admin.id,
      cancelReason: "Admin voided duplicate draft",
      deletedAt: null,
    });

    const submittedForAccountant = await createSubmittedNote("CANCEL-SUBMITTED-ACCOUNTANT");
    await expect(
      cancelShippingNote(
        { id: submittedForAccountant.id, expectedStatus: "submitted", cancelReason: "Sale cannot cancel after submission" },
        actors.saleA,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await cancelShippingNote(
      { id: submittedForAccountant.id, expectedStatus: "submitted", cancelReason: "  Customer cancelled submitted shipment  " },
      actors.accountant,
    );
    expect(await getCancellationTransitionMetadata(submittedForAccountant.id)).toMatchObject({
      status: "cancelled",
      cancelledById: actors.accountant.id,
      cancelReason: "Customer cancelled submitted shipment",
      deletedAt: null,
    });
    expect((await listAuditLogsForEntity(
      "shipping_note",
      submittedForAccountant.id,
    )).some((row) => row.action === "shipping_note.cancel")).toBe(true);

    const submittedForAdmin = await createSubmittedNote("CANCEL-SUBMITTED-ADMIN");
    await cancelShippingNote(
      { id: submittedForAdmin.id, expectedStatus: "submitted", cancelReason: "Admin cancelled submitted shipment" },
      actors.admin,
    );
    expect(await getCancellationTransitionMetadata(submittedForAdmin.id)).toMatchObject({
      status: "cancelled",
      cancelledById: actors.admin.id,
      cancelReason: "Admin cancelled submitted shipment",
    });

    const reviewingForAccountant = await startAccountingReview(
      { id: (await createSubmittedNote("CANCEL-REVIEWING-ACCOUNTANT")).id },
      actors.accountant,
    );
    await expect(
      cancelShippingNote(
        { id: reviewingForAccountant.id, expectedStatus: "accounting_reviewing", cancelReason: "Sale cannot cancel review" },
        actors.saleA,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await cancelShippingNote(
      { id: reviewingForAccountant.id, expectedStatus: "accounting_reviewing", cancelReason: "Accounting stopped review" },
      actors.accountant,
    );
    expect(await getCancellationTransitionMetadata(reviewingForAccountant.id)).toMatchObject({
      status: "cancelled",
      cancelledById: actors.accountant.id,
      cancelReason: "Accounting stopped review",
    });

    const reviewingForAdmin = await startAccountingReview(
      { id: (await createSubmittedNote("CANCEL-REVIEWING-ADMIN")).id },
      actors.accountant,
    );
    await cancelShippingNote(
      { id: reviewingForAdmin.id, expectedStatus: "accounting_reviewing", cancelReason: "Admin stopped review" },
      actors.admin,
    );
    expect(await getCancellationTransitionMetadata(reviewingForAdmin.id)).toMatchObject({
      status: "cancelled",
      cancelledById: actors.admin.id,
      cancelReason: "Admin stopped review",
    });
    expect((await listAuditLogsForEntity(
      "shipping_note",
      reviewingForAdmin.id,
    )).some((row) => row.action === "shipping_note.cancel")).toBe(true);
  });

  it("enforces finalized cancellation rules and preserves checked and approval metadata", async () => {
    const checked = await createCheckedNote("CANCEL-CHECKED");
    await expect(
      cancelFinalizedShippingNote(
        { id: checked.id, expectedStatus: "checked", cancelReason: "Sale denied" },
        actors.saleA,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      cancelFinalizedShippingNote(
        { id: checked.id, expectedStatus: "checked", cancelReason: "Accountant denied" },
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await cancelFinalizedShippingNote(
      { id: checked.id, expectedStatus: "checked", cancelReason: "  Finalized duplicate checked note  " },
      actors.admin,
    );

    const checkedMetadata = await getCancellationTransitionMetadata(checked.id);
    expect(checkedMetadata.status).toBe("cancelled");
    expect(checkedMetadata.checkedById).toBe(actors.accountant.id);
    expect(checkedMetadata.checkedAt).toBeInstanceOf(Date);
    expect(checkedMetadata.cancelledById).toBe(actors.admin.id);
    expect(checkedMetadata.cancelReason).toBe("Finalized duplicate checked note");
    expect(checkedMetadata.deletedAt).toBeNull();

    const checkedAuditRows = await listAuditLogsForEntity("shipping_note", checked.id);
    const checkedCancelAudit = checkedAuditRows.find(
      (row) => row.action === "shipping_note.cancel",
    );
    expect(checkedCancelAudit?.before).toMatchObject({
      status: "checked",
      cancelledById: null,
      cancelledAt: null,
      cancelReason: null,
    });
    expect(checkedCancelAudit?.after).toMatchObject({
      status: "cancelled",
      cancelledById: actors.admin.id,
      cancelReason: "Finalized duplicate checked note",
    });

    const approved = await createApprovedNote("CANCEL-APPROVED");
    await expect(
      cancelFinalizedShippingNote(
        { id: approved.id, expectedStatus: "approved", cancelReason: "Accountant denied finalized" },
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await cancelFinalizedShippingNote(
      { id: approved.id, expectedStatus: "approved", cancelReason: "Approved note cancelled" },
      actors.admin,
    );

    const approvedMetadata = await getCancellationTransitionMetadata(approved.id);
    expect(approvedMetadata.status).toBe("cancelled");
    expect(approvedMetadata.checkedById).toBe(actors.accountant.id);
    expect(approvedMetadata.checkedAt).toBeInstanceOf(Date);
    expect(approvedMetadata.approvedById).toBe(actors.admin.id);
    expect(approvedMetadata.approvedAt).toBeInstanceOf(Date);
    expect(approvedMetadata.cancelledById).toBe(actors.admin.id);
    expect(approvedMetadata.cancelReason).toBe("Approved note cancelled");
  });

  it("denies locked and stale cancellation and keeps cancelled terminal", async () => {
    const locked = await createLockedNote("CANCEL-LOCKED", "Locked close");
    await expect(
      cancelShippingNote(
        { id: locked.id, expectedStatus: "accounting_reviewing", cancelReason: "No direct locked cancel" },
        actors.admin,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      cancelFinalizedShippingNote(
        { id: locked.id, expectedStatus: "approved", cancelReason: "No stale approved cancel" },
        actors.admin,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getCancellationTransitionMetadata(locked.id)).toMatchObject({
      status: "locked",
      lockedById: actors.admin.id,
      lockReason: "Locked close",
      cancelledById: null,
      cancelledAt: null,
      cancelReason: null,
    });
    expect((await listAuditLogsForEntity("shipping_note", locked.id)).some(
      (row) => row.action === "shipping_note.cancel",
    )).toBe(false);

    const staleDraft = await createDraftFor(actors.saleA, runId, "CANCEL-STALE-DRAFT");
    const staleDraftRequest = {
      id: staleDraft.id,
      expectedStatus: "draft" as const,
    };
    await submitShippingNote({ id: staleDraft.id }, actors.saleA);
    await expect(
      cancelShippingNote(staleDraftRequest, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect((await getCancellationTransitionMetadata(staleDraft.id)).status).toBe("submitted");

    const staleApproved = await createApprovedNote("CANCEL-STALE-APPROVED");
    const staleApprovedRequest = {
      id: staleApproved.id,
      expectedStatus: "approved" as const,
      cancelReason: "Prepared before lock",
    };
    await lockShippingNote({ id: staleApproved.id, lockReason: "Concurrent lock" }, actors.admin);
    await expect(
      cancelFinalizedShippingNote(staleApprovedRequest, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getCancellationTransitionMetadata(staleApproved.id)).toMatchObject({
      status: "locked",
      cancelledById: null,
      cancelReason: null,
    });

    const cancelledDraft = await createDraftFor(actors.saleA, runId, "CANCEL-TERMINAL-DRAFT");
    await cancelShippingNote(
      { id: cancelledDraft.id, expectedStatus: "draft" },
      actors.saleA,
    );
    await expect(
      submitShippingNote({ id: cancelledDraft.id }, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const cancelledSubmitted = await createSubmittedNote("CANCEL-TERMINAL-SUBMITTED");
    await cancelShippingNote(
      { id: cancelledSubmitted.id, expectedStatus: "submitted", cancelReason: "Terminal submitted" },
      actors.accountant,
    );
    await expect(
      startAccountingReview({ id: cancelledSubmitted.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const cancelledReviewing = await startAccountingReview(
      { id: (await createSubmittedNote("CANCEL-TERMINAL-REVIEWING")).id },
      actors.accountant,
    );
    await cancelShippingNote(
      { id: cancelledReviewing.id, expectedStatus: "accounting_reviewing", cancelReason: "Terminal reviewing" },
      actors.accountant,
    );
    await expect(
      markShippingNoteChecked({ id: cancelledReviewing.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const cancelledChecked = await createCheckedNote("CANCEL-TERMINAL-CHECKED");
    await cancelFinalizedShippingNote(
      { id: cancelledChecked.id, expectedStatus: "checked", cancelReason: "Terminal checked" },
      actors.admin,
    );
    await expect(
      approveShippingNote({ id: cancelledChecked.id }, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const cancelledApproved = await createApprovedNote("CANCEL-TERMINAL-APPROVED");
    await cancelFinalizedShippingNote(
      { id: cancelledApproved.id, expectedStatus: "approved", cancelReason: "Terminal approved" },
      actors.admin,
    );
    await expect(
      lockShippingNote({ id: cancelledApproved.id }, actors.admin),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("keeps cancelled notes immutable while preserving historical reads for internal roles", async () => {
    const cancelledDraft = await createDraftFor(actors.saleA, runId, "CANCEL-IMMUTABLE-DRAFT");
    await cancelShippingNote(
      { id: cancelledDraft.id, expectedStatus: "draft" },
      actors.saleA,
    );
    await expect(
      createSellingChargeForNote(
        sellingInput(cancelledDraft.id, "CANCELLED-SELL"),
        actors.saleA,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const approved = await createApprovedNote("CANCEL-IMMUTABLE-APPROVED");
    const buyingChargeId = await getActiveBuyingChargeId(approved.id);
    await cancelFinalizedShippingNote(
      { id: approved.id, expectedStatus: "approved", cancelReason: "Read-only after cancellation" },
      actors.admin,
    );

    await expect(
      updateBuyingCharge(
        buyingChargeId,
        updateBuyingChargeInputSchema.parse({
          id: buyingChargeId,
          chargeName: `${runId}-CANCELLED-BUY`,
          description: `${runId} cancelled buying`,
          quantity: "2.000",
          unit: "shipment",
          unitPrice: "120.0000",
          currency: "VND",
          vendorOrAgentText: `${runId} cancelled vendor`,
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      assignChargeTaxRule(
        assignChargeTaxRuleInputSchema.parse({
          chargeId: buyingChargeId,
          taxRuleId: buyingTaxRuleId,
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      overrideChargeVatPercent(
        overrideChargeVatPercentInputSchema.parse({
          chargeId: buyingChargeId,
          vatPercent: "12.00",
          reason: "Should not mutate cancelled charge",
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect((await getShippingNoteForUser(approved.id, actors.saleA))?.status).toBe("cancelled");
    await expect(
      listBuyingChargesForNoteForUser(approved.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      getFinancialSummaryForNoteForUser(approved.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      listChargeTaxDetailsForNoteForUser(approved.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(await listBuyingChargesForNoteForUser(
      approved.id,
      actors.accountant,
    )).toHaveLength(1);
    expect(await getFinancialSummaryForNoteForUser(
      approved.id,
      actors.accountant,
    )).toMatchObject({
      totalSellingVnd: "250.00",
      totalBuyingVnd: "100.00",
      grossProfitVnd: "150.00",
    });
    expect(await listChargeTaxDetailsForNoteForUser(
      approved.id,
      actors.accountant,
    )).toHaveLength(2);
  });

  it("preserves historical exports and denies new export data after cancellation", async () => {
    const approved = await createApprovedNote("CANCEL-EXPORT-PRESERVE");
    const fileName = `${runId}-cancel-preserved.xlsx`;
    const pending = await createPendingInternalXlsxExportRecord({
      shippingNoteId: approved.id,
      fileName,
      user: actors.accountant,
    });
    const generatedAt = new Date();
    await markInternalXlsxExportGenerated({
      exportId: pending.id,
      fileName,
      checksumSha256: "abc123cancelledexport",
      artifactStorageKey: `shipping-note-exports/${pending.id}/artifact.xlsx`,
      artifactSizeBytes: 125,
      artifactMimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sellingChargeCount: 1,
      buyingChargeCount: 1,
      generatedAt,
      user: actors.accountant,
    });
    const beforeCancelExport = await getExportRecord(pending.id);

    await cancelFinalizedShippingNote(
      { id: approved.id, expectedStatus: "approved", cancelReason: "Cancelled after export" },
      actors.admin,
    );

    const afterCancelExport = await getExportRecord(pending.id);
    expect(afterCancelExport).toMatchObject({
      id: beforeCancelExport.id,
      shippingNoteId: beforeCancelExport.shippingNoteId,
      exportType: beforeCancelExport.exportType,
      version: beforeCancelExport.version,
      status: beforeCancelExport.status,
      fileName: beforeCancelExport.fileName,
      checksum: beforeCancelExport.checksum,
      generatedById: beforeCancelExport.generatedById,
      generatedAt: beforeCancelExport.generatedAt,
    });

    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.accountant),
    ).rejects.toThrow(/checked.*approved.*locked.*status/);
    await expect(
      getInternalShippingNoteExportDataForUser(approved.id, actors.admin),
    ).rejects.toThrow(/checked.*approved.*locked.*status/);
    expect((await getCancellationTransitionMetadata(approved.id)).status).toBe("cancelled");
    expect(await getExportRecord(pending.id)).toMatchObject({
      id: beforeCancelExport.id,
      version: beforeCancelExport.version,
      status: beforeCancelExport.status,
      checksum: beforeCancelExport.checksum,
    });
  });

  it("uploads a durable generated export to Drive with Admin-only authorization and audit", async () => {
    const checked = await createCheckedNote("DRIVE-UPLOAD-HAPPY");
    const storage = new FakeArtifactStorage();
    const exportRecord = await createDurableGeneratedXlsxExport({
      noteId: checked.id,
      fileName: `${runId}-drive-happy.xlsx`,
      actor: actors.accountant,
      storage,
    });
    const drive = new FakeDriveArtifactUploader();

    await expect(
      uploadShippingNoteExportToDrive(exportRecord.id, actors.saleA, {
        driveUploader: drive,
        artifactStorage: storage,
        rootFolderId: "fake-root-folder",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      uploadShippingNoteExportToDrive(exportRecord.id, actors.accountant, {
        driveUploader: drive,
        artifactStorage: storage,
        rootFolderId: "fake-root-folder",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const result = await uploadShippingNoteExportToDrive(
      exportRecord.id,
      actors.admin,
      {
        driveUploader: drive,
        artifactStorage: storage,
        rootFolderId: "fake-root-folder",
      },
    );

    expect(result).toMatchObject({
      exportId: exportRecord.id,
      driveUploadStatus: "uploaded",
      driveFileId: "fake-drive-file-1",
    });

    const uploadedRecord = await getExportRecord(exportRecord.id);
    expect(uploadedRecord).toMatchObject({
      status: "generated",
      driveUploadStatus: "uploaded",
      driveFileId: "fake-drive-file-1",
      driveUrl: "https://drive.google.test/file/1",
      driveFolderId: "fake-root-folder",
      driveErrorMessage: null,
    });
    expect(uploadedRecord.driveUploadedAt).toBeInstanceOf(Date);

    const uploadAuditRows = await listAuditLogsForEntity(
      "shipping_note_export",
      exportRecord.id,
    );
    const uploadAudit = uploadAuditRows.find(
      (row) => row.action === "shipping_note.export.drive.uploaded",
    );
    expect(uploadAudit?.actorUserId).toBe(actors.admin.id);
    expect(uploadAudit?.after).toMatchObject({
      exportId: exportRecord.id,
      shippingNoteId: checked.id,
      exportType: "excel",
      version: 2,
      driveFileId: "fake-drive-file-1",
      driveFolderId: "fake-root-folder",
      currentShippingNoteStatus: "checked",
      reconciledFromDrive: false,
    });
  });

  it("records sanitized Drive failure and allows retry from upload_failed", async () => {
    const approved = await createApprovedNote("DRIVE-RETRY");
    const storage = new FakeArtifactStorage();
    const exportRecord = await createDurableGeneratedXlsxExport({
      noteId: approved.id,
      fileName: `${runId}-drive-retry.xlsx`,
      actor: actors.accountant,
      storage,
    });
    const drive = new FakeDriveArtifactUploader();
    drive.failNextUpload(new DriveError(
      DRIVE_ERROR_CODES.TEMPORARY_FAILURE,
      503,
      "Temporary fake Drive failure.",
      { retryable: true },
    ));

    await expect(
      uploadShippingNoteExportToDrive(exportRecord.id, actors.admin, {
        driveUploader: drive,
        artifactStorage: storage,
        rootFolderId: "fake-root-folder",
      }),
    ).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.TEMPORARY_FAILURE,
    });

    expect(await getExportRecord(exportRecord.id)).toMatchObject({
      status: "generated",
      driveUploadStatus: "upload_failed",
      driveErrorMessage: DRIVE_ERROR_CODES.TEMPORARY_FAILURE,
    });

    await uploadShippingNoteExportToDrive(exportRecord.id, actors.admin, {
      driveUploader: drive,
      artifactStorage: storage,
      rootFolderId: "fake-root-folder",
    });

    expect(await getExportRecord(exportRecord.id)).toMatchObject({
      status: "generated",
      driveUploadStatus: "uploaded",
      driveErrorMessage: null,
    });

    const auditRows = await listAuditLogsForEntity(
      "shipping_note_export",
      exportRecord.id,
    );
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "shipping_note.export.drive.failed",
        "shipping_note.export.drive.uploaded",
      ]),
    );
  });

  it("reconciles an existing Drive artifact and preserves current note status", async () => {
    const locked = await createLockedNote("DRIVE-RECONCILE", "Drive reconcile lock");
    const storage = new FakeArtifactStorage();
    const exportRecord = await createDurableGeneratedXlsxExport({
      noteId: locked.id,
      fileName: `${runId}-drive-reconcile.xlsx`,
      actor: actors.accountant,
      storage,
    });
    const drive = new FakeDriveArtifactUploader();
    drive.seedFile({
      id: "existing-drive-file",
      name: exportRecord.fileName,
      webViewLink: "https://drive.google.test/existing",
      appProperties: {
        uniwaveExportId: exportRecord.id,
        uniwaveShippingNoteId: exportRecord.shippingNoteId,
        uniwaveExportType: exportRecord.exportType,
        uniwaveExportVersion: exportRecord.version.toString(),
        uniwaveChecksumSha256: exportRecord.checksum ?? "",
      },
      parents: ["fake-root-folder"],
    });

    await uploadShippingNoteExportToDrive(exportRecord.id, actors.admin, {
      driveUploader: drive,
      artifactStorage: storage,
      rootFolderId: "fake-root-folder",
    });

    expect(drive.uploads).toHaveLength(0);
    expect(await getLockTransitionMetadata(locked.id)).toMatchObject({
      status: "locked",
      lockedById: actors.admin.id,
    });
    expect(await getExportRecord(exportRecord.id)).toMatchObject({
      driveUploadStatus: "uploaded",
      driveFileId: "existing-drive-file",
      driveUrl: "https://drive.google.test/existing",
    });
  });

  it("allows historical reopened and cancelled artifacts without changing note status", async () => {
    const approvedForReopen = await createApprovedNote("DRIVE-REOPEN-HISTORICAL");
    const reopenStorage = new FakeArtifactStorage();
    const reopenExport = await createDurableGeneratedXlsxExport({
      noteId: approvedForReopen.id,
      fileName: `${runId}-drive-reopen.xlsx`,
      actor: actors.accountant,
      storage: reopenStorage,
    });
    await reopenShippingNoteForCorrection(
      {
        id: approvedForReopen.id,
        expectedStatus: "approved",
        reason: "Historical Drive upload test correction",
      },
      actors.admin,
    );

    await uploadShippingNoteExportToDrive(reopenExport.id, actors.admin, {
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: reopenStorage,
      rootFolderId: "fake-root-folder",
    });
    expect((await getApprovalTransitionMetadata(approvedForReopen.id)).status).toBe(
      "accounting_reviewing",
    );

    const approvedForCancel = await createApprovedNote("DRIVE-CANCEL-HISTORICAL");
    const cancelStorage = new FakeArtifactStorage();
    const cancelExport = await createDurableGeneratedXlsxExport({
      noteId: approvedForCancel.id,
      fileName: `${runId}-drive-cancel.xlsx`,
      actor: actors.accountant,
      storage: cancelStorage,
    });
    await cancelFinalizedShippingNote(
      {
        id: approvedForCancel.id,
        expectedStatus: "approved",
        cancelReason: "Historical Drive upload test cancellation",
      },
      actors.admin,
    );

    await uploadShippingNoteExportToDrive(cancelExport.id, actors.admin, {
      driveUploader: new FakeDriveArtifactUploader(),
      artifactStorage: cancelStorage,
      rootFolderId: "fake-root-folder",
    });

    expect((await getCancellationTransitionMetadata(approvedForCancel.id)).status).toBe(
      "cancelled",
    );
  });

  it("prevents concurrent Drive claim from overwriting an uploading record", async () => {
    const checked = await createCheckedNote("DRIVE-CONFLICT");
    const storage = new FakeArtifactStorage();
    const exportRecord = await createDurableGeneratedXlsxExport({
      noteId: checked.id,
      fileName: `${runId}-drive-conflict.xlsx`,
      actor: actors.accountant,
      storage,
    });
    await db
      .update(shippingNoteExports)
      .set({ driveUploadStatus: "uploading" })
      .where(eq(shippingNoteExports.id, exportRecord.id));

    await expect(
      uploadShippingNoteExportToDrive(exportRecord.id, actors.admin, {
        driveUploader: new FakeDriveArtifactUploader(),
        artifactStorage: storage,
        rootFolderId: "fake-root-folder",
      }),
    ).rejects.toMatchObject({
      code: DRIVE_ERROR_CODES.UPLOAD_IN_PROGRESS,
    });
  });

  it("protects export history and historical durable download", async () => {
    const checked = await createCheckedNote("HISTORY-DOWNLOAD");
    const storage = new FakeArtifactStorage();
    const exportRecord = await createDurableGeneratedXlsxExport({
      noteId: checked.id,
      fileName: `${runId}-history-download.xlsx`,
      actor: actors.accountant,
      storage,
      body: Buffer.from("history artifact"),
    });

    await expect(
      listShippingNoteExportHistoryForUser(checked.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const accountantHistory = await listShippingNoteExportHistoryForUser(
      checked.id,
      actors.accountant,
    );
    const adminHistory = await listShippingNoteExportHistoryForUser(
      checked.id,
      actors.admin,
    );

    expect(accountantHistory[0]).toMatchObject({
      id: exportRecord.id,
      artifactAvailable: true,
    });
    expect(accountantHistory[0]).not.toHaveProperty("driveFolderId");
    expect(accountantHistory[0]).not.toHaveProperty("artifactStorageKey");
    expect(adminHistory[0]).toMatchObject({
      id: exportRecord.id,
      artifactAvailable: true,
    });

    await expect(
      getHistoricalExportDownloadForUser(exportRecord.id, actors.saleA, {
        artifactStorage: storage,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const download = await getHistoricalExportDownloadForUser(
      exportRecord.id,
      actors.accountant,
      { artifactStorage: storage },
    );
    expect(download.fileName).toBe(`${runId}-history-download.xlsx`);
    expect(download.bytes).toEqual(Buffer.from("history artifact"));
  });

  it("keeps reopened and cancelled historical artifacts downloadable without mutating note status", async () => {
    const approvedForReopen = await createApprovedNote("HISTORY-REOPEN");
    const reopenStorage = new FakeArtifactStorage();
    const reopenExport = await createDurableGeneratedXlsxExport({
      noteId: approvedForReopen.id,
      fileName: `${runId}-history-reopen.xlsx`,
      actor: actors.accountant,
      storage: reopenStorage,
    });
    await reopenShippingNoteForCorrection(
      {
        id: approvedForReopen.id,
        expectedStatus: "approved",
        reason: "Historical download after reopen",
      },
      actors.admin,
    );

    await expect(getHistoricalExportDownloadForUser(
      reopenExport.id,
      actors.accountant,
      { artifactStorage: reopenStorage },
    )).resolves.toMatchObject({ exportId: reopenExport.id });
    expect((await getApprovalTransitionMetadata(approvedForReopen.id)).status).toBe(
      "accounting_reviewing",
    );

    const approvedForCancel = await createApprovedNote("HISTORY-CANCEL");
    const cancelStorage = new FakeArtifactStorage();
    const cancelExport = await createDurableGeneratedXlsxExport({
      noteId: approvedForCancel.id,
      fileName: `${runId}-history-cancel.xlsx`,
      actor: actors.accountant,
      storage: cancelStorage,
    });
    await cancelFinalizedShippingNote(
      {
        id: approvedForCancel.id,
        expectedStatus: "approved",
        cancelReason: "Historical download after cancellation",
      },
      actors.admin,
    );

    await expect(getHistoricalExportDownloadForUser(
      cancelExport.id,
      actors.admin,
      { artifactStorage: cancelStorage },
    )).resolves.toMatchObject({ exportId: cancelExport.id });
    expect((await getCancellationTransitionMetadata(approvedForCancel.id)).status).toBe(
      "cancelled",
    );
  });

  it("recovers stale Drive uploading by reconciling before duplicate creation", async () => {
    const checked = await createCheckedNote("HISTORY-STALE-RECONCILE");
    const storage = new FakeArtifactStorage();
    const exportRecord = await createDurableGeneratedXlsxExport({
      noteId: checked.id,
      fileName: `${runId}-stale-reconcile.xlsx`,
      actor: actors.accountant,
      storage,
    });
    const staleUpdatedAt = new Date(Date.now() - DRIVE_UPLOAD_STALE_AFTER_MS);
    await db
      .update(shippingNoteExports)
      .set({
        driveUploadStatus: "uploading",
        updatedAt: staleUpdatedAt,
      })
      .where(eq(shippingNoteExports.id, exportRecord.id));

    const drive = new FakeDriveArtifactUploader();
    drive.seedFile({
      id: "existing-stale-drive-file",
      name: exportRecord.fileName,
      webViewLink: "https://drive.google.test/stale-existing",
      appProperties: {
        uniwaveExportId: exportRecord.id,
        uniwaveShippingNoteId: exportRecord.shippingNoteId,
        uniwaveExportType: exportRecord.exportType,
        uniwaveExportVersion: exportRecord.version.toString(),
        uniwaveChecksumSha256: exportRecord.checksum ?? "",
      },
      parents: ["fake-root-folder"],
    });

    await uploadShippingNoteExportToDrive(exportRecord.id, actors.admin, {
      driveUploader: drive,
      artifactStorage: storage,
      rootFolderId: "fake-root-folder",
      now: new Date(),
    });

    expect(drive.uploads).toHaveLength(0);
    expect(await getExportRecord(exportRecord.id)).toMatchObject({
      driveUploadStatus: "uploaded",
      driveFileId: "existing-stale-drive-file",
    });
  });

  it("persists expected audit fields for core business actions", async () => {
    const checked = await createCheckedNote("AUDIT-COVERAGE");
    const auditRows = await listAuditLogsForEntity("shipping_note", checked.id);

    for (const action of [
      "shipping_note.create_draft",
      "shipping_note.submit",
      "shipping_note.accounting_review.start",
      "shipping_note.accounting_review.checked",
    ]) {
      const row = auditRows.find((auditRow) => auditRow.action === action);
      expect(row?.actorUserId).toBeTruthy();
      expect(row?.entityType).toBe("shipping_note");
      expect(row?.entityId).toBe(checked.id);
      expect(row?.createdAt).toBeInstanceOf(Date);
    }
  });
});
