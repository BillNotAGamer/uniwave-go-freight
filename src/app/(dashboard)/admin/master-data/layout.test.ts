import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MasterDataLayout from "./layout";

describe("Master Data local navigation", () => {
  it("renders Partners and Locations navigation without changing global navigation", () => {
    const markup = renderToStaticMarkup(
      createElement(MasterDataLayout, null, createElement("p", null, "Content")),
    );

    expect(markup).toContain('href="/admin/master-data/partners"');
    expect(markup).toContain('href="/admin/master-data/locations"');
  });
});
