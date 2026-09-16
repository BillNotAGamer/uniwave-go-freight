import { getShippingModePresentation } from "../mode-rules";
import { formatMawbHawb } from "../presentation";
import type { InternalShippingNoteExportDto } from "./types";

type ExportNote = InternalShippingNoteExportDto["note"];

export type ExportPresentationField = {
  label: string;
  value: string | null | undefined;
};

export type ExportRoutingPresentation = {
  bill: ExportPresentationField | null;
  origin: ExportPresentationField;
  destination: ExportPresentationField;
  finalDestination: ExportPresentationField | null;
  transport: ExportPresentationField[];
};

function formatMblHbl(note: ExportNote): string {
  const values = [note.mblNo, note.hblNo]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return values.join(" / ") || "-";
}

export function buildExportRoutingPresentation(
  note: ExportNote,
): ExportRoutingPresentation {
  switch (getShippingModePresentation(note.shippingMode).family) {
    case "air":
      return {
        bill: { label: "MAWB / HAWB", value: formatMawbHawb(note) },
        origin: { label: "AOL", value: note.aol },
        destination: { label: "AOD", value: note.aod },
        finalDestination: { label: "Final Destination", value: note.finalDestination },
        transport: [{ label: "Flight No", value: note.flightNo }],
      };
    case "sea":
      return {
        bill: { label: "MBL / HBL", value: formatMblHbl(note) },
        origin: { label: "POL", value: note.portOfLoading },
        destination: { label: "POD", value: note.portOfDischarge },
        finalDestination: { label: "Final Destination", value: note.finalDestination },
        transport: [
          { label: "Vessel", value: note.vesselName },
          { label: "Voyage", value: note.voyageNo },
        ],
      };
    case "domestic":
      return {
        bill: null,
        origin: { label: "From", value: note.domesticOrigin },
        destination: { label: "To", value: note.domesticDestination },
        finalDestination: null,
        transport: [],
      };
    case "custom":
      return {
        bill: null,
        origin: { label: "From", value: note.customOrigin },
        destination: { label: "To", value: note.customDestination },
        finalDestination: null,
        transport: [{ label: "Custom Mode", value: note.customModeName }],
      };
  }
}

/**
 * Resolves the canonical Commodity display value.
 * For modern records: note.commodity.
 * For legacy records: falls back to note.commodityHsCode without delimiter guessing or splitting.
 */
export function getExportCommodityValue(
  note: ExportNote,
): string | null | undefined {
  if (note.commodity !== undefined && note.commodity !== null) {
    const trimmed = note.commodity.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (note.commodityHsCode !== undefined && note.commodityHsCode !== null) {
    const trimmed = note.commodityHsCode.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Resolves the canonical HS Code display value.
 * Must remain note.hsCode ONLY. Never fabricated or parsed from legacy commodityHsCode.
 * Preserves leading zeroes by returning exact text string.
 */
export function getExportHsCodeValue(
  note: ExportNote,
): string | null | undefined {
  if (note.hsCode !== undefined && note.hsCode !== null) {
    const trimmed = note.hsCode.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

export type ModeSpecificExportField = {
  key: string;
  label: string;
  value: string | null | undefined;
};

/**
 * Returns mode-specific operational metadata fields for export presentation.
 * Strictly enforces mode isolation based on the shipping mode family:
 * - Sea: Container No., Seal No., Carrier Name, Gross Weight
 * - Air: Chargeable Weight, Gross Weight
 * - Domestic: License Plate, Driver Information, Vehicle Payload Capacity
 * - Custom: []
 */
export function getModeSpecificExportFields(
  note: ExportNote,
): ModeSpecificExportField[] {
  const family = getShippingModePresentation(note.shippingMode).family;

  switch (family) {
    case "sea":
      return [
        { key: "containerNo", label: "Container No.", value: note.containerNo },
        { key: "sealNo", label: "Seal No.", value: note.sealNo },
        { key: "carrierName", label: "Carrier Name", value: note.carrierName },
        { key: "grossWeight", label: "Gross Weight", value: note.grossWeight },
      ];
    case "air":
      return [
        {
          key: "chargeableWeight",
          label: "Chargeable Weight",
          value: note.chargeableWeight,
        },
        { key: "grossWeight", label: "Gross Weight", value: note.grossWeight },
      ];
    case "domestic":
      return [
        { key: "licensePlate", label: "License Plate", value: note.licensePlate },
        {
          key: "driverInformation",
          label: "Driver Information",
          value: note.driverInformation,
        },
        {
          key: "vehiclePayloadCapacity",
          label: "Vehicle Payload Capacity",
          value: note.vehiclePayloadCapacity,
        },
      ];
    case "custom":
      return [];
  }
}
