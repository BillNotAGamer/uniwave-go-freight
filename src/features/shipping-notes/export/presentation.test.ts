import { describe, expect, it } from "vitest";

import {
  buildExportRoutingPresentation,
  getExportCommodityValue,
  getExportHsCodeValue,
  getModeSpecificExportFields,
} from "./presentation";
import type { InternalShippingNoteExportDto } from "./types";

function note(
  overrides: Partial<InternalShippingNoteExportDto["note"]>,
): InternalShippingNoteExportDto["note"] {
  return {
    id: "note-1",
    jobsheetNo: "EXPORT-1",
    mawbNo: null,
    hawbNo: null,
    mawbHawbNo: null,
    shippingMode: "air_export",
    shipperText: null,
    consigneeText: null,
    customerText: null,
    agentText: null,
    aol: null,
    aod: null,
    finalDestination: null,
    etd: null,
    eta: null,
    volumeValue: null,
    volumeUnit: null,
    exchangeRate: "1.000000",
    status: "checked",
    ...overrides,
  };
}

describe("export routing presentation", () => {
  it("uses modern Air bill numbers and Air routing labels", () => {
    const presentation = buildExportRoutingPresentation(note({
      mawbNo: "45964854462",
      hawbNo: "NIL",
      mawbHawbNo: "legacy",
      aol: "SGN",
      aod: "LAX",
      finalDestination: "LOS ANGELES",
      flightNo: "VN300",
    }));

    expect(presentation).toMatchObject({
      bill: { label: "MAWB / HAWB", value: "45964854462 / NIL" },
      origin: { label: "AOL", value: "SGN" },
      destination: { label: "AOD", value: "LAX" },
      finalDestination: { label: "Final Destination", value: "LOS ANGELES" },
      transport: [{ label: "Flight No", value: "VN300" }],
    });
  });

  it("uses Ocean bills and routing without Air labels", () => {
    const presentation = buildExportRoutingPresentation(note({
      shippingMode: "sea_export",
      mblNo: "276301562",
      hblNo: "SLT-2609001",
      portOfLoading: "HCM",
      portOfDischarge: "MIAMI",
      finalDestination: "MIAMI",
      vesselName: "MAERSK PORT KLANG",
      voyageNo: "638N",
    }));

    expect(presentation).toMatchObject({
      bill: { label: "MBL / HBL", value: "276301562 / SLT-2609001" },
      origin: { label: "POL", value: "HCM" },
      destination: { label: "POD", value: "MIAMI" },
      finalDestination: { label: "Final Destination", value: "MIAMI" },
      transport: [
        { label: "Vessel", value: "MAERSK PORT KLANG" },
        { label: "Voyage", value: "638N" },
      ],
    });
  });

  it("uses the canonical manual routing labels for Domestic and Custom notes", () => {
    expect(buildExportRoutingPresentation(note({
      shippingMode: "domestic_truck",
      domesticOrigin: "HCM",
      domesticDestination: "HAN",
    }))).toMatchObject({
      bill: null,
      origin: { label: "From", value: "HCM" },
      destination: { label: "To", value: "HAN" },
    });
    expect(buildExportRoutingPresentation(note({
      shippingMode: "custom",
      customModeName: "Rail",
      customOrigin: "HCM",
      customDestination: "HAN",
    }))).toMatchObject({
      bill: null,
      origin: { label: "From", value: "HCM" },
      destination: { label: "To", value: "HAN" },
      transport: [{ label: "Custom Mode", value: "Rail" }],
    });
  });
});

describe("export commodity and HS code presentation", () => {
  it("resolves separate Commodity and HS Code for current records", () => {
    const currentNote = note({
      commodity: "Frozen Seafood",
      hsCode: "0303.89",
      commodityHsCode: null,
    });

    expect(getExportCommodityValue(currentNote)).toBe("Frozen Seafood");
    expect(getExportHsCodeValue(currentNote)).toBe("0303.89");
  });

  it("preserves leading zeroes on HS Code text", () => {
    const leadingZeroNote = note({
      commodity: "Live horses",
      hsCode: "01012100",
    });

    expect(getExportHsCodeValue(leadingZeroNote)).toBe("01012100");
  });

  it("falls back to legacy commodityHsCode for Commodity and leaves HS Code blank", () => {
    const legacyNote = note({
      commodity: null,
      hsCode: null,
      commodityHsCode: "Steel coils / HS 7210.49",
    });

    expect(getExportCommodityValue(legacyNote)).toBe("Steel coils / HS 7210.49");
    expect(getExportHsCodeValue(legacyNote)).toBeNull();
  });
});

