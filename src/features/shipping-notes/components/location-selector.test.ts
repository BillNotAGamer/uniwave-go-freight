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
  LocationSelectorOptions,
} from "./location-selector";

describe("LocationSelector", () => {
  it("maps every routing field to its explicit applicability without type inference", () => {
    expect(getShippingNoteLocationApplicability("ocean", "portOfLoading")).toBe("sea_pol");
    expect(getShippingNoteLocationApplicability("ocean", "portOfDischarge")).toBe("sea_pod");
    expect(getShippingNoteLocationApplicability("ocean", "finalDestination")).toBe("sea_final_destination");
    expect(getShippingNoteLocationApplicability("air", "aol")).toBe("air_aol");
    expect(getShippingNoteLocationApplicability("air", "aod")).toBe("air_aod");
    expect(getShippingNoteLocationApplicability("air", "finalDestination")).toBe("air_final_destination");
    expect(getShippingNoteLocationApplicability("custom", "customOrigin")).toBe("custom_origin");
    expect(getShippingNoteLocationApplicability("custom", "customDestination")).toBe("custom_destination");
    expect(() => getShippingNoteLocationApplicability("domestic" as never, "domesticOrigin")).toThrow();
  });

  it.each([
    [[], "No matching master locations."],
    [[{ code: "SGN", name: "Ho Chi Minh", type: "airport", countryCode: "VN" }], "SGN - Ho Chi Minh"],
  ] as const)("keeps + Add more below results and empty state", (results, expected) => {
    const html = renderToStaticMarkup(createElement("ul", null,
      createElement(LocationSelectorOptions, {
        activeIndex: -1,
        listboxId: "locations",
        onAddMore: vi.fn(),
        onChoose: vi.fn(),
        results: [...results],
      }),
    ));
    expect(html).toContain(expected);
    expect(html).toContain("+ Add more");
    expect(html.indexOf("+ Add more")).toBeGreaterThan(html.indexOf(expected));
  });

  it("passes contextual applicability and auto-selects the returned Location", () => {
    const source = readFileSync(new URL("./location-selector.tsx", import.meta.url), "utf8");
    expect(source).toContain("applicability,");
    expect(source).toContain("chooseLocation(result.location)");
    expect(source).toContain("setQuickAddOpen(false)");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("setQuickAddType");
    expect(source).toContain("Location Code");
    expect(source).toContain("Location Name");
    expect(source).toContain("Location Type");
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
import { readFileSync } from "node:fs";
