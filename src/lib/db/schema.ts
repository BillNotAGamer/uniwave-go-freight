import { randomUUID } from "node:crypto";

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
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
  "custom",
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

export const taxTreatmentEnum = pgEnum("tax_treatment", [
  "taxable",
  "zero_rated",
  "non_taxable",
]);

export const currencyCodeEnum = pgEnum("currency_code", ["VND", "USD"]);

export const exportTypeEnum = pgEnum("export_type", ["excel", "pdf"]);

export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "generated",
  "uploaded",
  "failed",
]);

export const driveUploadStatusEnum = pgEnum("drive_upload_status", [
  "not_uploaded",
  "uploading",
  "uploaded",
  "upload_failed",
]);

export const shippingNoteDocumentTypeEnum = pgEnum(
  "shipping_note_document_type",
  [
    "pre_alert_hbl",
    "pre_alert_mbl",
    "contract",
    "invoice",
  ],
);

export const shippingNoteDocumentStorageProviderEnum = pgEnum(
  "shipping_note_document_storage_provider",
  ["r2", "google_drive"],
);

export const routingLocationTypeEnum = pgEnum("routing_location_type", [
  "airport",
  "seaport",
  "inland",
  "other",
]);

export const routingLocationApplicabilityEnum = pgEnum(
  "routing_location_applicability",
  [
    "sea_pol",
    "sea_pod",
    "sea_final_destination",
    "air_aol",
    "air_aod",
    "air_final_destination",
    "domestic_origin",
    "domestic_destination",
    "custom_origin",
    "custom_destination",
  ],
);

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
    shipperPartnerId: text("shipper_partner_id").references(
      () => businessPartners.id,
      { onDelete: "set null" },
    ),
    shipperText: text("shipper_text"),
    consigneePartnerId: text("consignee_partner_id").references(
      () => businessPartners.id,
      { onDelete: "set null" },
    ),
    consigneeText: text("consignee_text"),
    customerPartnerId: text("customer_partner_id").references(
      () => businessPartners.id,
      { onDelete: "set null" },
    ),
    customerText: text("customer_text"),
    agentPartnerId: text("agent_partner_id").references(
      () => businessPartners.id,
      { onDelete: "set null" },
    ),
    agentText: text("agent_text"),
    domesticOrigin: text("domestic_origin"),
    domesticDestination: text("domestic_destination"),
    customModeName: text("custom_mode_name"),
    customOrigin: text("custom_origin"),
    customDestination: text("custom_destination"),
    // Existing AOL/AOD columns are the canonical Air origin/destination storage.
    aol: text("aol"),
    aod: text("aod"),
    portOfLoading: text("port_of_loading"),
    portOfDischarge: text("port_of_discharge"),
    finalDestination: text("final_destination"),
    mawbNo: text("mawb_no"),
    hawbNo: text("hawb_no"),
    mblNo: text("mbl_no"),
    hblNo: text("hbl_no"),
    flightNo: text("flight_no"),
    vesselName: text("vessel_name"),
    voyageNo: text("voyage_no"),
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
    checkedAt: timestamp("checked_at", { mode: "date", precision: 3 }),
    approvedById: text("approved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { mode: "date", precision: 3 }),
    lockedById: text("locked_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lockedAt: timestamp("locked_at", { mode: "date", precision: 3 }),
    lockReason: text("lock_reason"),
    cancelledById: text("cancelled_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { mode: "date", precision: 3 }),
    cancelReason: text("cancel_reason"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("shipping_notes_status_idx").on(table.status),
    index("shipping_notes_created_by_id_idx").on(table.createdById),
    index("shipping_notes_shipper_partner_id_idx").on(table.shipperPartnerId),
    index("shipping_notes_consignee_partner_id_idx").on(
      table.consigneePartnerId,
    ),
    index("shipping_notes_customer_partner_id_idx").on(table.customerPartnerId),
    index("shipping_notes_agent_partner_id_idx").on(table.agentPartnerId),
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
    taxRuleId: text("tax_rule_id").references(() => taxRules.id, {
      onDelete: "restrict",
    }),
    taxRuleCodeSnapshot: text("tax_rule_code_snapshot"),
    taxRuleNameSnapshot: text("tax_rule_name_snapshot"),
    taxTreatmentSnapshot: taxTreatmentEnum("tax_treatment_snapshot"),
    serviceCatalogItemId: text("service_catalog_item_id").references(
      () => serviceCatalogItems.id,
      { onDelete: "set null" },
    ),
    catalogCodeSnapshot: text("catalog_code_snapshot"),
    catalogNameSnapshot: text("catalog_name_snapshot"),
    catalogUnitSnapshot: text("catalog_unit_snapshot"),
    catalogVatRateSnapshot: numeric("catalog_vat_rate_snapshot", {
      precision: 6,
      scale: 2,
    }),
    vatOverrideRate: numeric("vat_override_rate", {
      precision: 6,
      scale: 2,
    }),
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
    index("shipping_note_charges_tax_rule_id_idx").on(table.taxRuleId),
    index("shipping_note_charges_service_catalog_item_id_idx").on(
      table.serviceCatalogItemId,
    ),
    check(
      "shipping_note_charges_vat_override_rate_check",
      sql`${table.vatOverrideRate} is null or ${table.vatOverrideRate} in (0, 5, 8, 10)`,
    ),
  ],
);

export const shippingNoteCustomsDeclarations = pgTable(
  "shipping_note_customs_declarations",
  {
    id: idColumn(),
    shippingNoteId: text("shipping_note_id")
      .notNull()
      .references(() => shippingNotes.id, { onDelete: "cascade" }),
    declarationNo: text("declaration_no").notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("shipping_note_customs_declarations_shipping_note_id_idx").on(
      table.shippingNoteId,
    ),
    uniqueIndex(
      "shipping_note_customs_declarations_active_note_number_uidx",
    )
      .on(table.shippingNoteId, table.declarationNo)
      .where(sql`${table.deletedAt} is null`),
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
    driveUploadStatus: driveUploadStatusEnum("drive_upload_status")
      .notNull()
      .default("not_uploaded"),
    driveUploadedAt: timestamp("drive_uploaded_at", {
      mode: "date",
      precision: 3,
    }),
    driveFolderId: text("drive_folder_id"),
    driveErrorMessage: text("drive_error_message"),
    artifactStorageKey: text("artifact_storage_key"),
    artifactSizeBytes: integer("artifact_size_bytes"),
    artifactMimeType: text("artifact_mime_type"),
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
    uniqueIndex("shipping_note_exports_artifact_storage_key_uidx").on(
      table.artifactStorageKey,
    ),
  ],
);

export const shippingNoteDocuments = pgTable(
  "shipping_note_documents",
  {
    id: idColumn(),
    shippingNoteId: text("shipping_note_id")
      .notNull()
      .references(() => shippingNotes.id, { onDelete: "cascade" }),
    documentType: shippingNoteDocumentTypeEnum("document_type").notNull(),
    originalFileName: text("original_file_name").notNull(),
    storageProvider:
      shippingNoteDocumentStorageProviderEnum("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedById: text("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("shipping_note_documents_shipping_note_id_idx").on(
      table.shippingNoteId,
    ),
    index("shipping_note_documents_document_type_idx").on(
      table.documentType,
    ),
    uniqueIndex("shipping_note_documents_active_provider_key_uidx")
      .on(table.storageProvider, table.storageKey)
      .where(sql`${table.deletedAt} is null`),
    check(
      "shipping_note_documents_size_bytes_check",
      sql`${table.sizeBytes} >= 0`,
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
    index("audit_logs_created_at_id_idx").on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const taxRules = pgTable(
  "tax_rules",
  {
    id: idColumn(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    shippingMode: shippingModeEnum("shipping_mode").notNull(),
    chargeSection: chargeSectionEnum("charge_section").notNull(),
    chargeNamePattern: text("charge_name_pattern").notNull(),
    taxTreatment: taxTreatmentEnum("tax_treatment").notNull(),
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
    uniqueIndex("tax_rules_code_uidx").on(table.code),
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

export type ShippingNoteCustomsDeclaration =
  typeof shippingNoteCustomsDeclarations.$inferSelect;
export type NewShippingNoteCustomsDeclaration =
  typeof shippingNoteCustomsDeclarations.$inferInsert;

export type ShippingNoteExport = typeof shippingNoteExports.$inferSelect;
export type NewShippingNoteExport = typeof shippingNoteExports.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type TaxRule = typeof taxRules.$inferSelect;
export type NewTaxRule = typeof taxRules.$inferInsert;

export const businessPartners = pgTable(
  "business_partners",
  {
    id: idColumn(),
    vendorCode: text("vendor_code"),
    companyName: text("company_name").notNull(),
    address: text("address"),
    taxId: text("tax_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("business_partners_company_name_idx").on(table.companyName),
    index("business_partners_vendor_code_idx").on(table.vendorCode),
    index("business_partners_tax_id_idx").on(table.taxId),
  ],
);

export const partnerContacts = pgTable(
  "partner_contacts",
  {
    id: idColumn(),
    partnerId: text("partner_id")
      .notNull()
      .references(() => businessPartners.id, { onDelete: "cascade" }),
    picName: text("pic_name"),
    email: text("email"),
    phone: text("phone"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("partner_contacts_partner_id_idx").on(table.partnerId),
  ],
);

export const partnerCategories = pgTable(
  "partner_categories",
  {
    id: idColumn(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("partner_categories_code_uidx").on(table.code),
  ],
);

export const partnerCategoryMembers = pgTable(
  "partner_category_members",
  {
    id: idColumn(),
    partnerId: text("partner_id")
      .notNull()
      .references(() => businessPartners.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => partnerCategories.id, { onDelete: "cascade" }),
    createdAt,
  },
  (table) => [
    index("partner_category_members_partner_id_idx").on(table.partnerId),
    index("partner_category_members_category_id_idx").on(table.categoryId),
    uniqueIndex("partner_category_members_partner_id_category_id_uidx").on(
      table.partnerId,
      table.categoryId,
    ),
  ],
);

export const routingLocations = pgTable(
  "routing_locations",
  {
    id: idColumn(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: routingLocationTypeEnum("type").notNull(),
    countryCode: text("country_code"),
    subdivision: text("subdivision"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("routing_locations_type_code_uidx").on(table.type, table.code),
    index("routing_locations_code_idx").on(table.code),
    index("routing_locations_name_idx").on(table.name),
  ],
);

export const routingLocationApplicabilities = pgTable(
  "routing_location_applicabilities",
  {
    id: idColumn(),
    locationId: text("location_id")
      .notNull()
      .references(() => routingLocations.id, { onDelete: "cascade" }),
    applicability: routingLocationApplicabilityEnum("applicability").notNull(),
    createdAt,
  },
  (table) => [
    index("routing_location_applicabilities_location_id_idx").on(table.locationId),
    uniqueIndex(
      "routing_location_applicabilities_location_id_applicability_uidx",
    ).on(table.locationId, table.applicability),
  ],
);

export const businessPartnersRelations = relations(
  businessPartners,
  ({ many }) => ({
    contacts: many(partnerContacts),
    categoryMemberships: many(partnerCategoryMembers),
    shippingNotesAsShipper: many(shippingNotes, {
      relationName: "shippingNoteShipperPartner",
    }),
    shippingNotesAsConsignee: many(shippingNotes, {
      relationName: "shippingNoteConsigneePartner",
    }),
    shippingNotesAsCustomer: many(shippingNotes, {
      relationName: "shippingNoteCustomerPartner",
    }),
    shippingNotesAsAgent: many(shippingNotes, {
      relationName: "shippingNoteAgentPartner",
    }),
  }),
);

export const shippingNotesRelations = relations(
  shippingNotes,
  ({ many, one }) => ({
    shipperPartner: one(businessPartners, {
      fields: [shippingNotes.shipperPartnerId],
      references: [businessPartners.id],
      relationName: "shippingNoteShipperPartner",
    }),
    consigneePartner: one(businessPartners, {
      fields: [shippingNotes.consigneePartnerId],
      references: [businessPartners.id],
      relationName: "shippingNoteConsigneePartner",
    }),
    customerPartner: one(businessPartners, {
      fields: [shippingNotes.customerPartnerId],
      references: [businessPartners.id],
      relationName: "shippingNoteCustomerPartner",
    }),
    agentPartner: one(businessPartners, {
      fields: [shippingNotes.agentPartnerId],
      references: [businessPartners.id],
      relationName: "shippingNoteAgentPartner",
    }),
    customsDeclarations: many(shippingNoteCustomsDeclarations),
    documents: many(shippingNoteDocuments),
  }),
);

export const partnerContactsRelations = relations(
  partnerContacts,
  ({ one }) => ({
    businessPartner: one(businessPartners, {
      fields: [partnerContacts.partnerId],
      references: [businessPartners.id],
    }),
  }),
);

export const partnerCategoriesRelations = relations(
  partnerCategories,
  ({ many }) => ({
    memberships: many(partnerCategoryMembers),
  }),
);

export const partnerCategoryMembersRelations = relations(
  partnerCategoryMembers,
  ({ one }) => ({
    businessPartner: one(businessPartners, {
      fields: [partnerCategoryMembers.partnerId],
      references: [businessPartners.id],
    }),
    category: one(partnerCategories, {
      fields: [partnerCategoryMembers.categoryId],
      references: [partnerCategories.id],
    }),
  }),
);

export const routingLocationsRelations = relations(
  routingLocations,
  ({ many }) => ({
    applicabilityMemberships: many(routingLocationApplicabilities),
  }),
);

export const routingLocationApplicabilitiesRelations = relations(
  routingLocationApplicabilities,
  ({ one }) => ({
    location: one(routingLocations, {
      fields: [routingLocationApplicabilities.locationId],
      references: [routingLocations.id],
    }),
  }),
);

export const shippingNoteDocumentsRelations = relations(
  shippingNoteDocuments,
  ({ one }) => ({
    shippingNote: one(shippingNotes, {
      fields: [shippingNoteDocuments.shippingNoteId],
      references: [shippingNotes.id],
    }),
    uploadedBy: one(users, {
      fields: [shippingNoteDocuments.uploadedById],
      references: [users.id],
    }),
  }),
);

export type ShippingNoteDocument = typeof shippingNoteDocuments.$inferSelect;
export type NewShippingNoteDocument = typeof shippingNoteDocuments.$inferInsert;

export const serviceCatalogNatureEnum = pgEnum("service_catalog_nature", [
  "service",
  "tool_supply",
  "goods",
]);

export const serviceCatalogItems = pgTable(
  "service_catalog_items",
  {
    id: idColumn(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    nature: serviceCatalogNatureEnum("nature").notNull(),
    primaryUnit: text("primary_unit"),
    vatRate: numeric("vat_rate", { precision: 6, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("service_catalog_items_code_uidx").on(table.code),
    index("service_catalog_items_name_idx").on(table.name),
  ],
);

export const serviceCatalogUnitConversions = pgTable(
  "service_catalog_unit_conversions",
  {
    id: idColumn(),
    serviceCatalogItemId: text("service_catalog_item_id")
      .notNull()
      .references(() => serviceCatalogItems.id, { onDelete: "cascade" }),
    convertedUnit: text("converted_unit").notNull(),
    conversionFactor: numeric("conversion_factor", {
      precision: 18,
      scale: 6,
    }).notNull(),
    operation: text("operation").notNull(),
    sourceDescription: text("source_description"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("service_catalog_unit_conversions_item_id_idx").on(
      table.serviceCatalogItemId,
    ),
  ],
);

export const serviceCatalogItemsRelations = relations(
  serviceCatalogItems,
  ({ many }) => ({
    unitConversions: many(serviceCatalogUnitConversions),
    shippingNoteCharges: many(shippingNoteCharges),
  }),
);

export const shippingNoteChargesRelations = relations(
  shippingNoteCharges,
  ({ one }) => ({
    serviceCatalogItem: one(serviceCatalogItems, {
      fields: [shippingNoteCharges.serviceCatalogItemId],
      references: [serviceCatalogItems.id],
    }),
  }),
);

export const shippingNoteCustomsDeclarationsRelations = relations(
  shippingNoteCustomsDeclarations,
  ({ one }) => ({
    shippingNote: one(shippingNotes, {
      fields: [shippingNoteCustomsDeclarations.shippingNoteId],
      references: [shippingNotes.id],
    }),
  }),
);

export const serviceCatalogUnitConversionsRelations = relations(
  serviceCatalogUnitConversions,
  ({ one }) => ({
    item: one(serviceCatalogItems, {
      fields: [serviceCatalogUnitConversions.serviceCatalogItemId],
      references: [serviceCatalogItems.id],
    }),
  }),
);

export type ServiceCatalogItem = typeof serviceCatalogItems.$inferSelect;
export type NewServiceCatalogItem = typeof serviceCatalogItems.$inferInsert;

export type ServiceCatalogUnitConversion =
  typeof serviceCatalogUnitConversions.$inferSelect;
export type NewServiceCatalogUnitConversion =
  typeof serviceCatalogUnitConversions.$inferInsert;

export type BusinessPartner = typeof businessPartners.$inferSelect;
export type NewBusinessPartner = typeof businessPartners.$inferInsert;

export type PartnerContact = typeof partnerContacts.$inferSelect;
export type NewPartnerContact = typeof partnerContacts.$inferInsert;

export type PartnerCategory = typeof partnerCategories.$inferSelect;
export type NewPartnerCategory = typeof partnerCategories.$inferInsert;

export type PartnerCategoryMember = typeof partnerCategoryMembers.$inferSelect;
export type NewPartnerCategoryMember = typeof partnerCategoryMembers.$inferInsert;

export type RoutingLocation = typeof routingLocations.$inferSelect;
export type NewRoutingLocation = typeof routingLocations.$inferInsert;

export type RoutingLocationApplicability =
  typeof routingLocationApplicabilities.$inferSelect;
export type NewRoutingLocationApplicability =
  typeof routingLocationApplicabilities.$inferInsert;
