import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./location-selector", () => ({
  getShippingNoteLocationApplicability: (_mode: string, fieldName: string) => fieldName,
  LocationSelector: ({ label, name }: { label: string; name: string }) => `LOCATION_SELECTOR:${name}:${label}`,
}));
vi.mock("./partner-selector", () => ({
  PartnerSelector: ({ label }: { label: string }) => label,
}));

import { ShippingNoteCreateRoutingFields } from "./shipping-note-create-form";

describe("Shipping Note create routing fields", () => {
  it("uses manual text inputs for Domestic From and To", () => {
    const html = renderToStaticMarkup(createElement(ShippingNoteCreateRoutingFields, {
      fields: [
        { name: "domesticOrigin", label: "From" },
        { name: "domesticDestination", label: "To" },
      ],
      shipmentType: "domestic",
    }));

    expect(html).toContain('name="domesticOrigin"');
    expect(html).toContain('name="domesticDestination"');
    expect(html).not.toContain("LOCATION_SELECTOR");
    expect(html).not.toContain("+ Add more");
  });

  it("keeps Ocean, Air, and Custom routing on LocationSelector", () => {
    for (const [shipmentType, name] of [
      ["ocean", "portOfLoading"],
      ["air", "aol"],
      ["custom", "customOrigin"],
    ] as const) {
      const html = renderToStaticMarkup(createElement(ShippingNoteCreateRoutingFields, {
        fields: [{ name, label: "Location" }],
        shipmentType,
      }));
      expect(html).toContain(`LOCATION_SELECTOR:${name}`);
    }
  });
});
