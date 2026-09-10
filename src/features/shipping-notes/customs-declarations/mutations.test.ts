import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getShippingNoteForUser: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { transaction: mocks.transaction },
}));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: mocks.logAuditEvent }));
vi.mock("../queries", () => ({
  getShippingNoteForUser: mocks.getShippingNoteForUser,
}));

import type { User } from "@/lib/db/schema";
import { addCustomsDeclaration, removeCustomsDeclaration } from "./mutations";

const now = new Date("2026-09-09T00:00:00.000Z");

function user(role: User["role"]): User {
  return {
    id: `${role}-1`,
    email: `${role}@example.test`,
    name: role,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function configureTransaction(duplicate = false) {
  const inserted: Array<Record<string, unknown>> = [];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(duplicate ? [{ id: "existing" }] : []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        inserted.push(values);
        return {
          returning: vi.fn().mockResolvedValue([{
            id: `declaration-${inserted.length}`,
            createdAt: now,
            updatedAt: now,
            ...values,
          }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "existing" }]),
        })),
      })),
    })),
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  return { tx, inserted };
}

describe("Customs Declaration mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getShippingNoteForUser.mockResolvedValue({
      id: "note-1",
      status: "accounting_reviewing",
    });
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it.each(["accountant", "admin"] as const)(
    "allows an authorized %s to add one or multiple declarations atomically",
    async (role) => {
      const configured = configureTransaction();
      await addCustomsDeclaration(
        { shippingNoteId: "note-1", declarationNo: "  DEC/001  " },
        user(role),
      );
      await addCustomsDeclaration(
        { shippingNoteId: "note-1", declarationNo: "DEC/002" },
        user(role),
      );

      expect(configured.inserted).toEqual([
        { shippingNoteId: "note-1", declarationNo: "DEC/001" },
        { shippingNoteId: "note-1", declarationNo: "DEC/002" },
      ]);
      expect(mocks.logAuditEvent).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects an exact active duplicate on the same note before insertion", async () => {
    const configured = configureTransaction(true);
    await expect(addCustomsDeclaration(
      { shippingNoteId: "note-1", declarationNo: "DEC/001" },
      user("accountant"),
    )).rejects.toThrow(/already exists/);
    expect(configured.tx.insert).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("does not impose global uniqueness across Shipping Notes", async () => {
    const configured = configureTransaction();
    mocks.getShippingNoteForUser.mockResolvedValue({
      id: "note-2",
      status: "submitted",
    });
    await addCustomsDeclaration(
      { shippingNoteId: "note-2", declarationNo: "DEC/001" },
      user("accountant"),
    );
    expect(configured.inserted[0]).toMatchObject({
      shippingNoteId: "note-2",
      declarationNo: "DEC/001",
    });
  });

  it("rejects Sale and immutable Shipping Note statuses before writes", async () => {
    configureTransaction();
    await expect(addCustomsDeclaration(
      { shippingNoteId: "note-1", declarationNo: "DEC/001" },
      user("sale"),
    )).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();

    mocks.getShippingNoteForUser.mockResolvedValue({ id: "note-1", status: "locked" });
    await expect(addCustomsDeclaration(
      { shippingNoteId: "note-1", declarationNo: "DEC/001" },
      user("accountant"),
    )).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rolls back the transaction contract when audit persistence fails", async () => {
    configureTransaction();
    mocks.logAuditEvent.mockRejectedValue(new Error("audit failed"));
    await expect(addCustomsDeclaration(
      { shippingNoteId: "note-1", declarationNo: "DEC/001" },
      user("accountant"),
    )).rejects.toThrow("audit failed");
  });

  it("soft-deletes an owned declaration and audits the removal", async () => {
    const configured = configureTransaction(true);
    await removeCustomsDeclaration(
      { id: "existing", shippingNoteId: "note-1" },
      user("accountant"),
    );
    expect(configured.tx.update).toHaveBeenCalledOnce();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      configured.tx,
      expect.objectContaining({
        action: "shipping_note.customs_declaration.remove",
        entityType: "shipping_note",
        entityId: "note-1",
      }),
    );
  });
});
