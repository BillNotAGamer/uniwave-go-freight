import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { select: mocks.select },
}));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import {
  buildSaleOwnNoteFinancialOwnershipWhere,
  getSaleOwnNoteFinancialViewForUser,
} from "./sale-own-note-financial";

function actor(role: User["role"], id = `${role}-1`): User {
  return { id, role } as User;
}

function mockOwnedNoteAndCharges(rows: unknown[]) {
  const noteLimit = vi.fn().mockResolvedValue([{ id: "note-1" }]);
  const noteWhere = vi.fn().mockReturnValue({ limit: noteLimit });
  const noteFrom = vi.fn().mockReturnValue({ where: noteWhere });
  const chargeOrderBy = vi.fn().mockResolvedValue(rows);
  const chargeWhere = vi.fn().mockReturnValue({ orderBy: chargeOrderBy });
  const chargeFrom = vi.fn().mockReturnValue({ where: chargeWhere });

  mocks.select
    .mockReturnValueOnce({ from: noteFrom })
    .mockReturnValueOnce({ from: chargeFrom });
}

describe("Sale own-note financial read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binds the requested note to the authenticated Sale owner in SQL", () => {
    const query = new PgDialect().sqlToQuery(
      buildSaleOwnNoteFinancialOwnershipWhere("note-1", "sale-1")!,
    );

    expect(query.sql).toContain('"shipping_notes"."id" = $1');
    expect(query.sql).toContain('"shipping_notes"."created_by_id" = $2');
    expect(query.sql).toContain('"shipping_notes"."deleted_at" is null');
    expect(query.sql).not.toContain('"shipping_notes"."status"');
    expect(query.params).toEqual(["note-1", "sale-1"]);
  });

  it("returns only Buying Rate context and authoritative Gross Profit", async () => {
    mockOwnedNoteAndCharges([
      {
        id: "selling-1",
        section: "selling",
        chargeName: "Ocean freight selling",
        description: null,
        quantity: "2.000",
        unit: "shipment",
        unitPrice: "200.0000",
        currency: "USD",
        amountOriginal: "400.0000",
        amountVnd: "10000000.00",
        vendorOrAgentText: "must not serialize",
      },
      {
        id: "buying-1",
        section: "buying",
        chargeName: "Ocean freight buying",
        description: "Carrier cost",
        quantity: "2.000",
        unit: "shipment",
        unitPrice: "150.0000",
        currency: "USD",
        amountOriginal: "300.0000",
        amountVnd: "7500000.00",
        vendorOrAgentText: "Confidential vendor",
        taxRuleCodeSnapshot: "VAT0",
        exchangeRate: "25000.000000",
      },
    ]);

    const result = await getSaleOwnNoteFinancialViewForUser(
      "note-1",
      actor("sale", "sale-1"),
    );

    expect(result).toEqual({
      buyingRates: [
        {
          id: "buying-1",
          chargeName: "Ocean freight buying",
          description: "Carrier cost",
          quantity: "2.000",
          unit: "shipment",
          unitPrice: "150.0000",
          currency: "USD",
          amountOriginal: "300.0000",
        },
      ],
      grossProfitVnd: "2500000.00",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Confidential vendor");
    expect(serialized).not.toContain("taxRule");
    expect(serialized).not.toContain("exchangeRate");
    expect(serialized).not.toContain("selling-1");
  });

  it("returns null for a guessed note ID that is not owned and never queries charges", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.select.mockReturnValueOnce({ from });

    await expect(
      getSaleOwnNoteFinancialViewForUser(
        "note-created-by-sale-b",
        actor("sale", "sale-a"),
      ),
    ).resolves.toBeNull();
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it.each(["ops", "accountant", "admin"] as const)(
    "rejects %s from the Sale-specific financial query",
    async (role) => {
      await expect(
        getSaleOwnNoteFinancialViewForUser("note-1", actor(role)),
      ).rejects.toBeInstanceOf(AuthorizationError);
      expect(mocks.select).not.toHaveBeenCalled();
    },
  );
});
