import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  searchShippingNoteLocationsAction: vi.fn(),
}));

import {
  getSelectedLocationFormValue,
  LocationSelector,
  LocationSelectorOptions,
} from "./location-selector";

describe("LocationSelector", () => {
  it("uses English manual-entry copy", () => {
    const source = readFileSync(new URL("./location-selector.tsx", import.meta.url), "utf8");

    expect(source).toContain("Enter manually");
    expect(source).not.toContain("Nhập thủ công");
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

  it("auto-selects the returned Location without persisting field context", () => {
    const source = readFileSync(new URL("./location-selector.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("applicability");
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
