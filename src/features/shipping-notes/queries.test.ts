import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { select: mocks.select },
}));

import {
  buildShippingNotesListWhere,
  escapeShippingNoteJobsheetLikePattern,
  getShippingNoteById,
  shippingNoteDetailSelect,
} from "./queries";
import { shippingNotes, type User } from "@/lib/db/schema";

const saleUser = {
  id: "sale-1",
  role: "sale",
} as User;

const adminUser = {
  id: "admin-1",
  role: "admin",
} as User;

describe("C4 Shipping Note historical read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the frozen party snapshot even after the referenced Partner is renamed", async () => {
    const storedNote = {
      id: "note-1",
      shipperPartnerId: "partner-1",
      shipperText: "Alpha",
    };
    const partnerNow = { id: "partner-1", companyName: "Beta" };
    const limit = vi.fn().mockResolvedValue([storedNote]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    mocks.select.mockReturnValue({ from });

    const note = await getShippingNoteById("note-1");

    expect(note?.shipperPartnerId).toBe(partnerNow.id);
    expect(note?.shipperText).toBe("Alpha");
    expect(note?.shipperText).not.toBe(partnerNow.companyName);
  });

  it("exposes Partner IDs, frozen snapshots, and explicit C4 fields without a live Partner join", () => {
    expect(shippingNoteDetailSelect.shipperPartnerId).toBe(
      shippingNotes.shipperPartnerId,
    );
    expect(shippingNoteDetailSelect.shipperText).toBe(shippingNotes.shipperText);
    expect(shippingNoteDetailSelect.airOrigin).toBe(shippingNotes.aol);
    expect(shippingNoteDetailSelect.airDestination).toBe(shippingNotes.aod);
    expect(shippingNoteDetailSelect.portOfLoading).toBe(
      shippingNotes.portOfLoading,
    );
    expect(shippingNoteDetailSelect.mawbNo).toBe(shippingNotes.mawbNo);
    expect(shippingNoteDetailSelect.vesselName).toBe(shippingNotes.vesselName);
  });
});

describe("C7 Shipping Note list query", () => {
  it("uses literal case-insensitive Jobsheet contains matching", () => {
    expect(escapeShippingNoteJobsheetLikePattern("UGF%_\\26")).toBe("UGF\\%\\_\\\\26");

    const query = new PgDialect().sqlToQuery(buildShippingNotesListWhere(adminUser, {
      jobsheet: "ugf-26",
    }));

    expect(query.sql).toContain('"shipping_notes"."jobsheet_no" ilike $1');
    expect(query.params).toEqual(["%ugf-26%"]);
  });

  it("composes Jobsheet and ETD predicates before the database query", () => {
    const etdFrom = new Date("2026-08-31T17:00:00.000Z");
    const etdToExclusive = new Date("2026-09-30T17:00:00.000Z");
    const query = new PgDialect().sqlToQuery(buildShippingNotesListWhere(adminUser, {
      jobsheet: "UGF-26",
      etdFrom,
      etdToExclusive,
    }));

    expect(query.sql).toContain('"shipping_notes"."jobsheet_no" ilike $1');
    expect(query.sql).toContain('"shipping_notes"."etd" >= $2');
    expect(query.sql).toContain('"shipping_notes"."etd" < $3');
    expect(query.params).toEqual([
      "%UGF-26%",
      etdFrom.toISOString(),
      etdToExclusive.toISOString(),
    ]);
  });

  it("keeps Sale ownership scope composed with matching filters", () => {
    const saleQuery = new PgDialect().sqlToQuery(buildShippingNotesListWhere(saleUser, {
      jobsheet: "UGF-26",
    }));
    const adminQuery = new PgDialect().sqlToQuery(buildShippingNotesListWhere(adminUser, {
      jobsheet: "UGF-26",
    }));

    expect(saleQuery.sql).toContain('"shipping_notes"."created_by_id" = $1');
    expect(saleQuery.params).toEqual(["sale-1", "%UGF-26%"]);
    expect(adminQuery.sql).not.toContain('"shipping_notes"."created_by_id"');
  });
});
