vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/lib/permissions/require-permission";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logAuditEvent: vi.fn(),
  rejectInactiveOrSoftDeletedUsers: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { transaction: mocks.transaction, select: vi.fn() },
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/auth/user-state", () => ({
  rejectInactiveOrSoftDeletedUsers: mocks.rejectInactiveOrSoftDeletedUsers,
}));

import type { User } from "@/lib/db/schema";
import { hardDeleteTaxRule } from "./mutations";

const taxRule = {
  id: "tax-rule-1",
  code: "VAT-10",
  name: "VAT 10%",
  description: null,
  shippingMode: "sea_export",
  chargeSection: "selling",
  chargeNamePattern: "*",
  taxTreatment: "taxable",
  vatPercent: "10.00",
  isActive: true,
  effectiveFrom: null,
  effectiveTo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function admin(): User {
  return {
    id: "admin-1", email: "admin@example.test", name: "Admin", image: null,
    emailVerified: true, role: "admin", isActive: true,
    createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  };
}

function sale(): User {
  return { ...admin(), id: "sale-1", role: "sale" };
}

function configureTransaction() {
  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([taxRule]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: taxRule.id }]),
      }),
    }),
  };
  mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
  return tx;
}

describe("Tax Rule hard delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rejectInactiveOrSoftDeletedUsers.mockReturnValue(true);
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("clears only the nullable live FK, physically deletes the rule, and retains a minimal audited reason", async () => {
    const tx = configureTransaction();

    await hardDeleteTaxRule(
      { id: taxRule.id, reason: "Duplicate tax configuration" },
      admin(),
    );

    expect(tx.update).toHaveBeenCalledOnce();
    expect(tx.delete).toHaveBeenCalledOnce();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "tax_rule.hard_delete",
        entityId: taxRule.id,
        reason: "Duplicate tax configuration",
        before: { code: taxRule.code, name: taxRule.name },
      }),
    );
  });

  it("rejects a whitespace-only reason before opening a transaction", async () => {
    await expect(
      hardDeleteTaxRule({ id: taxRule.id, reason: "  " }, admin()),
    ).rejects.toThrow("Delete reason is required.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("preserves Tax Rule mutation authorization", async () => {
    await expect(
      hardDeleteTaxRule({ id: taxRule.id, reason: "Duplicate" }, sale()),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
