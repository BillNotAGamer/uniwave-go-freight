import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  listShippingNotesForUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/features/shipping-notes/queries", () => ({
  listShippingNotesForUser: mocks.listShippingNotesForUser,
}));

import ShippingNotesPage from "./page";

const now = new Date("2026-09-01T00:00:00.000Z");

function user(): User {
  return {
    id: "sale-1",
    email: "sale@example.test",
    name: "Sale",
    image: null,
    emailVerified: true,
    role: "sale",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

describe("/shipping-notes C7 filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user() });
    mocks.listShippingNotesForUser.mockResolvedValue([]);
  });

  it("passes normalized URL filters to the protected list query", async () => {
    const actor = user();
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: actor });

    await expect(ShippingNotesPage({
      searchParams: Promise.resolve({
        jobsheet: " UGF-26 ",
        etdFrom: "2026-09-01",
        etdTo: "2026-09-30",
      }),
    })).resolves.toBeTruthy();

    expect(mocks.listShippingNotesForUser).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        jobsheet: "UGF-26",
        etdFrom: new Date("2026-08-31T17:00:00.000Z"),
        etdToExclusive: new Date("2026-09-30T17:00:00.000Z"),
      }),
    );
  });

  it("renders invalid filters safely without issuing a database query", async () => {
    await expect(ShippingNotesPage({
      searchParams: Promise.resolve({ etdFrom: "2026-02-30" }),
    })).resolves.toBeTruthy();

    expect(mocks.listShippingNotesForUser).not.toHaveBeenCalled();
  });
});
