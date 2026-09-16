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
