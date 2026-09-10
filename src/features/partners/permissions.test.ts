import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { User as DbUser } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import {
  assertCanMutatePartners,
  assertCanReadPartners,
  canMutatePartners,
  canReadPartners,
} from "./permissions";

function makeUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: "user-test-id",
    email: "test@uniwave.test",
    name: "Test User",
    image: null,
    emailVerified: true,
    role: "sale",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("Partner Master Permissions Policy", () => {
  it("allows admin to both read and mutate partners", () => {
    const admin = makeUser({ role: "admin" });

    expect(canReadPartners(admin)).toBe(true);
    expect(canMutatePartners(admin)).toBe(true);
    expect(() => assertCanReadPartners(admin)).not.toThrow();
    expect(() => assertCanMutatePartners(admin)).not.toThrow();
  });

  it("allows accountant to read partners but denies mutation", () => {
    const accountant = makeUser({ role: "accountant" });

    expect(canReadPartners(accountant)).toBe(true);
    expect(canMutatePartners(accountant)).toBe(false);
    expect(() => assertCanReadPartners(accountant)).not.toThrow();
    expect(() => assertCanMutatePartners(accountant)).toThrow(AuthorizationError);
  });

  it("allows sale to read partners for lookup but denies mutation", () => {
    const sale = makeUser({ role: "sale" });

    expect(canReadPartners(sale)).toBe(true);
    expect(canMutatePartners(sale)).toBe(false);
    expect(() => assertCanReadPartners(sale)).not.toThrow();
    expect(() => assertCanMutatePartners(sale)).toThrow(AuthorizationError);
  });

  it("denies both read and mutate when user is inactive", () => {
    const inactiveAdmin = makeUser({ role: "admin", isActive: false });

    expect(canReadPartners(inactiveAdmin)).toBe(false);
    expect(canMutatePartners(inactiveAdmin)).toBe(false);
    expect(() => assertCanReadPartners(inactiveAdmin)).toThrow(AuthorizationError);
    expect(() => assertCanMutatePartners(inactiveAdmin)).toThrow(AuthorizationError);
  });

  it("denies both read and mutate when user is soft-deleted", () => {
    const deletedAdmin = makeUser({
      role: "admin",
      deletedAt: new Date("2026-08-01T00:00:00Z"),
    });

    expect(canReadPartners(deletedAdmin)).toBe(false);
    expect(canMutatePartners(deletedAdmin)).toBe(false);
    expect(() => assertCanReadPartners(deletedAdmin)).toThrow(AuthorizationError);
    expect(() => assertCanMutatePartners(deletedAdmin)).toThrow(AuthorizationError);
  });

  it("denies null or undefined user", () => {
    expect(canReadPartners(null)).toBe(false);
    expect(canMutatePartners(undefined)).toBe(false);
    expect(() => assertCanReadPartners(null)).toThrow(AuthorizationError);
    expect(() => assertCanMutatePartners(undefined)).toThrow(AuthorizationError);
  });
});
