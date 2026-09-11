import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), logAuditEvent: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: mocks.logAuditEvent }));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { RoutingLocationConflictError, createRoutingLocation, deactivateRoutingLocation, restoreRoutingLocation, updateRoutingLocation } from "./mutations";
import type { CreateRoutingLocationInput } from "./validators";

const now = new Date("2026-01-01T00:00:00Z");
const row = { id: "location-1", code: "XY-01", name: "Synthetic Airport", type: "airport" as const, countryCode: "ZZ", subdivision: null, isActive: true, createdAt: now, updatedAt: now, deletedAt: null };
const input: CreateRoutingLocationInput = { code: " xy-01 ", name: " Synthetic Airport ", type: "airport", countryCode: "zz", applicabilities: ["air_aol"] };

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

  it("rejects Sale and Accountant at the canonical mutation boundary", async () => {
    await expect(createRoutingLocation(input, user("sale"))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(updateRoutingLocation("location-1", { ...input, id: "location-1" }, user("accountant"))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(deactivateRoutingLocation("location-1", user("sale"))).rejects.toBeInstanceOf(AuthorizationError);
    await expect(restoreRoutingLocation("location-1", user("accountant"))).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("creates normalized identity and memberships transactionally with an attributed audit event", async () => {
    const insert = vi.fn()
      .mockReturnValueOnce({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([row]) })) })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    transaction({ insert, select: selectRows([{ applicability: "air_aol" }]) });

    const result = await createRoutingLocation(input, user("admin"));
    expect(result).toMatchObject({ code: "XY-01", countryCode: "ZZ", applicabilities: ["air_aol"] });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "routing_location.create", actorUserId: "admin-1" }));
  });

  it("updates fields and synchronizes memberships transactionally", async () => {
    const updated = { ...row, name: "Synthetic Port", type: "seaport" as const };
    const insert = vi.fn()
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) })
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([updated]) })) })) }));
    const remove = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    transaction({ select: selectRows([row], [{ applicability: "air_aol" }], [{ applicability: "sea_pol" }]), insert, update, delete: remove });

    const result = await updateRoutingLocation("location-1", { ...input, id: "location-1", name: "Synthetic Port", type: "seaport", applicabilities: ["sea_pol"] }, user("admin"));
    expect(result).toMatchObject({ name: "Synthetic Port", type: "seaport", applicabilities: ["sea_pol"] });
    expect(remove).toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "routing_location.update", actorUserId: "admin-1" }));
  });

  it("soft-deactivates and restores the same record with audit events", async () => {
    const deactivated = { ...row, isActive: false, deletedAt: now };
    const restore = { ...row, isActive: true, deletedAt: null };
    const update = vi.fn()
      .mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([deactivated]) })) })) })
      .mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([restore]) })) })) });
    transaction({ select: selectRows([row], [{ applicability: "air_aol" }], [{ applicability: "air_aol" }], [deactivated], [{ applicability: "air_aol" }], [{ applicability: "air_aol" }]), update });

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
