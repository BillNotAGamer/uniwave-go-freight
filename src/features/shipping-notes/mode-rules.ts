import { type ShippingMode } from "./constants";

export type ShippingModeFamily = "domestic" | "air" | "sea" | "custom";
export type EditShipmentFamily = "ocean" | "air" | "domestic" | "custom";
export type ShipmentDirection = "export" | "import";

export type EditShipmentModePresentation = {
  shipmentFamily: EditShipmentFamily;
  direction: ShipmentDirection | null;
};

export type ShippingNoteModeTextField =
  | "domesticOrigin"
  | "domesticDestination"
  | "customModeName"
  | "customOrigin"
  | "customDestination"
  | "aol"
  | "aod"
  | "portOfLoading"
  | "portOfDischarge"
  | "finalDestination"
  | "mawbNo"
  | "hawbNo"
  | "mblNo"
  | "hblNo"
  | "flightNo"
  | "vesselName"
  | "voyageNo";

export type ShippingNoteModeInput = {
  shippingMode: ShippingMode;
  domesticOrigin?: string;
  domesticDestination?: string;
  customModeName?: string;
  customOrigin?: string;
  customDestination?: string;
  /** Legacy action aliases that normalize into AOL/AOD before persistence. */
  airOrigin?: string;
  airDestination?: string;
  aol?: string;
  aod?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  finalDestination?: string;
  mawbNo?: string;
  hawbNo?: string;
  mblNo?: string;
  hblNo?: string;
  flightNo?: string;
  vesselName?: string;
  voyageNo?: string;
  etd?: Date;
  eta?: Date;
};

export type ShippingNoteModeField = {
  name: ShippingNoteModeTextField;
  label: string;
};

export type ShippingNoteModeFieldRules = {
  family: ShippingModeFamily;
  routingFields: ShippingNoteModeField[];
  transportFields: ShippingNoteModeField[];
  requiredTextFields: ShippingNoteModeField[];
  requiredDateFields: Array<{ name: "etd" | "eta"; label: string }>;
  inactiveTextFields: ShippingNoteModeTextField[];
};

const DOMESTIC_RULES: ShippingNoteModeFieldRules = {
  family: "domestic",
  routingFields: [
    { name: "domesticOrigin", label: "From" },
    { name: "domesticDestination", label: "To" },
  ],
  transportFields: [],
  requiredTextFields: [
    { name: "domesticOrigin", label: "From" },
    { name: "domesticDestination", label: "To" },
  ],
  requiredDateFields: [],
  inactiveTextFields: [
    "aol",
    "aod",
    "portOfLoading",
    "portOfDischarge",
    "finalDestination",
    "mawbNo",
    "hawbNo",
    "mblNo",
    "hblNo",
    "flightNo",
    "vesselName",
    "voyageNo",
    "customModeName",
    "customOrigin",
    "customDestination",
  ],
};

const AIR_RULES: ShippingNoteModeFieldRules = {
  family: "air",
  routingFields: [
    { name: "aol", label: "AOL" },
    { name: "aod", label: "AOD" },
    { name: "finalDestination", label: "Final Destination" },
  ],
  transportFields: [
    { name: "mawbNo", label: "MAWB" },
    { name: "hawbNo", label: "HAWB" },
    { name: "flightNo", label: "Flight No" },
  ],
  requiredTextFields: [
    { name: "aol", label: "AOL" },
    { name: "aod", label: "AOD" },
    { name: "finalDestination", label: "Final Destination" },
    { name: "mawbNo", label: "MAWB" },
    { name: "hawbNo", label: "HAWB" },
    { name: "flightNo", label: "Flight No" },
  ],
  requiredDateFields: [
    { name: "etd", label: "ETD" },
    { name: "eta", label: "ETA" },
  ],
  inactiveTextFields: [
    "domesticOrigin",
    "domesticDestination",
    "portOfLoading",
    "portOfDischarge",
    "mblNo",
    "hblNo",
    "vesselName",
    "voyageNo",
    "customModeName",
    "customOrigin",
    "customDestination",
  ],
};

const SEA_RULES: ShippingNoteModeFieldRules = {
  family: "sea",
  routingFields: [
    { name: "portOfLoading", label: "POL" },
    { name: "portOfDischarge", label: "POD" },
    { name: "finalDestination", label: "Final Destination" },
  ],
  transportFields: [
    { name: "mblNo", label: "MBL" },
    { name: "hblNo", label: "HBL" },
    { name: "vesselName", label: "Vessel" },
    { name: "voyageNo", label: "Voyage" },
  ],
  requiredTextFields: [
    { name: "portOfLoading", label: "POL" },
    { name: "portOfDischarge", label: "POD" },
    { name: "finalDestination", label: "Final Destination" },
    { name: "mblNo", label: "MBL" },
    { name: "hblNo", label: "HBL" },
    { name: "vesselName", label: "Vessel" },
    { name: "voyageNo", label: "Voyage" },
  ],
  requiredDateFields: [
    { name: "etd", label: "ETD" },
    { name: "eta", label: "ETA" },
  ],
  inactiveTextFields: [
    "domesticOrigin",
    "domesticDestination",
    "aol",
    "aod",
    "mawbNo",
    "hawbNo",
    "flightNo",
    "customModeName",
    "customOrigin",
    "customDestination",
  ],
};

