import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  listPartnerCategories: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.requireAuthenticatedUser }));
vi.mock("@/features/partners/queries", () => ({ listPartnerCategories: mocks.listPartnerCategories }));
vi.mock("@/features/partners/components/admin-partner-forms", () => ({
  CreatePartnerForm: () => null,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import NewPartnerPage from "./page";

const now = new Date("2026-09-01T00:00:00Z");
function user(role: User["role"]): User {
  return { id: `${role}-1`, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null };
}

describe("/admin/master-data/partners/new page policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPartnerCategories.mockResolvedValue([]);
  });

  it("allows Admin", async () => {
    const admin = user("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: admin });
    await expect(NewPartnerPage()).resolves.toBeTruthy();
    expect(mocks.listPartnerCategories).toHaveBeenCalledWith(admin);
  });

  it.each(["sale", "accountant"] as const)("denies %s before category data is read", async (role) => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user(role) });
    await expect(NewPartnerPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.listPartnerCategories).not.toHaveBeenCalled();
  });
});
