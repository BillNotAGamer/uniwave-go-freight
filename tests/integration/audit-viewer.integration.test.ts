import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditLogs } from "@/lib/db/schema";
import { listAuditViewerForUser } from "@/features/admin/audit/queries";

import {
  createIntegrationActors,
  createIntegrationUser,
  type IntegrationActors,
} from "./fixtures/users";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { db, ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("AUDVIEW");
let actors: IntegrationActors;

async function insertAuditRow(input: {
  id?: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: Date;
}) {
  const [created] = await db
    .insert(auditLogs)
    .values({
      id: input.id ?? randomUUID(),
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ?? null,
      after: input.after ?? { runId },
      reason: input.reason ?? null,
      createdAt: input.createdAt,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to insert audit viewer fixture.");
  }

  return created;
}

describe("audit viewer read model", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("allows Admin and denies Sale/Accountant before returning audit data", async () => {
    await insertAuditRow({
      actorUserId: actors.admin.id,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: actors.saleA.id,
      after: { runId, revokedSessionCount: 1 },
      createdAt: new Date("2026-08-24T01:00:00.000Z"),
    });

    await expect(listAuditViewerForUser(actors.saleA)).rejects.toThrow();
    await expect(listAuditViewerForUser(actors.accountant)).rejects.toThrow();
    await expect(listAuditViewerForUser(actors.admin, {
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: actors.saleA.id,
    })).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          action: "user.sessions_revoked",
          entityType: "user",
          entityId: actors.saleA.id,
          actor: expect.objectContaining({
            id: actors.admin.id,
            email: actors.admin.email,
          }),
          changes: [
            {
              field: "revokedSessionCount",
              label: "Revoked session count",
              before: null,
              after: "1",
            },
          ],
        }),
      ],
    });
  });

  it("orders newest first with same-timestamp id tie-breaker and supports cursor pagination", async () => {
    const createdAt = new Date("2026-08-24T02:00:00.000Z");
    const highId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const lowId = "00000000-0000-4000-8000-000000000001";

    await insertAuditRow({
      id: lowId,
      actorUserId: actors.admin.id,
      action: "shipping_note.cancel",
      entityType: "shipping_note",
      entityId: randomUUID(),
      before: { runId, status: "approved" },
      after: { runId, status: "cancelled", cancelReason: "void" },
      createdAt,
    });
    await insertAuditRow({
      id: highId,
      actorUserId: actors.admin.id,
      action: "shipping_note.reopen_for_correction",
      entityType: "shipping_note",
      entityId: randomUUID(),
      before: { runId, status: "approved" },
      after: { runId, status: "accounting_reviewing" },
      createdAt,
    });

    const firstPage = await listAuditViewerForUser(actors.admin, {
      from: "2026-08-24T02:00:00.000Z",
      to: "2026-08-24T02:00:00.000Z",
      limit: 1,
    });
    const secondPage = await listAuditViewerForUser(actors.admin, {
      from: "2026-08-24T02:00:00.000Z",
      to: "2026-08-24T02:00:00.000Z",
      cursor: firstPage.nextCursor ?? undefined,
      limit: 1,
    });

    expect(firstPage.items[0]?.id).toBe(highId);
    expect(firstPage.hasNextPage).toBe(true);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(secondPage.items[0]?.id).toBe(lowId);
  });

  it("filters by action, entity, actor, and date range", async () => {
    const entityId = randomUUID();
    const createdAt = new Date("2026-08-24T03:00:00.000Z");

    await insertAuditRow({
      actorUserId: actors.admin.id,
      action: "shipping_note.export.drive.failed",
      entityType: "shipping_note_export",
      entityId,
      after: {
        runId,
        driveUploadStatus: "upload_failed",
        driveErrorMessage: "DRIVE_UPLOAD_FAILED",
        driveFileId: "drive-file-hidden",
        driveFolderId: "drive-folder-hidden",
        artifactStorageKey: "storage-key-hidden",
      },
      createdAt,
    });

    const page = await listAuditViewerForUser(actors.admin, {
      action: "shipping_note.export.drive.failed",
      entityType: "shipping_note_export",
      entityId,
      actorId: actors.admin.id,
      from: "2026-08-24T02:59:00.000Z",
      to: "2026-08-24T03:01:00.000Z",
    });
    const text = JSON.stringify(page);

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).not.toHaveProperty("before");
    expect(page.items[0]).not.toHaveProperty("after");
    expect(text).toContain("DRIVE_UPLOAD_FAILED");
    expect(text).not.toContain("drive-file-hidden");
    expect(text).not.toContain("drive-folder-hidden");
    expect(text).not.toContain("storage-key-hidden");
  });

  it("resolves soft-deleted actor identity and uses safe fallback for null actor", async () => {
    const deletedActor = await createIntegrationUser({
      runId,
      label: "audit-deleted-actor",
      role: "admin",
      deleted: true,
    });

    await insertAuditRow({
      actorUserId: deletedActor.id,
      action: "user.role_change",
      entityType: "user",
      entityId: actors.saleB.id,
      before: { runId, role: "sale" },
      after: { runId, role: "accountant", revokedSessionCount: 0 },
      createdAt: new Date("2026-08-24T04:00:00.000Z"),
    });
    await insertAuditRow({
      actorUserId: null,
      action: "user.sessions_revoked",
      entityType: "user",
      entityId: actors.saleB.id,
      after: { runId, revokedSessionCount: 0 },
      createdAt: new Date("2026-08-24T04:01:00.000Z"),
    });

    const page = await listAuditViewerForUser(actors.admin, {
      entityType: "user",
      entityId: actors.saleB.id,
      from: "2026-08-24T04:00:00.000Z",
      to: "2026-08-24T04:01:00.000Z",
    });

    expect(page.items.find((item) => item.actor.id === deletedActor.id)?.actor)
      .toMatchObject({
        name: deletedActor.name,
        email: deletedActor.email,
        display: deletedActor.name,
      });
    expect(page.items.find((item) => item.actor.id === null)?.actor.display)
      .toBe("Unknown actor");
  });

  it("hides unknown action snapshots completely", async () => {
    const entityId = randomUUID();

    await insertAuditRow({
      actorUserId: actors.admin.id,
      action: "future.secret_action",
      entityType: "shipping_note",
      entityId,
      before: {
        runId,
        harmless: "hidden-before",
        password: "hidden-password",
      },
      after: {
        runId,
        harmless: "hidden-after",
        token: "hidden-token",
      },
      reason: "future reason",
      createdAt: new Date("2026-08-24T05:00:00.000Z"),
    });

    const page = await listAuditViewerForUser(actors.admin, {
      entityType: "shipping_note",
      entityId,
    });
    const text = JSON.stringify(page);

    expect(page.items[0]).toMatchObject({
      action: "future.secret_action",
      detailsAvailable: false,
      changes: [],
      reason: "future reason",
    });
    expect(text).not.toContain("hidden-before");
    expect(text).not.toContain("hidden-after");
    expect(text).not.toContain("hidden-password");
    expect(text).not.toContain("hidden-token");
  });
});
