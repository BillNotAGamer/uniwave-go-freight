import { describe, expect, it } from "vitest";

import { createRoutingLocationInputSchema } from "./validators";

const valid = { code: " xy-01 ", name: "  Synthetic Terminal  ", type: "airport", countryCode: " zz ", subdivision: "  Sample Region ", applicabilities: ["air_aol", "air_aod"] };

describe("Routing Location validators", () => {
  it("normalizes code, name, country code, and subdivision", () => {
    expect(createRoutingLocationInputSchema.parse(valid)).toMatchObject({
      code: "XY-01", name: "Synthetic Terminal", countryCode: "ZZ", subdivision: "Sample Region",
    });
  });

  it("requires identity fields and at least one explicit applicability", () => {
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, code: "" }).success).toBe(false);
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, applicabilities: [] }).success).toBe(false);
  });

  it("accepts only canonical types and applicability values without duplicates", () => {
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, type: "warehouse" }).success).toBe(false);
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, applicabilities: ["invalid"] }).success).toBe(false);
    expect(createRoutingLocationInputSchema.safeParse({ ...valid, applicabilities: ["air_aol", "air_aol"] }).success).toBe(false);
  });
});
