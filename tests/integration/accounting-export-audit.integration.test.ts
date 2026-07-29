import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { shippingNotes } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  createBuyingChargeForNote,
  createSellingChargeForNote,
  markShippingNoteChecked,
  startAccountingReview,
  submitShippingNote,
} from "@/features/shipping-notes/mutations";
import {
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
} from "@/features/shipping-notes/validators";
import { getInternalShippingNoteExportDataForUser } from "@/features/shipping-notes/export/queries";

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

async function getCheckedById(noteId: string): Promise<string | null> {
  const [row] = await db
    .select({ checkedById: shippingNotes.checkedById })
    .from(shippingNotes)
    .where(eq(shippingNotes.id, noteId))
    .limit(1);

  return row?.checkedById ?? null;
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
    expect(await getCheckedById(checked.id)).toBe(actors.accountant.id);

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
    )?.after).toMatchObject({ status: "checked" });
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
    expect(await getCheckedById(checked.id)).toBe(actors.admin.id);
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

    for (const noteId of [draft.id, submitted.id, reviewing.id]) {
      await expect(
        getInternalShippingNoteExportDataForUser(noteId, actors.accountant),
      ).rejects.toThrow(/checked' status/);
    }

    expect(await getInternalShippingNoteExportDataForUser(
      deleted.id,
      actors.accountant,
    )).toBeNull();
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
