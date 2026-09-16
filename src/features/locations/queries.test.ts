import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));

import { PgDialect } from "drizzle-orm/pg-core";
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
  const where = vi.fn<(_condition: import("drizzle-orm").SQL | undefined) => { orderBy: typeof orderBy }>().mockReturnValue({ orderBy });
  const from = vi.fn(() => ({ where }));
  return { from };
}

function lookupRows(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn<(_condition: import("drizzle-orm").SQL | undefined) => { orderBy: typeof orderBy }>().mockReturnValue({ orderBy });
  const from = vi.fn(() => ({ where }));
  return { from, where, limit };
}

describe("Routing Location queries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves consumer read access for Admin, Sale, and Accountant while denying Admin lifecycle queries to non-Admin", async () => {
    for (const role of ["sale", "ops", "accountant"] as const) {
      await expect(listRoutingLocationsForAdmin({}, user(role))).rejects.toBeInstanceOf(AuthorizationError);
    }
    await expect(getRoutingLocationByIdForAdmin("location-1", user("sale"))).rejects.toBeInstanceOf(AuthorizationError);
  });

  it.each(["admin", "sale", "ops", "accountant"] as const)("returns all matching active types for %s without an eligibility join", async (role) => {
    const rows = [
      { code: "SGN", name: "SGN Airport", type: "airport" },
      { code: "VNSGN", name: "VNSGN Seaport", type: "seaport" },
      { code: "XYZ", name: "SGN Other", type: "other" },
    ];
    const query = lookupRows(rows);
    mocks.select.mockReturnValueOnce(query);
    expect(await searchRoutingLocations("SGN", user(role), { limit: 12 })).toEqual(rows);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(query.limit).toHaveBeenCalledWith(12);
    const condition = query.where.mock.calls[0]?.[0];
    const sql = new PgDialect().sqlToQuery(condition!);
    expect(sql.sql).toContain('"routing_locations"."is_active" =');
    expect(sql.sql).toContain('"routing_locations"."deleted_at" is null');
    expect(sql.sql).not.toContain('"type"');
    expect(sql.sql).not.toContain("applicabilit");
    expect(sql.params).toEqual([true, "%SGN%", "%SGN%"]);
  });

  it("supports Admin lifecycle list pagination and type filtering", async () => {
    mocks.select.mockReturnValueOnce(locationRows([]) as never);
    await expect(listRoutingLocationsForAdmin({ status: "deleted", type: "seaport", limit: 10, offset: 20 }, user("admin"))).resolves.toEqual([]);
  });
});
