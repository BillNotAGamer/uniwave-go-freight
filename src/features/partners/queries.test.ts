import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: mocks.select,
  },
}));

import type { User as DbUser } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/permissions/require-permission";

import {
  getPartnerById,
  listPartnerCategories,
  listPartners,
  searchPartners,
} from "./queries";

function makeUser(role: DbUser["role"] = "sale", overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: `user-${role}-1`,
    email: `${role}@example.test`,
    name: `${role} User`,
    image: null,
    emailVerified: true,
    role,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
    ...overrides,
  };
}

describe("Partner Master Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authorization guards", () => {
    it("denies access to inactive users", async () => {
      const inactiveUser = makeUser("admin", { isActive: false });

      await expect(getPartnerById("partner-1", inactiveUser)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      await expect(listPartners({}, inactiveUser)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      await expect(listPartnerCategories(inactiveUser)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
    });

    it("allows Sale, Accountant, and Admin to query partners", async () => {
      // Mock db response for listPartners returning empty
      const offset = vi.fn().mockResolvedValue([]);
      const limit = vi.fn(() => ({ offset }));
      const orderBy = vi.fn(() => ({ limit }));
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      mocks.select.mockReturnValue({ from } as never);

      await expect(listPartners({}, makeUser("sale"))).resolves.toEqual([]);
      await expect(listPartners({}, makeUser("accountant"))).resolves.toEqual([]);
      await expect(listPartners({}, makeUser("admin"))).resolves.toEqual([]);
    });
  });

  describe("getPartnerById", () => {
    it("returns null if partner is not found", async () => {
      const limit = vi.fn().mockResolvedValue([]);
      const where = vi.fn(() => ({ limit }));
      const from = vi.fn(() => ({ where }));
      mocks.select.mockReturnValueOnce({ from } as never);

      const result = await getPartnerById("non-existent-id", makeUser("admin"));
      expect(result).toBeNull();
    });

    it("returns partner with active contacts and categories when found", async () => {
      const partnerRow = {
        id: "partner-1",
        vendorCode: "V-001",
        companyName: "Acme Freight Ltd",
        address: "123 Port St",
        taxId: "0102030405",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        deletedAt: null,
      };

      const contactRows = [
        {
          id: "contact-1",
          partnerId: "partner-1",
          picName: "Alice",
          email: "alice@acme.test",
          phone: "+84 901 111 222",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          deletedAt: null,
        },
      ];

      const categoryRows = [
        {
          id: "cat-1",
          code: "factory_sea",
          name: "FACTORY SEA",
          description: "Sea freight factory",
          isActive: true,
        },
      ];

      // 1st select: partner
      const partnerLimit = vi.fn().mockResolvedValue([partnerRow]);
      const partnerWhere = vi.fn(() => ({ limit: partnerLimit }));
      const partnerFrom = vi.fn(() => ({ where: partnerWhere }));

      // 2nd select: contacts
      const contactsOrderBy = vi.fn().mockResolvedValue(contactRows);
      const contactsWhere = vi.fn(() => ({ orderBy: contactsOrderBy }));
      const contactsFrom = vi.fn(() => ({ where: contactsWhere }));

      // 3rd select: categories
      const categoriesOrderBy = vi.fn().mockResolvedValue(categoryRows);
      const categoriesWhere = vi.fn(() => ({ orderBy: categoriesOrderBy }));
      const categoriesInnerJoin = vi.fn(() => ({ where: categoriesWhere }));
      const categoriesFrom = vi.fn(() => ({ innerJoin: categoriesInnerJoin }));

      mocks.select
        .mockReturnValueOnce({ from: partnerFrom } as never)
        .mockReturnValueOnce({ from: contactsFrom } as never)
        .mockReturnValueOnce({ from: categoriesFrom } as never);

      const result = await getPartnerById("partner-1", makeUser("sale"));

      expect(result).not.toBeNull();
      expect(result?.id).toBe("partner-1");
      expect(result?.companyName).toBe("Acme Freight Ltd");
      expect(result?.contacts).toHaveLength(1);
      expect(result?.contacts[0].picName).toBe("Alice");
      expect(result?.categories).toHaveLength(1);
      expect(result?.categories[0].code).toBe("factory_sea");
    });
  });

  describe("listPartners & searchPartners", () => {
    it("returns empty array and does not query category memberships if no partners match", async () => {
      const offset = vi.fn().mockResolvedValue([]);
      const limit = vi.fn(() => ({ offset }));
      const orderBy = vi.fn(() => ({ limit }));
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      mocks.select.mockReturnValueOnce({ from } as never);

      const result = await listPartners({ search: "NonExistent" }, makeUser("admin"));
      expect(result).toEqual([]);
      expect(mocks.select).toHaveBeenCalledTimes(1);
    });

    it("attaches category memberships to matching partners", async () => {
      const partnersList = [
        {
          id: "p-1",
          vendorCode: "P1",
          companyName: "Partner One",
          address: "Addr 1",
          taxId: "T1",
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ];

      const categoryMemberships = [
        {
          partnerId: "p-1",
          category: {
            id: "cat-1",
            code: "airline",
            name: "DATA HÃNG BAY",
            description: "Airlines",
            isActive: true,
          },
        },
      ];

      // 1st select: partners
      const offset = vi.fn().mockResolvedValue(partnersList);
      const limit = vi.fn(() => ({ offset }));
      const orderBy = vi.fn(() => ({ limit }));
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));

      // 2nd select: category memberships
      const catOrderBy = vi.fn().mockResolvedValue(categoryMemberships);
      const catWhere = vi.fn(() => ({ orderBy: catOrderBy }));
      const catInnerJoin = vi.fn(() => ({ where: catWhere }));
      const catFrom = vi.fn(() => ({ innerJoin: catInnerJoin }));

      mocks.select
        .mockReturnValueOnce({ from } as never)
        .mockReturnValueOnce({ from: catFrom } as never);

      const result = await searchPartners("Partner", makeUser("sale"), { limit: 10 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p-1");
      expect(result[0].categories).toHaveLength(1);
      expect(result[0].categories[0].code).toBe("airline");
      expect(limit).toHaveBeenCalledWith(10);
    });
  });

  describe("listPartnerCategories", () => {
    it("lists active categories ordered by name and code", async () => {
      const categories = [
        {
          id: "cat-1",
          code: "factory_sea",
          name: "FACTORY SEA",
          description: "Sea freight factory",
          isActive: true,
        },
      ];

      const orderBy = vi.fn().mockResolvedValue(categories);
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      mocks.select.mockReturnValueOnce({ from } as never);

      const result = await listPartnerCategories(makeUser("accountant"));
      expect(result).toEqual(categories);
    });
  });
});
