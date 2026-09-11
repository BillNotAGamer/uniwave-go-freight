import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn(), listRoutingLocationsForAdmin: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.requireAuthenticatedUser }));
vi.mock("@/features/locations/queries", () => ({ listRoutingLocationsForAdmin: mocks.listRoutingLocationsForAdmin }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
import LocationListPage from "./page";

const now = new Date("2026-09-12T00:00:00Z");
function user(role: User["role"]): User { return { id: role, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null }; }

describe("/admin/master-data/locations page", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.listRoutingLocationsForAdmin.mockResolvedValue([]); });
  it("allows Admin and maps server-side search, type, lifecycle, and pagination", async () => { const admin = user("admin"); mocks.requireAuthenticatedUser.mockResolvedValue({ user: admin }); await expect(LocationListPage({ searchParams: Promise.resolve({ search: "XY", type: "airport", status: "deleted", page: "2" }) })).resolves.toBeTruthy(); expect(mocks.listRoutingLocationsForAdmin).toHaveBeenCalledWith(expect.objectContaining({ search: "XY", type: "airport", status: "deleted", limit: 51, offset: 50 }), admin); });
  it.each(["sale", "accountant"] as const)("blocks %s before reading Locations", async (role) => { mocks.requireAuthenticatedUser.mockResolvedValue({ user: user(role) }); await expect(LocationListPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND"); expect(mocks.listRoutingLocationsForAdmin).not.toHaveBeenCalled(); });
  it("renders location statuses and empty state", async () => { mocks.requireAuthenticatedUser.mockResolvedValue({ user: user("admin") }); mocks.listRoutingLocationsForAdmin.mockResolvedValueOnce([{ id: "active", code: "XY-01", name: "Active Synthetic", type: "airport", countryCode: "ZZ", subdivision: "Region", isActive: true, deletedAt: null, applicabilities: ["air_aol"], createdAt: now, updatedAt: now }, { id: "deleted", code: "XY-02", name: "Deactivated Synthetic", type: "seaport", countryCode: null, subdivision: null, isActive: false, deletedAt: now, applicabilities: ["sea_pod"], createdAt: now, updatedAt: now }]); const populated = renderToStaticMarkup(await LocationListPage({ searchParams: Promise.resolve({ status: "all" }) })); expect(populated).toContain("Active Synthetic"); expect(populated).toContain("Deactivated"); mocks.listRoutingLocationsForAdmin.mockResolvedValueOnce([]); const empty = renderToStaticMarkup(await LocationListPage({ searchParams: Promise.resolve({}) })); expect(empty).toContain("No Locations found"); });
});
