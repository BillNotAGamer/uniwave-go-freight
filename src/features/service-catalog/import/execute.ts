import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import {
  serviceCatalogItems,
  serviceCatalogUnitConversions,
} from "@/lib/db/schema";
import { assertAuthorizedDatabaseTarget } from "@/lib/db/database-target-authorization";

import {
  SERVICE_CATALOG_IMPORT_CONFIRM_KEY,
  SERVICE_CATALOG_IMPORT_VERSION,
} from "../constants";
import type {
  CanonicalServiceCatalogItemCandidate,
  CanonicalUnitConversionCandidate,
  ServiceCatalogImportExecuteOptions,
  ServiceCatalogImportExecutionReport,
  ServiceCatalogImportPlan,
  ServiceCatalogStateClassification,
  ServiceCatalogStateDiagnostics,
} from "../types";
import { normalizeCatalogText, normalizeServiceCode } from "./normalize";

const REQUIRED_TABLES = [
  "service_catalog_items",
  "service_catalog_unit_conversions",
] as const;

type QueryClient = {
  query: (statement: string) => Promise<{ rows: unknown[] }>;
};

export class ServiceCatalogImportAuthorizationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ServiceCatalogImportAuthorizationError";
    this.code = code;
  }
}

export function isProductionServiceCatalogTarget(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "neon.tech" ||
    normalized.endsWith(".neon.tech") ||
    normalized.includes("prod") ||
    normalized.includes("production")
  );
}

export interface AuthorizedServiceCatalogTarget {
  targetHost: string;
  targetDatabase: string;
  targetPort: string;
  sslPresent: boolean;
}

export function validateServiceCatalogApplyAuthorization(
  env: Record<string, string | undefined>,
  options: ServiceCatalogImportExecuteOptions,
): AuthorizedServiceCatalogTarget {
  if (
    env.SERVICE_CATALOG_IMPORT_CONFIRM !==
    SERVICE_CATALOG_IMPORT_CONFIRM_KEY
  ) {
    throw new ServiceCatalogImportAuthorizationError(
      "SERVICE_CATALOG_IMPORT_CONFIRMATION_REQUIRED",
      `Service Catalog import apply requires SERVICE_CATALOG_IMPORT_CONFIRM="${SERVICE_CATALOG_IMPORT_CONFIRM_KEY}".`,
    );
  }

  try {
    const target = assertAuthorizedDatabaseTarget({
      operation: "Service Catalog import apply",
      databaseUrl: env.DATABASE_URL,
      authorization: env.SERVICE_CATALOG_IMPORT_AUTHORIZED,
      productionAuthorization:
        env.SERVICE_CATALOG_IMPORT_PRODUCTION_AUTHORIZED,
      expectedHost:
        options.expectedHost ?? env.SERVICE_CATALOG_IMPORT_EXPECTED_HOST,
      expectedDatabase:
        options.expectedDatabase ??
        env.SERVICE_CATALOG_IMPORT_EXPECTED_DATABASE,
      nodeEnv: env.NODE_ENV,
      forbidProductionNodeEnv: false,
    });

    const productionTarget =
      options.isProduction || isProductionServiceCatalogTarget(target.hostname);
    if (
      productionTarget &&
      env.SERVICE_CATALOG_IMPORT_PRODUCTION_AUTHORIZED !== "true"
    ) {
      throw new ServiceCatalogImportAuthorizationError(
        "SERVICE_CATALOG_PRODUCTION_IMPORT_NOT_AUTHORIZED",
        "Service Catalog production import requires explicit production authorization.",
      );
    }

    const parsedUrl = new URL(env.DATABASE_URL as string);
    const sslMode = parsedUrl.searchParams.get("sslmode")?.toLowerCase();
    const sslPresent = Boolean(sslMode && sslMode !== "disable");
    if (productionTarget && !sslPresent) {
      throw new ServiceCatalogImportAuthorizationError(
        "SERVICE_CATALOG_IMPORT_SSL_REQUIRED",
        "Service Catalog production import requires SSL to be explicitly enabled.",
      );
    }

    return {
      targetHost: target.hostname,
      targetDatabase: target.databaseName,
      targetPort: target.port || "default",
      sslPresent,
    };
  } catch (error) {
    if (error instanceof ServiceCatalogImportAuthorizationError) throw error;
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "SERVICE_CATALOG_DATABASE_TARGET_UNAUTHORIZED";
    throw new ServiceCatalogImportAuthorizationError(
      code,
      "Service Catalog import apply target authorization failed.",
    );
  }
}

