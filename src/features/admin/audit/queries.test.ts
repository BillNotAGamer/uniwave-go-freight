import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
  },
}));

const now = new Date("2026-08-24T04:00:00.000Z");
const adminId = "00000000-0000-4000-8000-000000000001";
const noteId = "00000000-0000-4000-8000-000000000002";
const auditId = "00000000-0000-4000-8000-000000000010";

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

function makeAuditQuery(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));

  return {
    from,
    leftJoin,
    where,
    orderBy,
    limit,
    query: { from },
  };
}

describe("audit viewer read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies Sale and Accountant before querying audit data", async () => {
    const { listAuditViewerForUser } = await import("./queries");

    await expect(listAuditViewerForUser(user("sale"))).rejects
      .toBeInstanceOf(AuthorizationError);
    await expect(listAuditViewerForUser(user("accountant"))).rejects
      .toBeInstanceOf(AuthorizationError);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("returns safe DTOs without raw snapshots and detects next page", async () => {
    const first = {
      id: auditId,
      actorUserId: adminId,
      action: "shipping_note.approve",
      entityType: "shipping_note",
      entityId: noteId,
      before: {
        status: "checked",
        password: "must-not-escape",
      },
      after: {
        status: "approved",
        approvedById: adminId,
        token: "must-not-escape-token",
      },
      reason: null,
      createdAt: now,
      actorName: "Admin User",
      actorEmail: "admin@example.test",
    };
    const second = {
      ...first,
      id: "00000000-0000-4000-8000-000000000009",
      createdAt: new Date("2026-08-24T03:59:00.000Z"),
    };
    const auditQuery = makeAuditQuery([first, second]);
    const noteQuery = {
      where: vi.fn(async () => [{ id: noteId, jobsheetNo: "JS-001" }]),
    };

    mocks.select
      .mockReturnValueOnce(auditQuery.query)
      .mockReturnValueOnce({ from: vi.fn(() => noteQuery) });

    const { listAuditViewerForUser } = await import("./queries");
    const page = await listAuditViewerForUser(
      user("admin"),
      { limit: 1 },
    );
    const text = JSON.stringify(page);

    expect(page).toMatchObject({
      hasNextPage: true,
      limit: 1,
      items: [
        {
          id: auditId,
          action: "shipping_note.approve",
          actionLabel: "Shipping Note approved",
          category: "shipping_note",
          entityLabel: "JS-001",
          entityHref: `/shipping-notes/${noteId}`,
          actor: {
            id: adminId,
            name: "Admin User",
            email: "admin@example.test",
            display: "Admin User",
          },
          detailsAvailable: true,
        },
      ],
    });
    expect(page.nextCursor).toBeTruthy();
    expect(page.items[0]).not.toHaveProperty("before");
    expect(page.items[0]).not.toHaveProperty("after");
    expect(text).not.toContain("must-not-escape");
    expect(text).not.toContain("must-not-escape-token");
    expect(auditQuery.limit).toHaveBeenCalledWith(2);
  });

  it("keeps unknown action details hidden and falls back for missing actor/entity labels", async () => {
    const auditQuery = makeAuditQuery([{
      id: auditId,
      actorUserId: null,
      action: "future.action",
      entityType: "future_entity",
      entityId: noteId,
      before: { harmless: "hidden", secret: "secret-hidden" },
      after: { harmless: "hidden-after", token: "token-hidden" },
      reason: "future event",
      createdAt: now,
      actorName: null,
      actorEmail: null,
    }]);

    mocks.select.mockReturnValueOnce(auditQuery.query);

    const { listAuditViewerForUser } = await import("./queries");
    const page = await listAuditViewerForUser(user("admin"));
    const text = JSON.stringify(page);

    expect(page.items[0]).toMatchObject({
      action: "future.action",
      category: "unknown",
      entityLabel: null,
      entityHref: null,
      actor: {
        id: null,
        name: null,
        email: null,
        display: "Unknown actor",
      },
      detailsAvailable: false,
      changes: [],
      reason: "future event",
    });
    expect(text).not.toContain("hidden");
    expect(text).not.toContain("hidden-after");
    expect(text).not.toContain("secret-hidden");
    expect(text).not.toContain("token-hidden");
  });
});
