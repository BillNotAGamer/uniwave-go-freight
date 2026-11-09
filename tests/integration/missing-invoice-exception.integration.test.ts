import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";

import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  shippingNoteCharges,
  shippingNoteMissingInvoiceExceptions,
  type User,
} from "@/lib/db/schema";
import { getFinancialReviewRevisionForNote } from "@/features/shipping-notes/financial-review-revision";
import {
  approveShippingNote,
  cancelShippingNote,
  createBuyingChargeForNote,
  createSellingChargeForNote,
  lockShippingNote,
  markShippingNoteChecked,
  startAccountingReview,
  submitShippingNote,
  updateBuyingCharge,
} from "@/features/shipping-notes/mutations";
import {
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  updateBuyingChargeInputSchema,
} from "@/features/shipping-notes/validators";
import {
  decideMissingInvoiceException,
  requestMissingInvoiceException,
  revokeMissingInvoiceException,
} from "@/features/shipping-notes/tax/missing-invoice-exceptions";
import {
  assignChargeTaxRule,
  classifyChargeTaxManually,
} from "@/features/shipping-notes/tax/mutations";
import {
  decideMissingInvoiceExceptionInputSchema,
  manualChargeTaxDecisionInputSchema,
  requestMissingInvoiceExceptionInputSchema,
  revokeMissingInvoiceExceptionInputSchema,
} from "@/features/shipping-notes/tax/validators";
import {
  getTaxCompletenessForNoteForUser,
  listChargeTaxDetailsForNoteForUser,
} from "@/features/shipping-notes/tax/queries";

