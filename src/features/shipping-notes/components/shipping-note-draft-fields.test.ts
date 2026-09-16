import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./location-selector", () => ({
  LocationSelector: ({ label, name }: { label: string; name: string }) => `LOCATION_SELECTOR:${name}:${label}`,
}));
vi.mock("./partner-selector", () => ({
  PartnerSelector: ({ label }: { label: string }) => label,
}));

import { ShippingNoteDraftFields } from "./shipping-note-draft-fields";

function render(mode: "sea_export" | "air_export" | "domestic_truck" | "custom") {
  return renderToStaticMarkup(createElement(ShippingNoteDraftFields, {
    values: {
      jobsheetNo: "QA-EDIT-001",
      shippingMode: mode,
      commodity: "Electronics",
      hsCode: "0303.89",
      aol: "SGN",
      aod: "NRT",
      portOfLoading: "VNSGN",
      portOfDischarge: "USLAX",
      finalDestination: "Destination",
      domesticOrigin: "HCM",
      domesticDestination: "DAD",
      customModeName: "Rail",
      customOrigin: "HCM",
      customDestination: "Phnom Penh",
      mawbNo: "MAWB-1",
      hawbNo: "HAWB-1",
      flightNo: "VN1",
      mblNo: "MBL-1",
      hblNo: "HBL-1",
      vesselName: "Ocean One",
      voyageNo: "V-1",
      containerNo: "CONT-1234",
      sealNo: "SEAL-5678",
      carrierName: "Maersk",
      grossWeight: "1500 KGS",
      chargeableWeight: "1200 KGS",
      licensePlate: "29A-12345",
      driverInformation: "Nguyen Van A\nCCCD: 012345678901",
      vehiclePayloadCapacity: "5 TONS",
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

  it("renders independent Commodity and HS Code fields without combined input", () => {
    const html = render("air_export");

    expect(html).toContain("Commodity");
    expect(html).toContain('name="commodity"');
    expect(html).toContain('value="Electronics"');
    expect(html).toContain("HS Code");
    expect(html).toContain('name="hsCode"');
    expect(html).toContain('value="0303.89"');
    expect(html).not.toContain("Commidity/HS code");
    expect(html).not.toContain("Commodity / HS Code");
    expect(html).not.toContain('name="commodityHsCode"');
  });

  it("renders Air routing, transport documents, and schedule & cargo controls", () => {
    const html = render("air_export");

    expect(html).toContain("AOL");
    expect(html).toContain("AOD");
    expect(html).toContain("Final Destination");
    expect(html).toContain("Transport Documents");
    expect(html).toContain("MAWB");
    expect(html).toContain("HAWB");
    expect(html).toContain("Flight No");
    expect(html).not.toContain("Container No.");
    expect(html).not.toContain("Seal No.");
    expect(html).not.toContain("Carrier Name");
    expect(html).toContain("Schedule &amp; Cargo");
    expect(html).toContain("Chargeable Weight");
    expect(html).toContain("Gross Weight");
    expect(html).not.toContain("License Plate");
    expect(html).not.toContain("Driver Information");
  });

  it("renders Ocean routing, transport documents with Container/Seal/Carrier, and Gross Weight", () => {
    const html = render("sea_export");

    expect(html).toContain("POL");
    expect(html).toContain("POD");
    expect(html).toContain("Final Destination");
    expect(html).toContain("Transport Documents");
    expect(html).toContain("MBL");
    expect(html).toContain("HBL");
    expect(html).toContain("Container No.");
    expect(html).toContain("Seal No.");
    expect(html).toContain("Carrier Name");
    expect(html).toContain("Schedule &amp; Cargo");
    expect(html).toContain("Gross Weight");
    expect(html).not.toContain("Chargeable Weight");
    expect(html).not.toContain("License Plate");
    expect(html).not.toContain("Driver Information");
  });

  it("renders Domestic From and To with vehicle/driver fields without Sea/Air fields", () => {
    const html = render("domestic_truck");

    expect(html).toContain("Domestic");
    expect(html).toContain("From");
    expect(html).toContain("To");
    expect(html).not.toContain("shipmentDirection");
    expect(html).not.toContain("Final Destination");
    expect(html).toContain('name="domesticOrigin"');
    expect(html).toContain('name="domesticDestination"');
    expect(html).not.toContain("LOCATION_SELECTOR:domesticOrigin");
    expect(html).not.toContain("LOCATION_SELECTOR:domesticDestination");
    expect(html).not.toContain("+ Add more");
    expect(html).toContain("License Plate");
    expect(html).toContain("Driver Information");
    expect(html).toContain("Vehicle Payload Capacity");
    expect(html).not.toContain("Transport Documents");
    expect(html).not.toContain("Gross Weight");
    expect(html).not.toContain("Chargeable Weight");
  });

  it("renders Custom Mode, From, and To without direction or transport fields", () => {
    const html = render("custom");

    expect(html).toContain("Custom");
    expect(html).toContain("Mode");
    expect(html).toContain("From");
    expect(html).toContain("To");
    expect(html).not.toContain("shipmentDirection");
    expect(html).not.toContain("Transport Documents");
    expect(html).not.toContain("Gross Weight");
    expect(html).not.toContain("Chargeable Weight");
    expect(html).not.toContain("License Plate");
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
