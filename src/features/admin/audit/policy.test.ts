import { describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/db/schema";

import { canReadAuditViewer, requireAuditViewerAccess } from "./policy";

vi.mock("server-only", () => ({}));

function user(role: User["role"]): User {
  const now = new Date("2026-08-24T00:00:00.000Z");

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

describe("audit viewer policy", () => {
  it("allows only Admin through AUDIT_LOGS_READ", () => {
    expect(canReadAuditViewer("admin")).toBe(true);
    expect(canReadAuditViewer("accountant")).toBe(false);
    expect(canReadAuditViewer("sale")).toBe(false);
  });

  it("throws the repository authorization error for non-Admin viewers", () => {
    expect(() => requireAuditViewerAccess(user("admin"))).not.toThrow();
    expect(() => requireAuditViewerAccess(user("accountant"))).toThrow();
    expect(() => requireAuditViewerAccess(user("sale"))).toThrow();
  });
});