const CUSTOM_RULES: ShippingNoteModeFieldRules = {
  family: "custom",
  routingFields: [
    { name: "customOrigin", label: "From" },
    { name: "customDestination", label: "To" },
  ],
  transportFields: [],
  requiredTextFields: [{ name: "customModeName", label: "Mode" }],
  requiredDateFields: [],
  inactiveTextFields: [
    "domesticOrigin",
    "domesticDestination",
    "aol",
    "aod",
    "portOfLoading",
    "portOfDischarge",
    "finalDestination",
    "mawbNo",
    "hawbNo",
    "mblNo",
    "hblNo",
    "flightNo",
    "vesselName",
    "voyageNo",
  ],
};

const RULES_BY_FAMILY: Record<ShippingModeFamily, ShippingNoteModeFieldRules> = {
  domestic: DOMESTIC_RULES,
  air: AIR_RULES,
  sea: SEA_RULES,
  custom: CUSTOM_RULES,
};

export const SHIPPING_MODE_PRESENTATION: Record<
  ShippingMode,
  { label: string; family: ShippingModeFamily }
> = {
  domestic_truck: { label: "Domestic", family: "domestic" },
  sea_export: { label: "Ocean Export", family: "sea" },
  sea_import: { label: "Ocean Import", family: "sea" },
  air_export: { label: "Air Export", family: "air" },
  air_import: { label: "Air Import", family: "air" },
  custom: { label: "Custom", family: "custom" },
};

export function getShippingModePresentation(mode: ShippingMode) {
  const presentation = SHIPPING_MODE_PRESENTATION[mode];
  if (!presentation) {
    throw new Error("Unknown Shipping Mode.");
  }

  return presentation;
}

/**
 * Maps persisted transport modes to the compact, user-facing edit controls.
 * Persistence continues to use the shipping_mode enum values.
 */
export function getEditShipmentModePresentation(
  mode: ShippingMode,
): EditShipmentModePresentation {
  switch (mode) {
    case "sea_export":
      return { shipmentFamily: "ocean", direction: "export" };
    case "sea_import":
      return { shipmentFamily: "ocean", direction: "import" };
    case "air_export":
      return { shipmentFamily: "air", direction: "export" };
    case "air_import":
      return { shipmentFamily: "air", direction: "import" };
    case "domestic_truck":
      return { shipmentFamily: "domestic", direction: null };
    case "custom":
      return { shipmentFamily: "custom", direction: null };
  }
}

export function getShippingModeFromEditSelection(
  shipmentFamily: EditShipmentFamily,
  direction: ShipmentDirection | null,
): ShippingMode {
  if (shipmentFamily === "domestic") {
    return "domestic_truck";
  }

  if (shipmentFamily === "custom") {
    return "custom";
  }

  const selectedDirection = direction ?? "export";

  if (shipmentFamily === "ocean") {
    return selectedDirection === "export" ? "sea_export" : "sea_import";
  }

  return selectedDirection === "export" ? "air_export" : "air_import";
}

export function getShippingModeFieldRules(mode: ShippingMode): ShippingNoteModeFieldRules {
  return getShippingModeFieldRulesForFamily(getShippingModePresentation(mode).family);
}

export function getShippingModeFieldRulesForFamily(
  family: ShippingModeFamily,
): ShippingNoteModeFieldRules {
  return RULES_BY_FAMILY[family];
}

export function canonicalizeShippingNoteModeFields<T extends ShippingNoteModeInput>(
  input: T,
): T {
  const rules = getShippingModeFieldRules(input.shippingMode);
  const canonical = {
    ...input,
    // C4 accepted legacy action aliases; persistence is canonical AOL/AOD.
    aol: input.aol ?? input.airOrigin,
    aod: input.aod ?? input.airDestination,
    airOrigin: undefined,
    airDestination: undefined,
  } as T;

  for (const field of rules.inactiveTextFields) {
    canonical[field] = undefined;
  }

  return canonical;
}

export type ShippingNoteModeValidationIssue = {
  path: ShippingNoteModeTextField | "etd" | "eta";
  message: string;
};

export function validateShippingNoteModeFields(
  input: ShippingNoteModeInput,
): ShippingNoteModeValidationIssue[] {
  const rules = getShippingModeFieldRules(input.shippingMode);
  const issues: ShippingNoteModeValidationIssue[] = [];

  for (const field of rules.requiredTextFields) {
    if (!input[field.name]?.trim()) {
      issues.push({ path: field.name, message: `${field.label} is required.` });
    }
  }

  for (const field of rules.requiredDateFields) {
    if (!input[field.name]) {
      issues.push({ path: field.name, message: `${field.label} is required.` });
    }
  }

  return issues;
}

export function assertValidShippingNoteModeFields(input: ShippingNoteModeInput): void {
  const [firstIssue] = validateShippingNoteModeFields(input);
  if (firstIssue) {
    throw new Error(firstIssue.message);
  }
}
