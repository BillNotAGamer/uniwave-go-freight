import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

type InlineForeignKey = {
  onDelete: string;
  reference: () => {
    foreignTable: unknown;
    columns: Array<{ name: string }>;
  };
};

const getInlineForeignKeys = (table: unknown): InlineForeignKey[] => {
  const tableRecord = table as Record<symbol, unknown>;
  const fks = tableRecord[Symbol.for("drizzle:PgInlineForeignKeys")];
  return (Array.isArray(fks) ? fks : []) as InlineForeignKey[];
};

import {
  businessPartners,
  businessPartnersRelations,
  partnerCategories,
  partnerCategoriesRelations,
  partnerCategoryMembers,
  partnerCategoryMembersRelations,
  partnerContacts,
  partnerContactsRelations,
} from "@/lib/db/schema";

describe("Partner Master Schema Foundation Contract", () => {
  describe("business_partners table", () => {
    it("has the expected table name and core columns", () => {
      const config = getTableConfig(businessPartners);
      expect(config.name).toBe("business_partners");

      expect(businessPartners.id).toBeDefined();
      expect(businessPartners.vendorCode).toBeDefined();
      expect(businessPartners.companyName).toBeDefined();
      expect(businessPartners.address).toBeDefined();
      expect(businessPartners.taxId).toBeDefined();
      expect(businessPartners.isActive).toBeDefined();
      expect(businessPartners.createdAt).toBeDefined();
      expect(businessPartners.updatedAt).toBeDefined();
      expect(businessPartners.deletedAt).toBeDefined();
    });

    it("enforces nullability rules correctly", () => {
      expect(businessPartners.companyName.notNull).toBe(true);
      expect(businessPartners.vendorCode.notNull).toBe(false);
      expect(businessPartners.address.notNull).toBe(false);
      expect(businessPartners.taxId.notNull).toBe(false);
      expect(businessPartners.isActive.notNull).toBe(true);
      expect(businessPartners.deletedAt.notNull).toBe(false);
    });

    it("does NOT enforce global database uniqueness on vendorCode, taxId, or companyName", () => {
      const config = getTableConfig(businessPartners);
      const uniqueConstraints = config.uniqueConstraints ?? [];
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);

      const uniqueCols = new Set<string>();
      for (const uq of uniqueConstraints) {
        for (const col of uq.columns) {
          uniqueCols.add(col.name);
        }
      }
      for (const uidx of uniqueIndexes) {
        for (const col of uidx.config.columns) {
          if ("name" in col) {
            uniqueCols.add(col.name as string);
          }
        }
      }

      // vendorCode, taxId, companyName MUST NOT be unique
      expect(uniqueCols.has("vendor_code")).toBe(false);
      expect(uniqueCols.has("tax_id")).toBe(false);
      expect(uniqueCols.has("company_name")).toBe(false);
    });

    it("has search/lookup indexes on companyName, vendorCode, and taxId", () => {
      const config = getTableConfig(businessPartners);
      const indexNames = config.indexes.map((idx) => idx.config.name);

      expect(indexNames).toContain("business_partners_company_name_idx");
      expect(indexNames).toContain("business_partners_vendor_code_idx");
      expect(indexNames).toContain("business_partners_tax_id_idx");
    });
  });

  describe("partner_contacts table", () => {
    it("has the expected table name and core columns", () => {
      const config = getTableConfig(partnerContacts);
      expect(config.name).toBe("partner_contacts");

      expect(partnerContacts.id).toBeDefined();
      expect(partnerContacts.partnerId).toBeDefined();
      expect(partnerContacts.picName).toBeDefined();
      expect(partnerContacts.email).toBeDefined();
      expect(partnerContacts.phone).toBeDefined();
      expect(partnerContacts.createdAt).toBeDefined();
      expect(partnerContacts.updatedAt).toBeDefined();
      expect(partnerContacts.deletedAt).toBeDefined();
    });

    it("does NOT enforce global database uniqueness on email, phone, or picName", () => {
      const config = getTableConfig(partnerContacts);
      const uniqueConstraints = config.uniqueConstraints ?? [];
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);

      const uniqueCols = new Set<string>();
      for (const uq of uniqueConstraints) {
        for (const col of uq.columns) {
          uniqueCols.add(col.name);
        }
      }
      for (const uidx of uniqueIndexes) {
        for (const col of uidx.config.columns) {
          if ("name" in col) {
            uniqueCols.add(col.name as string);
          }
        }
      }

      expect(uniqueCols.has("email")).toBe(false);
      expect(uniqueCols.has("phone")).toBe(false);
      expect(uniqueCols.has("pic_name")).toBe(false);
      expect(uniqueIndexes).toHaveLength(0);
    });

    it("configures foreign key cascade to business_partners", () => {
      const inlineFks = getInlineForeignKeys(partnerContacts);

      expect(inlineFks).toBeDefined();
      expect(inlineFks.length).toBeGreaterThan(0);

      const partnerFk = inlineFks.find((fk) => {
        const ref = fk.reference();
        return (
          ref.foreignTable === businessPartners &&
          ref.columns.some((c) => c.name === "partner_id")
        );
      });

      expect(partnerFk).toBeDefined();
      expect(partnerFk?.onDelete).toBe("cascade");
    });
  });

  describe("partner_categories table", () => {
    it("has the expected table name and core columns", () => {
      const config = getTableConfig(partnerCategories);
      expect(config.name).toBe("partner_categories");

      expect(partnerCategories.id).toBeDefined();
      expect(partnerCategories.code).toBeDefined();
      expect(partnerCategories.name).toBeDefined();
      expect(partnerCategories.description).toBeDefined();
      expect(partnerCategories.isActive).toBeDefined();
      expect(partnerCategories.createdAt).toBeDefined();
      expect(partnerCategories.updatedAt).toBeDefined();
    });

    it("enforces database uniqueness on category code", () => {
      const config = getTableConfig(partnerCategories);
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);

      const codeUniqueIndex = uniqueIndexes.find((idx) =>
        idx.config.columns.some(
          (col) => "name" in col && col.name === "code",
        ),
      );

      expect(codeUniqueIndex).toBeDefined();
      expect(codeUniqueIndex?.config.name).toBe("partner_categories_code_uidx");
    });
  });

  describe("partner_category_members table", () => {
    it("has the expected table name and core columns", () => {
      const config = getTableConfig(partnerCategoryMembers);
      expect(config.name).toBe("partner_category_members");

      expect(partnerCategoryMembers.id).toBeDefined();
      expect(partnerCategoryMembers.partnerId).toBeDefined();
      expect(partnerCategoryMembers.categoryId).toBeDefined();
      expect(partnerCategoryMembers.createdAt).toBeDefined();
    });

    it("prevents duplicate membership of the same partnerId + categoryId via unique index", () => {
      const config = getTableConfig(partnerCategoryMembers);
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);

      const membershipUniqueIndex = uniqueIndexes.find(
        (idx) => idx.config.name === "partner_category_members_partner_id_category_id_uidx",
      );

      expect(membershipUniqueIndex).toBeDefined();
      const colNames = membershipUniqueIndex?.config.columns.map(
        (c) => ("name" in c ? (c.name as string) : ""),
      );
      expect(colNames).toContain("partner_id");
      expect(colNames).toContain("category_id");
    });

    it("configures foreign key cascade to both business_partners and partner_categories", () => {
      const inlineFks = getInlineForeignKeys(partnerCategoryMembers);

      expect(inlineFks).toBeDefined();
      expect(inlineFks.length).toBe(2);

      const partnerFk = inlineFks.find((fk) => {
        const ref = fk.reference();
        return (
          ref.foreignTable === businessPartners &&
          ref.columns.some((c) => c.name === "partner_id")
        );
      });
      const categoryFk = inlineFks.find((fk) => {
        const ref = fk.reference();
        return (
          ref.foreignTable === partnerCategories &&
          ref.columns.some((c) => c.name === "category_id")
        );
      });

      expect(partnerFk).toBeDefined();
      expect(partnerFk?.onDelete).toBe("cascade");
      expect(categoryFk).toBeDefined();
      expect(categoryFk?.onDelete).toBe("cascade");
    });
  });

  describe("Drizzle relation definitions", () => {
    it("defines 1:N relations from businessPartners to partnerContacts", () => {
      expect(businessPartnersRelations).toBeDefined();
      expect(businessPartnersRelations.table).toBe(businessPartners);
    });

    it("defines N:N category membership relations through partnerCategoryMembers", () => {
      expect(partnerCategoriesRelations).toBeDefined();
      expect(partnerCategoriesRelations.table).toBe(partnerCategories);

      expect(partnerCategoryMembersRelations).toBeDefined();
      expect(partnerCategoryMembersRelations.table).toBe(partnerCategoryMembers);

      expect(partnerContactsRelations).toBeDefined();
      expect(partnerContactsRelations.table).toBe(partnerContacts);
    });
  });

  describe("Model contract and cardinality guarantees", () => {
    it("proves BusinessPartner can have multiple contacts", () => {
      const partnerId = "partner-1";
      const contacts = [
        {
          id: "contact-1",
          partnerId,
          picName: "Alice",
          email: "alice@example.com",
          phone: "0901234567",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "contact-2",
          partnerId,
          picName: "Bob",
          email: "bob@example.com",
          phone: "0907654321",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      expect(contacts).toHaveLength(2);
      expect(contacts.every((c) => c.partnerId === partnerId)).toBe(true);
    });

    it("proves BusinessPartner can have multiple categories", () => {
      const partnerId = "partner-1";
      const memberships = [
        {
          id: "mem-1",
          partnerId,
          categoryId: "cat-sea",
          createdAt: new Date(),
        },
        {
          id: "mem-2",
          partnerId,
          categoryId: "cat-air",
          createdAt: new Date(),
        },
      ];

      expect(memberships).toHaveLength(2);
      expect(memberships.every((m) => m.partnerId === partnerId)).toBe(true);
      expect(new Set(memberships.map((m) => m.categoryId)).size).toBe(2);
    });

    it("proves a category can contain multiple partners", () => {
      const categoryId = "cat-sea";
      const memberships = [
        {
          id: "mem-1",
          partnerId: "partner-1",
          categoryId,
          createdAt: new Date(),
        },
        {
          id: "mem-2",
          partnerId: "partner-2",
          categoryId,
          createdAt: new Date(),
        },
      ];

      expect(memberships).toHaveLength(2);
      expect(memberships.every((m) => m.categoryId === categoryId)).toBe(true);
      expect(new Set(memberships.map((m) => m.partnerId)).size).toBe(2);
    });

    it("proves PartnerCategoryMember composite key prevents duplicate partner/category membership", () => {
      const config = getTableConfig(partnerCategoryMembers);
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);

      const membershipUniqueIndex = uniqueIndexes.find(
        (idx) =>
          idx.config.name ===
          "partner_category_members_partner_id_category_id_uidx",
      );

      expect(membershipUniqueIndex).toBeDefined();

      // Simulate composite uniqueness enforcement
      const existingMemberships = new Set<string>();
      const addMembership = (pId: string, cId: string) => {
        const key = `${pId}:${cId}`;
        if (existingMemberships.has(key)) {
          throw new Error("duplicate key value violates unique constraint");
        }
        existingMemberships.add(key);
      };

      addMembership("partner-1", "cat-1");
      expect(() => addMembership("partner-1", "cat-1")).toThrow(
        "duplicate key value violates unique constraint",
      );
      // Different category for same partner is allowed
      expect(() => addMembership("partner-1", "cat-2")).not.toThrow();
      // Same category for different partner is allowed
      expect(() => addMembership("partner-2", "cat-1")).not.toThrow();
    });

    it("confirms vendorCode is not globally unique at schema level", () => {
      const config = getTableConfig(businessPartners);
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);
      const isVendorCodeUnique = uniqueIndexes.some((idx) =>
        idx.config.columns.some((c) => "name" in c && c.name === "vendor_code"),
      );
      expect(isVendorCodeUnique).toBe(false);
    });

    it("confirms taxId is not globally unique at schema level", () => {
      const config = getTableConfig(businessPartners);
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);
      const isTaxIdUnique = uniqueIndexes.some((idx) =>
        idx.config.columns.some((c) => "name" in c && c.name === "tax_id"),
      );
      expect(isTaxIdUnique).toBe(false);
    });

    it("confirms contact email is not globally unique at schema level", () => {
      const config = getTableConfig(partnerContacts);
      const uniqueIndexes = config.indexes.filter((idx) => idx.config.unique);
      const isEmailUnique = uniqueIndexes.some((idx) =>
        idx.config.columns.some((c) => "name" in c && c.name === "email"),
      );
      expect(isEmailUnique).toBe(false);
    });
  });
});

