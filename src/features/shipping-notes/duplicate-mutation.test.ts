import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("./queries", () => ({
  getShippingNoteById: vi.fn(),
  getShippingNoteForUser: vi.fn(),
  shippingNoteDetailSelect: { id: "id" },
}));

import type { User } from "@/lib/db/schema";
import {
  duplicateShippingNote,
  ShippingNoteJobsheetConflictError,
} from "./mutations";
import type { ShippingNoteDetail } from "./types";

const now = new Date("2026-10-01T00:00:00.000Z");

function user(role: User["role"], id = `${role}-1`): User {
  return {
    id,
    email: `${id}@example.test`,
    name: id,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function sourceNote(overrides: Partial<ShippingNoteDetail> = {}): ShippingNoteDetail {
  return {
    id: "source-1",
    jobsheetNo: "SOURCE-001",
    shippingMode: "domestic_truck",
    customModeName: null,
    shipperText: "Frozen Shipper",
    consigneeText: "Frozen Consignee",
    status: "locked",
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    createdById: "sale-1",
    shipperPartnerId: null,
    consigneePartnerId: null,
    customerPartnerId: null,
    agentPartnerId: null,
    commodityHsCode: "Legacy Cargo / 0000",
    commodity: "Cargo",
    hsCode: "0000.00",
    containerType: null,
    containerNo: null,
    sealNo: null,
    carrierName: null,
    grossWeight: null,
    chargeableWeight: null,
    licensePlate: "51C-123.45",
    driverInformation: "Driver A",
    vehiclePayloadCapacity: "5 TONS",
    mawbHawbNo: null,
    customerText: null,
    agentText: null,
    domesticOrigin: "Warehouse A",
    domesticDestination: "Warehouse B",
    customOrigin: null,
    customDestination: null,
    airOrigin: null,
    airDestination: null,
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
    volumeValue: "4.50",
    volumeUnit: "cbm",
    exchangeRate: "25000.00",
    ...overrides,
  };
}

function queryChain(response: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    for: vi.fn(),
    then: <TResult1 = unknown[], TResult2 = never>(
      onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(response).then(onfulfilled, onrejected),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.for.mockResolvedValue(response);
  return chain;
}

function configureTransaction({
  source = sourceNote(),
  jobsheetRows = [],
  partners = [],
  insertError,
}: {
  source?: ShippingNoteDetail | null;
  jobsheetRows?: unknown[];
  partners?: unknown[];
  insertError?: unknown;
} = {}) {
  const responses = [[...(source ? [source] : [])], jobsheetRows, partners];
  let insertedValues: Record<string, unknown> | undefined;
  const tx = {
    select: vi.fn(() => queryChain(responses.shift() ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        insertedValues = values;
        return {
          returning: vi.fn(() => insertError
            ? Promise.reject(insertError)
            : Promise.resolve([{ id: "copy-1", ...values }])),
        };
      }),
    })),
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  return { tx, insertedValues: () => insertedValues };
}

describe("duplicateShippingNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logAuditEvent.mockResolvedValue(undefined);
  });

  it("creates an operational-only Draft owned by the actor without mutating the source", async () => {
    const source = sourceNote();
    const sourceSnapshot = structuredClone(source);
    const configured = configureTransaction({ source });

    const created = await duplicateShippingNote(
      { sourceId: source.id, newJobsheetNo: " copy  001 " },
      user("sale", "sale-1"),
    );

    expect(created.id).toBe("copy-1");
    expect(configured.insertedValues()).toMatchObject({
      jobsheetNo: "COPY 001",
      status: "draft",
      createdById: "sale-1",
      exchangeRate: "1",
      commodityHsCode: "Legacy Cargo / 0000",
      commodity: "Cargo",
      hsCode: "0000.00",
      domesticOrigin: "Warehouse A",
      domesticDestination: "Warehouse B",
    });
    expect(configured.insertedValues()).not.toHaveProperty("submittedAt");
    expect(configured.insertedValues()).not.toHaveProperty("approvedAt");
    expect(configured.insertedValues()).not.toHaveProperty("createdAt");
    expect(configured.insertedValues()).not.toHaveProperty("updatedAt");
    expect(configured.tx.insert).toHaveBeenCalledTimes(1);
    expect(source).toEqual(sourceSnapshot);
    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      configured.tx,
      expect.objectContaining({
        actorUserId: "sale-1",
        action: "shipping_note.duplicate",
        entityId: "copy-1",
        before: expect.objectContaining({ sourceShippingNoteId: "source-1" }),
        after: expect.objectContaining({
          sourceShippingNoteId: "source-1",
          newShippingNoteId: "copy-1",
          copyScope: "operational_fields_only",
        }),
      }),
    );
  });

  it("ignores existing financial, workflow, document, customs, export, and audit relations", async () => {
    const sourceWithRelations = Object.assign(sourceNote(), {
      sellingCharges: [{ id: "selling-1" }],
      buyingCharges: [{ id: "buying-1" }],
      customsDeclarations: [{ id: "customs-1" }],
      documents: [{ id: "document-1", storageKey: "private/source.pdf" }],
      exports: [{ id: "export-1" }],
      auditHistory: [{ id: "audit-1" }],
      checkedById: "accountant-1",
      approvedById: "admin-1",
      lockedById: "admin-1",
    });
    const configured = configureTransaction({ source: sourceWithRelations });

    await duplicateShippingNote(
      { sourceId: "source-1", newJobsheetNo: "COPY-NO-CHILDREN" },
      user("admin"),
    );

    expect(configured.tx.select).toHaveBeenCalledTimes(2);
    expect(configured.tx.insert).toHaveBeenCalledTimes(1);
    for (const excluded of [
      "sellingCharges",
      "buyingCharges",
      "customsDeclarations",
      "documents",
      "exports",
      "auditHistory",
      "checkedById",
      "approvedById",
      "lockedById",
    ]) {
      expect(configured.insertedValues()).not.toHaveProperty(excluded);
    }
  });

  it.each([
    ["admin", "admin-1"],
    ["ops", "sale-1"],
  ] satisfies Array<[User["role"], string]>) (
    "allows %s when the ownership rule is satisfied",
    async (role, actorId) => {
      configureTransaction();
      await expect(
        duplicateShippingNote(
          { sourceId: "source-1", newJobsheetNo: `COPY-${role}` },
          user(role, actorId),
        ),
      ).resolves.toMatchObject({ id: "copy-1", createdById: actorId });
    },
  );

  it.each([
    ["sale", "other-sale"],
    ["ops", "other-ops"],
  ] satisfies Array<[User["role"], string]>) (
    "rejects cross-owner %s duplication on the server",
    async (role, actorId) => {
      const configured = configureTransaction();
      await expect(
        duplicateShippingNote(
          { sourceId: "source-1", newJobsheetNo: "COPY-002" },
          user(role, actorId),
        ),
      ).rejects.toThrow("permission");
      expect(configured.tx.insert).not.toHaveBeenCalled();
      expect(mocks.logAuditEvent).not.toHaveBeenCalled();
    },
  );

  it("rejects Accountant and inactive or deleted actors", async () => {
    await expect(
      duplicateShippingNote(
        { sourceId: "source-1", newJobsheetNo: "COPY-003" },
        user("accountant"),
      ),
    ).rejects.toThrow("permission");

    for (const actor of [
      { ...user("sale"), isActive: false },
      { ...user("sale"), deletedAt: now },
    ]) {
      await expect(
        duplicateShippingNote(
          { sourceId: "source-1", newJobsheetNo: "COPY-004" },
          actor,
        ),
      ).rejects.toThrow("permission");
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("treats missing or soft-deleted source rows as unauthorized", async () => {
    const configured = configureTransaction({ source: null });
    await expect(
      duplicateShippingNote(
        { sourceId: "missing", newJobsheetNo: "COPY-005" },
        user("admin"),
      ),
    ).rejects.toThrow("permission");
    expect(configured.tx.insert).not.toHaveBeenCalled();
  });

  it("rejects the source Jobsheet and an already-used Jobsheet", async () => {
    configureTransaction();
    await expect(
      duplicateShippingNote(
        { sourceId: "source-1", newJobsheetNo: "source-001" },
        user("admin"),
      ),
    ).rejects.toBeInstanceOf(ShippingNoteJobsheetConflictError);

    configureTransaction({ jobsheetRows: [{ id: "existing" }] });
    await expect(
      duplicateShippingNote(
        { sourceId: "source-1", newJobsheetNo: "USED-001" },
        user("admin"),
      ),
    ).rejects.toBeInstanceOf(ShippingNoteJobsheetConflictError);
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("maps a concurrent database unique violation to the friendly conflict", async () => {
    configureTransaction({ insertError: { code: "23505" } });
    await expect(
      duplicateShippingNote(
        { sourceId: "source-1", newJobsheetNo: "RACE-001" },
        user("admin"),
      ),
    ).rejects.toBeInstanceOf(ShippingNoteJobsheetConflictError);
    expect(mocks.logAuditEvent).not.toHaveBeenCalled();
  });

  it("fails the transaction when the single audit write fails", async () => {
    configureTransaction();
    mocks.logAuditEvent.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(
      duplicateShippingNote(
        { sourceId: "source-1", newJobsheetNo: "COPY-006" },
        user("admin"),
      ),
    ).rejects.toThrow("Failed to duplicate shipping note.");
    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1);
  });
});
