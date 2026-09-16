import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  transaction: vi.fn(),
  getShippingNoteForUser: vi.fn(),
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
  getShippingNoteById: vi.fn(),
  getShippingNoteForUser: mocks.getShippingNoteForUser,
  shippingNoteDetailSelect: { id: "id" },
}));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  createBuyingChargeForNote,
  softDeleteBuyingCharge,
  updateBuyingCharge,
} from "./mutations";
import {
  createBuyingChargeInputSchema,
  updateBuyingChargeInputSchema,
} from "./validators";

function actor(role: User["role"]): User {
  const now = new Date("2026-09-16T00:00:00.000Z");
  return {
    id: `${role}-actor`,
    email: `${role}@example.test`,
    name: role,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function note(status: "submitted" | "accounting_reviewing") {
  return {
    id: "sale-created-note",
    status,
    createdById: "sale-creator",
  } as never;
}

function createInput() {
  return createBuyingChargeInputSchema.parse({
    shippingNoteId: "sale-created-note",
    chargeName: "Terminal handling",
    quantity: "1",
    unit: "shipment",
    unitPrice: "100",
    currency: "USD",
    exchangeRate: "25000",
    vendorOrAgentText: "Carrier A",
  });
}

function updateInput() {
  return updateBuyingChargeInputSchema.parse({
    id: "charge-1",
    chargeName: "Terminal handling",
    quantity: "2",
    unit: "shipment",
    unitPrice: "100",
    currency: "USD",
    exchangeRate: "25000",
    vendorOrAgentText: "Carrier A",
  });
}

function mockExistingCharge() {
  mocks.dbSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([{
          id: "charge-1",
          shippingNoteId: "sale-created-note",
          section: "buying",
          chargeName: "Terminal handling",
          description: null,
          quantity: "1",
          unit: "shipment",
          unitPrice: "100",
          currency: "USD",
          exchangeRate: "25000",
          amountOriginal: "100",
          amountVnd: "2500000",
          vendorOrAgentText: "Carrier A",
          vatPercent: "0",
          taxTreatmentSnapshot: null,
          serviceCatalogItemId: null,
          catalogCodeSnapshot: null,
          catalogNameSnapshot: null,
          catalogUnitSnapshot: null,
          catalogVatRateSnapshot: null,
          vatOverrideRate: null,
        }]),
      })),
    })),
  });
}

function mockTransaction() {
  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((values) => ({
        returning: vi.fn().mockResolvedValue([{ id: "charge-1", ...values }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values) => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{
            id: "charge-1",
            shippingNoteId: "sale-created-note",
            ...values,
          }]),
        })),
      })),
    })),
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  return tx;
}

describe("OPS Buying Charge mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("allows OPS to create a Buying Charge on a submitted note created by Sale and audits the OPS actor", async () => {
    const tx = mockTransaction();
    mocks.getShippingNoteForUser.mockResolvedValue(note("submitted"));

    const created = await createBuyingChargeForNote(
      "sale-created-note",
      createInput(),
      actor("ops"),
    );

    expect(created.shippingNoteId).toBe("sale-created-note");
    expect(tx.insert).toHaveBeenCalledOnce();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorUserId: "ops-actor",
      action: "shipping_note_charge.buying.create",
    }));
  });

  it("allows OPS update and delete on a submitted Sale-created note", async () => {
    mockExistingCharge();
    mockTransaction();
    mocks.getShippingNoteForUser.mockResolvedValue(note("submitted"));

    await expect(updateBuyingCharge("charge-1", updateInput(), actor("ops")))
      .resolves.toMatchObject({ shippingNoteId: "sale-created-note" });
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorUserId: "ops-actor",
      action: "shipping_note_charge.buying.update",
    }));

    mockExistingCharge();
    await expect(softDeleteBuyingCharge("charge-1", actor("ops")))
      .resolves.toBe("sale-created-note");

    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorUserId: "ops-actor",
      action: "shipping_note_charge.buying.delete",
    }));
  });

  it("rejects an OPS stale form once Accounting Review has started before any transaction", async () => {
    mocks.getShippingNoteForUser.mockResolvedValue(note("accounting_reviewing"));

    await expect(createBuyingChargeForNote(
      "sale-created-note",
      createInput(),
      actor("ops"),
    )).rejects.toBeInstanceOf(AuthorizationError);

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps Sale outside the OPS Buying Charge mutation capability", async () => {
    await expect(createBuyingChargeForNote(
      "sale-created-note",
      createInput(),
      actor("sale"),
    )).rejects.toBeInstanceOf(AuthorizationError);

    expect(mocks.getShippingNoteForUser).not.toHaveBeenCalled();
  });
});
