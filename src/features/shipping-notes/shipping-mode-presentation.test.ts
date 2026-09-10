import { describe, expect, it } from "vitest";

import {
  getShippingModePresentation,
  SHIPPING_MODE_PRESENTATION,
} from "./mode-rules";

describe("Shipping Note mode presentation", () => {
  it("maps every persisted mode to its approved label and field family", () => {
    expect(SHIPPING_MODE_PRESENTATION).toEqual({
      domestic_truck: { label: "Nội địa", family: "domestic" },
      sea_export: { label: "Sea Export", family: "sea" },
      sea_import: { label: "Sea Import", family: "sea" },
      air_export: { label: "Air Export", family: "air" },
      air_import: { label: "Air Import", family: "air" },
    });
  });

  it("keeps mode presentation deterministic instead of falling back to another family", () => {
    expect(getShippingModePresentation("domestic_truck").family).toBe("domestic");
    expect(getShippingModePresentation("air_export").family).toBe("air");
    expect(getShippingModePresentation("air_import").family).toBe("air");
    expect(getShippingModePresentation("sea_export").family).toBe("sea");
    expect(getShippingModePresentation("sea_import").family).toBe("sea");
  });
});