import {
  createIntegrationActors,
  createIntegrationUser,
  type IntegrationActors,
} from "./fixtures/users";
import { createDraftFor } from "./fixtures/shipping-notes";
import { createTaxRuleFixture } from "./fixtures/tax-rules";
import { listAuditLogsForEntity } from "./helpers/audit";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { db, ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("P0B1");
let actors: IntegrationActors;
let opsActor: User;
let sellingTaxRuleId: string;
let buyingTaxRuleId: string;

async function revisionFor(noteId: string): Promise<string> {
  const revision = await getFinancialReviewRevisionForNote(noteId);
  if (!revision) {
    throw new Error("Expected a financial revision for the exception fixture.");
  }
  return revision;
}

function sellingInput(noteId: string, label: string) {
  return createSellingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-SELL-${label}`,
    description: `${runId} selling ${label}`,
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
    description: `${runId} buying ${label}`,
    quantity: "1.000",
    unit: "shipment",
    unitPrice,
    currency: "VND",
    vendorOrAgentText: `${runId} vendor ${label}`,
  });
}

async function createSubmittedFixture(label: string) {
  const draft = await createDraftFor(actors.saleA, runId, label);
  const selling = await createSellingChargeForNote(
    sellingInput(draft.id, label),
    actors.saleA,
  );
  const buying = await createBuyingChargeForNote(
    draft.id,
    buyingInput(draft.id, label),
    actors.admin,
  );
  const note = await submitShippingNote({ id: draft.id }, actors.saleA);
  await assignChargeTaxRule(
    { chargeId: selling.id, taxRuleId: sellingTaxRuleId },
    actors.accountant,
  );
  return { note, selling, buying };
}

async function classifyMissingInvoice(
  noteId: string,
  chargeId: string,
  actor: User = actors.accountant,
) {
  return classifyChargeTaxManually(
    manualChargeTaxDecisionInputSchema.parse({
      chargeId,
      taxTreatment: "taxable",
      vatPercent: "10",
      reason: "Accounting confirmed the expense treatment while supplier invoice evidence remains unavailable.",
      expectedFinancialRevision: await revisionFor(noteId),
      inputVatInvoiceStatus: "missing",
      inputVatDeductible: false,
    }),
    actor,
  );
}

async function requestException(
  noteId: string,
  chargeId: string,
  actor: User = actors.accountant,
) {
  return requestMissingInvoiceException(
    requestMissingInvoiceExceptionInputSchema.parse({
      chargeId,
      reason: "Supplier invoice remains unavailable after documented follow-up; record the expense without input VAT deduction.",
      expectedFinancialRevision: await revisionFor(noteId),
    }),
    actor,
  );
}

async function decideException(
  noteId: string,
  exceptionId: string,
  decision: "approved" | "rejected",
  actor: User = actors.admin,
) {
  return decideMissingInvoiceException(
    decideMissingInvoiceExceptionInputSchema.parse({
      exceptionId,
      decision,
      reason: decision === "approved"
        ? "Approved for operational closure only; input VAT remains non-deductible."
        : "Rejected because the missing-invoice evidence is insufficient.",
      expectedFinancialRevision: await revisionFor(noteId),
    }),
    actor,
  );
}

async function markCurrentStateChecked(noteId: string) {
  return markShippingNoteChecked({
    id: noteId,
    expectedFinancialRevision: await revisionFor(noteId),
    sellingVerified: true,
    buyingVerified: true,
    taxVerified: true,
  }, actors.accountant);
}

describe("P0B.1 missing-invoice operational closure exception", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
    opsActor = await createIntegrationUser({
      runId,
      label: "ops",
      role: "ops",
    });
    const [sellingRule, buyingRule] = await Promise.all([
      createTaxRuleFixture({
        runId,
        label: "SELL-VAT10",
        actor: actors.admin,
        chargeSection: "selling",
      }),
      createTaxRuleFixture({
        runId,
        label: "BUY-VAT10",
        actor: actors.admin,
        chargeSection: "buying",
      }),
    ]);
    sellingTaxRuleId = sellingRule.id;
    buyingTaxRuleId = buyingRule.id;
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("T01-T07 and final acceptance: closes a classified note only after Admin approval", async () => {
    const { note, buying: missingBuying } = await createSubmittedFixture(
      "APPROVED-CLOSE",
    );
    const normalBuying = await createBuyingChargeForNote(
      note.id,
      buyingInput(note.id, "NORMAL-INVOICE", "25.0000"),
      actors.accountant,
    );
    await assignChargeTaxRule({
      chargeId: normalBuying.id,
      taxRuleId: buyingTaxRuleId,
      inputVatInvoiceStatus: "available",
      inputVatInvoiceReference: `${runId}-INV-NORMAL`,
      inputVatDeductible: true,
    }, actors.accountant);
    const classified = await classifyMissingInvoice(
      note.id,
      missingBuying.id,
    );
    expect(classified).toMatchObject({
      taxTreatmentSnapshot: "taxable",
      vatPercent: "10.00",
      inputVatInvoiceStatus: "missing",
      inputVatDeductible: false,
      taxComplete: false,
    });

    await startAccountingReview({ id: note.id }, actors.accountant);
    await expect(markCurrentStateChecked(note.id)).rejects.toThrow(
      /tax classification/,
    );

    await expect(requestException(note.id, missingBuying.id, opsActor))
      .rejects.toBeInstanceOf(AuthorizationError);
    const pending = await requestException(note.id, missingBuying.id);
    expect(pending.status).toBe("pending");
    await expect(requestException(note.id, missingBuying.id))
      .rejects.toThrow(/already has a pending or approved/);
    expect((await getTaxCompletenessForNoteForUser(
      note.id,
      actors.accountant,
    ))?.taxComplete).toBe(false);
    await expect(decideException(
      note.id,
      pending.id,
      "approved",
      actors.accountant,
    )).rejects.toBeInstanceOf(AuthorizationError);

    const approved = await decideException(note.id, pending.id, "approved");
    expect(approved).toMatchObject({
      status: "approved",
      selfApproved: false,
      requestedById: actors.accountant.id,
      decisionById: actors.admin.id,
      invoiceStatusSnapshot: "missing",
      inputVatDeductibleSnapshot: false,
    });
    expect((await getTaxCompletenessForNoteForUser(
      note.id,
      actors.accountant,
    ))?.taxComplete).toBe(true);
    const opsScoped = (await listChargeTaxDetailsForNoteForUser(
      note.id,
      opsActor,
    )).find((row) => row.chargeId === missingBuying.id);
    expect(opsScoped).toMatchObject({
      inputVatInvoiceStatus: "missing",
      inputVatInvoiceReference: null,
      inputVatDeductible: null,
      missingInvoiceException: null,
    });

    const checked = await markCurrentStateChecked(note.id);
    expect(checked.status).toBe("checked");
    await expect(requestException(note.id, missingBuying.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    const approvedNote = await approveShippingNote({ id: note.id }, actors.admin);
    expect(approvedNote.status).toBe("approved");
    await expect(requestException(note.id, missingBuying.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    const locked = await lockShippingNote({ id: note.id }, actors.admin);
    expect(locked.status).toBe("locked");
    await expect(requestException(note.id, missingBuying.id))
      .rejects.toBeInstanceOf(AuthorizationError);

    const persisted = (await listChargeTaxDetailsForNoteForUser(
      note.id,
      actors.accountant,
    )).find((row) => row.chargeId === missingBuying.id);
    expect(persisted).toMatchObject({
      taxDecisionSource: "manual",
      taxTreatmentSnapshot: "taxable",
      vatPercent: "10.00",
      inputVatInvoiceStatus: "missing",
      inputVatDeductible: false,
      taxComplete: true,
      missingInvoiceException: {
        status: "approved",
        selfApproved: false,
      },
    });
    const audit = await listAuditLogsForEntity(
      "missing_invoice_exception",
      pending.id,
    );
    expect(audit.map((row) => row.action)).toEqual(expect.arrayContaining([
      "shipping_note_charge.missing_invoice_exception.requested",
      "shipping_note_charge.missing_invoice_exception.approved",
    ]));
  });

  it("T08-T11: rejection/revocation block, self-approval is explicit, and VAT remains legitimate", async () => {
    const rejectedFixture = await createSubmittedFixture("REJECTED");
    await classifyMissingInvoice(
      rejectedFixture.note.id,
      rejectedFixture.buying.id,
    );
    const rejectedRequest = await requestException(
      rejectedFixture.note.id,
      rejectedFixture.buying.id,
    );
    const rejected = await decideException(
      rejectedFixture.note.id,
      rejectedRequest.id,
      "rejected",
    );
    expect(rejected.status).toBe("rejected");
    expect((await getTaxCompletenessForNoteForUser(
      rejectedFixture.note.id,
      actors.accountant,
    ))?.taxComplete).toBe(false);

    const selfFixture = await createSubmittedFixture("SELF-APPROVED");
    await classifyMissingInvoice(selfFixture.note.id, selfFixture.buying.id, actors.admin);
    const selfRequest = await requestException(
      selfFixture.note.id,
      selfFixture.buying.id,
      actors.admin,
    );
    const selfApproved = await decideException(
      selfFixture.note.id,
      selfRequest.id,
      "approved",
      actors.admin,
    );
    expect(selfApproved).toMatchObject({
      status: "approved",
      selfApproved: true,
      requestedById: actors.admin.id,
      decisionById: actors.admin.id,
    });
    const detail = (await listChargeTaxDetailsForNoteForUser(
      selfFixture.note.id,
      actors.accountant,
    )).find((row) => row.chargeId === selfFixture.buying.id);
    expect(detail).toMatchObject({
      vatPercent: "10.00",
      inputVatInvoiceStatus: "missing",
      inputVatDeductible: false,
      taxComplete: true,
    });

    const revoked = await revokeMissingInvoiceException(
      revokeMissingInvoiceExceptionInputSchema.parse({
        exceptionId: selfApproved.id,
        reason: "Admin revoked the operational exception for renewed evidence review.",
        expectedFinancialRevision: await revisionFor(selfFixture.note.id),
      }),
      actors.admin,
    );
    expect(revoked.status).toBe("revoked");
    expect((await getTaxCompletenessForNoteForUser(
      selfFixture.note.id,
      actors.accountant,
    ))?.taxComplete).toBe(false);
  });

  it("T12-T13 and T16: unknown classification, stale revision, and wrong charge fail closed", async () => {
    const fixture = await createSubmittedFixture("FAIL-CLOSED");
    await db
      .update(shippingNoteCharges)
      .set({
        inputVatInvoiceStatus: "missing",
        inputVatInvoiceReference: null,
        inputVatDeductible: false,
      })
      .where(eq(shippingNoteCharges.id, fixture.buying.id));
    const request = await requestException(fixture.note.id, fixture.buying.id);
    await decideException(fixture.note.id, request.id, "approved");
    expect((await getTaxCompletenessForNoteForUser(
      fixture.note.id,
      actors.accountant,
    ))?.taxComplete).toBe(false);

    await expect(requestMissingInvoiceException({
      chargeId: "nonexistent-charge",
      reason: "Forged wrong-note charge request.",
      expectedFinancialRevision: await revisionFor(fixture.note.id),
    }, actors.admin)).rejects.toBeInstanceOf(AuthorizationError);

    const staleFixture = await createSubmittedFixture("STALE");
    await classifyMissingInvoice(staleFixture.note.id, staleFixture.buying.id);
    const staleRevision = await revisionFor(staleFixture.note.id);
    await updateBuyingCharge(
      staleFixture.buying.id,
      updateBuyingChargeInputSchema.parse({
        id: staleFixture.buying.id,
        chargeName: `${runId}-BUY-STALE-EDITED`,
        description: `${runId} changed after review`,
        quantity: "2.000",
        unit: "shipment",
        unitPrice: "60.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} vendor stale edited`,
      }),
      actors.accountant,
    );
    await expect(requestMissingInvoiceException({
      chargeId: staleFixture.buying.id,
      reason: "Attempt with stale evidence.",
      expectedFinancialRevision: staleRevision,
    }, actors.accountant)).rejects.toThrow(/financial review changed/i);
  });

  it("T14-T15 and T20: material edits invalidate approval while snapshots remain auditable", async () => {
    const fixture = await createSubmittedFixture("INVALIDATE");
    await classifyMissingInvoice(fixture.note.id, fixture.buying.id);
    const request = await requestException(fixture.note.id, fixture.buying.id);
    await decideException(fixture.note.id, request.id, "approved");

    await updateBuyingCharge(
      fixture.buying.id,
      updateBuyingChargeInputSchema.parse({
        id: fixture.buying.id,
        chargeName: `${runId}-BUY-INVALIDATED`,
        description: `${runId} material amount correction`,
        quantity: "2.000",
        unit: "shipment",
        unitPrice: "75.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} corrected vendor`,
      }),
      actors.accountant,
    );
    const [invalidated] = await db
      .select()
      .from(shippingNoteMissingInvoiceExceptions)
      .where(eq(shippingNoteMissingInvoiceExceptions.id, request.id));
    expect(invalidated).toMatchObject({
      status: "invalidated",
      invalidatedById: actors.accountant.id,
    });
    expect(invalidated?.invalidationReason).toMatch(/financial values changed/);
    expect((await getTaxCompletenessForNoteForUser(
      fixture.note.id,
      actors.accountant,
    ))?.taxComplete).toBe(false);

    await assignChargeTaxRule({
      chargeId: fixture.buying.id,
      taxRuleId: buyingTaxRuleId,
      inputVatInvoiceStatus: "available",
      inputVatInvoiceReference: `${runId}-LATE-INVOICE`,
      inputVatDeductible: true,
    }, actors.accountant);
    const reconciled = (await listChargeTaxDetailsForNoteForUser(
      fixture.note.id,
      actors.accountant,
    )).find((row) => row.chargeId === fixture.buying.id);
    expect(reconciled).toMatchObject({
      taxDecisionSource: "tax_rule",
      inputVatInvoiceStatus: "available",
      inputVatDeductible: true,
      taxComplete: true,
      missingInvoiceException: { status: "invalidated" },
    });
  });

  it("T17-T19: cancelled notes deny mutation and immutable audit evidence retains actor/time/reason", async () => {
    const fixture = await createSubmittedFixture("CANCELLED");
    await classifyMissingInvoice(fixture.note.id, fixture.buying.id);
    const request = await requestException(fixture.note.id, fixture.buying.id);
    const approved = await decideException(fixture.note.id, request.id, "approved");
    expect(approved.decidedAt).toBeInstanceOf(Date);
    expect(approved.decisionReason).toMatch(/operational closure only/);

    await cancelShippingNote({
      id: fixture.note.id,
      expectedStatus: "submitted",
      cancelReason: "Synthetic cancellation coverage.",
    }, actors.accountant);
    await expect(requestException(fixture.note.id, fixture.buying.id))
      .rejects.toBeInstanceOf(AuthorizationError);
    const audit = await listAuditLogsForEntity(
      "missing_invoice_exception",
      request.id,
    );
    expect(audit.every((row) => row.actorUserId !== null)).toBe(true);
    expect(audit.every((row) => row.createdAt instanceof Date)).toBe(true);
    expect(audit.map((row) => row.reason)).toEqual(expect.arrayContaining([
      expect.stringMatching(/Supplier invoice remains unavailable/),
      expect.stringMatching(/operational closure only/),
    ]));
  });

  it("T13-T14 concurrency: charge edit versus approval cannot leave stale approval effective", async () => {
    const fixture = await createSubmittedFixture("CONCURRENT");
    await classifyMissingInvoice(fixture.note.id, fixture.buying.id);
    const request = await requestException(fixture.note.id, fixture.buying.id);
    const sharedRevision = await revisionFor(fixture.note.id);

    const [approvalResult, editResult] = await Promise.allSettled([
      decideMissingInvoiceException({
        exceptionId: request.id,
        decision: "approved",
        reason: "Concurrent Admin approval attempt.",
        expectedFinancialRevision: sharedRevision,
      }, actors.admin),
      updateBuyingCharge(
        fixture.buying.id,
        updateBuyingChargeInputSchema.parse({
          id: fixture.buying.id,
          chargeName: `${runId}-BUY-CONCURRENT-EDIT`,
          description: `${runId} concurrent material edit`,
          quantity: "3.000",
          unit: "shipment",
          unitPrice: "80.0000",
          currency: "VND",
          vendorOrAgentText: `${runId} concurrent vendor`,
        }),
        actors.accountant,
      ),
    ]);

    expect(editResult.status).toBe("fulfilled");
    expect(["fulfilled", "rejected"]).toContain(approvalResult.status);
    const [finalException] = await db
      .select()
      .from(shippingNoteMissingInvoiceExceptions)
      .where(eq(shippingNoteMissingInvoiceExceptions.id, request.id))
      .orderBy(desc(shippingNoteMissingInvoiceExceptions.createdAt));
    expect(finalException?.status).toBe("invalidated");
    expect((await getTaxCompletenessForNoteForUser(
      fixture.note.id,
      actors.accountant,
    ))?.taxComplete).toBe(false);
  });
});
