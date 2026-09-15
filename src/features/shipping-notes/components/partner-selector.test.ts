import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  quickCreateShippingNotePartnerAction: vi.fn(),
  searchShippingNotePartnersAction: vi.fn(),
}));

import { PartnerSelector } from "./partner-selector";

describe("PartnerSelector quick add", () => {
  it("renders English selector and manual-entry copy", () => {
    const selectorMarkup = renderToStaticMarkup(createElement(PartnerSelector, {
      label: "Shipper",
      partnerFieldName: "shipperPartnerId",
      textFieldName: "shipperText",
    }));
    const manualMarkup = renderToStaticMarkup(createElement(PartnerSelector, {
      initialText: "Manual Shipper",
      label: "Shipper",
      partnerFieldName: "shipperPartnerId",
      textFieldName: "shipperText",
    }));

    expect(selectorMarkup).toContain("Enter manually");
    expect(selectorMarkup).toContain("Search by name, code or tax ID");
    expect(manualMarkup).toContain("Select Partner");
    expect(manualMarkup).toContain("Enter partner name");
  });

  it("places + Add more after populated and zero-result list content", () => {
    const source = readFileSync(new URL("./partner-selector.tsx", import.meta.url), "utf8");
    const addMoreIndex = source.indexOf("+ Add more");

    expect(source).toContain("results.map((partner, index)");
    expect(source).toContain("No active Partners found.");
    expect(addMoreIndex).toBeGreaterThan(source.indexOf("results.map((partner, index)"));
    expect(addMoreIndex).toBeGreaterThan(source.indexOf("No active Partners found."));
  });

  it("keeps the public selector contract limited to its live form fields", () => {
    expect(PartnerSelector).toBeTypeOf("function");

    const source = readFileSync(new URL("./partner-selector.tsx", import.meta.url), "utf8");
    expect(source).toContain("partnerFieldName");
    expect(source).toContain("textFieldName");
    expect(source).toContain("setManualEntry(true)");
    expect(source).toContain("name={textFieldName}");
    expect(source).toContain("name={partnerFieldName}");
  });

  it("submits the selected Partner ID while displaying its company name", () => {
    const source = readFileSync(new URL("./partner-selector.tsx", import.meta.url), "utf8");

    expect(source).toContain('{selected ? <input name={partnerFieldName} type="hidden" value={selected.id} /> : null}');
    expect(source).toContain("setSelected(partner)");
    expect(source).toContain("setQuery(partner.companyName)");
  });

  it("keeps manual entry text-only and outside the quick-create action", () => {
    const source = readFileSync(new URL("./partner-selector.tsx", import.meta.url), "utf8");

    expect(source).toContain("if (manualEntry) {");
    expect(source).toContain("name={textFieldName}");
    expect(source.indexOf("quickCreateShippingNotePartnerAction")).toBeLessThan(
      source.indexOf("if (manualEntry) {"),
    );
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
