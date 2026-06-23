import { randomUUID } from "node:crypto";

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { ROLES } from "../permissions/roles";

const idColumn = () => text("id").primaryKey().$defaultFn(() => randomUUID());

const createdAt = timestamp("created_at", { mode: "date", precision: 3 })
  .notNull()
  .defaultNow();

const updatedAt = timestamp("updated_at", { mode: "date", precision: 3 })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

const deletedAt = timestamp("deleted_at", { mode: "date", precision: 3 });

export const userRoleEnum = pgEnum("user_role", ROLES);

export const shippingModeEnum = pgEnum("shipping_mode", [
  "domestic_truck",
  "sea_export",
  "sea_import",
  "air_export",
  "air_import",
]);

export const volumeUnitEnum = pgEnum("volume_unit", [
  "kgs",
  "cbm",
  "cont_20",
  "cont_40",
  "rt",
]);

export const shippingNoteStatusEnum = pgEnum("shipping_note_status", [
  "draft",
  "submitted",
  "accounting_reviewing",
  "checked",
  "approved",
  "exported",
  "locked",
  "cancelled",
]);

export const chargeSectionEnum = pgEnum("charge_section", [
  "selling",
  "buying",
]);

export const currencyCodeEnum = pgEnum("currency_code", ["VND", "USD"]);

export const exportTypeEnum = pgEnum("export_type", ["excel", "pdf"]);

export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "generated",
  "uploaded",
  "failed",
]);

export const users = pgTable("users", {
  id: idColumn(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  emailVerified: boolean("email_verified").notNull().default(false),
  role: userRoleEnum("role").notNull().default("sale"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
  deletedAt,
});

export const sessions = pgTable(
  "sessions",
  {
    id: idColumn(),
    createdAt,
    updatedAt,
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3 }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_token_idx").on(table.token),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: idColumn(),
    createdAt,
    updatedAt,
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      precision: 3,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      precision: 3,
    }),
    scope: text("scope"),
    password: text("password"),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_uidx").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: idColumn(),
    createdAt,
    updatedAt,
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3 }).notNull(),
    identifier: text("identifier").notNull(),
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
    uniqueIndex("verifications_value_uidx").on(table.value),
  ],
);

export const authSchema = {
  users,
  sessions,
  accounts,
  verifications,
} as const;

export const shippingNotes = pgTable(
  "shipping_notes",
  {
    id: idColumn(),
    jobsheetNo: text("jobsheet_no").notNull().unique(),
    mawbHawbNo: text("mawb_hawb_no"),
    shippingMode: shippingModeEnum("shipping_mode")
      .notNull()
      .default("domestic_truck"),
    shipperText: text("shipper_text"),
    consigneeText: text("consignee_text"),
    customerText: text("customer_text"),
    agentText: text("agent_text"),
    aol: text("aol"),
    aod: text("aod"),
    finalDestination: text("final_destination"),
    etd: timestamp("etd", { mode: "date", precision: 3 }),
    eta: timestamp("eta", { mode: "date", precision: 3 }),
    volumeValue: numeric("volume_value", { precision: 18, scale: 3 }),
    volumeUnit: volumeUnitEnum("volume_unit"),
    exchangeRate: numeric("exchange_rate", {
      precision: 18,
      scale: 6,
    })
      .notNull()
      .default("1"),
    status: shippingNoteStatusEnum("status").notNull().default("draft"),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { mode: "date", precision: 3 }),
    checkedById: text("checked_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedById: text("approved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lockedAt: timestamp("locked_at", { mode: "date", precision: 3 }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("shipping_notes_status_idx").on(table.status),
    index("shipping_notes_created_by_id_idx").on(table.createdById),
  ],
);

export const shippingNoteCharges = pgTable(
  "shipping_note_charges",
  {
    id: idColumn(),
    shippingNoteId: text("shipping_note_id")
      .notNull()
      .references(() => shippingNotes.id, { onDelete: "cascade" }),
    section: chargeSectionEnum("section").notNull(),
    chargeName: text("charge_name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 18, scale: 3 }).notNull(),
    unit: text("unit"),
    unitPrice: numeric("unit_price", { precision: 18, scale: 4 }).notNull(),
    currency: currencyCodeEnum("currency").notNull().default("VND"),
    exchangeRate: numeric("exchange_rate", {
      precision: 18,
      scale: 6,
    })
      .notNull()
      .default("1"),
    amountOriginal: numeric("amount_original", {
      precision: 20,
      scale: 4,
    }).notNull(),
    amountVnd: numeric("amount_vnd", { precision: 20, scale: 2 }).notNull(),
    vatPercent: numeric("vat_percent", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    vatAmount: numeric("vat_amount", { precision: 20, scale: 2 })
      .notNull()
      .default("0"),
    vendorOrAgentText: text("vendor_or_agent_text"),
    isOverride: boolean("is_override").notNull().default(false),
    overrideReason: text("override_reason"),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("shipping_note_charges_shipping_note_id_idx").on(
      table.shippingNoteId,
    ),
  ],
);

export const shippingNoteExports = pgTable(
  "shipping_note_exports",
  {
    id: idColumn(),
    shippingNoteId: text("shipping_note_id")
      .notNull()
      .references(() => shippingNotes.id, { onDelete: "cascade" }),
    exportType: exportTypeEnum("export_type").notNull(),
    version: integer("version").notNull().default(1),
    status: exportStatusEnum("status").notNull().default("pending"),
    driveFileId: text("drive_file_id"),
    driveUrl: text("drive_url"),
    fileName: text("file_name"),
    checksum: text("checksum"),
    errorMessage: text("error_message"),
    generatedById: text("generated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    generatedAt: timestamp("generated_at", { mode: "date", precision: 3 }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("shipping_note_exports_shipping_note_id_idx").on(
      table.shippingNoteId,
    ),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idColumn(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    createdAt,
  },
  (table) => [
    index("audit_logs_entity_lookup_idx").on(table.entityType, table.entityId),
  ],
);

export const taxRules = pgTable(
  "tax_rules",
  {
    id: idColumn(),
    name: text("name").notNull(),
    shippingMode: shippingModeEnum("shipping_mode").notNull(),
    chargeSection: chargeSectionEnum("charge_section").notNull(),
    chargeNamePattern: text("charge_name_pattern").notNull(),
    vatPercent: numeric("vat_percent", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    isActive: boolean("is_active").notNull().default(true),
    effectiveFrom: timestamp("effective_from", { mode: "date", precision: 3 }),
    effectiveTo: timestamp("effective_to", { mode: "date", precision: 3 }),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("tax_rules_lookup_idx").on(
      table.shippingMode,
      table.chargeSection,
      table.isActive,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

export type ShippingNote = typeof shippingNotes.$inferSelect;
export type NewShippingNote = typeof shippingNotes.$inferInsert;

export type ShippingNoteCharge = typeof shippingNoteCharges.$inferSelect;
export type NewShippingNoteCharge = typeof shippingNoteCharges.$inferInsert;

export type ShippingNoteExport = typeof shippingNoteExports.$inferSelect;
export type NewShippingNoteExport = typeof shippingNoteExports.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type TaxRule = typeof taxRules.$inferSelect;
export type NewTaxRule = typeof taxRules.$inferInsert;
