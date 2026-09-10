import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { shippingNotes } from "@/lib/db/schema";
import {
  createShippingNoteDraft,
  submitShippingNote,
  updateShippingNoteDraft,
} from "@/features/shipping-notes/mutations";
import {
  shippingNoteDraftInputSchema,
  submitShippingNoteInputSchema,
  updateShippingNoteDraftInputSchema,
} from "@/features/shipping-notes/validators";

import { createIntegrationActors, type IntegrationActors } from "./fixtures/users";
import { createDraftFor, draftInput } from "./fixtures/shipping-notes";
import {
  countAuditLogsForRunAction,
  listAuditLogsForEntity,
} from "./helpers/audit";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { db, ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("MUT");
let actors: IntegrationActors;

describe("shipping note draft mutations and submission", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("creates sale and admin drafts with server-controlled owner and draft status", async () => {
    const saleInput = shippingNoteDraftInputSchema.parse({
      ...draftInput(runId, "CREATE-SALE"),
      status: "checked",
      createdById: actors.saleB.id,
    });
    const saleDraft = await createShippingNoteDraft(saleInput, actors.saleA);
    const adminDraft = await createShippingNoteDraft(
      draftInput(runId, "CREATE-ADMIN"),
      actors.admin,
    );

    expect(saleDraft.createdById).toBe(actors.saleA.id);
    expect(saleDraft.status).toBe("draft");
    expect(adminDraft.createdById).toBe(actors.admin.id);
    expect(adminDraft.status).toBe("draft");
    expect(saleDraft.mawbHawbNo).toBe(`${runId}-MAWB-CREATE-SALE`);

    const saleAudit = await listAuditLogsForEntity("shipping_note", saleDraft.id);
    expect(saleAudit.some((row) => row.action === "shipping_note.create_draft")).toBe(true);
  });

  it("denies accountant draft creation and writes no success audit row", async () => {
    const before = await countAuditLogsForRunAction(
      runId,
      "shipping_note.create_draft",
    );

    await expect(
      createShippingNoteDraft(draftInput(runId, "CREATE-DENIED"), actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const after = await countAuditLogsForRunAction(
      runId,
      "shipping_note.create_draft",
    );
    expect(after).toBe(before);
  });

  it("documents active and deleted user filtering at the session boundary", () => {
    expect(rejectInactiveOrSoftDeletedUsers(actors.inactiveSale)).toBeNull();
    expect(rejectInactiveOrSoftDeletedUsers(actors.deletedSale)).toBeNull();
    expect(rejectInactiveOrSoftDeletedUsers(actors.saleA)?.id).toBe(actors.saleA.id);
  });

  it("updates own sale draft and admin-permitted drafts with before/after audit snapshots", async () => {
    const ownDraft = await createDraftFor(actors.saleA, runId, "UPDATE-OWN");
    const otherDraft = await createDraftFor(actors.saleB, runId, "UPDATE-ADMIN");
    const updateInput = updateShippingNoteDraftInputSchema.parse({
      ...draftInput(runId, "UPDATE-OWN-UPDATED"),
      id: ownDraft.id,
      shipperText: `Updated shipper ${runId}`,
    });

    const updated = await updateShippingNoteDraft(
      ownDraft.id,
      updateInput,
      actors.saleA,
    );
    const adminUpdated = await updateShippingNoteDraft(
      otherDraft.id,
      updateShippingNoteDraftInputSchema.parse({
        ...draftInput(runId, "UPDATE-ADMIN-UPDATED"),
        id: otherDraft.id,
      }),
      actors.admin,
    );

    expect(updated.createdById).toBe(actors.saleA.id);
    expect(updated.status).toBe("draft");
    expect(updated.shipperText).toBe(`Updated shipper ${runId}`);
    expect(adminUpdated.createdById).toBe(actors.saleB.id);

    const auditRows = await listAuditLogsForEntity("shipping_note", ownDraft.id);
    const updateAudit = auditRows.find(
      (row) => row.action === "shipping_note.update_draft",
    );

    expect(updateAudit?.before).toMatchObject({ id: ownDraft.id });
    expect(updateAudit?.after).toMatchObject({
      id: ownDraft.id,
      shipperText: `Updated shipper ${runId}`,
    });
  });

  it("denies sale updating another sale draft and accountant updating any draft", async () => {
    const otherDraft = await createDraftFor(actors.saleB, runId, "UPDATE-DENIED");
    const beforeAudit = await listAuditLogsForEntity("shipping_note", otherDraft.id);
    const input = updateShippingNoteDraftInputSchema.parse({
      ...draftInput(runId, "UPDATE-DENIED-ATTEMPT"),
      id: otherDraft.id,
    });

    await expect(
      updateShippingNoteDraft(otherDraft.id, input, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      updateShippingNoteDraft(otherDraft.id, input, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const afterAudit = await listAuditLogsForEntity("shipping_note", otherDraft.id);
    expect(afterAudit.length).toBe(beforeAudit.length);
  });

  it("submits own sale draft exactly once and writes status audit snapshots", async () => {
    const draft = await createDraftFor(actors.saleA, runId, "SUBMIT-OWN");
    const submitted = await submitShippingNote(
      submitShippingNoteInputSchema.parse({ id: draft.id }),
      actors.saleA,
    );

    expect(submitted.status).toBe("submitted");
    expect(submitted.submittedAt).toBeInstanceOf(Date);

    await expect(
      submitShippingNote({ id: draft.id }, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const auditRows = await listAuditLogsForEntity("shipping_note", draft.id);
    const submitAudit = auditRows.find(
      (row) => row.action === "shipping_note.submit",
    );

    expect(submitAudit?.actorUserId).toBe(actors.saleA.id);
    expect(submitAudit?.before).toMatchObject({ status: "draft" });
    expect(submitAudit?.after).toMatchObject({ status: "submitted" });
  });

  it("denies submitting another sale draft and blocks draft updates after submission", async () => {
    const otherDraft = await createDraftFor(actors.saleB, runId, "SUBMIT-DENIED");

    await expect(
      submitShippingNote({ id: otherDraft.id }, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      submitShippingNote({ id: otherDraft.id }, actors.accountant),
    ).rejects.toBeInstanceOf(AuthorizationError);

    await submitShippingNote({ id: otherDraft.id }, actors.saleB);

    await expect(
      updateShippingNoteDraft(
        otherDraft.id,
        updateShippingNoteDraftInputSchema.parse({
          ...draftInput(runId, "SUBMIT-DENIED-UPDATE"),
          id: otherDraft.id,
        }),
        actors.saleB,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const [persisted] = await db
      .select({ status: shippingNotes.status })
      .from(shippingNotes)
      .where(eq(shippingNotes.id, otherDraft.id))
      .limit(1);

    expect(persisted?.status).toBe("submitted");
  });
});
