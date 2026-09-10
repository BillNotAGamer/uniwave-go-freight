import { describe, expect, it } from "vitest";

import {
  getShippingNoteCreateModeFields,
  SHIPPING_NOTE_PARTY_SELECTOR_FIELDS,
} from "./shipping-note-create-fields";
import { getShippingModeFieldRules } from "../mode-rules";

function names(fields: { name: string }[]) {
  return fields.map((field) => field.name);
}

describe("Shipping Note create field presentation", () => {
  it("submits explicit C4 Partner IDs while retaining separate legacy text fallback names", () => {
    expect(SHIPPING_NOTE_PARTY_SELECTOR_FIELDS).toEqual([
      { label: "Shipper", partnerFieldName: "shipperPartnerId", textFieldName: "shipperText" },
      { label: "Consignee", partnerFieldName: "consigneePartnerId", textFieldName: "consigneeText" },
      { label: "Customer", partnerFieldName: "customerPartnerId", textFieldName: "customerText" },
      { label: "Agent", partnerFieldName: "agentPartnerId", textFieldName: "agentText" },
    ]);
  });

  it("shows only domestic routing fields and no transport-document fields", () => {
    const fields = getShippingNoteCreateModeFields("domestic");
    expect(names(fields.routing)).toEqual([
      "domesticOrigin",
      "domesticDestination",
    ]);
    expect(fields.routing.map((field) => field.label)).toEqual(["From", "To"]);
    expect(fields.transport).toEqual([]);
  });

  it("maps air routing and transport fields to the C4 action names", () => {
    const fields = getShippingNoteCreateModeFields("air");
    expect(names(fields.routing)).toEqual([
      "aol",
      "aod",
      "finalDestination",
    ]);
    expect(fields.routing.map((field) => field.label)).toEqual(["AOL", "AOD", "Final Destination"]);
    expect(names(fields.transport)).toEqual([
      "mawbNo",
      "hawbNo",
      "flightNo",
    ]);
  });

  it("maps sea routing and transport fields to the C4 action names", () => {
    const fields = getShippingNoteCreateModeFields("sea");
    expect(names(fields.routing)).toEqual([
      "portOfLoading",
      "portOfDischarge",
      "finalDestination",
    ]);
    expect(fields.routing.map((field) => field.label)).toEqual(["POL", "POD", "Final Destination"]);
    expect(names(fields.transport)).toEqual([
      "mblNo",
      "hblNo",
      "vesselName",
      "voyageNo",
    ]);
  });

  it("maps Custom to only optional neutral routing fields", () => {
    const fields = getShippingNoteCreateModeFields("custom");
    expect(fields.routing).toEqual([
      { name: "customOrigin", label: "From" },
      { name: "customDestination", label: "To" },
    ]);
    expect(fields.transport).toEqual([]);
  });

  it("keeps every active-mode text requirement visible in the C5 configuration", () => {
    for (const [family, mode] of [
      ["domestic", "domestic_truck"],
      ["air", "air_export"],
      ["sea", "sea_export"],
    ] as const) {
      const fields = getShippingNoteCreateModeFields(family);
      const visibleNames = names([...fields.routing, ...fields.transport]);
      const requiredNames = getShippingModeFieldRules(mode).requiredTextFields.map(
        (field) => field.name,
      );

      expect(visibleNames).toEqual(requiredNames);
    }
  });
});
