import { describe, expect, it, vi } from "vitest";

import {
  checkMigrationTableExistence,
  classifyPartnerImportState,
  executePartnerImportPlan,
  applyPartnerImportPlan,
  PartnerImportAuthorizationError,
  validateApplyAuthorization,
} from "./execute";
import type { PartnerImportPlan } from "./types";

function makeMinimalPlan(): PartnerImportPlan {
  return {
    workbookFingerprint: "abc123hash",
    workbookFingerprintPrefix: "abc123hashpref",
    fileSizeBytes: 1000,
    categories: [
      "factory_sea",
      "air_factory",
      "airline",
      "co_loader_buying",
      "co_loader_selling",
      "oversea_agent_selling",
      "oversea_agent_buying",
    ],
    partners: [
      {
        id: "p-1",
        companyName: "Acme Logistics",
        vendorCode: "ACM",
        address: "123 Port",
        taxId: "TAX-1",
        sourceRowNumbers: [3],
        categories: ["factory_sea"],
      },
    ],
    contacts: [
      {
        id: "c-1",
        partnerCompanyName: "Acme Logistics",
        picName: "Alice",
        email: "alice@acme.test",
        phone: "+84 901 000 001",
        sourceRowNumbers: [3],
      },
    ],
    categoryMemberships: [
      {
        partnerCompanyName: "Acme Logistics",
        categoryCode: "factory_sea",
        sourceRowNumbers: [3],
      },
    ],
    quarantinedRows: [],
    stats: {
      sourceCategoryPresenceEntities: 1,
      tbaPlaceholders: 0,
      namedCategoryPresences: 1,
      uniqueNamedBusinessPartners: 1,
      sourceContactRows: 1,
      unresolvedTbaContactRows: 0,
      exactDuplicateContactRows: 0,
      canonicalContactCandidates: 1,
      categories: 1,
      categoryMemberships: 1,
    },
    warnings: [],
  };
}

