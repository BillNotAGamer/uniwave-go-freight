vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeArtifactStorage } from "@/lib/artifact-storage/fake";
import { AuthorizationError } from "@/lib/permissions/require-permission";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logAuditEvent: vi.fn(),
  getShippingNoteForUser: vi.fn(),
  rejectInactiveOrSoftDeletedUsers: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { transaction: mocks.transaction },
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/auth/user-state", () => ({
  rejectInactiveOrSoftDeletedUsers: mocks.rejectInactiveOrSoftDeletedUsers,
}));

vi.mock("./queries", () => ({
  getShippingNoteForUser: mocks.getShippingNoteForUser,
}));

import type { User } from "@/lib/db/schema";
import { hardDeleteShippingNote } from "./hard-delete";

const note = {
  id: "note-1",
  jobsheetNo: "JS-2026-001",
  shippingMode: "sea_export",
  createdById: "admin-1",
};

function admin(): User {
  return {
    id: "admin-1",
    email: "admin@example.test",
    name: "Admin",
    image: null,
    emailVerified: true,
    role: "admin",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function sale(): User {
  return { ...admin(), id: "sale-1", role: "sale" };
}

function configureTransaction() {
  const tx = {
    select: vi.fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([note]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { storageKey: "shipping-note-documents/note-1/document.pdf" },
          ]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { storageKey: "shipping-note-exports/note-1/export.xlsx" },
          ]),
        }),
      }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: note.id }]),
      }),
    }),
  };
  mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
  return tx;
}

describe("Shipping Note hard delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
    mocks.getShippingNoteForUser.mockResolvedValue(note);
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("hard deletes the note after collecting dependent artifact keys, then removes exact R2 objects", async () => {
    const tx = configureTransaction();
    const storage = new FakeArtifactStorage();

    const result = await hardDeleteShippingNote(
      { id: note.id, reason: "Duplicate jobsheet" },
      admin(),
      { storage },
    );

    expect(tx.delete).toHaveBeenCalledOnce();
    expect(storage.deletedKeys).toStrictEqual([
      "shipping-note-documents/note-1/document.pdf",
      "shipping-note-exports/note-1/export.xlsx",
    ]);
    expect(storage.deletedKeys).not.toContain("shipping-note-documents/note-1/");
    expect(result).toMatchObject({
      id: note.id,
      documentArtifactCount: 1,
      exportArtifactCount: 1,
    });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "shipping_note.hard_delete",
        entityId: note.id,
        reason: "Duplicate jobsheet",
        before: expect.objectContaining({
          jobsheetNo: note.jobsheetNo,
          documentArtifactCount: 1,
          exportArtifactCount: 1,
        }),
      }),
    );
  });

  it("rejects blank reasons before querying or deleting", async () => {
    await expect(
      hardDeleteShippingNote({ id: note.id, reason: "   " }, admin()),
    ).rejects.toThrow("Delete reason is required.");
    expect(mocks.getShippingNoteForUser).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("preserves Admin-only destructive authorization", async () => {
    await expect(
      hardDeleteShippingNote({ id: note.id, reason: "Duplicate jobsheet" }, sale()),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.getShippingNoteForUser).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps the committed hard-delete audit and reports a sanitized cleanup failure", async () => {
    const tx = configureTransaction();
    const storage = new FakeArtifactStorage();
    storage.failNextDelete();

    await expect(
      hardDeleteShippingNote(
        { id: note.id, reason: "Duplicate jobsheet" },
        admin(),
        { storage },
      ),
    ).rejects.toThrow("Shipping Note was deleted, but private artifact cleanup failed.");

    expect(tx.delete).toHaveBeenCalledOnce();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "shipping_note.hard_delete" }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "shipping_note.hard_delete.cleanup_failed" }),
    );
  });
});