describe("mode-specific export fields and mode isolation", () => {
  it("extracts Sea fields and isolates from Air/Domestic metadata", () => {
    const seaNote = note({
      shippingMode: "sea_export",
      containerNo: "MSCU1234567",
      sealNo: "SL987654",
      carrierName: "Maersk",
      grossWeight: "18,500 KGS",
      // Irrelevant fields in DB
      chargeableWeight: "15000 KGS",
      licensePlate: "51C-999.99",
      driverInformation: "Le Van C",
      vehiclePayloadCapacity: "10 TONS",
    });

    const fields = getModeSpecificExportFields(seaNote);
    expect(fields).toEqual([
      { key: "containerNo", label: "Container No.", value: "MSCU1234567" },
      { key: "sealNo", label: "Seal No.", value: "SL987654" },
      { key: "carrierName", label: "Carrier Name", value: "Maersk" },
      { key: "grossWeight", label: "Gross Weight", value: "18,500 KGS" },
    ]);

    const keys = fields.map((f) => f.key);
    expect(keys).not.toContain("chargeableWeight");
    expect(keys).not.toContain("licensePlate");
    expect(keys).not.toContain("driverInformation");
    expect(keys).not.toContain("vehiclePayloadCapacity");
  });

  it("extracts Air fields and isolates from Sea/Domestic metadata", () => {
    const airNote = note({
      shippingMode: "air_export",
      chargeableWeight: "200 KGS",
      grossWeight: "180 KGS",
      // Irrelevant fields in DB
      containerNo: "MSCU1234567",
      sealNo: "SL987654",
      carrierName: "Maersk",
      licensePlate: "51C-123.45",
      driverInformation: "Nguyen Van A",
      vehiclePayloadCapacity: "5 TONS",
    });

    const fields = getModeSpecificExportFields(airNote);
    expect(fields).toEqual([
      { key: "chargeableWeight", label: "Chargeable Weight", value: "200 KGS" },
      { key: "grossWeight", label: "Gross Weight", value: "180 KGS" },
    ]);

    const keys = fields.map((f) => f.key);
    expect(keys).not.toContain("containerNo");
    expect(keys).not.toContain("sealNo");
    expect(keys).not.toContain("carrierName");
    expect(keys).not.toContain("licensePlate");
    expect(keys).not.toContain("driverInformation");
    expect(keys).not.toContain("vehiclePayloadCapacity");
  });

  it("extracts Domestic fields and isolates from Sea/Air metadata", () => {
    const driverInfo = "Nguyen Van A\nCCCD: 012345678901\nDOB: 1990-01-01";
    const domesticNote = note({
      shippingMode: "domestic_truck",
      licensePlate: "51C-123.45",
      driverInformation: driverInfo,
      vehiclePayloadCapacity: "5 TONS",
      // Irrelevant fields in DB
      containerNo: "MSCU1234567",
      sealNo: "SL987654",
      carrierName: "Maersk",
      chargeableWeight: "200 KGS",
      grossWeight: "180 KGS",
    });

    const fields = getModeSpecificExportFields(domesticNote);
    expect(fields).toEqual([
      { key: "licensePlate", label: "License Plate", value: "51C-123.45" },
      { key: "driverInformation", label: "Driver Information", value: driverInfo },
      {
        key: "vehiclePayloadCapacity",
        label: "Vehicle Payload Capacity",
        value: "5 TONS",
      },
    ]);

    const keys = fields.map((f) => f.key);
    expect(keys).not.toContain("containerNo");
    expect(keys).not.toContain("sealNo");
    expect(keys).not.toContain("carrierName");
    expect(keys).not.toContain("chargeableWeight");
    expect(keys).not.toContain("grossWeight");
  });

  it("returns no mode-specific metadata fields for Custom mode", () => {
    const customNote = note({
      shippingMode: "custom",
      customModeName: "Rail",
      // Extraneous fields
      containerNo: "MSCU1234567",
      grossWeight: "5000 KGS",
      licensePlate: "51C-123.45",
    });

    expect(getModeSpecificExportFields(customNote)).toEqual([]);
  });
});
