import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { transaction: mocks.transaction },
}));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: mocks.logAuditEvent }));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { assignChargeTaxRule } from "./mutations";

const now = new Date("2026-10-20T00:00:00.000Z");

function actor(role: User["role"]): User {
  return {
    id: `${role}-1`,
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

function configureSellingChargeTransaction(): void {
  const rows = [
    [{ shippingNoteId: "note-1" }],
    [{ status: "submitted", shippingMode: "sea_export" }],
    [{
      id: "selling-1",
      shippingNoteId: "note-1",
      section: "selling",
      chargeName: "Ocean Freight",
      amountVnd: "100.00",
      taxRuleId: null,
      taxRuleCodeSnapshot: null,
      taxRuleNameSnapshot: null,
      taxTreatmentSnapshot: null,
      vatPercent: "0.00",
      vatAmount: "0.00",
      isOverride: false,
      overrideReason: null,
      vatOverrideRate: null,
      serviceCatalogItemId: "catalog-1",
      catalogCodeSnapshot: "OF",
      catalogNameSnapshot: "Ocean Freight",
      catalogUnitSnapshot: "Shipment",
      catalogVatRateSnapshot: "8.00",
    }],
  ];
  let call = 0;
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            const result = rows[call++] ?? [];
            return call === 1
              ? Promise.resolve(result)
              : { for: vi.fn().mockResolvedValue(result) };
          }),
        })),
      })),
    })),
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
}

describe("OPS scoped tax mutation boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a forged selling-charge classification from OPS inside the transaction", async () => {
    configureSellingChargeTransaction();

    await expect(assignChargeTaxRule({
      chargeId: "selling-1",
      taxRuleId: "rule-1",
    }, actor("ops"))).rejects.toBeInstanceOf(AuthorizationError);

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("rejects Sale before opening a tax mutation transaction", async () => {
    await expect(assignChargeTaxRule({
      chargeId: "buying-1",
      taxRuleId: "rule-1",
    }, actor("sale"))).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
