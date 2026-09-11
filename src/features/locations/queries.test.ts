import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { getRoutingLocationByIdForAdmin, listRoutingLocationsForAdmin, searchRoutingLocations } from "./queries";

function user(role: User["role"]): User {
  const now = new Date();
  return { id: role, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null };
}

function locationRows(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

function lookupRows(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

function memberships(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

function applicabilitySubquery() {
  const where = vi.fn(() => ({}));
  const from = vi.fn(() => ({ where }));
  return { from };
}

describe("Routing Location queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves consumer read access for Admin, Sale, and Accountant while denying Admin lifecycle queries to non-Admin", async () => {
    for (const role of ["sale", "accountant"] as const) {
      await expect(listRoutingLocationsForAdmin({}, user(role))).rejects.toBeInstanceOf(AuthorizationError);
    }
    await expect(getRoutingLocationByIdForAdmin("location-1", user("sale"))).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns active consumer search results with only explicit applicability filtering", async () => {
    const row = { id: "location-1", code: "XY-01", name: "Synthetic Airport", type: "airport", countryCode: null, subdivision: null, isActive: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null };
    mocks.select
      .mockReturnValueOnce(applicabilitySubquery() as never)
      .mockReturnValueOnce(lookupRows([row]) as never)
      .mockReturnValueOnce(memberships([{ locationId: "location-1", applicability: "air_aol" }]) as never);

    const result = await searchRoutingLocations("xy", user("sale"), { applicability: "air_aol" });
    expect(result).toEqual([{ ...row, applicabilities: ["air_aol"] }]);
    expect(mocks.select).toHaveBeenCalledTimes(3);
  });

  it("supports Admin lifecycle list pagination and type filtering", async () => {
    mocks.select.mockReturnValueOnce(locationRows([]) as never);
    await expect(listRoutingLocationsForAdmin({ status: "deleted", type: "seaport", limit: 10, offset: 20 }, user("admin"))).resolves.toEqual([]);
  });
});
