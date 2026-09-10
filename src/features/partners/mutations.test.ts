import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

import type { User as DbUser } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import {
  addPartnerContact,
  createPartner,
  restorePartner,
  setPartnerCategories,
  softDeletePartner,
  softDeletePartnerContact,
  updatePartner,
  updatePartnerContact,
} from "./mutations";

function makeUser(role: DbUser["role"] = "admin"): DbUser {
  return {
    id: `user-${role}-id`,
    email: `${role}@example.test`,
    name: `${role} User`,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
  };
}

type MockTx = Record<string, unknown>;
type TransactionCallback<T = unknown> = (tx: MockTx) => Promise<T>;

function mockTransactionWith(tx: MockTx): void {
  mocks.transaction.mockImplementation(async (callback: TransactionCallback) => {
    return callback(tx);
  });
}

describe("Partner Master Mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authorization guards", () => {
    it("denies Sale and Accountant from creating partners", async () => {
      const input = { companyName: "Test Company" };

      await expect(createPartner(input, makeUser("sale"))).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      await expect(
        createPartner(input, makeUser("accountant")),
      ).rejects.toBeInstanceOf(AuthorizationError);

      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("denies Sale and Accountant from updating or soft-deleting partners", async () => {
      await expect(
        updatePartner("p-1", { id: "p-1", companyName: "New Name" }, makeUser("sale")),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        softDeletePartner("p-1", makeUser("accountant")),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        restorePartner("p-1", makeUser("sale")),
      ).rejects.toBeInstanceOf(AuthorizationError);
    });

    it("denies Sale and Accountant from managing contacts and categories", async () => {
      await expect(
        addPartnerContact("p-1", { picName: "Bob" }, makeUser("sale")),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        updatePartnerContact("c-1", { picName: "Bob" }, makeUser("sale")),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        softDeletePartnerContact("c-1", makeUser("sale")),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        setPartnerCategories("p-1", ["factory_sea"], makeUser("sale")),
      ).rejects.toBeInstanceOf(AuthorizationError);
    });
  });

  describe("createPartner", () => {
    it("creates a partner with contacts and categories in a transaction and logs audit", async () => {
      const insertedPartner = {
        id: "partner-uuid",
        companyName: "Global Trans",
        vendorCode: "GT-01",
        address: "789 Sea Way",
        taxId: "030999888",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: null,
      };

      const insertedContact = {
        id: "contact-uuid",
        partnerId: "partner-uuid",
        picName: "John Doe",
        email: "john@globaltrans.test",
        phone: "+84 901 000 111",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: null,
      };

      const categoryRow = {
        id: "cat-1",
        code: "factory_sea",
        name: "FACTORY SEA",
        description: "Sea factory",
        isActive: true,
      };

      const txMock = {
        insert: vi.fn(),
        select: vi.fn(),
      };

      // 1st insert: partner
      const partnerReturning = vi.fn().mockResolvedValue([insertedPartner]);
      const partnerValues = vi.fn(() => ({ returning: partnerReturning }));

      // 2nd insert: contact
      const contactReturning = vi.fn().mockResolvedValue([insertedContact]);
      const contactValues = vi.fn(() => ({ returning: contactReturning }));

      // 3rd insert: category membership
      const catMemberValues = vi.fn().mockResolvedValue([]);

      txMock.insert
        .mockReturnValueOnce({ values: partnerValues })
        .mockReturnValueOnce({ values: contactValues })
        .mockReturnValueOnce({ values: catMemberValues });

      // select categories by code
      const catWhere = vi.fn().mockResolvedValue([categoryRow]);
      const catFrom = vi.fn(() => ({ where: catWhere }));
      txMock.select.mockReturnValueOnce({ from: catFrom });

      mockTransactionWith(txMock);

      const result = await createPartner(
        {
          companyName: "Global Trans",
          vendorCode: "GT-01",
          address: "789 Sea Way",
          taxId: "030999888",
          categoryCodes: ["factory_sea"],
          contacts: [
            {
              picName: "John Doe",
              email: "john@globaltrans.test",
              phone: "+84 901 000 111",
            },
          ],
        },
        makeUser("admin"),
      );

      expect(result.id).toBe("partner-uuid");
      expect(result.companyName).toBe("Global Trans");
      expect(result.contacts).toHaveLength(1);
      expect(result.categories).toHaveLength(1);

      expect(mocks.logAuditEvent).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          action: "partner.create",
          entityType: "partner",
          entityId: "partner-uuid",
        }),
      );
    });
  });

  describe("softDeletePartner & Lifecycle Invariant", () => {
    it("sets deletedAt and isActive = false without hard deleting partner or child contacts", async () => {
      const existingPartner = {
        id: "partner-uuid",
        companyName: "Target Partner",
        isActive: true,
        deletedAt: null,
      };

      const updatedPartner = {
        ...existingPartner,
        isActive: false,
        deletedAt: new Date("2026-09-01T00:00:00Z"),
      };

      const txMock = {
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(), // Should NEVER be called
      };

      // select current partner
      const partnerLimit = vi.fn().mockResolvedValue([existingPartner]);
      const partnerWhere = vi.fn(() => ({ limit: partnerLimit }));
      const partnerFrom = vi.fn(() => ({ where: partnerWhere }));

      // update partner
      const partnerReturning = vi.fn().mockResolvedValue([updatedPartner]);
      const partnerUpdateWhere = vi.fn(() => ({ returning: partnerReturning }));
      const partnerSet = vi.fn(() => ({ where: partnerUpdateWhere }));

      // select contacts
      const contactsWhere = vi.fn().mockResolvedValue([]);
      const contactsFrom = vi.fn(() => ({ where: contactsWhere }));

      // select categories
      const catWhere = vi.fn().mockResolvedValue([]);
      const catInnerJoin = vi.fn(() => ({ where: catWhere }));
      const catFrom = vi.fn(() => ({ innerJoin: catInnerJoin }));

      txMock.select
        .mockReturnValueOnce({ from: partnerFrom })
        .mockReturnValueOnce({ from: contactsFrom })
        .mockReturnValueOnce({ from: catFrom });

      txMock.update.mockReturnValueOnce({ set: partnerSet });

      mockTransactionWith(txMock);

      const result = await softDeletePartner("partner-uuid", makeUser("admin"));

      expect(result.isActive).toBe(false);
      expect(result.deletedAt).not.toBeNull();

      // Verify that NO hard delete was executed
      expect(txMock.delete).not.toHaveBeenCalled();

      // Verify audit event
      expect(mocks.logAuditEvent).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          action: "partner.soft_delete",
          entityType: "partner",
          entityId: "partner-uuid",
        }),
      );
    });
  });

  describe("softDeletePartnerContact", () => {
    it("sets deletedAt on contact without hard deleting", async () => {
      const existingContact = {
        id: "contact-uuid",
        partnerId: "partner-uuid",
        picName: "Alice",
        deletedAt: null,
      };

      const updatedContact = {
        ...existingContact,
        deletedAt: new Date("2026-09-01T00:00:00Z"),
      };

      const txMock = {
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };

      const selectLimit = vi.fn().mockResolvedValue([existingContact]);
      const selectWhere = vi.fn(() => ({ limit: selectLimit }));
      const selectFrom = vi.fn(() => ({ where: selectWhere }));

      const updateReturning = vi.fn().mockResolvedValue([updatedContact]);
      const updateWhere = vi.fn(() => ({ returning: updateReturning }));
      const updateSet = vi.fn(() => ({ where: updateWhere }));

      txMock.select.mockReturnValueOnce({ from: selectFrom });
      txMock.update.mockReturnValueOnce({ set: updateSet });

      mockTransactionWith(txMock);

      const result = await softDeletePartnerContact("contact-uuid", makeUser("admin"));

      expect(result.deletedAt).not.toBeNull();
      expect(txMock.delete).not.toHaveBeenCalled();
      expect(mocks.logAuditEvent).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          action: "partner.contact.soft_delete",
          entityType: "partner_contact",
          entityId: "contact-uuid",
        }),
      );
    });
  });

  describe("restorePartner", () => {
    it("resets deletedAt to null and sets isActive to true", async () => {
      const existingPartner = {
        id: "partner-uuid",
        companyName: "Target Partner",
        isActive: false,
        deletedAt: new Date("2026-09-01T00:00:00Z"),
      };

      const restoredPartner = {
        ...existingPartner,
        isActive: true,
        deletedAt: null,
      };

      const txMock = {
        select: vi.fn(),
        update: vi.fn(),
      };

      const partnerLimit = vi.fn().mockResolvedValue([existingPartner]);
      const partnerWhere = vi.fn(() => ({ limit: partnerLimit }));
      const partnerFrom = vi.fn(() => ({ where: partnerWhere }));

      const partnerReturning = vi.fn().mockResolvedValue([restoredPartner]);
      const partnerUpdateWhere = vi.fn(() => ({ returning: partnerReturning }));
      const partnerSet = vi.fn(() => ({ where: partnerUpdateWhere }));

      const contactsWhere = vi.fn().mockResolvedValue([]);
      const contactsFrom = vi.fn(() => ({ where: contactsWhere }));

      const catWhere = vi.fn().mockResolvedValue([]);
      const catInnerJoin = vi.fn(() => ({ where: catWhere }));
      const catFrom = vi.fn(() => ({ innerJoin: catInnerJoin }));

      txMock.select
        .mockReturnValueOnce({ from: partnerFrom })
        .mockReturnValueOnce({ from: contactsFrom })
        .mockReturnValueOnce({ from: catFrom });

      txMock.update.mockReturnValueOnce({ set: partnerSet });

      mockTransactionWith(txMock);

      const result = await restorePartner("partner-uuid", makeUser("admin"));

      expect(result.isActive).toBe(true);
      expect(result.deletedAt).toBeNull();
      expect(mocks.logAuditEvent).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          action: "partner.restore",
          entityType: "partner",
          entityId: "partner-uuid",
        }),
      );
    });
  });

  describe("setPartnerCategories", () => {
    it("deduplicates category codes and replaces memberships within a transaction", async () => {
      const existingPartner = { id: "partner-uuid" };
      const categoryRow = {
        id: "cat-1",
        code: "airline",
        name: "DATA HÃNG BAY",
        description: "Airlines",
        isActive: true,
      };

      const txMock = {
        select: vi.fn(),
        delete: vi.fn(),
        insert: vi.fn(),
      };

      // partner check
      const partnerLimit = vi.fn().mockResolvedValue([existingPartner]);
      const partnerWhere = vi.fn(() => ({ limit: partnerLimit }));
      const partnerFrom = vi.fn(() => ({ where: partnerWhere }));

      // previous categories
      const prevCatWhere = vi.fn().mockResolvedValue([]);
      const prevCatJoin = vi.fn(() => ({ where: prevCatWhere }));
      const prevCatFrom = vi.fn(() => ({ innerJoin: prevCatJoin }));

      // delete existing memberships
      const deleteWhere = vi.fn().mockResolvedValue([]);
      txMock.delete.mockReturnValueOnce({ where: deleteWhere });

      // select matching categories
      const selectCatWhere = vi.fn().mockResolvedValue([categoryRow]);
      const selectCatFrom = vi.fn(() => ({ where: selectCatWhere }));

      // insert new memberships
      const insertValues = vi.fn().mockResolvedValue([]);
      txMock.insert.mockReturnValueOnce({ values: insertValues });

      txMock.select
        .mockReturnValueOnce({ from: partnerFrom })
        .mockReturnValueOnce({ from: prevCatFrom })
        .mockReturnValueOnce({ from: selectCatFrom });

      mockTransactionWith(txMock);

      const result = await setPartnerCategories(
        "partner-uuid",
        ["airline", "airline"], // duplicates
        makeUser("admin"),
      );

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("airline");
      expect(insertValues).toHaveBeenCalledTimes(1);
      expect(mocks.logAuditEvent).toHaveBeenCalledWith(
        txMock,
        expect.objectContaining({
          action: "partner.category.update",
          entityType: "partner",
          entityId: "partner-uuid",
        }),
      );
    });
  });
});
