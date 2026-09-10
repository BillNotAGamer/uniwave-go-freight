import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  transaction: vi.fn(),
  getShippingNoteById: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.dbSelect,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("./queries", () => ({
  getShippingNoteById: mocks.getShippingNoteById,
  getShippingNoteForUser: vi.fn(),
  shippingNoteDetailSelect: { id: "id" },
}));

import type { User } from "@/lib/db/schema";
import {
  createShippingNoteDraft,
  submitShippingNote,
  updateShippingNoteDraft,
} from "./mutations";
import {
  shippingNoteDraftInputSchema,
  updateShippingNoteDraftInputSchema,
} from "./validators";

function saleUser(): User {
  return {
    id: "sale-1",
    email: "sale@example.test",
    name: "Sale User",
    image: null,
    emailVerified: true,
    role: "sale",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };
}

function configureTransaction(partners: Array<Record<string, unknown>> = []) {
  let insertedValues: Record<string, unknown> | undefined;
  let updatedValues: Record<string, unknown> | undefined;

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(partners),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        insertedValues = values;
        return {
          returning: vi.fn().mockResolvedValue([{ id: "note-1", ...values }]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updatedValues = values;
        return {
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "note-1", ...values }]),
          })),
        };
      }),
    })),
  };

  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  return {
    tx,
    insertedValues: () => insertedValues,
    updatedValues: () => updatedValues,
  };
}

function configureUniqueJobsheetCheck(): void {
  mocks.dbSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([]),
      })),
    })),
  });
}

function domesticDraft(overrides: Record<string, unknown> = {}) {
  return shippingNoteDraftInputSchema.parse({
    jobsheetNo: "DOM-001",
    shippingMode: "domestic_truck",
    domesticOrigin: "HCM",
    domesticDestination: "DAD",
    ...overrides,
  });
}

function airDraft(overrides: Record<string, unknown> = {}) {
  return shippingNoteDraftInputSchema.parse({
    jobsheetNo: "AIR-001",
    shippingMode: "air_export",
    aol: "SGN",
    aod: "NRT",
    finalDestination: "Tokyo",
    mawbNo: "123-45678901",
    hawbNo: "HAWB-001",
    flightNo: "VN300",
    etd: "2026-06-01T08:00:00Z",
    eta: "2026-06-01T14:00:00Z",
    ...overrides,
  });
}

function seaDraft(overrides: Record<string, unknown> = {}) {
  return shippingNoteDraftInputSchema.parse({
    jobsheetNo: "SEA-001",
    shippingMode: "sea_export",
    portOfLoading: "VNSGN",
    portOfDischarge: "NLRTM",
    finalDestination: "Rotterdam",
    mblNo: "MBL-001",
    hblNo: "HBL-001",
    vesselName: "Pacific Dawn",
    voyageNo: "PD-26",
    etd: "2026-06-01T08:00:00Z",
    eta: "2026-06-20T14:00:00Z",
    ...overrides,
  });
}

function draftRecord(id: string, jobsheetNo: string) {
  return {
    id,
    jobsheetNo,
    status: "draft" as const,
    createdById: "sale-1",
  };
}

