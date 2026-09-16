import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import { assertCanMutateLocations, assertCanQuickCreateLocations, assertCanReadLocations, canMutateLocations, canQuickCreateLocations, canReadLocations } from "./permissions";

function user(role: User["role"], overrides: Partial<User> = {}): User {
  const now = new Date();
  return { id: role, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null, ...overrides };
}

describe("Routing Location permissions", () => {
  it("allows all active operational roles to read and only Admin to mutate", () => {
    for (const role of ["admin", "sale", "ops", "accountant"] as const) expect(canReadLocations(user(role))).toBe(true);
    expect(canMutateLocations(user("admin"))).toBe(true);
    expect(canMutateLocations(user("sale"))).toBe(false);
    expect(canMutateLocations(user("ops"))).toBe(false);
    expect(canMutateLocations(user("accountant"))).toBe(false);
  });

  it("rejects inactive, deleted, and non-Admin mutation attempts", () => {
    expect(() => assertCanReadLocations(user("admin", { isActive: false }))).toThrow(AuthorizationError);
    expect(() => assertCanReadLocations(user("admin", { deletedAt: new Date() }))).toThrow(AuthorizationError);
    expect(() => assertCanMutateLocations(user("sale"))).toThrow(AuthorizationError);
  });

  it("allows Admin, Sale, and OPS quick-create but rejects Accountant and inactive users", () => {
    expect(canQuickCreateLocations(user("admin"))).toBe(true);
    expect(canQuickCreateLocations(user("sale"))).toBe(true);
    expect(canQuickCreateLocations(user("ops"))).toBe(true);
    expect(canQuickCreateLocations(user("accountant"))).toBe(false);
    expect(canQuickCreateLocations(user("sale", { isActive: false }))).toBe(false);
    expect(canQuickCreateLocations(user("sale", { deletedAt: new Date() }))).toBe(false);
    expect(() => assertCanQuickCreateLocations(user("accountant"))).toThrow(AuthorizationError);
  });
});
