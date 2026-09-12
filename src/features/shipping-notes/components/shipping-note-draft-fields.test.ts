import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./location-selector", () => ({
  getShippingNoteLocationApplicability: (_mode: string, fieldName: string) => fieldName,
  LocationSelector: ({ label }: { label: string }) => label,
}));

import { ShippingNoteDraftFields } from "./shipping-note-draft-fields";

function render(mode: "sea_export" | "air_export" | "domestic_truck" | "custom") {
  return renderToStaticMarkup(createElement(ShippingNoteDraftFields, {
    values: {
      jobsheetNo: "QA-EDIT-001", shippingMode: mode,
      aol: "SGN", aod: "NRT", portOfLoading: "VNSGN", portOfDischarge: "USLAX",
      finalDestination: "Destination", domesticOrigin: "HCM", domesticDestination: "DAD",
      customModeName: "Rail", customOrigin: "HCM", customDestination: "Phnom Penh",
      mawbNo: "MAWB-1", hawbNo: "HAWB-1", flightNo: "VN1", mblNo: "MBL-1",
      hblNo: "HBL-1", vesselName: "Ocean One", voyageNo: "V-1",
    },
  }));
}

describe("Shipping Note Draft field presentation", () => {
  it("renders compact Air controls without exposing the raw selected enum as text", () => {
    const html = render("air_export");

    expect(html).toContain("Shipment Type");
    expect(html).toContain("Air");
    expect(html).toContain("Direction");
    expect(html).toContain("Export");
    expect(html).not.toContain(">air_export<");
  });

  it("renders Air routing and separate Air Freight controls", () => {
    const html = render("air_export");

    expect(html).toContain("AOL");
    expect(html).toContain("AOD");
    expect(html).toContain("Final Destination");
    expect(html).toContain("Air Freight");
    expect(html).toContain("MAWB");
    expect(html).toContain("HAWB");
    expect(html).toContain("Flight No");
    expect(html).not.toContain("Ocean Freight");
  });

  it("renders Ocean routing and separate Ocean Freight controls", () => {
    const html = render("sea_export");

    expect(html).toContain("POL");
    expect(html).toContain("POD");
    expect(html).toContain("Final Destination");
    expect(html).toContain("Ocean Freight");
    expect(html).toContain("MBL");
    expect(html).toContain("HBL");
    expect(html).not.toContain("Air Freight");
  });

  it("renders Domestic From and To without a direction or final destination", () => {
    const html = render("domestic_truck");

    expect(html).toContain("Domestic");
    expect(html).toContain("From");
    expect(html).toContain("To");
    expect(html).not.toContain("shipmentDirection");
    expect(html).not.toContain("Final Destination");
  });

  it("renders Custom Mode, From, and To without direction or transport fields", () => {
    const html = render("custom");

    expect(html).toContain("Custom");
    expect(html).toContain("Mode");
    expect(html).toContain("From");
    expect(html).toContain("To");
    expect(html).not.toContain("shipmentDirection");
    expect(html).not.toContain("Air Freight");
    expect(html).not.toContain("Ocean Freight");
  });

  it("groups schedule and parties into their own sections", () => {
    const html = render("air_export");

    expect(html).toContain("Schedule");
    expect(html).toContain("ETD");
    expect(html).toContain("ETA");
    expect(html).toContain("Parties");
    expect(html).toContain("Shipper");
    expect(html).toContain("Consignee");
    expect(html).toContain("Customer");
    expect(html).toContain("Agent");
  });
});
