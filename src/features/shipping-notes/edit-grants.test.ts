import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { select: mocks.select, transaction: mocks.transaction },
}));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: mocks.logAuditEvent }));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  hasActivePostSubmitEditGrant,
  issueShippingNoteEditGrant,
  revokeShippingNoteEditGrant,
} from "./edit-grants";

const now = new Date("2026-10-21T00:00:00.000Z");

function user(role: User["role"], id = `${role}-1`): User {
  return {
    id,
    email: `${id}@example.test`,
    name: id,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function queryChain(response: unknown[]) {
  const chain = {
    from: vi.fn(), innerJoin: vi.fn(), leftJoin: vi.fn(), where: vi.fn(),
    orderBy: vi.fn(), limit: vi.fn(), for: vi.fn(),
    then: <TResult1 = unknown[], TResult2 = never>(
      onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(response);
  chain.limit.mockReturnValue(chain);
  chain.for.mockResolvedValue(response);
  return chain;
}

function configureIssue({
  actorRole = "admin",
  noteStatus = "submitted",
  noteOwner = "sale-1",
  recipientRole = "sale",
  recipientActive = true,
  recipientDeletedAt = null as Date | null,
  insertResult = [{ id: "grant-1", shippingNoteId: "note-1", recipientUserId: "sale-1" }],
}: {
  actorRole?: User["role"];
  noteStatus?: "draft" | "submitted" | "accounting_reviewing" | "checked" | "approved" | "exported" | "locked" | "cancelled";
  noteOwner?: string;
  recipientRole?: User["role"];
  recipientActive?: boolean;
  recipientDeletedAt?: Date | null;
  insertResult?: unknown[];
} = {}) {
  const responses = [
    [{ id: "note-1", createdById: noteOwner, status: noteStatus }],
    [{ id: "sale-1", role: recipientRole, isActive: recipientActive, deletedAt: recipientDeletedAt }],
  ];
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({ returning: vi.fn().mockResolvedValue(insertResult) })),
    })),
  }));
  const tx = { select: vi.fn(() => queryChain(responses.shift() ?? [])), insert };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  return { actor: user(actorRole), tx };
}

describe("post-submit edit grants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it.each(["admin", "accountant"] as const)("allows %s to issue an owner-bound grant and audits it", async (role) => {
    const { actor } = configureIssue({ actorRole: role });
    await expect(issueShippingNoteEditGrant({
      shippingNoteId: "note-1", recipientUserId: "sale-1", reason: "Correction",
    }, actor)).resolves.toMatchObject({ id: "grant-1" });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorUserId: actor.id,
      action: "shipping_note.edit_grant_issued",
      entityId: "note-1",
      after: expect.objectContaining({ recipientUserId: "sale-1", status: "active" }),
    }));
  });

  it.each(["sale", "ops"] as const)("denies %s grant issuance before database mutation", async (role) => {
    const actor = user(role);
    await expect(issueShippingNoteEditGrant({ shippingNoteId: "note-1", recipientUserId: actor.id }, actor))
      .rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects cross-owner, inactive, changed-role, exported, closed, and duplicate active grants", async () => {
    for (const options of [
      { noteOwner: "sale-2" },
      { recipientActive: false },
      { recipientRole: "accountant" as const },
      { noteStatus: "exported" as const },
      { noteStatus: "locked" as const },
    ]) {
      const { actor } = configureIssue(options);
      await expect(issueShippingNoteEditGrant({ shippingNoteId: "note-1", recipientUserId: "sale-1" }, actor))
        .rejects.toBeInstanceOf(AuthorizationError);
    }
    const { actor } = configureIssue({ insertResult: [] });
    await expect(issueShippingNoteEditGrant({ shippingNoteId: "note-1", recipientUserId: "sale-1" }, actor))
      .rejects.toThrow("already has an active edit grant");
  });

  it("treats active access as recipient-, owner-, role-, and note-specific", async () => {
    mocks.select.mockReturnValueOnce(queryChain([{ id: "grant-1" }]));
    await expect(hasActivePostSubmitEditGrant("note-1", user("sale", "sale-1"))).resolves.toBe(true);
    await expect(hasActivePostSubmitEditGrant("note-2", user("admin"))).resolves.toBe(false);
  });

  it("revokes atomically, audits once, and treats repeat revocation as idempotent", async () => {
    const updateReturning = vi.fn().mockResolvedValue([{ id: "grant-1" }]);
    const tx = {
      select: vi.fn(() => queryChain([{
        id: "grant-1", shippingNoteId: "note-1", recipientUserId: "sale-1",
        status: "active", grantedById: "admin-1", grantedAt: now,
      }])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: updateReturning })) })) })),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    await revokeShippingNoteEditGrant({ shippingNoteId: "note-1", grantId: "grant-1" }, user("accountant"));
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "shipping_note.edit_grant_revoked",
      entityId: "note-1",
    }));

    vi.clearAllMocks();
    const revokedTx = {
      select: vi.fn(() => queryChain([{
        id: "grant-1", shippingNoteId: "note-1", recipientUserId: "sale-1",
        status: "revoked", grantedById: "admin-1", grantedAt: now,
      }])),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(revokedTx));
    await expect(revokeShippingNoteEditGrant({ shippingNoteId: "note-1", grantId: "grant-1" }, user("admin")))
      .resolves.toBeUndefined();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });
});