function emptyDiagnostics(): ServiceCatalogStateDiagnostics {
  return {
    missingItems: [],
    extraItems: [],
    conflictingItems: [],
    missingConversions: [],
    extraConversions: [],
    conflictingConversions: [],
    provenanceMismatch: [],
  };
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = normalizeCatalogText(String(value));
  return normalized || null;
}

function normalizedDecimal(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const normalized = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return `invalid:${normalized}`;
  return String(Number(normalized));
}

function plannedItemSignature(
  item: CanonicalServiceCatalogItemCandidate,
): string {
  return JSON.stringify([
    normalizeCatalogText(item.name),
    item.nature,
    item.primaryUnit === null ? null : normalizeCatalogText(item.primaryUnit),
    item.vatRate === null ? null : String(item.vatRate),
    true,
    null,
  ]);
}

function existingItemSignature(row: Record<string, unknown>): string {
  return JSON.stringify([
    normalizeCatalogText(String(row.name ?? "")),
    String(row.nature ?? ""),
    nullableText(row.primary_unit),
    normalizedDecimal(row.vat_rate),
    row.is_active,
    row.deleted_at === null || row.deleted_at === undefined ? null : "deleted",
  ]);
}

function plannedConversionKey(
  conversion: CanonicalUnitConversionCandidate,
): string {
  return JSON.stringify([
    normalizeServiceCode(conversion.itemCode),
    normalizeCatalogText(conversion.convertedUnit),
    normalizedDecimal(conversion.conversionFactor),
    conversion.operation,
    conversion.sourceDescription === null
      ? null
      : normalizeCatalogText(conversion.sourceDescription),
  ]);
}

function safeConversionLabel(
  itemCode: string,
  convertedUnit: string,
): string {
  return `${itemCode}:${convertedUnit}`.slice(0, 160);
}

/**
 * Classifies exact Service Catalog relational state plus aggregate provenance.
 * EMPTY means both Service Catalog business tables contain zero rows.
 */
export async function classifyServiceCatalogImportState(
  plan: ServiceCatalogImportPlan,
  db: QueryClient,
): Promise<ServiceCatalogStateClassification> {
  const diagnostics = emptyDiagnostics();
  const [itemsResult, conversionsResult, provenanceResult] = await Promise.all([
    db.query(
      "SELECT id, code, name, nature, primary_unit, vat_rate, is_active, deleted_at FROM service_catalog_items",
    ),
    db.query(
      "SELECT id, service_catalog_item_id, converted_unit, conversion_factor, operation, source_description, deleted_at FROM service_catalog_unit_conversions",
    ),
    db.query(
      "SELECT action, entity_type, entity_id, after FROM audit_logs WHERE action = 'service_catalog.import' AND entity_type = 'service_catalog_import'",
    ),
  ]);

  const itemRows = itemsResult.rows as Array<Record<string, unknown>>;
  const conversionRows = conversionsResult.rows as Array<Record<string, unknown>>;
  if (itemRows.length === 0 && conversionRows.length === 0) {
    return { state: "EMPTY", diagnostics };
  }

  const plannedItems = new Map(
    plan.items.map((item) => [normalizeServiceCode(item.code), item]),
  );
  const existingItems = new Map<string, Record<string, unknown>>();
  const itemCodeById = new Map<string, string>();

  for (const row of itemRows) {
    const code = normalizeServiceCode(String(row.code ?? ""));
    if (!code || existingItems.has(code)) {
      diagnostics.conflictingItems.push(code || "blank-code");
      continue;
    }
    existingItems.set(code, row);
    itemCodeById.set(String(row.id), code);
  }

  for (const [code, planned] of plannedItems) {
    const existing = existingItems.get(code);
    if (!existing) diagnostics.missingItems.push(code);
    else if (existingItemSignature(existing) !== plannedItemSignature(planned)) {
      diagnostics.conflictingItems.push(code);
    }
  }
  for (const code of existingItems.keys()) {
    if (!plannedItems.has(code)) diagnostics.extraItems.push(code);
  }

  const plannedConversions = new Map(
    plan.unitConversions.map((conversion) => [
      plannedConversionKey(conversion),
      safeConversionLabel(conversion.itemCode, conversion.convertedUnit),
    ]),
  );
  const existingConversions = new Map<string, string>();

  for (const row of conversionRows) {
    const itemCode = itemCodeById.get(String(row.service_catalog_item_id));
    const convertedUnit = nullableText(row.converted_unit) ?? "blank-unit";
    const label = safeConversionLabel(itemCode ?? "missing-parent", convertedUnit);
    if (
      !itemCode ||
      (row.deleted_at !== null && row.deleted_at !== undefined)
    ) {
      diagnostics.conflictingConversions.push(label);
      continue;
    }
    const key = JSON.stringify([
      itemCode,
      convertedUnit,
      normalizedDecimal(row.conversion_factor),
      String(row.operation ?? ""),
      nullableText(row.source_description),
    ]);
    if (existingConversions.has(key)) {
      diagnostics.conflictingConversions.push(`duplicate:${label}`);
    } else {
      existingConversions.set(key, label);
    }
  }

  for (const [key, label] of plannedConversions) {
    if (!existingConversions.has(key)) diagnostics.missingConversions.push(label);
  }
  for (const [key, label] of existingConversions) {
    if (!plannedConversions.has(key)) diagnostics.extraConversions.push(label);
  }

  const provenanceRows = provenanceResult.rows as Array<Record<string, unknown>>;
  const matchingProvenance = provenanceRows.some((row) => {
    const after = row.after as Record<string, unknown> | null;
    return (
      after?.importVersion === SERVICE_CATALOG_IMPORT_VERSION &&
      after.workbookFingerprint === plan.workbookFingerprint &&
      after.sourceRowCount === plan.stats.sourceBusinessRows &&
      after.canonicalItemCount === plan.items.length &&
      after.conversionCount === plan.unitConversions.length &&
      after.duplicateGroupCount === plan.duplicateGroups.length
    );
  });
  if (!matchingProvenance) {
    diagnostics.provenanceMismatch.push(
      "matching service_catalog.import provenance not found",
    );
  }

  const relationalConflictCount =
    diagnostics.extraItems.length +
    diagnostics.conflictingItems.length +
    diagnostics.extraConversions.length +
    diagnostics.conflictingConversions.length;
  const relationalMissingCount =
    diagnostics.missingItems.length + diagnostics.missingConversions.length;

  if (
    relationalConflictCount === 0 &&
    relationalMissingCount === 0 &&
    matchingProvenance
  ) {
    return { state: "ALREADY_IMPORTED_CANONICAL_DATASET", diagnostics };
  }

  if (relationalConflictCount === 0 && relationalMissingCount > 0) {
    return { state: "PARTIAL_IMPORT", diagnostics };
  }

  return { state: "CONFLICTING_EXISTING_DATA", diagnostics };
}

