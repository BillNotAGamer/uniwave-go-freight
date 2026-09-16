import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock("./location-selector", () => ({
  LocationSelector: ({ label, name }: { label: string; name: string }) => `LOCATION_SELECTOR:${name}:${label}`,
}));
vi.mock("./partner-selector", () => ({
  PartnerSelector: ({ label }: { label: string }) => label,
}));

import { ShippingNoteCreateForm } from "./shipping-note-create-form";

describe("Shipping Note create routing fields", () => {
  it("uses manual text inputs for Domestic From and To", () => {
    expect(ShippingNoteCreateForm).toBeTypeOf("function");

    const source = readFileSync(new URL("./shipping-note-create-form.tsx", import.meta.url), "utf8");
    expect(source).toContain(`shipmentType === "domestic" ? (
          <TextField key={field.name} label={field.label} name={field.name} required />
        ) : (`);
    expect(source).not.toContain('shipmentType === "domestic" ? (\n          <LocationSelector');
    expect(source).not.toContain('shipmentType === "domestic" ? (\n          + Add more');
  });

  it("keeps Ocean, Air, and Custom routing on LocationSelector", () => {
    const source = readFileSync(new URL("./shipping-note-create-form.tsx", import.meta.url), "utf8");

    expect(source).toContain('shipmentType === "domestic" ? (');
    expect(source).toContain("<LocationSelector");
    expect(source).not.toContain("applicability");
  });
});
