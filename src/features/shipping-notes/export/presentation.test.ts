import { describe, expect, it } from "vitest";

import { buildExportRoutingPresentation } from "./presentation";
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
