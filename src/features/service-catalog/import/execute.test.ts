import { describe, expect, it, vi } from "vitest";

import {
  SERVICE_CATALOG_IMPORT_CONFIRM_KEY,
  SERVICE_CATALOG_IMPORT_VERSION,
} from "../constants";
import type {
  ServiceCatalogImportPlan,
  ServiceCatalogImportStats,
} from "../types";
import {
  applyServiceCatalogImportPlan,
  classifyServiceCatalogImportState,
  executeServiceCatalogImportPlan,
  type ServiceCatalogImportDb,
  type ServiceCatalogImportTransaction,
  validateServiceCatalogApplyAuthorization,
} from "./execute";

const stats: ServiceCatalogImportStats = {
  sourceBusinessRows: 2,
  nonblankCodeRows: 2,
  uniqueCodes: 2,
  duplicateCodeGroups: 0,
  rowsInDuplicateCodeGroups: 0,
  singletonCodeRows: 2,
  natureServiceRows: 1,
  natureToolSupplyRows: 0,
  natureGoodsRows: 1,
  vat8Rows: 1,
  vat10Rows: 0,
  vatNullRows: 1,
  vat69Rows: 0,
  unexpectedVatRows: 0,
  sourceRepresentationRows: 2,
  sourceRowsWithConversion: 1,
  canonicalItems: 2,
  canonicalUnitConversions: 1,
  exactDuplicateConversionRows: 0,
  conflictingCoreMetadataGroups: 0,
  quarantinedRows: 0,
};

function makePlan(): ServiceCatalogImportPlan {
  return {
    workbookFingerprint: "a".repeat(64),
    workbookFingerprintPrefix: "a".repeat(16),
    fileSizeBytes: 100,
    worksheet: "Synthetic",
    items: [
      {
        code: "A",
        name: "Synthetic service",
        nature: "service",
        primaryUnit: null,
        vatRate: null,
        isActive: true,
        sourceRows: [5],
        sourceTrace: [
          { worksheet: "Synthetic", rowNumber: 5, sourceCode: "A" },
        ],
      },
      {
        code: "B",
        name: "Synthetic goods",
        nature: "goods",
        primaryUnit: "Box",
        vatRate: 8,
        isActive: true,
        sourceRows: [6],
        sourceTrace: [
          { worksheet: "Synthetic", rowNumber: 6, sourceCode: "B" },
        ],
      },
    ],
    unitConversions: [
      {
        itemCode: "B",
        convertedUnit: "Piece",
        conversionFactor: "10",
        operation: "multiply",
        sourceDescription: "1 Box = 10 Pieces",
        sourceRows: [6],
        sourceTrace: [
          { worksheet: "Synthetic", rowNumber: 6, sourceCode: "B" },
        ],
      },
    ],
    duplicateGroups: [],
    quarantines: [],
    warnings: [],
    stats,
  };
}

function exactRows(plan: ServiceCatalogImportPlan) {
  return {
    items: [
      {
        id: "item-a",
        code: "A",
        name: "Synthetic service",
        nature: "service",
        primary_unit: null,
        vat_rate: null,
        is_active: true,
        deleted_at: null,
      },
      {
        id: "item-b",
        code: "B",
        name: "Synthetic goods",
        nature: "goods",
        primary_unit: "Box",
        vat_rate: "8.00",
        is_active: true,
        deleted_at: null,
      },
    ],
    conversions: [
      {
        id: "conversion-b",
        service_catalog_item_id: "item-b",
        converted_unit: "Piece",
        conversion_factor: "10.000000",
        operation: "multiply",
        source_description: "1 Box = 10 Pieces",
        deleted_at: null,
      },
    ],
    provenance: [
      {
        action: "service_catalog.import",
        entity_type: "service_catalog_import",
        entity_id: plan.workbookFingerprintPrefix,
        after: {
          importVersion: SERVICE_CATALOG_IMPORT_VERSION,
          workbookFingerprint: plan.workbookFingerprint,
          sourceRowCount: plan.stats.sourceBusinessRows,
          canonicalItemCount: plan.items.length,
          conversionCount: plan.unitConversions.length,
          duplicateGroupCount: plan.duplicateGroups.length,
        },
      },
    ],
  };
}

function queryFor(rows: ReturnType<typeof exactRows>) {
  return vi.fn(async (statement: string) => {
    if (statement.includes("information_schema.tables")) return { rows: [{}] };
    if (statement.includes("FROM service_catalog_items")) {
      return { rows: rows.items };
    }
    if (statement.includes("FROM service_catalog_unit_conversions")) {
      return { rows: rows.conversions };
    }
    if (statement.includes("FROM audit_logs")) return { rows: rows.provenance };
    throw new Error(`Unexpected query: ${statement}`);
  });
}

