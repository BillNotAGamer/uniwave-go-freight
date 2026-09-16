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
    expect(internalShippingNoteExportNoteSelect.flightNo).toBe(shippingNotes.flightNo);
  });
});
