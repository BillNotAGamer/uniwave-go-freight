import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { User } from "@/lib/db/schema";
import type { AdminUserListItem } from "@/features/admin/users/types";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.auth }));
vi.mock("@/features/admin/users/read-model", () => ({ listAdminUsersForUser: mocks.list }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/features/admin/users/components/admin-users-table", () => ({
  AdminUsersTable: ({ users }: { users: AdminUserListItem[] }) => React.createElement("div", null, users.map((user) => user.name).join(", ")),
}));
import AdminUsersPage from "./page";

const actor = { id: "admin-viewer", role: "admin", name: "Viewer" } as User;
const matchingUser: AdminUserListItem = {
  id: "user-1", name: "Haru Nguyen", email: "haru@example.test", role: "sale",
  isActive: true, deletedAt: null, createdAt: new Date("2026-09-01Z"), updatedAt: new Date("2026-09-01Z"),
  accountStatus: "active", activeSessionCount: 0,
};

describe("Admin Users query-string page navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: actor });
    mocks.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
    mocks.list.mockResolvedValue({ items: [matchingUser], total: 1, limit: 20, offset: 0 });
  });

  it("renders the exact reported GET form URL without notFound", async () => {
    const params = Object.fromEntries(new URL("http://localhost/admin/users?search=Haru&role=&status=").searchParams);
    const html = renderToStaticMarkup(await AdminUsersPage({ searchParams: Promise.resolve(params) }));
    expect(html).toContain("Haru Nguyen");
    expect(html).toContain("Admin Users");
    expect(html).toContain('href="/admin/users"');
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.list).toHaveBeenCalledWith(actor, expect.objectContaining({ search: "Haru", role: undefined, status: undefined }));
  });

  it("renders a zero-result search successfully", async () => {
    mocks.list.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    const html = renderToStaticMarkup(await AdminUsersPage({ searchParams: Promise.resolve({ search: "Nobody", role: "", status: "" }) }));
    expect(html).toContain("No users found");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it.each([{}, { search: "", role: "", status: "" }])("renders empty/reset filters %j", async (params) => {
    await expect(AdminUsersPage({ searchParams: Promise.resolve(params) })).resolves.toBeTruthy();
    expect(mocks.list).toHaveBeenCalledWith(actor, expect.objectContaining({ search: undefined, role: undefined, status: undefined }));
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it.each(["active", "inactive", "deleted", "all"])("preserves role and %s status in pagination URLs", async (status) => {
    mocks.list.mockResolvedValue({ items: [matchingUser], total: 50, limit: 20, offset: 20 });
    const html = renderToStaticMarkup(await AdminUsersPage({ searchParams: Promise.resolve({ search: ["Haru & Co", "ignored"], role: "sale", status, page: "2" }) }));
    expect(mocks.list).toHaveBeenCalledWith(actor, expect.objectContaining({ search: "Haru & Co", role: "sale", status, offset: 20 }));
    expect(html).toContain(`search=Haru+%26+Co&amp;role=sale&amp;status=${status}&amp;page=3`);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("retains authorization and invalid-filter rejection", async () => {
    await expect(AdminUsersPage({ searchParams: Promise.resolve({ role: "invalid" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.list).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ user: { ...actor, role: "sale" } });
    await expect(AdminUsersPage({ searchParams: Promise.resolve({ search: "Haru" }) })).rejects.toThrow("NOT_FOUND");
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
