import { describe, expect, it } from "vitest";

import { createRoutingLocationInputSchema } from "./validators";

const valid = { code: " xy-01 ", name: "  Synthetic Terminal  ", type: "airport", countryCode: " zz ", subdivision: "  Sample Region " };

describe("Routing Location validators", () => {
  it("normalizes code, name, country code, and subdivision", () => {
    expect(createRoutingLocationInputSchema.parse(valid)).toMatchObject({
      code: "XY-01", name: "Synthetic Terminal", countryCode: "ZZ", subdivision: "Sample Region",
    });
  });

  it("requires identity fields without any usage requirement", () => {
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, code: "" }).success).toBe(false);
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(createRoutingLocationInputSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts only canonical descriptive types", () => {
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, type: "warehouse" }).success).toBe(false);
  });
});
