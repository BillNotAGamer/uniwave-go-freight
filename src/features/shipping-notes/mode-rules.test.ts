import { describe, expect, it } from "vitest";

import {
  canonicalizeShippingNoteModeFields,
  getShippingModeFieldRules,
  getShippingModePresentation,
  validateShippingNoteModeFields,
} from "./mode-rules";

const domestic = {
  shippingMode: "domestic_truck" as const,
  domesticOrigin: "HCM",
  domesticDestination: "DAD",
};

const air = {
  shippingMode: "air_export" as const,
  aol: "SGN",
  aod: "NRT",
  finalDestination: "Tokyo",
  mawbNo: "123-45678901",
  hawbNo: "HAWB-001",
  flightNo: "VN300",
  etd: new Date("2026-06-01T08:00:00Z"),
  eta: new Date("2026-06-01T14:00:00Z"),
};

const sea = {
  shippingMode: "sea_export" as const,
  portOfLoading: "VNSGN",
  portOfDischarge: "NLRTM",
  finalDestination: "Rotterdam",
  mblNo: "MBL-001",
  hblNo: "HBL-001",
  vesselName: "Pacific Dawn",
  voyageNo: "PD-26",
  etd: new Date("2026-06-01T08:00:00Z"),
  eta: new Date("2026-06-20T14:00:00Z"),
};

const custom = {
  shippingMode: "custom" as const,
  customModeName: "Rail",
  customOrigin: "HCM",
  customDestination: "Phnom Penh",
};

describe("C6 Shipping Note mode rules", () => {
  it("maps all persisted modes and fails closed for an unknown value", () => {
    expect(getShippingModePresentation("domestic_truck").family).toBe("domestic");
    expect(getShippingModePresentation("air_export").family).toBe("air");
    expect(getShippingModePresentation("air_import").family).toBe("air");
    expect(getShippingModePresentation("sea_export").family).toBe("sea");
    expect(getShippingModePresentation("sea_import").family).toBe("sea");
    expect(getShippingModePresentation("custom").family).toBe("custom");
    expect(() => getShippingModePresentation("rail" as never)).toThrow("Unknown Shipping Mode");
  });

  it("requires exactly the approved active-mode fields", () => {
    expect(validateShippingNoteModeFields(domestic)).toEqual([]);
    expect(validateShippingNoteModeFields(air)).toEqual([]);
    expect(validateShippingNoteModeFields(sea)).toEqual([]);
    expect(validateShippingNoteModeFields(custom)).toEqual([]);
    expect(validateShippingNoteModeFields({ ...custom, customModeName: " " })[0]?.path).toBe("customModeName");

    for (const field of getShippingModeFieldRules("air_export").requiredTextFields) {
      const invalid = { ...air, [field.name]: "   " };
      expect(validateShippingNoteModeFields(invalid).map((issue) => issue.path)).toContain(field.name);
    }
    for (const field of getShippingModeFieldRules("sea_export").requiredTextFields) {
      const invalid = { ...sea, [field.name]: undefined };
      expect(validateShippingNoteModeFields(invalid).map((issue) => issue.path)).toContain(field.name);
    }
    expect(validateShippingNoteModeFields({ ...domestic, domesticOrigin: " " })[0]?.path).toBe("domesticOrigin");
    expect(validateShippingNoteModeFields({ ...domestic, domesticDestination: undefined })[0]?.path).toBe("domesticDestination");
    expect(validateShippingNoteModeFields({ ...air, etd: undefined }).map((issue) => issue.path)).toContain("etd");
    expect(validateShippingNoteModeFields({ ...sea, eta: undefined }).map((issue) => issue.path)).toContain("eta");
  });

  it("clears inactive Domestic fields", () => {
    const canonical = canonicalizeShippingNoteModeFields({
      ...domestic,
      ...air,
      ...sea,
      shippingMode: "domestic_truck" as const,
    });

    expect(canonical).toMatchObject(domestic);
    expect(canonical).toMatchObject({
      aol: undefined,
      aod: undefined,
      portOfLoading: undefined,
      portOfDischarge: undefined,
      finalDestination: undefined,
      mawbNo: undefined,
      hawbNo: undefined,
      mblNo: undefined,
      hblNo: undefined,
      flightNo: undefined,
      vesselName: undefined,
      voyageNo: undefined,
    });
  });

  it("keeps Air fields while clearing Domestic and Sea fields", () => {
    const canonical = canonicalizeShippingNoteModeFields({ ...domestic, ...sea, ...air, shippingMode: "air_export" as const });

    expect(canonical).toMatchObject(air);
    expect(canonical).toMatchObject({
      domesticOrigin: undefined,
      domesticDestination: undefined,
      portOfLoading: undefined,
      portOfDischarge: undefined,
      mblNo: undefined,
      hblNo: undefined,
      vesselName: undefined,
      voyageNo: undefined,
    });
  });

  it("keeps Sea fields while clearing Domestic and Air fields", () => {
    const canonical = canonicalizeShippingNoteModeFields({ ...domestic, ...air, ...sea, shippingMode: "sea_export" as const });

    expect(canonical).toMatchObject(sea);
    expect(canonical).toMatchObject({
      domesticOrigin: undefined,
      domesticDestination: undefined,
      aol: undefined,
      aod: undefined,
      mawbNo: undefined,
      hawbNo: undefined,
      flightNo: undefined,
    });
  });

  it("clears transport-family values for Custom and clears Custom values for existing modes", () => {
    const customCanonical = canonicalizeShippingNoteModeFields({
      ...domestic, ...air, ...sea, ...custom, shippingMode: "custom" as const,
    });
    expect(customCanonical).toMatchObject(custom);
    expect(customCanonical).toMatchObject({
      domesticOrigin: undefined, domesticDestination: undefined,
      aol: undefined, aod: undefined, portOfLoading: undefined, portOfDischarge: undefined,
      finalDestination: undefined, mawbNo: undefined, hawbNo: undefined, flightNo: undefined,
      mblNo: undefined, hblNo: undefined, vesselName: undefined, voyageNo: undefined,
    });

    for (const shippingMode of ["domestic_truck", "air_export", "sea_export"] as const) {
      const canonical = canonicalizeShippingNoteModeFields({
        ...domestic, ...air, ...sea, ...custom, shippingMode,
      });
      expect(canonical.customModeName).toBeUndefined();
      expect(canonical.customOrigin).toBeUndefined();
      expect(canonical.customDestination).toBeUndefined();
    }
  });
});
