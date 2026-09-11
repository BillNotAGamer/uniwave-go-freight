import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { User } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  listPartnersForAdmin: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.requireAuthenticatedUser }));
vi.mock("@/features/partners/queries", () => ({ listPartnersForAdmin: mocks.listPartnersForAdmin }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import PartnerListPage from "./page";

const now = new Date("2026-09-01T00:00:00Z");
function user(role: User["role"]): User {
  return { id: `${role}-1`, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null };
}

describe("/admin/master-data/partners page policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPartnersForAdmin.mockResolvedValue([]);
  });

  it("allows Admin and wires validated search and lifecycle filters to the Admin list", async () => {
    const admin = user("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: admin });
    await expect(PartnerListPage({ searchParams: Promise.resolve({ search: "Acme", status: "deleted", page: "2" }) })).resolves.toBeTruthy();
    expect(mocks.listPartnersForAdmin).toHaveBeenCalledWith(expect.objectContaining({ search: "Acme", status: "deleted", offset: 50, limit: 51 }), admin);
  });

  it.each(["sale", "accountant"] as const)("denies %s before Partner data is read", async (role) => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user(role) });
    await expect(PartnerListPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.listPartnersForAdmin).not.toHaveBeenCalled();
  });

  it("rejects invalid filter input before Partner data is read", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user("admin") });
    await expect(PartnerListPage({ searchParams: Promise.resolve({ page: "0" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.listPartnersForAdmin).not.toHaveBeenCalled();
  });

  it("renders Partner rows, lifecycle labels, and the empty state", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user("admin") });
    mocks.listPartnersForAdmin.mockResolvedValueOnce([
      { id: "partner-active", companyName: "Active Freight", vendorCode: "ACT", taxId: "0101", address: "Port 1", isActive: true, deletedAt: null, categories: [], createdAt: now, updatedAt: now },
      { id: "partner-inactive", companyName: "Inactive Freight", vendorCode: null, taxId: null, address: null, isActive: false, deletedAt: null, categories: [], createdAt: now, updatedAt: now },
    ]);

    const populatedMarkup = renderToStaticMarkup(await PartnerListPage({ searchParams: Promise.resolve({ status: "all" }) }));
    expect(populatedMarkup).toContain("Active Freight");
    expect(populatedMarkup).toContain("Inactive Freight");
    expect(populatedMarkup).toContain("Active");
    expect(populatedMarkup).toContain("Inactive");

    mocks.listPartnersForAdmin.mockResolvedValueOnce([]);
    const emptyMarkup = renderToStaticMarkup(await PartnerListPage({ searchParams: Promise.resolve({}) }));
    expect(emptyMarkup).toContain("No Partners found");
  });
});
