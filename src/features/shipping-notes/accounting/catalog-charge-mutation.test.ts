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

function configureTransaction(
  catalogRows: Array<Record<string, unknown>>,
  taxRuleRows: Array<Record<string, unknown>> = [],
) {
  let inserted: Record<string, unknown> | undefined;
  let selectCall = 0;
  const tx = {
    select: vi.fn(() => {
      const currentSelect = selectCall++;
      const isNoteLockQuery = currentSelect === 0;
      const isTaxRuleQuery = currentSelect >= 2;
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => isTaxRuleQuery
            ? Promise.resolve(taxRuleRows)
            : ({
              limit: vi.fn(() => isNoteLockQuery
              ? { for: vi.fn().mockResolvedValue([{
                  id: "note-1",
                  status: "draft",
                  createdById: "sale-1",
                  shippingMode: "sea_export",
                  sellingRateReopenedAt: null,
                }]) }
              : Promise.resolve(catalogRows)),
            })),
        })),
      };
    }),
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

function input(
  serviceCatalogItemId?: string,
  overrides: Record<string, unknown> = {},
) {
  return createSellingChargeInputSchema.parse({
    shippingNoteId: "note-1",
    serviceCatalogItemId,
    chargeName: "Client-supplied wrong name",
    quantity: "1",
    unit: "Client unit",
    unitPrice: "100",
    currency: "VND",
    ...overrides,
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

    expect(configured.tx.select).toHaveBeenCalledTimes(3);
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
    expect(configured.tx.select).toHaveBeenCalledOnce();
    expect(configured.inserted()).toMatchObject({
      serviceCatalogItemId: null,
      catalogNameSnapshot: null,
      chargeName: "Client-supplied wrong name",
      unit: "Client unit",
    });
  });

  it("applies a unique effective charge-type VAT default through Tax Rule snapshots", async () => {
    const configured = configureTransaction([{
      id: "catalog-1",
      code: "OF-20",
      name: "Ocean Freight 20ft",
      primaryUnit: "Container",
      vatRate: "8.00",
      isActive: true,
      deletedAt: null,
    }], [{
      id: "rule-zero",
      code: "FREIGHT-VAT0",
      name: "Freight zero-rated",
      shippingMode: "sea_export",
      chargeSection: "selling",
      chargeNamePattern: "OF-*",
      taxTreatment: "zero_rated",
      vatPercent: "0.00",
      isActive: true,
      effectiveFrom: null,
      effectiveTo: null,
    }]);

    await createSellingChargeForNote(input("catalog-1"), actor);

    expect(configured.inserted()).toMatchObject({
      taxRuleId: "rule-zero",
      taxRuleCodeSnapshot: "FREIGHT-VAT0",
      taxRuleNameSnapshot: "Freight zero-rated",
      taxTreatmentSnapshot: "zero_rated",
      vatPercent: "0.00",
      vatAmount: "0.00",
      isOverride: false,
    });
  });

  it("persists and audits exact signed EUR amounts", async () => {
    const configured = configureTransaction([]);

    await createSellingChargeForNote(input(undefined, {
      quantity: "0.125",
      unitPrice: "-0.1000",
      currency: "EUR",
      exchangeRate: "28000",
    }), actor);

    expect(configured.inserted()).toMatchObject({
      quantity: "0.125",
      unitPrice: "-0.1000",
      currency: "EUR",
      exchangeRate: "28000.000000",
      amountOriginal: "-0.0125",
      amountVnd: "-350.00",
    });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      configured.tx,
      expect.objectContaining({
        actorUserId: actor.id,
        action: "shipping_note_charge.create",
        after: expect.objectContaining({
          currency: "EUR",
          amountOriginal: "-0.0125",
          amountVnd: "-350.00",
        }),
      }),
    );
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
