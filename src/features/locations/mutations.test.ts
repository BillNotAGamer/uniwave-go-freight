import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), logAuditEvent: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: mocks.logAuditEvent }));

import { routingLocations, type User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { RoutingLocationConflictError, createRoutingLocation, deactivateRoutingLocation, quickCreateRoutingLocation, restoreRoutingLocation, updateRoutingLocation } from "./mutations";
import type { CreateRoutingLocationInput } from "./validators";

const now = new Date("2026-01-01T00:00:00Z");
const row = { id: "location-1", code: "XY-01", name: "Synthetic Airport", type: "airport" as const, countryCode: "ZZ", subdivision: null, isActive: true, createdAt: now, updatedAt: now, deletedAt: null };
const input: CreateRoutingLocationInput = { code: " xy-01 ", name: " Synthetic Airport ", type: "airport", countryCode: "zz" };

function user(role: User["role"]): User {
  return { id: `${role}-1`, email: `${role}@example.test`, name: role, image: null, emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null };
}

function selectRows(...results: unknown[][]) {
  let index = 0;
  return vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        const result = Promise.resolve(results[index++] ?? []);
        return Object.assign(result, { limit: vi.fn(() => result) });
      }),
    })),
  }));
}

function transaction(tx: Record<string, unknown>) {
  mocks.transaction.mockImplementation(async (callback: (value: never) => Promise<unknown>) => callback(tx as never));
}

describe("Routing Location mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["sale", "ops", "accountant"] as const)("rejects %s at every full-management boundary", async (role) => {
    await expect(createRoutingLocation(input, user(role))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(updateRoutingLocation("location-1", { ...input, id: "location-1" }, user(role))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(deactivateRoutingLocation("location-1", user(role))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(restoreRoutingLocation("location-1", user(role))).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates normalized identity transactionally with an attributed audit event", async () => {
    const insert = vi.fn()
      .mockReturnValueOnce({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([row]) })) })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    transaction({ insert });

    const result = await createRoutingLocation(input, user("admin"));
    expect(result).toMatchObject({ code: "XY-01", countryCode: "ZZ" });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "routing_location.create", actorUserId: "admin-1" }));
  });

  it.each(["admin", "sale", "ops"] as const)("allows %s quick-create without membership writes and rejects Accountant", async (role) => {
    await expect(quickCreateRoutingLocation({
      code: "denied",
      name: "Denied",
      type: "other",
    }, user("accountant"))).rejects.toBeInstanceOf(AuthorizationError);

    const insert = vi.fn()
      .mockReturnValueOnce({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([row]) })) })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    transaction({ insert });

    await expect(quickCreateRoutingLocation({
      code: " xy-01 ",
      name: " Synthetic Airport ",
      type: "airport",
      countryCode: "zz",
    }, user(role))).resolves.toMatchObject({ code: "XY-01" });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(routingLocations);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "routing_location.create", actorUserId: `${role}-1` }),
    );
  });

  it("updates identity metadata without membership writes", async () => {
    const updated = { ...row, name: "Synthetic Port", type: "seaport" as const };
    const insert = vi.fn()
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([updated]) })) })) }));
    const remove = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    transaction({ select: selectRows([row]), insert, update, delete: remove });

    const result = await updateRoutingLocation("location-1", { ...input, id: "location-1", name: "Synthetic Port", type: "seaport" }, user("admin"));
    expect(result).toMatchObject({ name: "Synthetic Port", type: "seaport" });
    expect(remove).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "routing_location.update", actorUserId: "admin-1" }));
  });

  it("soft-deactivates and restores the same record with audit events", async () => {
    const deactivated = { ...row, isActive: false, deletedAt: now };
    const restore = { ...row, isActive: true, deletedAt: null };
    const update = vi.fn()
      .mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([deactivated]) })) })) })
      .mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([restore]) })) })) });
    transaction({ select: selectRows([row], [deactivated]), update });

    await expect(deactivateRoutingLocation("location-1", user("admin"))).resolves.toMatchObject({ isActive: false, deletedAt: now });
    await expect(restoreRoutingLocation("location-1", user("admin"))).resolves.toMatchObject({ isActive: true, deletedAt: null });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "routing_location.deactivate" }));
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "routing_location.restore" }));
  });

  it("maps database uniqueness conflicts without exposing a raw database error", async () => {
    mocks.transaction.mockRejectedValue({ code: "23505" });
    await expect(createRoutingLocation(input, user("admin"))).rejects.toBeInstanceOf(RoutingLocationConflictError);
  });
});
