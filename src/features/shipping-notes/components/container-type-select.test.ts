import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CONTAINER_TYPE_VALUES } from "../constants";
import { ContainerTypeSelect } from "./container-type-select";

describe("ContainerTypeSelect", () => {
  it("renders one grouped, single-select control with all 14 canonical choices", () => {
    const html = renderToStaticMarkup(createElement(ContainerTypeSelect, {
      defaultValue: "40_dry_high",
    }));

    expect(CONTAINER_TYPE_VALUES).toHaveLength(14);
    expect(html).toContain("<select");
    expect(html).toContain('name="containerType"');
    expect(html).not.toContain("multiple");
    expect(html).toContain('<optgroup label="General Sized Cargo">');
    expect(html).toContain('<optgroup label="Reefer Container">');
    expect(html).toContain('<optgroup label="Odd Sized Container">');
    for (const value of CONTAINER_TYPE_VALUES) {
      expect(html).toContain(`value="${value}"`);
    }
    expect(html).toContain('value="40_dry_high" selected=""');
  });
});
