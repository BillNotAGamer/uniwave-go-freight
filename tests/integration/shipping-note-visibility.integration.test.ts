import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  getFinancialSummaryForNoteForUser,
  getShippingNoteForUser,
  getSellingChargesAndSummaryForNoteForUser,
  listBuyingChargesForNoteForUser,
  listShippingNotesForUser,
} from "@/features/shipping-notes/queries";

import { createIntegrationActors, type IntegrationActors } from "./fixtures/users";
import { createDraftFor, softDeleteNote } from "./fixtures/shipping-notes";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("VIS");
let actors: IntegrationActors;

describe("shipping note visibility and row-level ownership", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("isolates Sale A and Sale B list/detail access to their own active notes", async () => {
    const saleANote = await createDraftFor(actors.saleA, runId, "SALE-A-OWN");
    const saleBNote = await createDraftFor(actors.saleB, runId, "SALE-B-OWN");

    const saleAList = await listShippingNotesForUser(actors.saleA);
    const saleBList = await listShippingNotesForUser(actors.saleB);

    expect(saleAList.some((note) => note.id === saleANote.id)).toBe(true);
    expect(saleAList.some((note) => note.id === saleBNote.id)).toBe(false);
    expect(saleBList.some((note) => note.id === saleBNote.id)).toBe(true);
    expect(saleBList.some((note) => note.id === saleANote.id)).toBe(false);
    expect(await getShippingNoteForUser(saleANote.id, actors.saleA)).not.toBeNull();
    expect(await getShippingNoteForUser(saleBNote.id, actors.saleA)).toBeNull();
  });

  it("lets accountant and admin list/read active notes across owners", async () => {
    const saleANote = await createDraftFor(actors.saleA, runId, "ACCT-READ-A");
    const saleBNote = await createDraftFor(actors.saleB, runId, "ACCT-READ-B");

    const accountantList = await listShippingNotesForUser(actors.accountant);
    const adminList = await listShippingNotesForUser(actors.admin);

    expect(accountantList.some((note) => note.id === saleANote.id)).toBe(true);
    expect(accountantList.some((note) => note.id === saleBNote.id)).toBe(true);
    expect(adminList.some((note) => note.id === saleANote.id)).toBe(true);
    expect(adminList.some((note) => note.id === saleBNote.id)).toBe(true);
    expect(await getShippingNoteForUser(saleBNote.id, actors.accountant)).not.toBeNull();
    expect(await getShippingNoteForUser(saleANote.id, actors.admin)).not.toBeNull();
  });

  it("keeps buying charges and financial summaries protected from sale users", async () => {
    const note = await createDraftFor(actors.saleA, runId, "SALE-PROTECTED");

    await expect(
      listBuyingChargesForNoteForUser(note.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      getFinancialSummaryForNoteForUser(note.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const sellingResult = await getSellingChargesAndSummaryForNoteForUser(
      note.id,
      actors.saleA,
    );
    expect(sellingResult.summary.totalVnd).toBe("0.00");
  });

  it("excludes soft-deleted shipping notes for every role", async () => {
    const deletedNote = await createDraftFor(actors.saleA, runId, "SOFT-DELETED");
    await softDeleteNote(deletedNote.id);

    expect(await getShippingNoteForUser(deletedNote.id, actors.saleA)).toBeNull();
    expect(await getShippingNoteForUser(deletedNote.id, actors.accountant)).toBeNull();
    expect(await getShippingNoteForUser(deletedNote.id, actors.admin)).toBeNull();
    expect((await listShippingNotesForUser(actors.admin)).some(
      (note) => note.id === deletedNote.id,
    )).toBe(false);
  });
});
