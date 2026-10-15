import { describe, expect, it } from "vitest";

import type { User } from "@/lib/db/schema";

import { SHIPPING_MODES, type ShippingMode } from "./constants";
import {
  buildShippingNoteDuplicationDraft,
  canDuplicateShippingNote,
} from "./duplication";
import type { ShippingNoteDetail } from "./types";
import { duplicateShippingNoteInputSchema } from "./validators";

const now = new Date("2026-10-01T00:00:00.000Z");

function makeSource(mode: ShippingMode = "sea_export"): ShippingNoteDetail {
  return {
    id: "source-1",
    jobsheetNo: "SOURCE-001",
    shippingMode: mode,
    customModeName: "Rail Charter",
    shipperText: "Frozen Shipper",
    consigneeText: "Frozen Consignee",
    customerText: "Frozen Customer",
    agentText: "Frozen Agent",
    status: "approved",
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    createdById: "sale-1",
    shipperPartnerId: "partner-active",
    consigneePartnerId: "partner-inactive",
    customerPartnerId: "partner-deleted",
    agentPartnerId: "partner-missing",
    commodityHsCode: "Legacy cargo / 0000",
    commodity: "Precision bearings",
    hsCode: "8482.10.00",
    containerType: "40_dry_high",
    containerNo: "MSCU1234567",
    sealNo: "SEAL-1",
    carrierName: "Carrier",
    grossWeight: "12000 KGS",
    chargeableWeight: "450 KGS",
    licensePlate: "51C-123.45",
    driverInformation: "Driver A",
    vehiclePayloadCapacity: "5 TONS",
    mawbHawbNo: "LEGACY-AWB",
    domesticOrigin: "Warehouse A",
    domesticDestination: "Warehouse B",
    customOrigin: "Origin X",
    customDestination: "Destination Y",
    airOrigin: "SGN",
    airDestination: "LAX",
    aol: "SGN",
    aod: "LAX",
    portOfLoading: "VNSGN",
    portOfDischarge: "USLAX",
    finalDestination: "Los Angeles",
    mawbNo: "081-12345678",
    hawbNo: "HAWB-1",
    mblNo: "MBL-1",
    hblNo: "HBL-1",
    flightNo: "VN001",
    vesselName: "Ocean Express",
    voyageNo: "VOY-1",
    etd: now,
    eta: now,
    volumeValue: "12.50",
    volumeUnit: "cbm",
    exchangeRate: "25450.25",
  };
}

const partners = [
  {
    id: "partner-active",
    companyName: "Current Shipper Name",
    isActive: true,
    deletedAt: null,
  },
  {
    id: "partner-inactive",
    companyName: "Inactive Consignee",
    isActive: false,
    deletedAt: null,
  },
  {
    id: "partner-deleted",
    companyName: "Deleted Customer",
    isActive: true,
    deletedAt: now,
  },
];

describe("Shipping Note duplication policy", () => {
  it.each([
    ["admin", "admin-1", true],
    ["sale", "sale-1", true],
    ["sale", "sale-2", false],
    ["ops", "sale-1", true],
    ["ops", "ops-2", false],
    ["accountant", "sale-1", false],
  ] satisfies Array<[User["role"], string, boolean]>) (
    "%s actor ownership policy returns %s",
    (role, id, expected) => {
      expect(canDuplicateShippingNote(makeSource(), { id, role })).toBe(expected);
    },
  );

  it.each(["draft", "checked", "approved", "locked", "cancelled"] as const)(
    "does not make %s status an eligibility gate",
    (status) => {
      const source = makeSource();
      source.status = status;
      expect(canDuplicateShippingNote(source, { id: "sale-1", role: "sale" })).toBe(true);
    },
  );
});

describe("Shipping Note duplication field mapping", () => {
  it.each(SHIPPING_MODES)("canonicalizes copied %s fields", (mode) => {
    const { input } = buildShippingNoteDuplicationDraft(
      makeSource(mode),
      " copy  001 ",
      partners,
    );

    expect(input.jobsheetNo).toBe("COPY 001");
    expect(input.shippingMode).toBe(mode);
    expect(input.exchangeRate).toBeUndefined();
    expect(input.commodity).toBe("Precision bearings");
    expect(input.hsCode).toBe("8482.10.00");
    expect(input.commodityHsCode).toBe("Legacy cargo / 0000");

    if (mode.startsWith("air_")) {
      expect(input.aol).toBe("SGN");
      expect(input.mawbNo).toBe("081-12345678");
      expect(input.portOfLoading).toBeUndefined();
    } else if (mode.startsWith("sea_")) {
      expect(input.portOfLoading).toBe("VNSGN");
      expect(input.mblNo).toBe("MBL-1");
      expect(input.aol).toBeUndefined();
    } else if (mode === "domestic_truck") {
      expect(input.domesticOrigin).toBe("Warehouse A");
      expect(input.licensePlate).toBe("51C-123.45");
      expect(input.portOfLoading).toBeUndefined();
    } else {
      expect(input.customModeName).toBe("Rail Charter");
      expect(input.customOrigin).toBe("Origin X");
      expect(input.portOfLoading).toBeUndefined();
    }
  });

  it("keeps active Partner references and falls back to frozen text for stale references", () => {
    const { partyPersistence } = buildShippingNoteDuplicationDraft(
      makeSource(),
      "COPY-002",
      partners,
    );

    expect(partyPersistence).toEqual({
      shipperPartnerId: "partner-active",
      shipperText: "Current Shipper Name",
      consigneePartnerId: null,
      consigneeText: "Frozen Consignee",
      customerPartnerId: null,
      customerText: "Frozen Customer",
      agentPartnerId: null,
      agentText: "Frozen Agent",
    });
  });
});

describe("duplicateShippingNoteInputSchema", () => {
  it("uses normal Jobsheet normalization", () => {
    expect(
      duplicateShippingNoteInputSchema.parse({
        sourceId: " source-1 ",
        newJobsheetNo: " copy   003 ",
      }),
    ).toEqual({ sourceId: "source-1", newJobsheetNo: "COPY 003" });
  });

  it("rejects an empty Jobsheet No", () => {
    expect(
      duplicateShippingNoteInputSchema.safeParse({
        sourceId: "source-1",
        newJobsheetNo: "   ",
      }).success,
    ).toBe(false);
  });
});