const validEnv = {
  DATABASE_URL:
    "postgresql://service_user:not-printed@localhost:5432/service_test?sslmode=require",
  SERVICE_CATALOG_IMPORT_AUTHORIZED: "true",
  SERVICE_CATALOG_IMPORT_CONFIRM: SERVICE_CATALOG_IMPORT_CONFIRM_KEY,
  SERVICE_CATALOG_IMPORT_EXPECTED_HOST: "localhost",
  SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE: "service_test",
};

describe("Service Catalog apply authorization", () => {
  it("accepts explicit authorization and exact target identity", () => {
    expect(
      validateServiceCatalogApplyAuthorization(validEnv, { dryRun: false }),
    ).toEqual({
      targetHost: "localhost",
      targetDatabase: "service_test",
      targetPort: "5432",
      sslPresent: true,
    });
  });

  it.each([
    ["general authorization", { SERVICE_CATALOG_IMPORT_AUTHORIZED: undefined }],
    ["confirmation", { SERVICE_CATALOG_IMPORT_CONFIRM: "WRONG" }],
    ["expected host", { SERVICE_CATALOG_IMPORT_EXPECTED_HOST: undefined }],
    ["expected database", { SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE: undefined }],
    ["actual host", { SERVICE_CATALOG_IMPORT_EXPECTED_HOST: "other-host" }],
    ["actual database", { SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE: "other_db" }],
  ])("fails closed for invalid %s", (_label, override) => {
    expect(() =>
      validateServiceCatalogApplyAuthorization(
        { ...validEnv, ...override },
        { dryRun: false },
      ),
    ).toThrow();
  });

  it("requires explicit production authorization for a Neon target", () => {
    expect(() =>
      validateServiceCatalogApplyAuthorization(
        {
          ...validEnv,
          DATABASE_URL:
            "postgresql://service_user:not-printed@catalog.neon.tech/neondb?sslmode=require",
          SERVICE_CATALOG_IMPORT_EXPECTED_HOST: "catalog.neon.tech",
          SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE: "neondb",
        },
        { dryRun: false },
      ),
    ).toThrow(/production authorization/i);
  });

  it("accepts a fully authorized exact production target with SSL", () => {
    expect(
      validateServiceCatalogApplyAuthorization(
        {
          ...validEnv,
          DATABASE_URL:
            "postgresql://service_user:not-printed@catalog.neon.tech/neondb?sslmode=require",
          SERVICE_CATALOG_IMPORT_EXPECTED_HOST: "catalog.neon.tech",
          SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE: "neondb",
          SERVICE_CATALOG_IMPORT_PRODUCTION_AUTHORIZED: "true",
        },
        { dryRun: false },
      ),
    ).toMatchObject({
      targetHost: "catalog.neon.tech",
      targetDatabase: "neondb",
      sslPresent: true,
    });
  });

  it("requires explicit SSL for a production target", () => {
    expect(() =>
      validateServiceCatalogApplyAuthorization(
        {
          ...validEnv,
          DATABASE_URL:
            "postgresql://service_user:not-printed@catalog.neon.tech/neondb",
          SERVICE_CATALOG_IMPORT_EXPECTED_HOST: "catalog.neon.tech",
          SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE: "neondb",
          SERVICE_CATALOG_IMPORT_PRODUCTION_AUTHORIZED: "true",
        },
        { dryRun: false },
      ),
    ).toThrow(/SSL/i);
  });

  it("does not leak database credentials in authorization errors", () => {
    let message = "";
    try {
      validateServiceCatalogApplyAuthorization(
        { ...validEnv, SERVICE_CATALOG_IMPORT_EXPECTED_HOST: "wrong" },
        { dryRun: false },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain("service_user");
    expect(message).not.toContain("not-printed");
  });
});

describe("exact Service Catalog state classifier", () => {
  it("returns EMPTY only when both business tables contain no rows", async () => {
    const db = {
      query: vi.fn(async (statement: string) => ({
        rows: statement.includes("audit_logs") ? [{ after: {} }] : [],
      })),
    };
    await expect(classifyServiceCatalogImportState(makePlan(), db)).resolves.toMatchObject({
      state: "EMPTY",
    });
  });

  it("accepts exact item, conversion, lifecycle, NULL, and provenance equality", async () => {
    const plan = makePlan();
    await expect(
      classifyServiceCatalogImportState(plan, { query: queryFor(exactRows(plan)) }),
    ).resolves.toMatchObject({ state: "ALREADY_IMPORTED_CANONICAL_DATASET" });
  });

  it("treats NULL VAT and zero VAT as different", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    rows.items[0]!.vat_rate = "0.00";
    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
    expect(result.diagnostics.conflictingItems).toContain("A");
  });

  it.each([
    ["inactive", { is_active: false }],
    ["soft-deleted", { deleted_at: new Date("2026-01-01") }],
  ])("rejects a canonical item that is %s", async (_label, override) => {
    const plan = makePlan();
    const rows = exactRows(plan);
    Object.assign(rows.items[0]!, override);
    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
    expect(result.diagnostics.conflictingItems).toContain("A");
  });

  it("rejects duplicate canonical item identity", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    rows.items.push({ ...rows.items[0]!, id: "item-a-duplicate" });
    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
    expect(result.diagnostics.conflictingItems).toContain("A");
  });

  it("classifies a strict relational subset as PARTIAL_IMPORT", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    rows.conversions = [];
    rows.provenance = [];
    await expect(
      classifyServiceCatalogImportState(plan, { query: queryFor(rows) }),
    ).resolves.toMatchObject({ state: "PARTIAL_IMPORT" });
  });

  it("classifies missing canonical items as PARTIAL_IMPORT", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    rows.items = rows.items.filter((item) => item.code !== "A");
    rows.provenance = [];
    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("PARTIAL_IMPORT");
    expect(result.diagnostics.missingItems).toContain("A");
  });

  it("rejects exact relational data without matching provenance", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    rows.provenance = [];
    await expect(
      classifyServiceCatalogImportState(plan, { query: queryFor(rows) }),
    ).resolves.toMatchObject({ state: "CONFLICTING_EXISTING_DATA" });
  });

  it("rejects mismatched provenance", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    const after = rows.provenance[0]!.after;
    after.workbookFingerprint = "b".repeat(64);
    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
    expect(result.diagnostics.provenanceMismatch).toHaveLength(1);
  });

  it.each([
    ["wrong factor", { conversion_factor: "11.000000" }],
    ["wrong parent", { service_catalog_item_id: "item-a" }],
    ["soft deleted", { deleted_at: new Date("2026-01-01") }],
  ])("rejects a conversion with %s", async (_label, override) => {
    const plan = makePlan();
    const rows = exactRows(plan);
    Object.assign(rows.conversions[0]!, override);
    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
    expect(
      result.diagnostics.extraConversions.length +
        result.diagnostics.conflictingConversions.length,
    ).toBeGreaterThan(0);
  });

  it("rejects an extra conversion", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    rows.conversions.push({
      ...rows.conversions[0]!,
      id: "extra-conversion",
      converted_unit: "Pallet",
    });
    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
    expect(result.diagnostics.extraConversions).toContain("B:Pallet");
  });

  it("detects extra items, wrong conversions, duplicate conversions, and lifecycle conflicts", async () => {
    const plan = makePlan();
    const rows = exactRows(plan);
    rows.items.push({
      ...rows.items[1]!,
      id: "item-extra",
      code: "EXTRA",
      name: "Extra",
    });
    rows.items[0]!.is_active = false;
    rows.conversions[0]!.operation = "divide";
    rows.conversions.push({ ...rows.conversions[0]!, id: "duplicate" });

    const result = await classifyServiceCatalogImportState(plan, {
      query: queryFor(rows),
    });
    expect(result.state).toBe("CONFLICTING_EXISTING_DATA");
    expect(result.diagnostics.extraItems).toContain("EXTRA");
    expect(result.diagnostics.conflictingItems).toContain("A");
    expect(result.diagnostics.conflictingConversions.length).toBeGreaterThan(0);
    expect(result.diagnostics.missingConversions.length).toBeGreaterThan(0);
  });
});

