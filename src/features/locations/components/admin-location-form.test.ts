import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../actions", () => ({
  createRoutingLocationAdminAction: vi.fn(),
  updateRoutingLocationAdminAction: vi.fn(),
  deactivateRoutingLocationAdminAction: vi.fn(),
  restoreRoutingLocationAdminAction: vi.fn(),
}));

import { CreateLocationForm, EditLocationForm } from "./admin-location-form";
import type { RoutingLocationDetail } from "../types";

const location: RoutingLocationDetail = {
  id: "location-1", code: "SGN", name: "Synthetic Airport", type: "airport",
  countryCode: "VN", subdivision: "South", isActive: true,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
};

describe("Admin Location catalog form", () => {
  it.each(["create", "edit"] as const)("renders identity only for %s", (mode) => {
    const html = renderToStaticMarkup(mode === "create"
      ? createElement(CreateLocationForm)
      : createElement(EditLocationForm, { location }));
    for (const label of ["Code", "Name", "Location Type", "Country Code", "Subdivision"]) {
      expect(html).toContain(label);
    }
    for (const field of ["code", "name", "type", "countryCode", "subdivision"]) {
      expect(html).toContain(`name="${field}"`);
    }
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("Shipping Note usage");
    if (mode === "edit") {
      expect(html).toContain('value="SGN"');
      expect(html).toContain('value="airport" selected');
    }
  });
});
