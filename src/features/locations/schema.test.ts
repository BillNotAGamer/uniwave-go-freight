import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  routingLocationApplicabilities,
  routingLocationApplicabilitiesRelations,
  routingLocationApplicabilityEnum,
  routingLocationTypeEnum,
  routingLocations,
  routingLocationsRelations,
} from "@/lib/db/schema";

type InlineForeignKey = { onDelete: string; reference: () => { foreignTable: unknown; columns: Array<{ name: string }> } };

function inlineForeignKeys(table: unknown): InlineForeignKey[] {
  const values = (table as Record<symbol, unknown>)[Symbol.for("drizzle:PgInlineForeignKeys")];
  return (Array.isArray(values) ? values : []) as InlineForeignKey[];
}

describe("Routing Location schema", () => {
  it("defines the canonical independent type and applicability enums", () => {
    expect(routingLocationTypeEnum.enumValues).toEqual(["airport", "seaport", "inland", "other"]);
    expect(routingLocationApplicabilityEnum.enumValues).toEqual([
      "sea_pol", "sea_pod", "sea_final_destination", "air_aol", "air_aod", "air_final_destination", "domestic_origin", "domestic_destination", "custom_origin", "custom_destination",
    ]);
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

  it("defines normalized applicability membership uniqueness and a cascade FK", () => {
    const config = getTableConfig(routingLocationApplicabilities);
    expect(config.name).toBe("routing_location_applicabilities");
    expect(routingLocationApplicabilities.locationId.notNull).toBe(true);
    expect(routingLocationApplicabilities.applicability.notNull).toBe(true);
    const unique = config.indexes.find((index) => index.config.name === "routing_location_applicabilities_location_id_applicability_uidx");
    expect(unique?.config.unique).toBe(true);
    const fk = inlineForeignKeys(routingLocationApplicabilities).find((candidate) => candidate.reference().foreignTable === routingLocations);
    expect(fk?.onDelete).toBe("cascade");
    expect(routingLocationsRelations.table).toBe(routingLocations);
    expect(routingLocationApplicabilitiesRelations.table).toBe(routingLocationApplicabilities);
  });
});
