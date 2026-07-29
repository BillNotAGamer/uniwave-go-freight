import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  getFinancialSummaryForNoteForUser,
  getSellingChargesAndSummaryForNoteForUser,
  listBuyingChargesForNoteForUser,
} from "@/features/shipping-notes/queries";
import {
  createBuyingChargeForNote,
  createSellingChargeForNote,
  softDeleteBuyingCharge,
  softDeleteSellingCharge,
  submitShippingNote,
  updateBuyingCharge,
  updateSellingCharge,
} from "@/features/shipping-notes/mutations";
import {
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  updateBuyingChargeInputSchema,
  updateSellingChargeInputSchema,
} from "@/features/shipping-notes/validators";

import { createIntegrationActors, type IntegrationActors } from "./fixtures/users";
import { createDraftFor } from "./fixtures/shipping-notes";
import { listAuditLogsForEntity } from "./helpers/audit";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("CHG");
let actors: IntegrationActors;

function sellingInput(noteId: string, label: string, unitPrice = "100.0000") {
  return createSellingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-SELL-${label}`,
    description: `${runId} selling charge ${label}`,
    quantity: "2.000",
    unit: "shipment",
    unitPrice,
    currency: "VND",
  });
}

function buyingInput(noteId: string, label: string, unitPrice = "60.0000") {
  return createBuyingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-BUY-${label}`,
    description: `${runId} buying charge ${label}`,
    quantity: "2.000",
    unit: "shipment",
    unitPrice,
    currency: "VND",
    vendorOrAgentText: `${runId} vendor ${label}`,
  });
}

