import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn(), notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.requireAuthenticatedUser }));
vi.mock("@/features/locations/components/admin-location-form", () => ({ CreateLocationForm: () => null }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
import NewLocationPage from "./page";
const now = new Date();
function user(role: User["role"]): User { return { id: role, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null }; }
describe("/admin/master-data/locations/new page", () => { beforeEach(() => vi.clearAllMocks()); it("allows Admin", async () => { mocks.requireAuthenticatedUser.mockResolvedValue({ user: user("admin") }); await expect(NewLocationPage()).resolves.toBeTruthy(); }); it.each(["sale", "accountant"] as const)("blocks %s", async (role) => { mocks.requireAuthenticatedUser.mockResolvedValue({ user: user(role) }); await expect(NewLocationPage()).rejects.toThrow("NEXT_NOT_FOUND"); }); });
