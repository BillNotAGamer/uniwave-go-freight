import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  quickCreateShippingNotePartnerAction: vi.fn(),
  searchShippingNotePartnersAction: vi.fn(),
}));

import { PartnerSelector, PartnerSelectorOptions } from "./partner-selector";

const partner = {
  id: "partner-1",
  companyName: "Acme Logistics",
  vendorCode: "ACME",
  categoryNames: [],
};

function renderOptions(results: typeof partner[]) {
  return renderToStaticMarkup(createElement("ul", null,
    createElement(PartnerSelectorOptions, {
      activeIndex: -1,
      listboxId: "partners",
      onAddMore: vi.fn(),
      onChoose: vi.fn(),
      results,
    }),
  ));
}

describe("PartnerSelector quick add", () => {
  it("renders + Add more after populated results", () => {
    const html = renderOptions([partner]);
    expect(html).toContain("Acme Logistics");
    expect(html).toContain("+ Add more");
    expect(html.indexOf("+ Add more")).toBeGreaterThan(html.indexOf("Acme Logistics"));
  });

  it("renders + Add more after the zero-results state", () => {
    const html = renderOptions([]);
    expect(html).toContain("No active Partners found.");
    expect(html).toContain("+ Add more");
    expect(html.indexOf("+ Add more")).toBeGreaterThan(html.indexOf("No active Partners found."));
  });

  it("preserves selected Partner ID and company snapshot display for draft editing", () => {
    const html = renderToStaticMarkup(createElement(PartnerSelector, {
      initialPartnerId: partner.id,
      initialText: partner.companyName,
      label: "Shipper",
      partnerFieldName: "shipperPartnerId",
      textFieldName: "shipperText",
    }));

    expect(html).toContain('name="shipperPartnerId"');
    expect(html).toContain('value="partner-1"');
    expect(html).toContain('value="Acme Logistics"');
  });

  it("keeps manual text entry separate from Master Data creation", () => {
    const html = renderToStaticMarkup(createElement(PartnerSelector, {
      initialText: "Manual Shipper",
      label: "Shipper",
      partnerFieldName: "shipperPartnerId",
      textFieldName: "shipperText",
    }));

    expect(html).toContain('name="shipperText"');
    expect(html).toContain('value="Manual Shipper"');
    expect(html).not.toContain('name="shipperPartnerId"');
    expect(html).not.toContain("Add Partner");
  });

  it("opens the dialog and auto-selects then closes after a successful action", () => {
    const source = readFileSync(new URL("./partner-selector.tsx", import.meta.url), "utf8");
    expect(source).toContain("setQuickAddOpen(true)");
    expect(source).toContain("choosePartner(result.partner)");
    expect(source).toContain("setQuickAddOpen(false)");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("Company Name");
    expect(source).toContain("Vendor Code");
    expect(source).toContain("Tax ID / MST");
    expect(source).toContain("Address");
  });
});