describe("persisted charges and financial summaries", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("creates, updates, and soft-deletes selling charges with server-computed amounts", async () => {
    const note = await createDraftFor(actors.saleA, runId, "SELLING-LIFECYCLE");
    const created = await createSellingChargeForNote(
      sellingInput(note.id, "CREATE"),
      actors.saleA,
    );

    expect(created.amountOriginal).toBe("200.0000");
    expect(created.amountVnd).toBe("200.00");
    expect(created.exchangeRate).toBe("1.000000");

    const updated = await updateSellingCharge(
      updateSellingChargeInputSchema.parse({
        id: created.id,
        chargeName: `${runId}-SELL-UPDATED`,
        description: `${runId} updated selling charge`,
        quantity: "3.000",
        unit: "shipment",
        unitPrice: "50.0000",
        currency: "VND",
      }),
      actors.saleA,
    );

    expect(updated.amountOriginal).toBe("150.0000");
    expect(updated.amountVnd).toBe("150.00");

    const beforeDeleteSummary = await getSellingChargesAndSummaryForNoteForUser(
      note.id,
      actors.saleA,
    );
    expect(beforeDeleteSummary.summary.totalVnd).toBe("150.00");

    await softDeleteSellingCharge(created.id, note.id, actors.saleA);

    const afterDeleteSummary = await getSellingChargesAndSummaryForNoteForUser(
      note.id,
      actors.saleA,
    );
    expect(afterDeleteSummary.charges).toHaveLength(0);
    expect(afterDeleteSummary.summary.totalVnd).toBe("0.00");

    const auditRows = await listAuditLogsForEntity("shipping_note_charge", created.id);
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "shipping_note_charge.create",
        "shipping_note_charge.update",
        "shipping_note_charge.delete",
      ]),
    );
  });

  it("denies selling charge mutations for other sale, submitted notes, and accountant", async () => {
    const ownNote = await createDraftFor(actors.saleA, runId, "SELLING-DENIED-OWN");
    const otherNote = await createDraftFor(actors.saleB, runId, "SELLING-DENIED-OTHER");
    await submitShippingNote({ id: ownNote.id }, actors.saleA);

    await expect(
      createSellingChargeForNote(sellingInput(otherNote.id, "OTHER-SALE"), actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      createSellingChargeForNote(sellingInput(ownNote.id, "SUBMITTED"), actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      createSellingChargeForNote(sellingInput(otherNote.id, "ACCOUNTANT"), actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("validates selling charge quantity, unit price, currency, and exchange rate", async () => {
    const note = await createDraftFor(actors.saleA, runId, "SELLING-VALIDATION");

    expect(() => createSellingChargeInputSchema.parse({
      ...sellingInput(note.id, "INVALID-QTY"),
      quantity: "0.000",
    })).toThrow(/must be positive/);
    expect(() => createSellingChargeInputSchema.parse({
      ...sellingInput(note.id, "INVALID-PRICE"),
      unitPrice: "-1.0000",
    })).toThrow(/Negative decimal values are not allowed/);
    expect(() => createSellingChargeInputSchema.parse({
      ...sellingInput(note.id, "INVALID-CURRENCY"),
      currency: "EUR",
    })).toThrow();
    expect(() => createSellingChargeInputSchema.parse({
      ...sellingInput(note.id, "USD-MISSING-RATE"),
      currency: "USD",
    })).toThrow(/Exchange rate is required/);
  });

  it("creates, updates, and soft-deletes buying charges in eligible statuses", async () => {
    const note = await createDraftFor(actors.saleA, runId, "BUYING-LIFECYCLE");
    await createSellingChargeForNote(sellingInput(note.id, "BASE", "150.0000"), actors.saleA);
    await submitShippingNote({ id: note.id }, actors.saleA);

    const created = await createBuyingChargeForNote(
      note.id,
      buyingInput(note.id, "CREATE"),
      actors.accountant,
    );
    expect(created.amountOriginal).toBe("120.0000");
    expect(created.amountVnd).toBe("120.00");

    let summary = await getFinancialSummaryForNoteForUser(note.id, actors.accountant);
    expect(summary).toMatchObject({
      totalSellingVnd: "300.00",
      totalBuyingVnd: "120.00",
      grossProfitVnd: "180.00",
    });

    const updated = await updateBuyingCharge(
      created.id,
      updateBuyingChargeInputSchema.parse({
        id: created.id,
        chargeName: `${runId}-BUY-UPDATED`,
        description: `${runId} updated buying charge`,
        quantity: "2.000",
        unit: "shipment",
        unitPrice: "75.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} updated vendor`,
      }),
      actors.accountant,
    );
    expect(updated.amountVnd).toBe("150.00");

    summary = await getFinancialSummaryForNoteForUser(note.id, actors.admin);
    expect(summary?.grossProfitVnd).toBe("150.00");

    await softDeleteBuyingCharge(created.id, actors.accountant);

    expect(await listBuyingChargesForNoteForUser(note.id, actors.accountant)).toHaveLength(0);
    summary = await getFinancialSummaryForNoteForUser(note.id, actors.accountant);
    expect(summary).toMatchObject({
      totalSellingVnd: "300.00",
      totalBuyingVnd: "0.00",
      grossProfitVnd: "300.00",
    });

    const auditRows = await listAuditLogsForEntity("shipping_note_charge", created.id);
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "shipping_note_charge.buying.create",
        "shipping_note_charge.buying.update",
        "shipping_note_charge.buying.delete",
      ]),
    );
  });

  it("denies sale buying access and rejects buying mutations in ineligible statuses", async () => {
    const draft = await createDraftFor(actors.saleA, runId, "BUYING-DENIED-DRAFT");
    const submitted = await createDraftFor(actors.saleA, runId, "BUYING-DENIED-SALE");
    await submitShippingNote({ id: submitted.id }, actors.saleA);

    await expect(
      listBuyingChargesForNoteForUser(submitted.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      createBuyingChargeForNote(submitted.id, buyingInput(submitted.id, "SALE"), actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      createBuyingChargeForNote(draft.id, buyingInput(draft.id, "DRAFT"), actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("computes zero and negative profit from active persisted rows exactly", async () => {
    const zeroNote = await createDraftFor(actors.saleA, runId, "ZERO-PROFIT");
    await createSellingChargeForNote(sellingInput(zeroNote.id, "ZERO-SELL", "50.0000"), actors.saleA);
    await submitShippingNote({ id: zeroNote.id }, actors.saleA);
    await createBuyingChargeForNote(zeroNote.id, buyingInput(zeroNote.id, "ZERO-BUY", "50.0000"), actors.accountant);

    const negativeNote = await createDraftFor(actors.saleA, runId, "NEGATIVE-PROFIT");
    await createSellingChargeForNote(sellingInput(negativeNote.id, "NEG-SELL", "25.0000"), actors.saleA);
    await submitShippingNote({ id: negativeNote.id }, actors.saleA);
    await createBuyingChargeForNote(negativeNote.id, buyingInput(negativeNote.id, "NEG-BUY", "37.5000"), actors.accountant);

    expect((await getFinancialSummaryForNoteForUser(
      zeroNote.id,
      actors.accountant,
    ))?.grossProfitVnd).toBe("0.00");
    expect((await getFinancialSummaryForNoteForUser(
      negativeNote.id,
      actors.accountant,
    ))?.grossProfitVnd).toBe("-25.00");
  });
});
