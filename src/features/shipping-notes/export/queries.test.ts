import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: {} }));

import { shippingNotes } from "@/lib/db/schema";

import { internalShippingNoteExportNoteSelect } from "./queries";

describe("internal export note projection", () => {
  it("projects modern MAWB and HAWB fields alongside the legacy fallback", () => {
    expect(internalShippingNoteExportNoteSelect.mawbNo).toBe(shippingNotes.mawbNo);
    expect(internalShippingNoteExportNoteSelect.hawbNo).toBe(shippingNotes.hawbNo);
    expect(internalShippingNoteExportNoteSelect.mawbHawbNo).toBe(
      shippingNotes.mawbHawbNo,
    );
  });

  it("projects canonical mode-aware routing, commodity, and operational fields", () => {
    expect(internalShippingNoteExportNoteSelect.portOfLoading).toBe(
      shippingNotes.portOfLoading,
    );
    expect(internalShippingNoteExportNoteSelect.portOfDischarge).toBe(
      shippingNotes.portOfDischarge,
    );
    expect(internalShippingNoteExportNoteSelect.mblNo).toBe(shippingNotes.mblNo);
    expect(internalShippingNoteExportNoteSelect.hblNo).toBe(shippingNotes.hblNo);
    expect(internalShippingNoteExportNoteSelect.vesselName).toBe(
      shippingNotes.vesselName,
    );
    expect(internalShippingNoteExportNoteSelect.voyageNo).toBe(shippingNotes.voyageNo);
    expect(internalShippingNoteExportNoteSelect.domesticOrigin).toBe(
      shippingNotes.domesticOrigin,
    );
    expect(internalShippingNoteExportNoteSelect.domesticDestination).toBe(
      shippingNotes.domesticDestination,
    );
    expect(internalShippingNoteExportNoteSelect.commodityHsCode).toBe(
      shippingNotes.commodityHsCode,
    );
    expect(internalShippingNoteExportNoteSelect.commodity).toBe(
      shippingNotes.commodity,
    );
    expect(internalShippingNoteExportNoteSelect.hsCode).toBe(
      shippingNotes.hsCode,
    );
    expect(internalShippingNoteExportNoteSelect.containerNo).toBe(
      shippingNotes.containerNo,
    );
    expect(internalShippingNoteExportNoteSelect.sealNo).toBe(
      shippingNotes.sealNo,
    );
    expect(internalShippingNoteExportNoteSelect.carrierName).toBe(
      shippingNotes.carrierName,
    );
    expect(internalShippingNoteExportNoteSelect.grossWeight).toBe(
      shippingNotes.grossWeight,
    );
    expect(internalShippingNoteExportNoteSelect.chargeableWeight).toBe(
      shippingNotes.chargeableWeight,
    );
    expect(internalShippingNoteExportNoteSelect.licensePlate).toBe(
      shippingNotes.licensePlate,
    );
    expect(internalShippingNoteExportNoteSelect.driverInformation).toBe(
      shippingNotes.driverInformation,
    );
    expect(internalShippingNoteExportNoteSelect.vehiclePayloadCapacity).toBe(
      shippingNotes.vehiclePayloadCapacity,
    );
    expect(internalShippingNoteExportNoteSelect.flightNo).toBe(shippingNotes.flightNo);
  });
});