describe("Import Execution & Safety Gates", () => {
  describe("C2A dry-run and apply prohibition", () => {
    it("completes dry-run successfully with 0 database writes", async () => {
      const plan = makeMinimalPlan();
      const report = await executePartnerImportPlan(plan, { dryRun: true });

      expect(report.status).toBe("DRY_RUN_SUCCESS");
      expect(report.appliedDatabaseWrites).toBe(0);
      expect(report.partnersCount).toBe(1);
      expect(report.contactsCount).toBe(1);
    });

    it("strictly forbids database apply in Phase C2A", async () => {
      const plan = makeMinimalPlan();
      await expect(
        executePartnerImportPlan(plan, { dryRun: false }),
      ).rejects.toThrowError(/applyPartnerImportPlan/);
    });
  });

  describe("validateApplyAuthorization", () => {
    const validEnv = {
      PARTNER_IMPORT_AUTHORIZED: "true",
      PARTNER_IMPORT_CONFIRM: "IMPORT_UNIWAVE_PARTNERS",
      DATABASE_URL: "postgresql://user:pass@ep-staging.us-east-2.aws.neon.tech/uniwave_db",
      PARTNER_IMPORT_PRODUCTION_AUTHORIZED: "true",
    };

    it("requires PARTNER_IMPORT_AUTHORIZED=true", () => {
      expect(() =>
        validateApplyAuthorization(
          { ...validEnv, PARTNER_IMPORT_AUTHORIZED: "false" },
          { dryRun: false },
        ),
      ).toThrow(PartnerImportAuthorizationError);
    });

    it("requires PARTNER_IMPORT_CONFIRM=IMPORT_UNIWAVE_PARTNERS", () => {
      expect(() =>
        validateApplyAuthorization(
          { ...validEnv, PARTNER_IMPORT_CONFIRM: "WRONG_CONFIRM" },
          { dryRun: false },
        ),
      ).toThrow(PartnerImportAuthorizationError);
    });

    it("requires PARTNER_IMPORT_PRODUCTION_AUTHORIZED=true when neon/prod host is detected", () => {
      expect(() =>
        validateApplyAuthorization(
          {
            ...validEnv,
            PARTNER_IMPORT_PRODUCTION_AUTHORIZED: undefined,
          },
          { dryRun: false },
        ),
      ).toThrow(PartnerImportAuthorizationError);
    });

    it("enforces expectedHost verification", () => {
      expect(() =>
        validateApplyAuthorization(validEnv, {
          dryRun: false,
          expectedHost: "different-host.neon.tech",
        }),
      ).toThrow(PartnerImportAuthorizationError);
    });

    it("enforces expectedDatabase verification", () => {
      expect(() =>
        validateApplyAuthorization(validEnv, {
          dryRun: false,
          expectedDatabase: "different_db",
        }),
      ).toThrow(PartnerImportAuthorizationError);
    });

    it("accepts valid authorization and descriptors", () => {
      const result = validateApplyAuthorization(validEnv, {
        dryRun: false,
        expectedHost: "ep-staging.us-east-2.aws.neon.tech",
        expectedDatabase: "uniwave_db",
      });

      expect(result.targetHost).toBe("ep-staging.us-east-2.aws.neon.tech");
      expect(result.targetDatabase).toBe("uniwave_db");
    });
  });

  describe("applyPartnerImportPlan (mocked)", () => {
    const validEnv = {
      PARTNER_IMPORT_AUTHORIZED: "true",
      PARTNER_IMPORT_CONFIRM: "IMPORT_UNIWAVE_PARTNERS",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/local_test",
      PARTNER_IMPORT_EXPECTED_HOST: "localhost",
      PARTNER_IMPORT_EXPECTED_DATABASE: "local_test",
    };

    it("stops if migration tables do not exist", async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }), // table check fails
        transaction: vi.fn(),
      };

      await expect(
        applyPartnerImportPlan(makeMinimalPlan(), mockDb, validEnv, { dryRun: false }),
      ).rejects.toThrowError(/STOP — PARTNER MASTER MIGRATION NOT APPLIED/);
    });

    it("behaves idempotently when canonical dataset is already present in DB", async () => {
      const plan = makeMinimalPlan();
      const mockDb = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("information_schema.tables")) {
            return { rows: [{ exists: 1 }] };
          }
          if (sql.includes("FROM business_partners")) {
            return { rows: [{ company_name: "Acme Logistics" }] }; // Exactly matches plan length
          }
          return { rows: [] };
        }),
        transaction: vi.fn(),
      };

      await expect(applyPartnerImportPlan(plan, mockDb, validEnv, { dryRun: false }))
        .rejects.toThrowError(/CONFLICTING_EXISTING_DATA/);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("fails closed on partial import state", async () => {
      const plan = makeMinimalPlan();
      plan.partners.push({
        id: "p-2",
        companyName: "Second Partner",
        vendorCode: null,
        address: null,
        taxId: null,
        sourceRowNumbers: [4],
        categories: ["factory_sea"],
      });

      const mockDb = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("information_schema.tables")) {
            return { rows: [{ exists: 1 }] };
          }
          if (sql.includes("FROM business_partners")) {
            // DB only has 1, but plan has 2 -> partial import
            return { rows: [{ company_name: "Acme Logistics" }] };
          }
          return { rows: [] };
        }),
        transaction: vi.fn(),
      };

      await expect(
        applyPartnerImportPlan(plan, mockDb, validEnv, { dryRun: false }),
      ).rejects.toThrowError(/CONFLICTING_EXISTING_DATA/);
    });

    it("executes atomic transaction with categories, partners, contacts, memberships, and aggregate audit log", async () => {
      const plan = makeMinimalPlan();
      const txMock = {
        insertCategory: vi.fn().mockResolvedValue({ id: "cat-uuid" }),
        insertPartner: vi.fn().mockResolvedValue(undefined),
        insertContact: vi.fn().mockResolvedValue(undefined),
        insertCategoryMember: vi.fn().mockResolvedValue(undefined),
        logAudit: vi.fn().mockResolvedValue(undefined),
      };

      const mockDb = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("information_schema.tables")) {
            return { rows: [{ exists: 1 }] };
          }
          if (sql.includes("FROM business_partners")) {
          return { rows: [] }; // DB is empty
          }
          return { rows: [] };
        }),
        transaction: vi
          .fn()
          .mockImplementation(
            async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
          ),
      };

      const result = await applyPartnerImportPlan(plan, mockDb, validEnv, { dryRun: false });

      expect(result.status).toBe("APPLY_SUCCESS");
      expect(txMock.insertCategory).toHaveBeenCalled();
      expect(txMock.insertPartner).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: "Acme Logistics" }),
      );
      expect(txMock.insertContact).toHaveBeenCalledWith(
        expect.objectContaining({ picName: "Alice", email: "alice@acme.test" }),
      );
      expect(txMock.insertCategoryMember).toHaveBeenCalled();
      expect(txMock.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "partner.import",
          entityType: "partner_import",
        }),
      );
    });

    it.each([
      ["partner", "insertPartner"],
      ["contact", "insertContact"],
      ["membership", "insertCategoryMember"],
      ["audit", "logAudit"],
    ] as const)("rolls back when the %s stage fails", async (_stage, failingMethod) => {
      const rolledBack = { value: false };
      const txMock = {
        insertCategory: vi.fn().mockResolvedValue({ id: "cat-uuid" }),
        insertPartner: vi.fn().mockResolvedValue(undefined),
        insertContact: vi.fn().mockResolvedValue(undefined),
        insertCategoryMember: vi.fn().mockResolvedValue(undefined),
        logAudit: vi.fn().mockResolvedValue(undefined),
      };
      txMock[failingMethod].mockRejectedValueOnce(new Error(`${failingMethod} failed`));
      const mockDb = {
        query: vi.fn().mockImplementation(async (sql: string) => ({
          rows: sql.includes("information_schema.tables") ? [{ exists: 1 }] : [],
        })),
        transaction: vi.fn().mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => {
          try {
            return await callback(txMock);
          } catch (error) {
            rolledBack.value = true;
            throw error;
          }
        }),
      };

      await expect(
        applyPartnerImportPlan(makeMinimalPlan(), mockDb, validEnv, { dryRun: false }),
      ).rejects.toThrow(`${failingMethod} failed`);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(rolledBack.value).toBe(true);
    });
  });

  describe("checkMigrationTableExistence", () => {
    it("returns true only when all 4 tables exist", async () => {
      const mockQueryAll = vi.fn().mockResolvedValue({ rows: [{ 1: 1 }] });
      expect(await checkMigrationTableExistence(mockQueryAll)).toBe(true);

      const mockQueryMissing = vi.fn().mockResolvedValueOnce({ rows: [{ 1: 1 }] }).mockResolvedValueOnce({ rows: [] });
      expect(await checkMigrationTableExistence(mockQueryMissing)).toBe(false);
    });
  });

  describe("complete relational state classifier", () => {
    function exactStateDb(plan: PartnerImportPlan) {
      const categoryRows = [
        "factory_sea", "air_factory", "airline", "co_loader_buying",
        "co_loader_selling", "oversea_agent_selling", "oversea_agent_buying",
      ].map((code, index) => ({ id: `cat-${index}`, code, is_active: true }));
      const rowsByQuery = (sql: string): unknown[] => {
        if (sql.includes("FROM business_partners")) return [{ id: "p-1", company_name: "Acme Logistics", vendor_code: "ACM", address: "123 Port", tax_id: "TAX-1", is_active: true, deleted_at: null }];
        if (sql.includes("FROM partner_contacts")) return [{ id: "c-1", partner_id: "p-1", pic_name: "Alice", email: "alice@acme.test", phone: "+84 901 000 001", deleted_at: null }];
        if (sql.includes("FROM partner_categories")) return categoryRows;
        if (sql.includes("FROM partner_category_members")) return [{ partner_id: "p-1", category_id: "cat-0" }];
        if (sql.includes("FROM audit_logs")) return [{ action: "partner.import", entity_type: "partner_import", after: { importVersion: "C2A.1", workbookFingerprint: plan.workbookFingerprint, canonicalPartnerCount: 1, canonicalContactCount: 1, membershipCount: 1, quarantineCount: 0 } }];
        return [];
      };
      return { query: vi.fn(async (sql: string) => ({ rows: rowsByQuery(sql) })) };
    }

    it("requires exact partners, contacts, categories, memberships, and provenance", async () => {
      const plan = makeMinimalPlan();
      const result = await classifyPartnerImportState(plan, exactStateDb(plan));
      expect(result.state).toBe("ALREADY_IMPORTED_CANONICAL_DATASET");
      expect(result.diagnostics).toEqual({
        missingPartners: [], extraPartners: [], missingContacts: [], extraContacts: [],
        missingMemberships: [], extraMemberships: [], categoryMismatch: [], provenanceMismatch: [],
      });
    });

    it("rejects a count-only false positive", async () => {
      const plan = makeMinimalPlan();
      const db = exactStateDb(plan);
      db.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM business_partners")) return { rows: [{ id: "wrong", company_name: "Other Logistics", vendor_code: "ACM", address: "123 Port", tax_id: "TAX-1", is_active: true, deleted_at: null }] };
        return exactStateDb(plan).query(sql);
      });
      const result = await classifyPartnerImportState(plan, db);
      expect(result.state).not.toBe("ALREADY_IMPORTED_CANONICAL_DATASET");
      expect(result.diagnostics.extraPartners.length).toBeGreaterThan(0);
    });

    it("classifies an exact relational dataset without provenance as conflicting", async () => {
      const plan = makeMinimalPlan();
      const db = exactStateDb(plan);
      db.query.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM audit_logs")) return { rows: [] };
        return exactStateDb(plan).query(sql);
      });
      const result = await classifyPartnerImportState(plan, db);
      expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
      expect(result.diagnostics.provenanceMismatch).toHaveLength(1);
    });
  });
});
