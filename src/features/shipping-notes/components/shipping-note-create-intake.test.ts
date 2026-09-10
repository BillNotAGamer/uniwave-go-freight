import { describe, expect, it } from "vitest";

import {
  SHIPMENT_TYPE_CARDS,
  SHIPPING_MODES_BY_SHIPMENT_TYPE,
  SHIPPING_NOTE_CREATE_INTAKE_COPY,
} from "./shipping-note-create-intake";

describe("Shipping Note create intake", () => {
  it("presents the Create Shipment intake copy and four shipment type cards", () => {
    expect(SHIPPING_NOTE_CREATE_INTAKE_COPY.title).toBe("Create Shipment");
    expect(SHIPMENT_TYPE_CARDS.map((card) => card.label)).toEqual([
      "Ocean",
      "Air",
      "Domestic",
      "Custom",
    ]);
    expect(SHIPMENT_TYPE_CARDS.map((card) => card.label)).not.toContain("Nội địa");
  });

  it("maps Ocean, Air, and Domestic to existing truthful persisted modes", () => {
    expect(SHIPPING_MODES_BY_SHIPMENT_TYPE.ocean).toEqual(["sea_export", "sea_import"]);
    expect(SHIPPING_MODES_BY_SHIPMENT_TYPE.air).toEqual(["air_export", "air_import"]);
    expect(SHIPPING_MODES_BY_SHIPMENT_TYPE.domestic).toEqual(["domestic_truck"]);
  });

  it("presents Custom as an enabled persisted shipment type", () => {
    expect(SHIPMENT_TYPE_CARDS.find((card) => card.type === "custom")?.available).toBe(true);
  });
});
