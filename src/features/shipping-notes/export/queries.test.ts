import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: { select: mocks.select } }));

import { shippingNotes, type User } from "@/lib/db/schema";

import { exportCreator, exportChecker, exportApprover, getInternalShippingNoteExportDataForUser, internalShippingNoteExportNoteSelect } from "./queries";

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


describe("XLSX canonical workflow actor read model", () => {
  it.each([
    ["Haru Nguyen", "Owner Administrator", "Other Approver"],
    ["Haru Nguyen", null, null],
  ])("joins persisted creator/checker/approver identities: %s / %s / %s", async (creator, checker, approver) => {
    vi.clearAllMocks();
    const note = { id: "note-1", jobsheetNo: "JS-1", status: "approved", createdByName: creator, checkedByName: checker, approvedByName: approver };
    const chain = { from: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue([{ note, charge: null }]) };
    mocks.select.mockReturnValue(chain);
    const result = await getInternalShippingNoteExportDataForUser("note-1", { id: "current-viewer", role: "admin", name: "Current Viewer" } as User);
    expect(result?.note).toMatchObject(note);
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(chain.leftJoin).toHaveBeenCalledTimes(4);
    const joins = chain.leftJoin.mock.calls.slice(0, 3);
    for (const [index, table] of [exportCreator, exportChecker, exportApprover].entries()) {
      expect(joins[index][0]).toBe(table);
    }
    expect(joins.map(([, on]) => new PgDialect().sqlToQuery(on).sql)).toEqual([
      '"export_creator"."id" = "shipping_notes"."created_by_id"',
      '"export_checker"."id" = "shipping_notes"."checked_by_id"',
      '"export_approver"."id" = "shipping_notes"."approved_by_id"',
    ]);
    expect(new PgDialect().sqlToQuery(sql`${internalShippingNoteExportNoteSelect.createdByName}`).sql).toBe('"export_creator"."name"');
    expect(new PgDialect().sqlToQuery(sql`${internalShippingNoteExportNoteSelect.checkedByName}`).sql).toBe('"export_checker"."name"');
    expect(new PgDialect().sqlToQuery(sql`${internalShippingNoteExportNoteSelect.approvedByName}`).sql).toBe('"export_approver"."name"');
  });
});
