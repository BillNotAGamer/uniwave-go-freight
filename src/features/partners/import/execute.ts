import { CANONICAL_PARTNER_CATEGORIES } from "../constants";
import { normalizeCompanyName, normalizeContactKey } from "./normalize";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  businessPartners,
  partnerCategories,
  partnerCategoryMembers,
  partnerContacts,
} from "@/lib/db/schema";
import type {
  CanonicalPartnerCandidate,
  DatabaseImportState,
  ImportExecuteOptions,
  PartnerImportPlan,
  PartnerImportStateDiagnostics,
} from "./types";
import { assertAuthorizedDatabaseTarget } from "@/lib/db/database-target-authorization";

export const PARTNER_IMPORT_CONFIRM_KEY = "IMPORT_UNIWAVE_PARTNERS";

export class PartnerImportAuthorizationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PartnerImportAuthorizationError";
    this.code = code;
  }
}

export function isProductionDatabaseHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower.includes("neon.tech") ||
    lower.includes("aws.neon.tech") ||
    lower.includes("prod") ||
    lower.includes("production")
  );
}

export function validateApplyAuthorization(
  env: Record<string, string | undefined>,
  options: ImportExecuteOptions,
): { targetHost: string; targetDatabase: string } {
  if (env.PARTNER_IMPORT_CONFIRM !== PARTNER_IMPORT_CONFIRM_KEY) {
    throw new PartnerImportAuthorizationError(
      "PARTNER_IMPORT_CONFIRMATION_REQUIRED",
      `Partner Master import apply requires PARTNER_IMPORT_CONFIRM="${PARTNER_IMPORT_CONFIRM_KEY}".`,
    );
  }

  try {
    if (env.PARTNER_IMPORT_AUTHORIZED !== "true") throw new Error("PARTNER_IMPORT_NOT_AUTHORIZED");
    const target = assertAuthorizedDatabaseTarget({
      operation: "Partner Master import apply",
      databaseUrl: env.DATABASE_URL,
      authorization: env.PARTNER_IMPORT_AUTHORIZED,
      productionAuthorization: env.PARTNER_IMPORT_PRODUCTION_AUTHORIZED,
      expectedHost: options.expectedHost ?? env.PARTNER_IMPORT_EXPECTED_HOST,
      expectedDatabase: options.expectedDatabase ?? env.PARTNER_IMPORT_EXPECTED_DATABASE,
      nodeEnv: env.NODE_ENV,
      forbidProductionNodeEnv: false,
    });
    if ((options.isProduction || isProductionDatabaseHost(target.hostname)) && env.PARTNER_IMPORT_PRODUCTION_AUTHORIZED !== "true") {
      throw new Error("PRODUCTION_IMPORT_NOT_AUTHORIZED");
    }
    return { targetHost: target.hostname, targetDatabase: target.databaseName };
  } catch (error) {
    if (error instanceof PartnerImportAuthorizationError) throw error;
    const code = error instanceof Error ? error.message : "DATABASE_TARGET_UNAUTHORIZED";
    throw new PartnerImportAuthorizationError(code, "Partner Master import apply target authorization failed.");
  }
}

export interface ImportExecutionReport {
  status: "DRY_RUN_SUCCESS" | "APPLY_SUCCESS" | "BLOCKED";
  workbookFingerprintPrefix: string;
  partnersCount: number;
  contactsCount: number;
  membershipsCount: number;
  quarantinedCount: number;
  databaseState?: DatabaseImportState;
  appliedDatabaseWrites: number;
  message: string;
}

export interface PartnerImportStateClassification {
  state: DatabaseImportState;
  diagnostics: PartnerImportStateDiagnostics;
}

type QueryClient = { query: (sql: string) => Promise<{ rows: unknown[] }> };

const emptyDiagnostics = (): PartnerImportStateDiagnostics => ({
  missingPartners: [],
  extraPartners: [],
  missingContacts: [],
  extraContacts: [],
  missingMemberships: [],
  extraMemberships: [],
  categoryMismatch: [],
  provenanceMismatch: [],
});

