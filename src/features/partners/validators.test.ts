import { describe, expect, it } from "vitest";

import {
  createPartnerInputSchema,
  listPartnersFilterSchema,
  partnerContactInputSchema,
  setPartnerCategoriesInputSchema,
  updatePartnerInputSchema,
} from "./validators";

describe("Partner Master Validators", () => {
  describe("partnerContactInputSchema", () => {
    it("accepts a contact with only picName", () => {
      const result = partnerContactInputSchema.safeParse({
        picName: "  Nguyen Van A  ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.picName).toBe("Nguyen Van A");
        expect(result.data.email).toBeUndefined();
        expect(result.data.phone).toBeUndefined();
      }
    });

    it("accepts a contact with only valid international email and normalizes to lowercase", () => {
      const result = partnerContactInputSchema.safeParse({
        email: "  CONTACT@Global-Freight.CO.UK  ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("contact@global-freight.co.uk");
        expect(result.data.picName).toBeUndefined();
      }
    });

    it("accepts international phone formats without Vietnam-only restriction", () => {
      const samples = [
        "+84 901 234 567",
        "+1-800-555-0199",
        "(028) 3822 1234",
        "0903123456",
        "+44 20 7946 0919",
      ];

      for (const phone of samples) {
        const result = partnerContactInputSchema.safeParse({ phone });
        expect(result.success).toBe(true);
      }
    });

    it("rejects a contact when all fields are empty or whitespace-only", () => {
      const result = partnerContactInputSchema.safeParse({
        picName: "   ",
        email: "",
        phone: "   ",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "At least one contact point",
        );
      }
    });

    it("rejects an invalid email format when email is non-empty", () => {
      const result = partnerContactInputSchema.safeParse({
        picName: "Test Person",
        email: "not-an-email",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["email"]);
      }
    });
  });

  describe("createPartnerInputSchema", () => {
    it("accepts valid minimal partner data", () => {
      const result = createPartnerInputSchema.safeParse({
        companyName: "  Uniwave Global Shipping Co., Ltd  ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.companyName).toBe("Uniwave Global Shipping Co., Ltd");
        expect(result.data.vendorCode).toBeUndefined();
        expect(result.data.address).toBeUndefined();
        expect(result.data.taxId).toBeUndefined();
        expect(result.data.isActive).toBe(true);
        expect(result.data.categoryCodes).toEqual([]);
        expect(result.data.contacts).toEqual([]);
      }
    });

    it("rejects empty or whitespace-only companyName", () => {
      const result = createPartnerInputSchema.safeParse({
        companyName: "   ",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(["companyName"]);
      }
    });

    it("accepts non-Vietnam and overseas tax IDs without rejecting format", () => {
      const taxIds = [
        "0314567890",
        "0314567890-001",
        "DE123456789",
        "US-EIN-12-3456789",
        "CHE-123.456.789 TVA",
      ];

      for (const taxId of taxIds) {
        const result = createPartnerInputSchema.safeParse({
          companyName: "Valid Company",
          taxId,
        });

        expect(result.success).toBe(true);
      }
    });

    it("accepts full partner payload with canonical categories and contacts", () => {
      const result = createPartnerInputSchema.safeParse({
        companyName: "Sealand Logistics",
        vendorCode: "SEA-001",
        address: "123 Port Road, Hai Phong",
        taxId: "0201234567",
        categoryCodes: ["factory_sea", "co_loader_buying"],
        contacts: [
          {
            picName: "Operations Desk",
            email: "ops@sealand.com",
            phone: "+84 225 3123456",
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryCodes).toEqual([
          "factory_sea",
          "co_loader_buying",
        ]);
        expect(result.data.contacts).toHaveLength(1);
      }
    });

    it("rejects invalid non-canonical category codes", () => {
      const result = createPartnerInputSchema.safeParse({
        companyName: "Invalid Category Partner",
        categoryCodes: ["unknown_category" as never],
      });

      expect(result.success).toBe(false);
    });

    it("does not reject duplicate vendorCode or taxId at the schema validation level", () => {
      // In C0, vendorCode and taxId uniqueness are NOT assumed
      const input1 = {
        companyName: "Branch A",
        vendorCode: "SHARED_CODE",
        taxId: "SHARED_TAX",
      };
      const input2 = {
        companyName: "Branch B",
        vendorCode: "SHARED_CODE",
        taxId: "SHARED_TAX",
      };

      expect(createPartnerInputSchema.safeParse(input1).success).toBe(true);
      expect(createPartnerInputSchema.safeParse(input2).success).toBe(true);
    });
  });

  describe("updatePartnerInputSchema", () => {
    it("requires partner id and validates company name", () => {
      const valid = updatePartnerInputSchema.safeParse({
        id: "partner-123",
        companyName: "Updated Name",
        isActive: false,
      });

      expect(valid.success).toBe(true);

      const invalid = updatePartnerInputSchema.safeParse({
        id: "",
        companyName: "Updated Name",
      });

      expect(invalid.success).toBe(false);
    });
  });

  describe("setPartnerCategoriesInputSchema", () => {
    it("deduplicates repeated category codes in input", () => {
      const result = setPartnerCategoriesInputSchema.safeParse({
        partnerId: "partner-1",
        categoryCodes: ["airline", "factory_sea", "airline", "factory_sea"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categoryCodes).toEqual(["airline", "factory_sea"]);
      }
    });
  });

  describe("listPartnersFilterSchema", () => {
    it("provides expected defaults for activeOnly, limit, and offset", () => {
      const result = listPartnersFilterSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeOnly).toBe(true);
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
        expect(result.data.search).toBeUndefined();
        expect(result.data.categoryCode).toBeUndefined();
      }
    });

    it("parses valid search and canonical category filters", () => {
      const result = listPartnersFilterSchema.safeParse({
        activeOnly: false,
        categoryCode: "oversea_agent_buying",
        search: "  Uniwave  ",
        limit: "25",
        offset: "50",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activeOnly).toBe(false);
        expect(result.data.categoryCode).toBe("oversea_agent_buying");
        expect(result.data.search).toBe("Uniwave");
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(50);
      }
    });
  });
});
