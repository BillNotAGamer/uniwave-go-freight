import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getPartnerByIdForAdmin: vi.fn(),
  listPartnerCategories: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.requireAuthenticatedUser }));
vi.mock("@/features/partners/queries", () => ({
  getPartnerByIdForAdmin: mocks.getPartnerByIdForAdmin,
  listPartnerCategories: mocks.listPartnerCategories,
}));
vi.mock("@/features/partners/components/admin-partner-forms", () => ({
  EditPartnerForm: () => null,
  PartnerCategoriesForm: () => null,
  PartnerContactsPanel: () => null,
  PartnerLifecycleControls: () => null,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import PartnerDetailPage from "./page";

const now = new Date("2026-09-01T00:00:00Z");
function user(role: User["role"]): User {
  return { id: `${role}-1`, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null };
}

describe("/admin/master-data/partners/[id] page policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPartnerByIdForAdmin.mockResolvedValue({ id: "partner-1", companyName: "Acme", vendorCode: null, taxId: null, address: null, isActive: true, deletedAt: null, contacts: [], categories: [], createdAt: now, updatedAt: now });
    mocks.listPartnerCategories.mockResolvedValue([]);
  });

  it("allows Admin and uses the Admin-only Partner detail query", async () => {
    const admin = user("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: admin });
    await expect(PartnerDetailPage({ params: Promise.resolve({ id: "partner-1" }) })).resolves.toBeTruthy();
    expect(mocks.getPartnerByIdForAdmin).toHaveBeenCalledWith("partner-1", admin);
  });

  it.each(["sale", "accountant"] as const)("denies %s before Partner data is read", async (role) => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user(role) });
    await expect(PartnerDetailPage({ params: Promise.resolve({ id: "partner-1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getPartnerByIdForAdmin).not.toHaveBeenCalled();
  });
});
