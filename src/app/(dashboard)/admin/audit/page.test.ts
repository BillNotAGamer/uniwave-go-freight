import { describe, expect, it, vi, beforeEach } from "vitest";

import type { User } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  listAuditViewerForUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/features/admin/audit/queries", () => ({
  listAuditViewerForUser: mocks.listAuditViewerForUser,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import AdminAuditPage from "./page";

const now = new Date("2026-08-24T00:00:00.000Z");

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

describe("/admin/audit page policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAuditViewerForUser.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasNextPage: false,
      limit: 50,
    });
  });

  it("allows Admin and calls the protected read model with validated filters", async () => {
    const admin = user("admin");
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: admin });

    await expect(AdminAuditPage({
      searchParams: Promise.resolve({
        action: "user.role_change",
      }),
    })).resolves.toBeTruthy();

    expect(mocks.listAuditViewerForUser).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        action: "user.role_change",
      }),
    );
  });

  it("denies Sale before audit data is read", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user("sale") });

    await expect(AdminAuditPage({
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.listAuditViewerForUser).not.toHaveBeenCalled();
  });

  it("denies Accountant before audit data is read", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user("accountant") });

    await expect(AdminAuditPage({
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.listAuditViewerForUser).not.toHaveBeenCalled();
  });

  it("rejects invalid query parameters before audit data is read", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: user("admin") });

    await expect(AdminAuditPage({
      searchParams: Promise.resolve({
        actorId: "not-a-uuid",
      }),
    })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.listAuditViewerForUser).not.toHaveBeenCalled();
  });
});