export interface ServiceCatalogImportDb {
  query: (statement: string) => Promise<{ rows: unknown[] }>;
  transaction: <T>(
    callback: (tx: ServiceCatalogImportTransaction) => Promise<T>,
  ) => Promise<T>;
}

export interface ServiceCatalogImportTransaction {
  insertItems: (
    items: CanonicalServiceCatalogItemCandidate[],
  ) => Promise<Array<{ id: string; code: string }>>;
  insertConversions: (
    conversions: Array<
      CanonicalUnitConversionCandidate & { serviceCatalogItemId: string }
    >,
  ) => Promise<void>;
  logAudit: (audit: {
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }) => Promise<void>;
}

export function createDrizzleServiceCatalogImportDb(
  db: Database,
): ServiceCatalogImportDb {
  return {
    async query(statement) {
      const result = await db.execute(sql.raw(statement));
      return { rows: result.rows };
    },
    async transaction(callback) {
      return db.transaction(async (tx) =>
        callback({
          async insertItems(items) {
            const inserted = await tx
              .insert(serviceCatalogItems)
              .values(
                items.map((item) => ({
                  id: randomUUID(),
                  code: item.code,
                  name: item.name,
                  nature: item.nature,
                  primaryUnit: item.primaryUnit,
                  vatRate: item.vatRate === null ? null : String(item.vatRate),
                  isActive: true,
                  deletedAt: null,
                })),
              )
              .returning({ id: serviceCatalogItems.id, code: serviceCatalogItems.code });
            return inserted;
          },
          async insertConversions(conversions) {
            if (conversions.length === 0) return;
            await tx.insert(serviceCatalogUnitConversions).values(
              conversions.map((conversion) => ({
                id: randomUUID(),
                serviceCatalogItemId: conversion.serviceCatalogItemId,
                convertedUnit: conversion.convertedUnit,
                conversionFactor: conversion.conversionFactor,
                operation: conversion.operation,
                sourceDescription: conversion.sourceDescription,
                deletedAt: null,
              })),
            );
          },
          async logAudit(audit) {
            const { logAuditEvent } = await import("@/lib/audit/log");
            await logAuditEvent(tx, {
              action: audit.action,
              entityType: audit.entityType,
              entityId: audit.entityId,
              after: audit.metadata,
            });
          },
        }),
      );
    },
  };
}

export async function checkServiceCatalogMigrationTables(
  query: (statement: string) => Promise<{ rows: unknown[] }>,
): Promise<boolean> {
  for (const table of REQUIRED_TABLES) {
    const result = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}'`,
    );
    if (result.rows.length === 0) return false;
  }
  return true;
}

