import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(), createRoutingLocation: vi.fn(), updateRoutingLocation: vi.fn(), deactivateRoutingLocation: vi.fn(), restoreRoutingLocation: vi.fn(), revalidatePath: vi.fn(),
}));
const LocationConflict = vi.hoisted(() => class RoutingLocationConflictError extends Error {});
vi.mock("@/lib/auth/session", () => ({ requireAuthenticatedUser: mocks.requireAuthenticatedUser }));
vi.mock("@/features/locations/mutations", () => ({ RoutingLocationConflictError: LocationConflict, createRoutingLocation: mocks.createRoutingLocation, updateRoutingLocation: mocks.updateRoutingLocation, deactivateRoutingLocation: mocks.deactivateRoutingLocation, restoreRoutingLocation: mocks.restoreRoutingLocation }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { RoutingLocationConflictError } from "./mutations";
import { createRoutingLocationAdminAction, deactivateRoutingLocationAdminAction, restoreRoutingLocationAdminAction, updateRoutingLocationAdminAction } from "./actions";

const initial = { ok: true };
const admin = { id: "admin-1", role: "admin" };
function form(values: Record<string, string | string[]>): FormData { const data = new FormData(); for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item); return data; }

describe("Location Admin server actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireAuthenticatedUser.mockResolvedValue({ user: admin }); });

  it("passes exactly the Admin-selected applicability set to canonical create without type inference", async () => {
    mocks.createRoutingLocation.mockResolvedValue({ id: "location-1" });
    const result = await createRoutingLocationAdminAction(initial, form({ code: " xy-01 ", name: "Synthetic Airport", type: "airport", applicabilities: ["sea_pod"] }));
    expect(result).toMatchObject({ ok: true, locationId: "location-1" });
    expect(mocks.createRoutingLocation).toHaveBeenCalledWith(expect.objectContaining({ code: "XY-01", type: "airport", applicabilities: ["sea_pod"] }), admin);
  });

  it("returns applicability validation feedback without calling the canonical create mutation", async () => {
    const result = await createRoutingLocationAdminAction(initial, form({ code: "XY-01", name: "Synthetic", type: "airport" }));
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toContain("At least one routing applicability");
    expect(mocks.createRoutingLocation).not.toHaveBeenCalled();
  });

  it("presents duplicate identity conflicts without exposing raw database details", async () => {
    mocks.createRoutingLocation.mockRejectedValue(new RoutingLocationConflictError());
    const result = await createRoutingLocationAdminAction(initial, form({ code: "XY-01", name: "Synthetic", type: "airport", applicabilities: ["air_aol"] }));
    expect(result).toEqual({ ok: false, error: "A Location with this type and code already exists." });
  });

  it("wires update, deactivate, and restore through canonical mutations", async () => {
    mocks.updateRoutingLocation.mockResolvedValue({}); mocks.deactivateRoutingLocation.mockResolvedValue({}); mocks.restoreRoutingLocation.mockResolvedValue({});
    await expect(updateRoutingLocationAdminAction(initial, form({ id: "location-1", code: "XY-02", name: "Updated", type: "inland", applicabilities: ["domestic_origin", "domestic_destination"] }))).resolves.toMatchObject({ ok: true });
    await expect(deactivateRoutingLocationAdminAction(initial, form({ id: "location-1", confirmation: "confirmed" }))).resolves.toMatchObject({ ok: true });
    await expect(restoreRoutingLocationAdminAction(initial, form({ id: "location-1" }))).resolves.toMatchObject({ ok: true });
    expect(mocks.updateRoutingLocation).toHaveBeenCalledWith("location-1", expect.objectContaining({ applicabilities: ["domestic_origin", "domestic_destination"] }), admin);
    expect(mocks.deactivateRoutingLocation).toHaveBeenCalledWith("location-1", admin);
    expect(mocks.restoreRoutingLocation).toHaveBeenCalledWith("location-1", admin);
  });
});
