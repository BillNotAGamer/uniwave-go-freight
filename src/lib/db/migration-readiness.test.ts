import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const drizzleDir = path.join(root, "drizzle");

function readMigration(name: string): string {
  return readFileSync(path.join(drizzleDir, name), "utf8");
}

describe("static migration readiness", () => {
  it("has migration files through 0011", () => {
    expect(readdirSync(drizzleDir).filter((file) => file.endsWith(".sql"))).toEqual([
      "0000_new_nick_fury.sql",
      "0001_dazzling_saracen.sql",
      "0002_jittery_paper_doll.sql",
      "0003_hard_titania.sql",
      "0004_clean_power_man.sql",
      "0005_perpetual_goblin_queen.sql",
      "0006_cold_kulan_gath.sql",
      "0007_fuzzy_steve_rogers.sql",
      "0008_sparkling_husk.sql",
      "0009_flowery_switch.sql",
      "0010_soft_lorna_dane.sql",
      "0011_fresh_radioactive_man.sql",
    ]);
  });

  it("has journal entries through 0011 in order", () => {
    const journal = JSON.parse(
      readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string }> };

    expect(journal.entries.map((entry) => `${entry.idx}:${entry.tag}`)).toEqual([
      "0:0000_new_nick_fury",
      "1:0001_dazzling_saracen",
      "2:0002_jittery_paper_doll",
      "3:0003_hard_titania",
      "4:0004_clean_power_man",
      "5:0005_perpetual_goblin_queen",
      "6:0006_cold_kulan_gath",
      "7:0007_fuzzy_steve_rogers",
      "8:0008_sparkling_husk",
      "9:0009_flowery_switch",
      "10:0010_soft_lorna_dane",
      "11:0011_fresh_radioactive_man",
    ]);
  });

  it("0003 contains post-checked workflow metadata and foreign keys", () => {
    const migration = readMigration("0003_hard_titania.sql");

    for (const expected of [
      '"checked_at"',
      '"approved_at"',
      '"locked_by_id"',
      '"lock_reason"',
      '"cancelled_by_id"',
      '"cancelled_at"',
      '"cancel_reason"',
      '"shipping_notes_locked_by_id_users_id_fk"',
      '"shipping_notes_cancelled_by_id_users_id_fk"',
    ]) {
      expect(migration).toContain(expected);
    }
  });

  it("0004 contains durable artifact and Drive lifecycle fields", () => {
    const migration = readMigration("0004_clean_power_man.sql");

    for (const expected of [
      'CREATE TYPE "public"."drive_upload_status"',
      '"drive_upload_status"',
      '"drive_uploaded_at"',
      '"drive_folder_id"',
      '"drive_error_message"',
      '"artifact_storage_key"',
      '"artifact_size_bytes"',
      '"artifact_mime_type"',
      '"shipping_note_exports_artifact_storage_key_uidx"',
    ]) {
      expect(migration).toContain(expected);
    }
  });

  it("0005 is only the additive audit viewer pagination index", () => {
    const migration = readMigration("0005_perpetual_goblin_queen.sql").trim();

    expect(migration).toBe(
      'CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);',
    );
  });

  it("0006 contains additive partner master domain structures and foreign keys", () => {
    const migration = readMigration("0006_cold_kulan_gath.sql");

    for (const expected of [
      'CREATE TABLE "business_partners"',
      'CREATE TABLE "partner_categories"',
      'CREATE TABLE "partner_category_members"',
      'CREATE TABLE "partner_contacts"',
      '"partner_category_members_partner_id_business_partners_id_fk"',
      '"partner_category_members_category_id_partner_categories_id_fk"',
      '"partner_contacts_partner_id_business_partners_id_fk"',
      '"business_partners_company_name_idx"',
      '"business_partners_vendor_code_idx"',
      '"business_partners_tax_id_idx"',
      '"partner_categories_code_uidx"',
      '"partner_category_members_partner_id_category_id_uidx"',
      '"partner_contacts_partner_id_idx"',
    ]) {
      expect(migration).toContain(expected);
    }
  });

  it("0007 contains only additive Service Catalog structures and its foreign key", () => {
    const migration = readMigration("0007_fuzzy_steve_rogers.sql");

    for (const expected of [
      'CREATE TYPE "public"."service_catalog_nature"',
      'CREATE TABLE "service_catalog_items"',
      'CREATE TABLE "service_catalog_unit_conversions"',
      '"service_catalog_unit_conversions_service_catalog_item_id_service_catalog_items_id_fk"',
      '"service_catalog_items_code_uidx"',
      '"service_catalog_items_name_idx"',
      '"service_catalog_unit_conversions_item_id_idx"',
    ]) {
      expect(migration).toContain(expected);
    }

    expect(migration).not.toMatch(/(?:^|\n)(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\s/im);
    expect(migration).not.toContain('ALTER TABLE "shipping_notes"');
    expect(migration).not.toContain('ALTER TABLE "business_partners"');
  });

  it("0008 additively aligns Shipping Notes with Partner and transport fields", () => {
    const migration = readMigration("0008_sparkling_husk.sql");

    for (const expected of [
      '"shipper_partner_id"',
      '"consignee_partner_id"',
      '"customer_partner_id"',
      '"agent_partner_id"',
      '"domestic_origin"',
      '"domestic_destination"',
      '"port_of_loading"',
      '"port_of_discharge"',
      '"mawb_no"',
      '"hawb_no"',
      '"mbl_no"',
      '"hbl_no"',
      '"flight_no"',
      '"vessel_name"',
      '"voyage_no"',
      'ON DELETE set null',
      '"shipping_notes_shipper_partner_id_idx"',
      '"shipping_notes_consignee_partner_id_idx"',
      '"shipping_notes_customer_partner_id_idx"',
      '"shipping_notes_agent_partner_id_idx"',
    ]) {
      expect(migration).toContain(expected);
    }

    expect(migration.match(/REFERENCES "public"\."business_partners"/g)).toHaveLength(4);
    expect(migration).not.toMatch(/(?:^|\n)(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\s/im);
    expect(migration).not.toContain('ALTER TABLE "business_partners"');
    expect(migration).not.toContain('ALTER TABLE "service_catalog_items"');
    expect(migration).not.toContain('ALTER TABLE "service_catalog_unit_conversions"');
  });

  it("0009 additively aligns charge catalog provenance and declarations", () => {
    const migration = readMigration("0009_flowery_switch.sql");

    for (const expected of [
      'CREATE TABLE "shipping_note_customs_declarations"',
      '"service_catalog_item_id"',
      '"catalog_code_snapshot"',
      '"catalog_name_snapshot"',
      '"catalog_unit_snapshot"',
      '"catalog_vat_rate_snapshot"',
      '"vat_override_rate"',
      'ON DELETE set null',
      'ON DELETE cascade',
      '"shipping_note_charges_service_catalog_item_id_idx"',
      '"shipping_note_customs_declarations_shipping_note_id_idx"',
      '"shipping_note_customs_declarations_active_note_number_uidx"',
      '"shipping_note_charges_vat_override_rate_check"',
    ]) {
      expect(migration).toContain(expected);
    }

    expect(migration).not.toMatch(/(?:^|\n)(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\s/im);
    expect(migration).not.toContain('ALTER TABLE "service_catalog_items"');
    expect(migration).not.toContain('ALTER TABLE "service_catalog_unit_conversions"');
    expect(migration).not.toContain('ALTER TABLE "business_partners"');
  });

  it("0010 contains only additive Shipping Note Documents structures and foreign keys", () => {
    const migration = readMigration("0010_soft_lorna_dane.sql");

    for (const expected of [
      'CREATE TYPE "public"."shipping_note_document_storage_provider"',
      'CREATE TYPE "public"."shipping_note_document_type"',
      'CREATE TABLE "shipping_note_documents"',
      '"shipping_note_documents_shipping_note_id_shipping_notes_id_fk"',
      '"shipping_note_documents_uploaded_by_id_users_id_fk"',
      '"shipping_note_documents_shipping_note_id_idx"',
      '"shipping_note_documents_document_type_idx"',
      '"shipping_note_documents_active_provider_key_uidx"',
      '"shipping_note_documents_size_bytes_check"',
      'ON DELETE cascade',
      'ON DELETE restrict',
    ]) {
      expect(migration).toContain(expected);
    }

    expect(migration).not.toMatch(/(?:^|\n)(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\s/im);
    expect(migration).not.toContain('ALTER TABLE "shipping_notes"');
    expect(migration).not.toContain('ALTER TABLE "users"');
  });

  it("0011 adds Custom mode and nullable custom fields without destructive SQL", () => {
    const migration = readMigration("0011_fresh_radioactive_man.sql");

    expect(migration).toContain('ALTER TYPE "public"."shipping_mode" ADD VALUE \'custom\'');
    expect(migration).toContain('ADD COLUMN "custom_mode_name" text');
    expect(migration).toContain('ADD COLUMN "custom_origin" text');
    expect(migration).toContain('ADD COLUMN "custom_destination" text');
    expect(migration).not.toMatch(/(?:^|\n)(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|CREATE TYPE)\s/im);
  });
});