describe("C4/C6 Shipping Note draft persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureUniqueJobsheetCheck();
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("keeps legacy text-only create callers valid", async () => {
    const configured = configureTransaction();
    const input = shippingNoteDraftInputSchema.parse({
      jobsheetNo: "C4-LEGACY",
      shippingMode: "domestic_truck",
      shipperText: "Legacy Shipper",
      consigneeText: "Legacy Consignee",
      domesticOrigin: "HCM",
      domesticDestination: "DAD",
    });

    await createShippingNoteDraft(input, saleUser());

    expect(configured.tx.select).not.toHaveBeenCalled();
    expect(configured.insertedValues()).toMatchObject({
      shippingMode: "domestic_truck",
      createdById: "sale-1",
      shipperPartnerId: null,
      shipperText: "Legacy Shipper",
      consigneePartnerId: null,
      consigneeText: "Legacy Consignee",
      domesticOrigin: "HCM",
      domesticDestination: "DAD",
      aol: null,
      aod: null,
      portOfLoading: null,
      portOfDischarge: null,
      finalDestination: null,
      mawbNo: null,
      hawbNo: null,
      mblNo: null,
      hblNo: null,
      flightNo: null,
      vesselName: null,
      voyageNo: null,
    });
  });

  it("persists the explicit Partner FK and server-derived frozen snapshot", async () => {
    const configured = configureTransaction([{
      id: "partner-alpha",
      companyName: "Alpha Logistics",
      isActive: true,
      deletedAt: null,
    }]);
    const input = shippingNoteDraftInputSchema.parse({
      jobsheetNo: "C4-PARTNER",
      shippingMode: "air_export",
      shipperPartnerId: "partner-alpha",
      shipperText: "Wrong Company",
      aol: "SGN",
      aod: "NRT",
      finalDestination: "Tokyo",
      mawbNo: "123-45678901",
      hawbNo: "HAWB-1",
      flightNo: "VN300",
      etd: "2026-06-01T08:00:00Z",
      eta: "2026-06-01T14:00:00Z",
    });

    await createShippingNoteDraft(input, saleUser());

    expect(configured.insertedValues()).toMatchObject({
      shippingMode: "air_export",
      shipperPartnerId: "partner-alpha",
      shipperText: "Alpha Logistics",
      domesticOrigin: null,
      domesticDestination: null,
      aol: "SGN",
      aod: "NRT",
      portOfLoading: null,
      portOfDischarge: null,
      finalDestination: "Tokyo",
      mawbNo: "123-45678901",
      hawbNo: "HAWB-1",
      mblNo: null,
      hblNo: null,
      flightNo: "VN300",
      vesselName: null,
      voyageNo: null,
    });
  });

  it("fails before inserting when an explicitly selected Partner is unavailable", async () => {
    const configured = configureTransaction([{
      id: "partner-deleted",
      companyName: "Deleted Partner",
      isActive: false,
      deletedAt: new Date("2026-01-01T00:00:00Z"),
    }]);
    const input = shippingNoteDraftInputSchema.parse({
      jobsheetNo: "C4-DELETED",
      shippingMode: "sea_export",
      customerPartnerId: "partner-deleted",
      portOfLoading: "VNSGN",
      portOfDischarge: "NLRTM",
      finalDestination: "Rotterdam",
      mblNo: "MBL-1",
      hblNo: "HBL-1",
      vesselName: "Pacific Dawn",
      voyageNo: "PD-26",
      etd: "2026-06-01T08:00:00Z",
      eta: "2026-06-20T14:00:00Z",
    });

    await expect(createShippingNoteDraft(input, saleUser())).rejects.toThrow(
      "Failed to create shipping note draft.",
    );
    expect(configured.tx.insert).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("persists every C4 route/document field independently on create", async () => {
    const configured = configureTransaction();
    const input = shippingNoteDraftInputSchema.parse({
      jobsheetNo: "C4-FIELDS",
      shippingMode: "sea_import",
      domesticOrigin: "HCM",
      domesticDestination: "DAD",
      airOrigin: "SGN",
      airDestination: "LAX",
      portOfLoading: "VNSGN",
      portOfDischarge: "USLAX",
      finalDestination: "Chicago",
      mawbNo: "MAWB-1",
      hawbNo: "HAWB-1",
      mblNo: "MBL-1",
      hblNo: "HBL-1",
      flightNo: "VN123",
      vesselName: "Vessel One",
      voyageNo: "V001",
      etd: "2026-06-01T08:00:00Z",
      eta: "2026-06-20T14:00:00Z",
    });

    await createShippingNoteDraft(input, saleUser());

    expect(configured.insertedValues()).toMatchObject({
      domesticOrigin: null,
      domesticDestination: null,
      aol: null,
      aod: null,
      portOfLoading: "VNSGN",
      portOfDischarge: "USLAX",
      finalDestination: "Chicago",
      mawbNo: null,
      hawbNo: null,
      mblNo: "MBL-1",
      hblNo: "HBL-1",
      flightNo: null,
      vesselName: "Vessel One",
      voyageNo: "V001",
    });
  });

  it("uses the same Partner snapshot and C4 field persistence rules on update", async () => {
    mocks.getShippingNoteById.mockResolvedValue({
      id: "note-1",
      jobsheetNo: "C4-UPDATE",
      status: "draft",
      createdById: "sale-1",
    });
    const configured = configureTransaction([{
      id: "partner-beta",
      companyName: "Beta Logistics",
      isActive: true,
      deletedAt: null,
    }]);
    const input = updateShippingNoteDraftInputSchema.parse({
      id: "note-1",
      jobsheetNo: "C4-UPDATE",
      shippingMode: "sea_export",
      agentPartnerId: "partner-beta",
      agentText: "Untrusted Name",
      portOfLoading: "VNSGN",
      portOfDischarge: "NLRTM",
      mblNo: "MBL-UPDATED",
      hblNo: "HBL-UPDATED",
      vesselName: "Vessel Updated",
      voyageNo: "V002",
      finalDestination: "Rotterdam",
      etd: "2026-06-01T08:00:00Z",
      eta: "2026-06-20T14:00:00Z",
    });

    await updateShippingNoteDraft("note-1", input, saleUser());

    expect(configured.updatedValues()).toMatchObject({
      agentPartnerId: "partner-beta",
      agentText: "Beta Logistics",
      portOfLoading: "VNSGN",
      portOfDischarge: "NLRTM",
      mblNo: "MBL-UPDATED",
      hblNo: "HBL-UPDATED",
      vesselName: "Vessel Updated",
      voyageNo: "V002",
    });
    expect(configured.updatedValues()).not.toHaveProperty("createdById");
  });

  it("does not change creator attribution when submitting a Draft", async () => {
    mocks.getShippingNoteById.mockResolvedValue(
      draftRecord("note-submit", "SUBMIT-001"),
    );
    const configured = configureTransaction();

    await submitShippingNote({ id: "note-submit" }, saleUser());

    expect(configured.updatedValues()).toMatchObject({ status: "submitted" });
    expect(configured.updatedValues()).not.toHaveProperty("createdById");
  });

  it("canonicalizes hostile inactive Air values to null on a Sea create", async () => {
    const configured = configureTransaction();
    const hostileInput = {
      ...seaDraft(),
      mawbNo: "SHOULD-NOT-SURVIVE",
      hawbNo: "SHOULD-NOT-SURVIVE",
      flightNo: "SHOULD-NOT-SURVIVE",
      domesticOrigin: "STALE",
    };

    await createShippingNoteDraft(
      hostileInput,
      saleUser(),
    );

    expect(configured.insertedValues()).toMatchObject({
      shippingMode: "sea_export",
      portOfLoading: "VNSGN",
      portOfDischarge: "NLRTM",
      mblNo: "MBL-001",
      hblNo: "HBL-001",
      domesticOrigin: null,
      domesticDestination: null,
      aol: null,
      aod: null,
      mawbNo: null,
      hawbNo: null,
      flightNo: null,
    });
  });

  it("clears old Air values when a Draft switches to Sea", async () => {
    mocks.getShippingNoteById.mockResolvedValue(draftRecord("note-air-sea", "AIR-SEA"));
    const configured = configureTransaction();
    const input = updateShippingNoteDraftInputSchema.parse({
      ...seaDraft({ jobsheetNo: "AIR-SEA" }),
      id: "note-air-sea",
      aol: "STALE-SGN",
      aod: "STALE-NRT",
      mawbNo: "STALE-MAWB",
      hawbNo: "STALE-HAWB",
      flightNo: "STALE-FLIGHT",
    });

    await updateShippingNoteDraft("note-air-sea", input, saleUser());

    expect(configured.updatedValues()).toMatchObject({
      shippingMode: "sea_export",
      portOfLoading: "VNSGN",
      mblNo: "MBL-001",
      aol: null,
      aod: null,
      mawbNo: null,
      hawbNo: null,
      flightNo: null,
    });
  });

  it("clears old Sea routing, documents, and Final Destination when a Draft switches to Domestic", async () => {
    mocks.getShippingNoteById.mockResolvedValue(draftRecord("note-sea-domestic", "SEA-DOM"));
    const configured = configureTransaction();
    const input = updateShippingNoteDraftInputSchema.parse({
      ...domesticDraft({ jobsheetNo: "SEA-DOM" }),
      id: "note-sea-domestic",
      portOfLoading: "STALE-POL",
      portOfDischarge: "STALE-POD",
      finalDestination: "STALE-FINAL",
      mblNo: "STALE-MBL",
      hblNo: "STALE-HBL",
      vesselName: "STALE-VESSEL",
      voyageNo: "STALE-VOYAGE",
    });

    await updateShippingNoteDraft("note-sea-domestic", input, saleUser());

    expect(configured.updatedValues()).toMatchObject({
      shippingMode: "domestic_truck",
      domesticOrigin: "HCM",
      domesticDestination: "DAD",
      portOfLoading: null,
      portOfDischarge: null,
      finalDestination: null,
      mblNo: null,
      hblNo: null,
      vesselName: null,
      voyageNo: null,
    });
  });

  it("clears Domestic routing when a Draft switches to Air", async () => {
    mocks.getShippingNoteById.mockResolvedValue(draftRecord("note-domestic-air", "DOM-AIR"));
    const configured = configureTransaction();
    const input = updateShippingNoteDraftInputSchema.parse({
      ...airDraft({ jobsheetNo: "DOM-AIR" }),
      id: "note-domestic-air",
      domesticOrigin: "STALE-ORIGIN",
      domesticDestination: "STALE-DESTINATION",
    });

    await updateShippingNoteDraft("note-domestic-air", input, saleUser());

    expect(configured.updatedValues()).toMatchObject({
      shippingMode: "air_export",
      aol: "SGN",
      aod: "NRT",
      mawbNo: "123-45678901",
      domesticOrigin: null,
      domesticDestination: null,
      portOfLoading: null,
      portOfDischarge: null,
    });
  });
});
