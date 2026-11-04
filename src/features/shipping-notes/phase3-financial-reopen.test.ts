import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
  logAuditEvent: vi.fn(),
  getShippingNoteForUser: vi.fn(),
  deriveFinancialReviewRevision: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: { select: mocks.select, transaction: mocks.transaction },
}));
vi.mock("@/lib/audit/log", () => ({ logAuditEvent: mocks.logAuditEvent }));
vi.mock("./financial-review-revision", () => ({
  deriveFinancialReviewRevision: mocks.deriveFinancialReviewRevision,
}));
vi.mock("./queries", () => ({
  getShippingNoteById: vi.fn(),
  getShippingNoteForUser: mocks.getShippingNoteForUser,
  shippingNoteDetailSelect: { id: "id" },
}));

import type { User } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import {
  createSellingChargeForNote,
  markShippingNoteChecked,
  reopenShippingNoteForCorrection,
  updateShippingNotePostSubmit,
} from "./mutations";

const now = new Date("2026-10-21T00:00:00.000Z");
const financialRevision = "a".repeat(64);

function user(role: User["role"]): User {
  return {
    id: `${role}-1`, email: `${role}@example.test`, name: role, image: null,
    emailVerified: true, role, isActive: true, createdAt: now, updatedAt: now, deletedAt: null,
  };
}

