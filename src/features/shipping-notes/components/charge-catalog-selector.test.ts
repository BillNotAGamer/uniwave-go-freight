import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  searchShippingNoteServiceCatalogAction: vi.fn(),
}));

import { ChargeCatalogSelector } from "./charge-catalog-selector";

describe("ChargeCatalogSelector copy", () => {
  it("renders English manual-entry copy", () => {
    const markup = renderToStaticMarkup(createElement(ChargeCatalogSelector));

    expect(markup).toContain("Charge Name (Manual)");
    expect(markup).toContain("Select from catalog");
    expect(markup).toContain("Enter custom charge name...");
  });

  it("uses English catalog states and helper text", () => {
    const source = readFileSync(new URL("./charge-catalog-selector.tsx", import.meta.url), "utf8");

    expect(source).toContain("Service Catalog");
    expect(source).toContain("Enter manually");
    expect(source).toContain("Unit:");
    expect(source).toContain("Catalog VAT:");
    expect(source).toContain("Search by code or service name...");
    expect(source).toContain("Searching…");
    expect(source).toContain("No matching services found.");
    expect(source).toContain("Unable to load service catalog. You can switch to manual entry.");
    expect(source).toContain("Unspecified");
  });
});
