import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  getShippingNoteForUser: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("../queries", () => ({
  getShippingNoteForUser: mocks.getShippingNoteForUser,
}));

import type { User } from "@/lib/db/schema";
import { listCustomsDeclarationsForNoteForUser } from "./queries";

const now = new Date("2026-09-09T00:00:00.000Z");
function user(role: User["role"]): User {
  return {
    id: `${role}-1`, email: `${role}@example.test`, name: role, image: null,
    emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now,
    deletedAt: null,
  };
}

describe("Customs Declaration read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getShippingNoteForUser.mockResolvedValue({ id: "note-1" });
  });

  it("returns zero, one, or multiple active declarations without speculative fields", async () => {
    const rows = [
      { id: "d-1", shippingNoteId: "note-1", declarationNo: "DEC-1", createdAt: now, updatedAt: now },
      { id: "d-2", shippingNoteId: "note-1", declarationNo: "DEC-2", createdAt: now, updatedAt: now },
    ];
    mocks.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue(rows) })),
      })),
    });

    await expect(listCustomsDeclarationsForNoteForUser(
      "note-1",
      user("accountant"),
    )).resolves.toEqual(rows);
  });

  it("keeps declaration reads Accounting-authorized", async () => {
    await expect(listCustomsDeclarationsForNoteForUser(
      "note-1",
      user("sale"),
    )).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