function queryChain(response: unknown[]) {
  const chain = {
    from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), limit: vi.fn(), for: vi.fn(),
    then: <TResult1 = unknown[], TResult2 = never>(
      onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.for.mockResolvedValue(response);
  return chain;
}

function reopenSnapshot(status: "checked" | "approved" | "locked" = "approved") {
  return {
    id: "note-1", status, checkedById: "accountant-old", checkedAt: now,
    approvedById: status === "approved" ? "admin-old" : null,
    approvedAt: status === "approved" ? now : null,
    lockedById: status === "locked" ? "admin-old" : null,
    lockedAt: status === "locked" ? now : null,
    lockReason: null,
  };
}

describe("Phase 3 selling-rate reopen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logAuditEvent.mockResolvedValue(undefined);
    mocks.deriveFinancialReviewRevision.mockResolvedValue(financialRevision);
  });

  it.each(["admin", "accountant"] as const)("allows %s to reopen and atomically supersede current signoff", async (role) => {
    const current = reopenSnapshot("approved");
    mocks.select.mockReturnValueOnce(queryChain([current]));
    let updateValues: Record<string, unknown> | undefined;
    const updated = { ...current, status: "accounting_reviewing" };
    const tx = {
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => {
          updateValues = values;
          return { where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([updated]) })) };
        }),
      })),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    await reopenShippingNoteForCorrection({ id: "note-1", expectedStatus: "approved", reason: "Correct rate" }, user(role));
    expect(updateValues).toMatchObject({
      status: "accounting_reviewing",
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
      sellingRateReopenedById: `${role}-1`,
      sellingRateReopenReason: "Correct rate",
    });
    expect(updateValues?.sellingRateReopenedAt).toBeInstanceOf(Date);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: "shipping_note.selling_rate_reopened",
      entityId: "note-1",
      reason: "Correct rate",
      before: expect.objectContaining({
        approvedById: "admin-old",
        correctionScope: "operational_and_financial",
      }),
      after: expect.objectContaining({
        approvedById: null,
        correctionScope: "operational_and_financial",
      }),
    }));
  });

  it.each(["sale", "ops"] as const)("denies %s reopen even if operationally assigned", async (role) => {
    await expect(reopenShippingNoteForCorrection({
      id: "note-1", expectedStatus: "approved", reason: "No",
    }, user(role))).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("denies locked and stale source states before mutation", async () => {
    mocks.select.mockReturnValueOnce(queryChain([reopenSnapshot("locked")]));
    await expect(reopenShippingNoteForCorrection({
      id: "note-1", expectedStatus: "approved", reason: "No",
    }, user("admin"))).rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows reopened selling mutations only for Admin/Accountant at the server boundary", async () => {
    const reopenedNote = {
      id: "note-1", status: "accounting_reviewing", createdById: "sale-1",
      sellingRateReopenedAt: now,
    };
    const charge = {
      id: "charge-1", shippingNoteId: "note-1", chargeName: "Correction",
      description: null, quantity: "1.000", unit: "shipment", unitPrice: "-1.0000",
      currency: "VND", exchangeRate: "1.000000", amountOriginal: "-1.0000",
      amountVnd: "-1.00", serviceCatalogItemId: null, catalogCodeSnapshot: null,
      catalogNameSnapshot: null, catalogUnitSnapshot: null, catalogVatRateSnapshot: null,
      createdAt: now, updatedAt: now,
    };

    for (const role of ["admin", "accountant"] as const) {
      const tx = {
        select: vi.fn(() => queryChain([reopenedNote])),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([charge]) })) })),
      };
      mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
      await expect(createSellingChargeForNote({
        shippingNoteId: "note-1", chargeName: "Correction", quantity: "1.000",
        unit: "shipment", unitPrice: "-1.0000", currency: "VND",
      }, user(role))).resolves.toMatchObject({ id: "charge-1" });
    }

    const saleTx = { select: vi.fn(() => queryChain([reopenedNote])) };
    mocks.transaction.mockImplementationOnce(async (callback) => callback(saleTx));
    await expect(createSellingChargeForNote({
      shippingNoteId: "note-1", chargeName: "Correction", quantity: "1.000",
      unit: "shipment", unitPrice: "-1.0000", currency: "VND",
    }, user("sale"))).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("locks the reviewed note before reading charges and publishing Checked signoff", async () => {
    const current = {
      id: "note-1", status: "accounting_reviewing", createdById: "sale-1",
      sellingRateReopenedAt: now, checkedById: null, checkedAt: null,
      approvedById: null, approvedAt: null,
    };
    mocks.getShippingNoteForUser.mockResolvedValueOnce(current);
    const noteLockQuery = queryChain([current]);
    const chargeQuery = queryChain([]);
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(noteLockQuery)
        .mockReturnValueOnce(chargeQuery),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{
              ...current,
              status: "checked",
              checkedById: "accountant-1",
              checkedAt: now,
              sellingRateReopenedAt: null,
            }]),
          })),
        })),
      })),
    };
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    await markShippingNoteChecked({
      id: "note-1",
      expectedFinancialRevision: financialRevision,
      sellingVerified: true,
      buyingVerified: true,
      taxVerified: true,
    }, user("accountant"));

    expect(noteLockQuery.for).toHaveBeenCalledWith("update");
    expect(noteLockQuery.for.mock.invocationCallOrder[0]).toBeLessThan(
      chargeQuery.where.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(tx.update).toHaveBeenCalledOnce();
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: "shipping_note.accounting_review.checked",
      before: current,
      after: expect.objectContaining({
        accountingConfirmations: expect.objectContaining({
          verifiedFinancialRevision: financialRevision,
        }),
      }),
    }));
  });

  it("rejects stale financial confirmations without publishing a signoff", async () => {
    const current = {
      id: "note-1",
      status: "accounting_reviewing",
      shippingMode: "sea_export",
      exchangeRate: "25000.000000",
      updatedAt: now,
      createdById: "sale-1",
    };
    mocks.getShippingNoteForUser.mockResolvedValueOnce(current);
    const noteLockQuery = queryChain([current]);
    const chargeQuery = queryChain([]);
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(noteLockQuery)
        .mockReturnValueOnce(chargeQuery),
      update: vi.fn(),
    };
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
    mocks.deriveFinancialReviewRevision.mockResolvedValueOnce("b".repeat(64));

    await expect(markShippingNoteChecked({
      id: "note-1",
      expectedFinancialRevision: financialRevision,
      sellingVerified: true,
      buyingVerified: true,
      taxVerified: true,
    }, user("accountant"))).rejects.toThrow(/Financial or tax data changed/);

    expect(tx.update).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("Phase 3 delegated operational mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logAuditEvent.mockResolvedValue(undefined);
    mocks.deriveFinancialReviewRevision.mockResolvedValue(financialRevision);
  });

  const operationalInput = {
    id: "note-1",
    expectedUpdatedAt: now,
    shippingMode: "domestic_truck" as const,
    domesticOrigin: "HCM",
    domesticDestination: "DAD",
  };

  function unchangedOperationalNote(status: "checked" | "approved") {
    return {
      id: "note-1",
      jobsheetNo: "JS-IMMUTABLE",
      commodityHsCode: null,
      commodity: null,
      hsCode: null,
      containerType: null,
      containerNo: null,
      sealNo: null,
      carrierName: null,
      grossWeight: null,
      chargeableWeight: null,
      licensePlate: null,
      driverInformation: null,
      vehiclePayloadCapacity: null,
      shippingMode: "domestic_truck",
      mawbHawbNo: null,
      shipperPartnerId: null,
      shipperText: null,
      consigneePartnerId: null,
      consigneeText: null,
      customerPartnerId: null,
      customerText: null,
      agentPartnerId: null,
      agentText: null,
      domesticOrigin: "HCM",
      domesticDestination: "DAD",
      customModeName: null,
      customOrigin: null,
      customDestination: null,
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
      etd: null,
      eta: null,
      volumeValue: null,
      volumeUnit: null,
      exchangeRate: "25000.000000",
      status,
      createdById: "sale-1",
      submittedAt: now,
      sellingRateReopenedById: null,
      sellingRateReopenedAt: null,
      sellingRateReopenReason: null,
      checkedById: "accountant-old",
      checkedAt: now,
      approvedById: status === "approved" ? "admin-old" : null,
      approvedAt: status === "approved" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
  }

  it("updates only the operational surface for the owner with a live grant", async () => {
    const current = {
      ...unchangedOperationalNote("checked"),
      status: "submitted" as const,
      domesticDestination: "HAN",
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
    };
    const responses = [[current], [{ id: "grant-1" }]];
    let updateValues: Record<string, unknown> | undefined;
    const tx = {
      select: vi.fn(() => queryChain(responses.shift() ?? [])),
      update: vi.fn(() => ({
        set: vi.fn((values: Record<string, unknown>) => {
          updateValues = values;
          return {
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ ...current, ...values }]),
            })),
          };
        }),
      })),
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));

    await updateShippingNotePostSubmit(operationalInput, user("sale"));
    expect(updateValues).toMatchObject({
      shippingMode: "domestic_truck", domesticOrigin: "HCM", domesticDestination: "DAD",
    });
    expect(updateValues).not.toHaveProperty("jobsheetNo");
    expect(updateValues).not.toHaveProperty("exchangeRate");
    expect(updateValues).not.toHaveProperty("createdById");
    expect(updateValues).not.toHaveProperty("status");
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: "shipping_note.update_post_submit", entityId: "note-1",
    }));
  });

  it.each(["checked", "approved"] as const)(
    "rejects direct delegated edits against a %s note until explicit reopen",
    async (status) => {
      const current = unchangedOperationalNote(status);
      const tx = {
        select: vi.fn(() => queryChain([current])),
        update: vi.fn(),
      };
      mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

      await expect(updateShippingNotePostSubmit(
        { ...operationalInput, domesticDestination: "HAN" },
        user("sale"),
      )).rejects.toBeInstanceOf(AuthorizationError);
      expect(tx.update).not.toHaveBeenCalled();
      expect(mocks.logAuditEvent).not.toHaveBeenCalled();
    },
  );

  it("allows a normalized no-op only after the explicit reopen returned the note to review", async () => {
    const current = {
      ...unchangedOperationalNote("approved"),
      status: "accounting_reviewing" as const,
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
      sellingRateReopenedAt: now,
    };
    const responses = [[current], [{ id: "grant-1" }]];
    const tx = {
      select: vi.fn(() => queryChain(responses.shift() ?? [])),
      update: vi.fn(),
    };
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    await expect(updateShippingNotePostSubmit(operationalInput, user("sale")))
      .resolves.toEqual(current);
    expect(tx.update).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("treats equivalent numeric formatting as a no-op", async () => {
    const current = {
      ...unchangedOperationalNote("approved"),
      status: "accounting_reviewing" as const,
      checkedById: null,
      checkedAt: null,
      approvedById: null,
      approvedAt: null,
      sellingRateReopenedAt: now,
      volumeValue: "2.500",
    };
    const responses = [[current], [{ id: "grant-1" }]];
    const tx = {
      select: vi.fn(() => queryChain(responses.shift() ?? [])),
      update: vi.fn(),
    };
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));

    await expect(updateShippingNotePostSubmit(
      { ...operationalInput, volumeValue: 2.5, volumeUnit: undefined },
      user("sale"),
    )).resolves.toEqual(current);
    expect(tx.update).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("denies cross-owner, revoked-grant, stale, and Closed mutations", async () => {
    for (const current of [
      { id: "note-1", status: "submitted", createdById: "sale-2", updatedAt: now },
      { id: "note-1", status: "locked", createdById: "sale-1", updatedAt: now },
      { id: "note-1", status: "exported", createdById: "sale-1", updatedAt: now },
      { id: "note-1", status: "submitted", createdById: "sale-1", updatedAt: new Date(now.getTime() + 1) },
    ]) {
      const tx = { select: vi.fn(() => queryChain([current])) };
      mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
      await expect(updateShippingNotePostSubmit(operationalInput, user("sale")))
        .rejects.toBeInstanceOf(AuthorizationError);
    }

    const revokedResponses = [[{
      id: "note-1", status: "submitted", createdById: "sale-1", updatedAt: now,
    }], []];
    const revokedTx = { select: vi.fn(() => queryChain(revokedResponses.shift() ?? [])) };
    mocks.transaction.mockImplementationOnce(async (callback) => callback(revokedTx));
    await expect(updateShippingNotePostSubmit(operationalInput, user("sale")))
      .rejects.toBeInstanceOf(AuthorizationError);
  });

  it.each(["admin", "accountant"] as const)("does not grant direct operational editing to %s", async (role) => {
    await expect(updateShippingNotePostSubmit(operationalInput, user(role)))
      .rejects.toBeInstanceOf(AuthorizationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
