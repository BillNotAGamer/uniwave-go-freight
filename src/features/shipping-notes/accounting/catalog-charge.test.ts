import { describe, expect, it } from "vitest";

import { resolveChargeCatalogPersistence } from "./catalog-charge";

const item = {
  id: "catalog-1",
  code: "OF",
  name: "Ocean Freight",
  primaryUnit: "Shipment",
  vatRate: "8.00",
  isActive: true,
  deletedAt: null,
};

describe("charge catalog snapshots", () => {
  it("derives authoritative frozen fields from an active selected item", () => {
    const snapshot = resolveChargeCatalogPersistence(
      {
        serviceCatalogItemId: item.id,
        chargeName: "Wrong Name",
        unit: "Wrong Unit",
      },
      item,
    );

    expect(snapshot).toMatchObject({
      serviceCatalogItemId: "catalog-1",
      catalogCodeSnapshot: "OF",
      catalogNameSnapshot: "Ocean Freight",
      catalogUnitSnapshot: "Shipment",
      catalogVatRateSnapshot: "8.00",
      chargeName: "Ocean Freight",
      unit: "Shipment",
    });
  });

  it("keeps manual charge behavior and clears catalog authority", () => {
    expect(resolveChargeCatalogPersistence(
      { chargeName: "Manual handling", unit: "Job" },
      null,
    )).toMatchObject({
      serviceCatalogItemId: null,
      catalogNameSnapshot: null,
      catalogVatRateSnapshot: null,
      chargeName: "Manual handling",
      unit: "Job",
    });
  });

  it.each([
    null,
    { ...item, isActive: false },
    { ...item, deletedAt: new Date() },
  ])("rejects a missing, inactive, or deleted selection", (candidate) => {
    expect(() => resolveChargeCatalogPersistence(
      { serviceCatalogItemId: item.id, chargeName: "x", unit: "x" },
      candidate,
    )).toThrow(/unavailable/);
  });

  it("keeps an existing historical snapshot independent of later catalog edits", () => {
    const snapshot = resolveChargeCatalogPersistence(
      { serviceCatalogItemId: item.id, chargeName: "x", unit: "x" },
      item,
    );
    const renamed = { ...item, name: "New Name", primaryUnit: "Container", vatRate: "10.00" };

    expect(renamed).not.toMatchObject({
      name: snapshot.catalogNameSnapshot,
      primaryUnit: snapshot.catalogUnitSnapshot,
      vatRate: snapshot.catalogVatRateSnapshot,
    });
    expect(snapshot).toMatchObject({
      catalogNameSnapshot: "Ocean Freight",
      catalogUnitSnapshot: "Shipment",
      catalogVatRateSnapshot: "8.00",
    });
  });
});
