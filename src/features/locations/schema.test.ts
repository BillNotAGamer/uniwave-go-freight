import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  routingLocationTypeEnum,
  routingLocations,
} from "@/lib/db/schema";

describe("Routing Location schema", () => {
  it("keeps descriptive Location types", () => {
    expect(routingLocationTypeEnum.enumValues).toEqual(["airport", "seaport", "inland", "other"]);
  });

  it("defines routing_locations identity and lifecycle columns with type/code uniqueness", () => {
    const config = getTableConfig(routingLocations);
    expect(config.name).toBe("routing_locations");
    for (const column of ["id", "code", "name", "type", "countryCode", "subdivision", "isActive", "createdAt", "updatedAt", "deletedAt"] as const) {
      expect(routingLocations[column]).toBeDefined();
    }
    expect(routingLocations.code.notNull).toBe(true);
    expect(routingLocations.name.notNull).toBe(true);
    expect(routingLocations.type.notNull).toBe(true);
    expect(routingLocations.deletedAt.notNull).toBe(false);
    const unique = config.indexes.find((index) => index.config.name === "routing_locations_type_code_uidx");
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns.map((column) => "name" in column ? column.name : "")).toEqual(["type", "code"]);
  });

  it("has no eligibility membership table or relation at runtime", async () => {
    const schema = await import("@/lib/db/schema");
    expect(schema).not.toHaveProperty("routingLocationApplicabilities");
    expect(schema).not.toHaveProperty("routingLocationApplicabilitiesRelations");
    expect(schema).not.toHaveProperty("routingLocationApplicabilityEnum");
  });
});
