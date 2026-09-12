import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  searchShippingNoteLocationsAction: vi.fn(),
}));

import {
  getSelectedLocationFormValue,
  getShippingNoteLocationApplicability,
  LocationSelector,
} from "./location-selector";

describe("LocationSelector", () => {
  it("maps every routing field to its explicit applicability without type inference", () => {
    expect(getShippingNoteLocationApplicability("ocean", "portOfLoading")).toBe("sea_pol");
    expect(getShippingNoteLocationApplicability("ocean", "portOfDischarge")).toBe("sea_pod");
    expect(getShippingNoteLocationApplicability("ocean", "finalDestination")).toBe("sea_final_destination");
    expect(getShippingNoteLocationApplicability("air", "aol")).toBe("air_aol");
    expect(getShippingNoteLocationApplicability("air", "aod")).toBe("air_aod");
    expect(getShippingNoteLocationApplicability("air", "finalDestination")).toBe("air_final_destination");
    expect(getShippingNoteLocationApplicability("domestic", "domesticOrigin")).toBe("domestic_origin");
    expect(getShippingNoteLocationApplicability("domestic", "domesticDestination")).toBe("domestic_destination");
    expect(getShippingNoteLocationApplicability("custom", "customOrigin")).toBe("custom_origin");
    expect(getShippingNoteLocationApplicability("custom", "customDestination")).toBe("custom_destination");
  });

  it("uses only the selected Location code as the form value", () => {
    expect(getSelectedLocationFormValue({ code: "SYN-AIR" })).toBe("SYN-AIR");
  });

  it("preserves an unmatched historical/manual value in the existing field name", () => {
    const markup = renderToStaticMarkup(createElement(LocationSelector, {
      applicability: "sea_pol",
      initialValue: "LEGACY VALUE",
      label: "POL",
      name: "portOfLoading",
      required: true,
    }));

    expect(markup).toContain('name="portOfLoading"');
    expect(markup).toContain('value="LEGACY VALUE"');
    expect(markup).toContain("Search Master Data or enter routing text manually.");
    expect(markup).not.toContain("locationId");
  });
});