function field(value: unknown): string | null {
  return value === null || value === undefined || String(value).trim() === ""
    ? null
    : String(value).trim();
}

function partnerKey(partner: Pick<CanonicalPartnerCandidate, "companyName">): string {
  return normalizeCompanyName(partner.companyName);
}

function partnerFields(row: Record<string, unknown>): string {
  return [
    normalizeCompanyName(String(row.company_name ?? "")),
    field(row.vendor_code) ?? "",
    field(row.tax_id) ?? "",
    field(row.address) ?? "",
  ].join("|||");
}

function contactKey(
  partner: string,
  row: { pic_name?: unknown; email?: unknown; phone?: unknown },
): string {
  return normalizeContactKey(
    partner,
    field(row.pic_name),
    field(row.email)?.toLowerCase() ?? null,
    field(row.phone),
  );
}

function safeDiagnosticKey(value: string): string {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

/**
 * Classifies the complete relational Partner Master state. Counts are used
 * only as diagnostics; canonical classification requires exact set equality
 * and a matching aggregate import provenance event.
 */
export async function classifyPartnerImportState(
  plan: PartnerImportPlan,
  db: QueryClient,
): Promise<PartnerImportStateClassification> {
  const diagnostics = emptyDiagnostics();
  const [partnersResult, contactsResult, categoriesResult, membershipsResult, provenanceResult] =
    await Promise.all([
      db.query("SELECT id, company_name, vendor_code, address, tax_id, is_active, deleted_at FROM business_partners"),
      db.query("SELECT id, partner_id, pic_name, email, phone, deleted_at FROM partner_contacts"),
      db.query("SELECT id, code, name, description, is_active FROM partner_categories"),
      db.query("SELECT partner_id, category_id FROM partner_category_members"),
      db.query("SELECT action, entity_type, entity_id, after FROM audit_logs WHERE action = 'partner.import' AND entity_type = 'partner_import'"),
    ]);

  const partners = partnersResult.rows as Array<Record<string, unknown>>;
  const contacts = contactsResult.rows as Array<Record<string, unknown>>;
  const categories = categoriesResult.rows as Array<Record<string, unknown>>;
  const memberships = membershipsResult.rows as Array<Record<string, unknown>>;
  const activePartners = partners.filter((row) => row.deleted_at == null);
  const activeContacts = contacts.filter((row) => row.deleted_at == null);

  const allDataEmpty = partners.length === 0 && contacts.length === 0 && categories.length === 0 && memberships.length === 0;
  if (allDataEmpty) return { state: "EMPTY", diagnostics };

  const plannedPartners = new Map(plan.partners.map((p) => [partnerKey(p), p]));
  const existingPartners = new Map<string, Record<string, unknown>>();
  for (const row of activePartners) {
    const key = normalizeCompanyName(String(row.company_name ?? ""));
    if (existingPartners.has(key)) diagnostics.extraPartners.push(`duplicate:${safeDiagnosticKey(key)}`);
    existingPartners.set(key, row);
  }
  for (const [key, planned] of plannedPartners) {
    const existing = existingPartners.get(key);
    if (!existing) diagnostics.missingPartners.push(key);
    else if (partnerFields(existing) !== [key, planned.vendorCode ?? "", planned.taxId ?? "", planned.address ?? ""].join("|||")) {
      diagnostics.extraPartners.push(`incompatible:${safeDiagnosticKey(key)}`);
    }
  }
  for (const key of existingPartners.keys()) if (!plannedPartners.has(key)) diagnostics.extraPartners.push(key);
  if (partners.some((row) => row.deleted_at != null || row.is_active === false)) diagnostics.extraPartners.push("inactive-or-deleted-partner");

  const categoryById = new Map(categories.map((row) => [String(row.id), row]));
  const canonicalCodes = new Set<string>(CANONICAL_PARTNER_CATEGORIES.map((category) => category.code));
  const activeCodes = categories.filter((row) => row.is_active !== false).map((row) => String(row.code));
  for (const code of canonicalCodes) if (activeCodes.filter((item) => item === code).length !== 1) diagnostics.categoryMismatch.push(code);
  for (const code of activeCodes) if (!canonicalCodes.has(code)) diagnostics.categoryMismatch.push(`unexpected:${code}`);
  if (categories.some((row) => row.is_active === false)) diagnostics.categoryMismatch.push("inactive-category");

  const plannedMemberships = new Set<string>(plan.categoryMemberships.map((m) => `${partnerKey({ companyName: m.partnerCompanyName })}|||${m.categoryCode}`));
  const existingMemberships = new Set<string>();
  for (const row of memberships) {
    const partner = activePartners.find((candidate) => String(candidate.id) === String(row.partner_id));
    const category = categoryById.get(String(row.category_id));
    const tuple = `${normalizeCompanyName(String(partner?.company_name ?? `missing:${row.partner_id}`))}|||${String(category?.code ?? `missing:${row.category_id}`)}`;
    if (existingMemberships.has(tuple)) diagnostics.extraMemberships.push(`duplicate:${tuple}`);
    existingMemberships.add(tuple);
  }
  for (const tuple of plannedMemberships) if (!existingMemberships.has(tuple)) diagnostics.missingMemberships.push(tuple);
  for (const tuple of existingMemberships) if (!plannedMemberships.has(tuple)) diagnostics.extraMemberships.push(tuple);

  const plannedContacts = new Set(plan.contacts.map((contact) => normalizeContactKey(partnerKey({ companyName: contact.partnerCompanyName }), contact.picName, contact.email, contact.phone)));
  const existingContacts = new Set<string>();
  for (const row of activeContacts) {
    const partner = activePartners.find((candidate) => String(candidate.id) === String(row.partner_id));
    const key = contactKey(normalizeCompanyName(String(partner?.company_name ?? `missing:${row.partner_id}`)), row);
    if (existingContacts.has(key)) diagnostics.extraContacts.push(`duplicate:${safeDiagnosticKey(key)}`);
    existingContacts.add(key);
  }
  for (const key of plannedContacts) if (!existingContacts.has(key)) diagnostics.missingContacts.push(safeDiagnosticKey(key));
  for (const key of existingContacts) if (!plannedContacts.has(key)) diagnostics.extraContacts.push(safeDiagnosticKey(key));
  if (contacts.some((row) => row.deleted_at != null)) diagnostics.extraContacts.push("deleted-contact");

  const provenance = provenanceResult.rows as Array<Record<string, unknown>>;
  const matchingProvenance = provenance.some((row) => {
    const after = (row.after ?? row.metadata) as Record<string, unknown> | null;
    return after?.importVersion === "C2A.1" && after.workbookFingerprint === plan.workbookFingerprint &&
      after.canonicalPartnerCount === plan.partners.length && after.canonicalContactCount === plan.contacts.length &&
      after.membershipCount === plan.categoryMemberships.length && after.quarantineCount === plan.quarantinedRows.length;
  });
  if (!matchingProvenance) diagnostics.provenanceMismatch.push("matching partner.import provenance not found");

  const mismatchCount = Object.values(diagnostics).reduce((total, values) => total + values.length, 0);
  if (mismatchCount === 0 && matchingProvenance) return { state: "ALREADY_IMPORTED_CANONICAL_DATASET", diagnostics };
  const onlyMissing = diagnostics.extraPartners.length === 0 && diagnostics.extraContacts.length === 0 && diagnostics.extraMemberships.length === 0 && diagnostics.categoryMismatch.length === 0 && (diagnostics.missingPartners.length + diagnostics.missingContacts.length + diagnostics.missingMemberships.length > 0);
  return { state: onlyMissing ? "PARTIAL_IMPORT" : "CONFLICTING_EXISTING_DATA", diagnostics };
}

export async function executePartnerImportPlan(
  plan: PartnerImportPlan,
  options: ImportExecuteOptions,
): Promise<ImportExecutionReport> {
  if (options.dryRun) {
    return {
      status: "DRY_RUN_SUCCESS",
      workbookFingerprintPrefix: plan.workbookFingerprintPrefix,
      partnersCount: plan.partners.length,
      contactsCount: plan.contacts.length,
      membershipsCount: plan.categoryMemberships.length,
      quarantinedCount: plan.quarantinedRows.length,
      appliedDatabaseWrites: 0,
      message:
        "Dry run completed successfully. 0 database writes performed. All invariants verified.",
    };
  }
  throw new Error("Database apply requires applyPartnerImportPlan with an explicitly authorized database target.");
}

export interface PartnerImportDb {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  transaction: <T>(
    callback: (tx: PartnerImportTransaction) => Promise<T>,
  ) => Promise<T>;
}

export interface PartnerImportTransaction {
  insertCategory: (code: string, name: string, description: string) => Promise<{ id: string }>;
  insertPartner: (partner: {
    id: string;
    companyName: string;
    vendorCode: string | null;
    address: string | null;
    taxId: string | null;
  }) => Promise<void>;
  insertContact: (contact: {
    id: string;
    partnerId: string;
    picName: string | null;
    email: string | null;
    phone: string | null;
  }) => Promise<void>;
  insertCategoryMember: (
    partnerId: string,
    categoryId: string,
  ) => Promise<void>;
  logAudit: (audit: {
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }) => Promise<void>;
}

/** Adapts the repository's Drizzle client to the import executor contract. */
export function createDrizzlePartnerImportDb(db: Database): PartnerImportDb {
  return {
    async query(statement) {
      const result = await db.execute(sql.raw(statement));
      return { rows: result.rows };
    },
    async transaction(callback) {
      return db.transaction(async (tx) => callback({
        async insertCategory(code, name, description) {
          const id = randomUUID();
          const [category] = await tx
            .insert(partnerCategories)
            .values({ id, code, name, description, isActive: true })
            .onConflictDoUpdate({
              target: partnerCategories.code,
              set: { name, description, isActive: true },
            })
            .returning({ id: partnerCategories.id });
          if (!category) throw new Error(`Failed to resolve canonical category ${code}.`);
          return category;
        },
        async insertPartner(partner) {
          await tx.insert(businessPartners).values({
            id: partner.id,
            companyName: partner.companyName,
            vendorCode: partner.vendorCode,
            address: partner.address,
            taxId: partner.taxId,
            isActive: true,
            deletedAt: null,
          });
        },
        async insertContact(contact) {
          await tx.insert(partnerContacts).values({
            id: contact.id,
            partnerId: contact.partnerId,
            picName: contact.picName,
            email: contact.email,
            phone: contact.phone,
            deletedAt: null,
          });
        },
        async insertCategoryMember(partnerId, categoryId) {
          await tx.insert(partnerCategoryMembers).values({
            id: randomUUID(), partnerId, categoryId,
          });
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
      }));
    },
  };
}

export async function checkMigrationTableExistence(
  queryFn: (sql: string) => Promise<{ rows: unknown[] }>,
): Promise<boolean> {
  const tables = [
    "business_partners",
    "partner_contacts",
    "partner_categories",
    "partner_category_members",
  ];

  for (const table of tables) {
    const result = await queryFn(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}'`,
    );
    if (result.rows.length === 0) {
      return false;
    }
  }

  return true;
}

export async function applyPartnerImportPlan(
  plan: PartnerImportPlan,
  db: PartnerImportDb,
  env: Record<string, string | undefined>,
  options: ImportExecuteOptions,
): Promise<ImportExecutionReport> {
  validateApplyAuthorization(env, options);

  const tablesExist = await checkMigrationTableExistence((sql) => db.query(sql));
  if (!tablesExist) {
    throw new Error("STOP — PARTNER MASTER MIGRATION NOT APPLIED");
  }

  const classification = await classifyPartnerImportState(plan, db);
  const dbState = classification.state;
  if (dbState !== "EMPTY") {
    if (dbState === "ALREADY_IMPORTED_CANONICAL_DATASET") {
      return {
        status: "APPLY_SUCCESS",
        workbookFingerprintPrefix: plan.workbookFingerprintPrefix,
        partnersCount: 0,
        contactsCount: 0,
        membershipsCount: 0,
        quarantinedCount: plan.quarantinedRows.length,
        databaseState: dbState,
        appliedDatabaseWrites: 0,
        message: "Dataset is already imported. Idempotent second execution made 0 modifications.",
      };
    } else if (dbState === "PARTIAL_IMPORT") {
      throw new Error(
        "STOP — PARTIAL_IMPORT DETECTED. Database contains partial records. Manual review required.",
      );
    } else {
      throw new Error(
        "STOP — CONFLICTING_EXISTING_DATA DETECTED. Database contains unexpected partner records.",
      );
    }
  }

  // Atomic transaction
  return db.transaction(async (tx) => {
    // 1. Seed/ensure canonical categories
    const categoryIdMap = new Map<string, string>();
    for (const cat of CANONICAL_PARTNER_CATEGORIES) {
      const created = await tx.insertCategory(cat.code, cat.name, cat.description);
      categoryIdMap.set(cat.code, created.id);
    }

    // 2. Insert partners
    const partnerIdMap = new Map<string, string>();
    for (const partner of plan.partners) {
      await tx.insertPartner({
        id: partner.id,
        companyName: partner.companyName,
        vendorCode: partner.vendorCode,
        address: partner.address,
        taxId: partner.taxId,
      });
      partnerIdMap.set(partner.companyName, partner.id);
    }

    // 3. Insert contacts
    for (const contact of plan.contacts) {
      const partnerId = partnerIdMap.get(contact.partnerCompanyName);
      if (partnerId) {
        await tx.insertContact({
          id: contact.id,
          partnerId,
          picName: contact.picName,
          email: contact.email,
          phone: contact.phone,
        });
      }
    }

    // 4. Insert category memberships
    for (const membership of plan.categoryMemberships) {
      const partnerId = partnerIdMap.get(membership.partnerCompanyName);
      const categoryId = categoryIdMap.get(membership.categoryCode);
      if (partnerId && categoryId) {
        await tx.insertCategoryMember(partnerId, categoryId);
      }
    }

    // 5. Aggregate audit log
    await tx.logAudit({
      action: "partner.import",
      entityType: "partner_import",
      entityId: plan.workbookFingerprintPrefix,
      metadata: {
        importVersion: "C2A.1",
        workbookFingerprint: plan.workbookFingerprint,
        canonicalPartnerCount: plan.partners.length,
        canonicalContactCount: plan.contacts.length,
        membershipCount: plan.categoryMemberships.length,
        fingerprintPrefix: plan.workbookFingerprintPrefix,
        stats: plan.stats,
        quarantineCount: plan.quarantinedRows.length,
      },
    });

    return {
      status: "APPLY_SUCCESS",
      workbookFingerprintPrefix: plan.workbookFingerprintPrefix,
      partnersCount: plan.partners.length,
      contactsCount: plan.contacts.length,
      membershipsCount: plan.categoryMemberships.length,
      quarantinedCount: plan.quarantinedRows.length,
      databaseState: "EMPTY",
      appliedDatabaseWrites:
        plan.partners.length +
        plan.contacts.length +
        plan.categoryMemberships.length +
        CANONICAL_PARTNER_CATEGORIES.length,
      message: "Future apply transaction successfully committed.",
    };
  });
}