function transactionMock() {
  return {
    insertItems: vi.fn().mockResolvedValue([
      { id: "item-b", code: "B" },
      { id: "item-a", code: "A" },
    ]),
    insertConversions: vi.fn().mockResolvedValue(undefined),
    logAudit: vi.fn().mockResolvedValue(undefined),
  } satisfies ServiceCatalogImportTransaction;
}

describe("Service Catalog live apply", () => {
  it("keeps dry-run at zero writes", async () => {
    await expect(
      executeServiceCatalogImportPlan(makePlan(), { dryRun: true }),
    ).resolves.toMatchObject({
      status: "DRY_RUN_SUCCESS",
      appliedDatabaseWrites: 0,
    });
  });

  it("blocks before a transaction when a migration table is missing", async () => {
    const db: ServiceCatalogImportDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn(),
    };
    await expect(
      applyServiceCatalogImportPlan(makePlan(), db, validEnv, { dryRun: false }),
    ).rejects.toThrow(/MIGRATION NOT APPLIED/);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects authorization before any database query or transaction", async () => {
    const db: ServiceCatalogImportDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    };
    await expect(
      applyServiceCatalogImportPlan(
        makePlan(),
        db,
        { ...validEnv, SERVICE_CATALOG_IMPORT_AUTHORIZED: undefined },
        { dryRun: false },
      ),
    ).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rolls back when returned item IDs do not map every planned code", async () => {
    const tx = transactionMock();
    tx.insertItems.mockResolvedValueOnce([
      { id: "item-b", code: "B" },
      { id: "item-x", code: "X" },
    ]);
    let committed = false;
    const db: ServiceCatalogImportDb = {
      query: queryFor({ items: [], conversions: [], provenance: [] }),
      transaction: vi.fn(async (callback) => {
        const result = await callback(tx);
        committed = true;
        return result;
      }),
    };
    await expect(
      applyServiceCatalogImportPlan(makePlan(), db, validEnv, { dryRun: false }),
    ).rejects.toThrow(/mapping is incomplete/);
    expect(committed).toBe(false);
    expect(tx.insertConversions).not.toHaveBeenCalled();
    expect(tx.logAudit).not.toHaveBeenCalled();
  });

  it("imports items, mapped conversions, and provenance in one transaction", async () => {
    const plan = makePlan();
    const tx = transactionMock();
    const db: ServiceCatalogImportDb = {
      query: queryFor({ items: [], conversions: [], provenance: [] }),
      transaction: vi.fn(async (callback) => callback(tx)),
    };

    const result = await applyServiceCatalogImportPlan(plan, db, validEnv, {
      dryRun: false,
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(tx.insertItems).toHaveBeenCalledWith(plan.items);
    expect(tx.insertConversions).toHaveBeenCalledWith([
      expect.objectContaining({ itemCode: "B", serviceCatalogItemId: "item-b" }),
    ]);
    expect(tx.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "service_catalog.import",
        entityType: "service_catalog_import",
        metadata: expect.objectContaining({
          workbookFingerprint: plan.workbookFingerprint,
          canonicalItemCount: 2,
          conversionCount: 1,
        }),
      }),
    );
    expect(result).toMatchObject({
      stateBefore: "EMPTY",
      status: "IMPORTED",
      itemsInserted: 2,
      conversionsInserted: 1,
      auditEventsWritten: 1,
      appliedDatabaseWrites: 4,
    });
  });

  it.each(["insertItems", "insertConversions", "logAudit"] as const)(
    "rolls back when %s fails",
    async (stage) => {
      const tx = transactionMock();
      tx[stage].mockRejectedValueOnce(new Error(`${stage} failed`));
      let committed = false;
      const db: ServiceCatalogImportDb = {
        query: queryFor({ items: [], conversions: [], provenance: [] }),
        transaction: vi.fn(async (callback) => {
          const result = await callback(tx);
          committed = true;
          return result;
        }),
      };

      await expect(
        applyServiceCatalogImportPlan(makePlan(), db, validEnv, {
          dryRun: false,
        }),
      ).rejects.toThrow(`${stage} failed`);
      expect(committed).toBe(false);
    },
  );

  it("returns a strict zero-write result for an exact second apply", async () => {
    const plan = makePlan();
    const db: ServiceCatalogImportDb = {
      query: queryFor(exactRows(plan)),
      transaction: vi.fn(),
    };
    const result = await applyServiceCatalogImportPlan(plan, db, validEnv, {
      dryRun: false,
    });

    expect(result).toMatchObject({
      stateBefore: "ALREADY_IMPORTED_CANONICAL_DATASET",
      status: "IDEMPOTENT",
      itemsInserted: 0,
      conversionsInserted: 0,
      auditEventsWritten: 0,
      updates: 0,
      deletes: 0,
      appliedDatabaseWrites: 0,
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each(["PARTIAL_IMPORT", "CONFLICTING_EXISTING_DATA"] as const)(
    "rejects %s before transaction",
    async (state) => {
      const plan = makePlan();
      const rows = exactRows(plan);
      if (state === "PARTIAL_IMPORT") {
        rows.conversions = [];
        rows.provenance = [];
      } else {
        rows.items[0]!.name = "Conflict";
      }
      const db: ServiceCatalogImportDb = {
        query: queryFor(rows),
        transaction: vi.fn(),
      };

      await expect(
        applyServiceCatalogImportPlan(plan, db, validEnv, { dryRun: false }),
      ).rejects.toThrow(state);
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );
});
