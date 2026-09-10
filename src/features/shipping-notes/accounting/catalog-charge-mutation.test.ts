import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getShippingNoteById: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: mocks.logAuditEvent }));
vi.mock("../queries", () => ({
  getShippingNoteById: mocks.getShippingNoteById,
  getShippingNoteForUser: vi.fn(),
  shippingNoteDetailSelect: { id: "id" },
}));

import type { User } from "@/lib/db/schema";
import { createSellingChargeForNote } from "../mutations";
import { createSellingChargeInputSchema } from "../validators";

const now = new Date("2026-09-09T00:00:00.000Z");
const actor: User = {
  id: "sale-1",
  email: "sale@example.test",
  name: "Sale",
  image: null,
  emailVerified: true,
  role: "sale",
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

function configureTransaction(catalogRows: Array<Record<string, unknown>>) {
  let inserted: Record<string, unknown> | undefined;
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(catalogRows),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        inserted = values;
        return {
          returning: vi.fn().mockResolvedValue([{
            id: "charge-1",
            createdAt: now,
            updatedAt: now,
            ...values,
          }]),
        };
      }),
    })),
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  return { tx, inserted: () => inserted };
}

function input(serviceCatalogItemId?: string) {
  return createSellingChargeInputSchema.parse({
    shippingNoteId: "note-1",
    serviceCatalogItemId,
    chargeName: "Client-supplied wrong name",
    quantity: "1",
    unit: "Client unit",
    unitPrice: "100",
    currency: "VND",
  });
}

describe("catalog-backed charge mutation wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getShippingNoteById.mockResolvedValue({
      id: "note-1",
      status: "draft",
      createdById: "sale-1",
    });
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("loads the active item inside the charge transaction and persists snapshots", async () => {
    const configured = configureTransaction([{
      id: "catalog-1",
      code: "OF",
      name: "Ocean Freight",
      primaryUnit: "Shipment",
      vatRate: "8.00",
      isActive: true,
      deletedAt: null,
    }]);

    await createSellingChargeForNote(input("catalog-1"), actor);

    expect(configured.tx.select).toHaveBeenCalledOnce();
    expect(configured.inserted()).toMatchObject({
      serviceCatalogItemId: "catalog-1",
      catalogCodeSnapshot: "OF",
      catalogNameSnapshot: "Ocean Freight",
      catalogUnitSnapshot: "Shipment",
      catalogVatRateSnapshot: "8.00",
      chargeName: "Ocean Freight",
      unit: "Shipment",
    });
    expect(mocks.logAuditEvent).toHaveBeenCalledOnce();
  });

  it("keeps manual creation DB-compatible without a catalog lookup", async () => {
    const configured = configureTransaction([]);
    await createSellingChargeForNote(input(), actor);
    expect(configured.tx.select).not.toHaveBeenCalled();
    expect(configured.inserted()).toMatchObject({
      serviceCatalogItemId: null,
      catalogNameSnapshot: null,
      chargeName: "Client-supplied wrong name",
      unit: "Client unit",
    });
  });

  it("fails atomically when the selected item is missing, inactive, or deleted", async () => {
    const configured = configureTransaction([]);
    await expect(createSellingChargeForNote(input("catalog-1"), actor)).rejects.toThrow(
      /Failed to create selling charge/,
    );
    expect(configured.tx.insert).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });
});