export async function executeServiceCatalogImportPlan(
  plan: ServiceCatalogImportPlan,
  options: ServiceCatalogImportExecuteOptions,
): Promise<ServiceCatalogImportExecutionReport> {
  if (!options.dryRun) {
    throw new Error(
      "Database apply requires applyServiceCatalogImportPlan with an explicitly authorized database target.",
    );
  }
  return {
    status: "DRY_RUN_SUCCESS",
    workbookFingerprintPrefix: plan.workbookFingerprintPrefix,
    itemsInserted: 0,
    conversionsInserted: 0,
    auditEventsWritten: 0,
    updates: 0,
    deletes: 0,
    appliedDatabaseWrites: 0,
    message: "Dry run completed with 0 database writes.",
  };
}

export async function applyServiceCatalogImportPlan(
  plan: ServiceCatalogImportPlan,
  db: ServiceCatalogImportDb,
  env: Record<string, string | undefined>,
  options: ServiceCatalogImportExecuteOptions,
): Promise<ServiceCatalogImportExecutionReport> {
  validateServiceCatalogApplyAuthorization(env, options);

  if (!await checkServiceCatalogMigrationTables(db.query)) {
    throw new Error("STOP — SERVICE CATALOG MIGRATION NOT APPLIED");
  }

  const classification = await classifyServiceCatalogImportState(plan, db);
  if (classification.state === "ALREADY_IMPORTED_CANONICAL_DATASET") {
    return {
      stateBefore: classification.state,
      status: "IDEMPOTENT",
      workbookFingerprintPrefix: plan.workbookFingerprintPrefix,
      itemsInserted: 0,
      conversionsInserted: 0,
      auditEventsWritten: 0,
      updates: 0,
      deletes: 0,
      appliedDatabaseWrites: 0,
      message: "Exact canonical dataset and provenance already exist; 0 database writes performed.",
    };
  }
  if (classification.state === "PARTIAL_IMPORT") {
    throw new Error(
      "STOP — PARTIAL_IMPORT DETECTED. Service Catalog remediation requires a separate authorized task.",
    );
  }
  if (classification.state === "CONFLICTING_EXISTING_DATA") {
    throw new Error(
      "STOP — CONFLICTING_EXISTING_DATA DETECTED. Service Catalog remediation requires a separate authorized task.",
    );
  }

  return db.transaction(async (tx) => {
    const insertedItems = await tx.insertItems(plan.items);
    const itemIdsByCode = new Map(
      insertedItems.map((item) => [normalizeServiceCode(item.code), item.id]),
    );
    const everyPlannedItemWasReturned = plan.items.every((item) =>
      itemIdsByCode.has(normalizeServiceCode(item.code)),
    );
    if (
      insertedItems.length !== plan.items.length ||
      itemIdsByCode.size !== plan.items.length ||
      !everyPlannedItemWasReturned
    ) {
      throw new Error("Inserted Service Catalog item mapping is incomplete.");
    }

    const conversions = plan.unitConversions.map((conversion) => {
      const serviceCatalogItemId = itemIdsByCode.get(
        normalizeServiceCode(conversion.itemCode),
      );
      if (!serviceCatalogItemId) {
        throw new Error(
          `Inserted Service Catalog item mapping is missing code ${conversion.itemCode}.`,
        );
      }
      return { ...conversion, serviceCatalogItemId };
    });
    await tx.insertConversions(conversions);

    await tx.logAudit({
      action: "service_catalog.import",
      entityType: "service_catalog_import",
      entityId: plan.workbookFingerprintPrefix,
      metadata: {
        importVersion: SERVICE_CATALOG_IMPORT_VERSION,
        workbookFingerprint: plan.workbookFingerprint,
        fingerprintPrefix: plan.workbookFingerprintPrefix,
        sourceRowCount: plan.stats.sourceBusinessRows,
        canonicalItemCount: plan.items.length,
        conversionCount: plan.unitConversions.length,
        duplicateGroupCount: plan.duplicateGroups.length,
        vatCounts: {
          rate8: plan.stats.vat8Rows,
          rate10: plan.stats.vat10Rows,
          unknown: plan.stats.vatNullRows,
        },
      },
    });

    return {
      stateBefore: "EMPTY",
      status: "IMPORTED",
      workbookFingerprintPrefix: plan.workbookFingerprintPrefix,
      itemsInserted: plan.items.length,
      conversionsInserted: plan.unitConversions.length,
      auditEventsWritten: 1,
      updates: 0,
      deletes: 0,
      appliedDatabaseWrites: plan.items.length + plan.unitConversions.length + 1,
      message: "Service Catalog import transaction committed atomically.",
    };
  });
}
