import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { ensureDatabaseReady, queryRows } from "./setup/database";

type CountRow = {
  count: string;
};

describe("hosted database migration verification", () => {
  it("applies committed Drizzle migrations and records migration metadata", async () => {
    await ensureDatabaseReady();

    const [row] = await queryRows<CountRow>(sql`
      select count(*)::text as count
      from drizzle.__drizzle_migrations
    `);

    expect(Number(row?.count ?? 0)).toBeGreaterThanOrEqual(6);
  });

  it("has core business tables, auth tables, soft-delete columns, and audit tables", async () => {
    await ensureDatabaseReady();

    const rows = await queryRows<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'users',
          'accounts',
          'sessions',
          'shipping_notes',
          'shipping_note_charges',
          'shipping_note_edit_grants',
          'shipping_note_exports',
          'audit_logs',
          'tax_rules'
        )
    `);

    expect(new Set(rows.map((row) => row.table_name))).toEqual(
      new Set([
        "users",
        "accounts",
        "sessions",
        "shipping_notes",
        "shipping_note_charges",
        "shipping_note_edit_grants",
        "shipping_note_exports",
        "audit_logs",
        "tax_rules",
      ]),
    );
  });

  it("has required constraints for uniqueness and foreign keys", async () => {
    await ensureDatabaseReady();

    const constraints = await queryRows<{ constraint_name: string }>(sql`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and constraint_name in (
          'users_email_unique',
          'shipping_notes_jobsheet_no_unique',
          'shipping_notes_created_by_id_users_id_fk',
          'shipping_notes_locked_by_id_users_id_fk',
          'shipping_notes_cancelled_by_id_users_id_fk',
          'shipping_note_charges_shipping_note_id_shipping_notes_id_fk',
          'audit_logs_actor_user_id_users_id_fk'
          ,'shipping_note_charges_tax_rule_id_tax_rules_id_fk'
        )
    `);

    expect(new Set(constraints.map((row) => row.constraint_name))).toEqual(
      new Set([
        "users_email_unique",
        "shipping_notes_jobsheet_no_unique",
        "shipping_notes_created_by_id_users_id_fk",
        "shipping_notes_locked_by_id_users_id_fk",
        "shipping_notes_cancelled_by_id_users_id_fk",
        "shipping_note_charges_shipping_note_id_shipping_notes_id_fk",
        "audit_logs_actor_user_id_users_id_fk",
        "shipping_note_charges_tax_rule_id_tax_rules_id_fk",
      ]),
    );
  });

  it("has tax treatment enum, tax rule metadata, and charge tax snapshots", async () => {
    await ensureDatabaseReady();

    const columns = await queryRows<{
      table_name: string;
      column_name: string;
      udt_name: string;
    }>(sql`
      select table_name, column_name, udt_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'tax_rules' and column_name in (
            'code',
            'description',
            'tax_treatment'
          ))
          or
          (table_name = 'shipping_note_charges' and column_name in (
            'tax_rule_id',
            'tax_rule_code_snapshot',
            'tax_rule_name_snapshot',
            'tax_treatment_snapshot',
            'vat_percent',
            'vat_amount'
          ))
        )
    `);

    const columnKeys = new Set(
      columns.map((row) => `${row.table_name}.${row.column_name}`),
    );

    expect(columnKeys).toEqual(new Set([
      "tax_rules.code",
      "tax_rules.description",
      "tax_rules.tax_treatment",
      "shipping_note_charges.tax_rule_id",
      "shipping_note_charges.tax_rule_code_snapshot",
      "shipping_note_charges.tax_rule_name_snapshot",
      "shipping_note_charges.tax_treatment_snapshot",
      "shipping_note_charges.vat_percent",
      "shipping_note_charges.vat_amount",
    ]));
    expect(columns.find(
      (row) => row.column_name === "tax_treatment",
    )?.udt_name).toBe("tax_treatment");
    expect(columns.find(
      (row) => row.column_name === "tax_treatment_snapshot",
    )?.udt_name).toBe("tax_treatment");

    const enumValues = await queryRows<{ enumlabel: string }>(sql`
      select enumlabel
      from pg_enum
      where enumtypid = 'tax_treatment'::regtype
      order by enumsortorder
    `);

    expect(enumValues.map((row) => row.enumlabel)).toStrictEqual([
      "taxable",
      "zero_rated",
      "non_taxable",
    ]);
  });

  it("has post-checked workflow metadata columns on shipping notes", async () => {
    await ensureDatabaseReady();

    const columns = await queryRows<{
      column_name: string;
      is_nullable: string;
      udt_name: string;
    }>(sql`
      select column_name, is_nullable, udt_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'shipping_notes'
        and column_name in (
          'checked_at',
          'approved_at',
          'locked_by_id',
          'lock_reason',
          'cancelled_by_id',
          'cancelled_at',
          'cancel_reason'
        )
    `);

    expect(new Set(columns.map((row) => row.column_name))).toEqual(new Set([
      "checked_at",
      "approved_at",
      "locked_by_id",
      "lock_reason",
      "cancelled_by_id",
      "cancelled_at",
      "cancel_reason",
    ]));

    for (const column of columns) {
      expect(column.is_nullable).toBe("YES");
    }

    expect(columns.find((row) => row.column_name === "checked_at")?.udt_name).toBe(
      "timestamp",
    );
    expect(columns.find((row) => row.column_name === "approved_at")?.udt_name).toBe(
      "timestamp",
    );
    expect(columns.find((row) => row.column_name === "cancelled_at")?.udt_name).toBe(
      "timestamp",
    );
  });

  it("has additive manual tax-decision and input VAT evidence constraints", async () => {
    await ensureDatabaseReady();

    const columns = await queryRows<{ column_name: string; is_nullable: string }>(sql`
      select column_name, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'shipping_note_charges'
        and column_name in (
          'tax_decision_source',
          'tax_decision_reason',
          'tax_decision_by_id',
          'tax_decision_at',
          'input_vat_invoice_status',
          'input_vat_invoice_reference',
          'input_vat_deductible'
        )
    `);
    expect(new Set(columns.map((row) => row.column_name))).toEqual(new Set([
      "tax_decision_source",
      "tax_decision_reason",
      "tax_decision_by_id",
      "tax_decision_at",
      "input_vat_invoice_status",
      "input_vat_invoice_reference",
      "input_vat_deductible",
    ]));
    expect(columns.every((column) => column.is_nullable === "YES")).toBe(true);

    const constraints = await queryRows<{ constraint_name: string }>(sql`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'shipping_note_charges'
        and constraint_name in (
          'shipping_note_charges_tax_decision_by_id_users_id_fk',
          'shipping_note_charges_tax_decision_evidence_check',
          'shipping_note_charges_input_vat_evidence_check',
          'shipping_note_charges_input_vat_deduction_check'
        )
    `);
    expect(new Set(constraints.map((row) => row.constraint_name))).toEqual(new Set([
      "shipping_note_charges_tax_decision_by_id_users_id_fk",
      "shipping_note_charges_tax_decision_evidence_check",
      "shipping_note_charges_input_vat_evidence_check",
      "shipping_note_charges_input_vat_deduction_check",
    ]));
  });

  it("has additive missing-invoice exception lifecycle constraints", async () => {
    await ensureDatabaseReady();

    const constraints = await queryRows<{ constraint_name: string }>(sql`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'shipping_note_missing_invoice_exceptions'
    `);
    const names = new Set(constraints.map((row) => row.constraint_name));
    for (const expected of [
      "missing_invoice_exceptions_request_evidence_check",
      "missing_invoice_exceptions_lifecycle_check",
      "shipping_note_missing_invoice_exceptions_shipping_note_id_shipping_notes_id_fk",
      "shipping_note_missing_invoice_exceptions_buying_charge_id_shipping_note_charges_id_fk",
      "shipping_note_missing_invoice_exceptions_requested_by_id_users_id_fk",
      "shipping_note_missing_invoice_exceptions_decision_by_id_users_id_fk",
      "shipping_note_missing_invoice_exceptions_invalidated_by_id_users_id_fk",
    ]) {
      // PostgreSQL limits identifiers to 63 bytes and deterministically
      // truncates Drizzle's long generated FK names.
      expect(
        [...names].some((name) => name === expected ||
          name === expected.slice(0, 63)),
      ).toBe(true);
    }

    const indexes = await queryRows<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'shipping_note_missing_invoice_exceptions'
    `);
    expect(indexes.map((row) => row.indexname)).toContain(
      "missing_invoice_exceptions_active_charge_uidx",
    );
  });

  it("has Phase 3 edit-grant constraints and selling-rate reopen metadata", async () => {
    await ensureDatabaseReady();

    const constraints = await queryRows<{ constraint_name: string }>(sql`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'shipping_note_edit_grants'
    `);
    const constraintNames = new Set(constraints.map((row) => row.constraint_name));

    for (const expectedConstraint of [
      "shipping_note_edit_grants_revocation_state_check",
      "shipping_note_edit_grants_shipping_note_id_shipping_notes_id_fk",
      "shipping_note_edit_grants_recipient_user_id_users_id_fk",
      "shipping_note_edit_grants_granted_by_id_users_id_fk",
      "shipping_note_edit_grants_revoked_by_id_users_id_fk",
    ]) {
      expect(constraintNames.has(expectedConstraint)).toBe(true);
    }

    const indexes = await queryRows<{ indexname: string; indexdef: string }>(sql`
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'shipping_note_edit_grants'
    `);
    expect(indexes.find(
      (row) => row.indexname === "shipping_note_edit_grants_active_note_recipient_uidx",
    )?.indexdef).toContain("WHERE (status = 'active'::shipping_note_edit_grant_status)");

    const reopenColumns = await queryRows<{ column_name: string; is_nullable: string }>(sql`
      select column_name, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'shipping_notes'
        and column_name in (
          'selling_rate_reopened_by_id',
          'selling_rate_reopened_at',
          'selling_rate_reopen_reason'
        )
    `);
    expect(new Set(reopenColumns.map((row) => row.column_name))).toEqual(new Set([
      "selling_rate_reopened_by_id",
      "selling_rate_reopened_at",
      "selling_rate_reopen_reason",
    ]));
    expect(reopenColumns.every((column) => column.is_nullable === "YES")).toBe(true);
  });

  it("has durable export artifact and Drive upload foundation columns", async () => {
    await ensureDatabaseReady();

    const columns = await queryRows<{
      column_name: string;
      is_nullable: string;
      udt_name: string;
      column_default: string | null;
    }>(sql`
      select column_name, is_nullable, udt_name, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'shipping_note_exports'
        and column_name in (
          'artifact_storage_key',
          'artifact_size_bytes',
          'artifact_mime_type',
          'drive_upload_status',
          'drive_uploaded_at',
          'drive_folder_id',
          'drive_error_message'
        )
    `);

    const columnKeys = new Set(columns.map((row) => row.column_name));
    expect(columnKeys).toEqual(new Set([
      "artifact_storage_key",
      "artifact_size_bytes",
      "artifact_mime_type",
      "drive_upload_status",
      "drive_uploaded_at",
      "drive_folder_id",
      "drive_error_message",
    ]));

    for (const column of columns) {
      if (column.column_name === "drive_upload_status") {
        expect(column.is_nullable).toBe("NO");
        expect(column.udt_name).toBe("drive_upload_status");
        expect(column.column_default).toContain("'not_uploaded'");
      } else {
        expect(column.is_nullable).toBe("YES");
      }
    }

    const enumValues = await queryRows<{ enumlabel: string }>(sql`
      select enumlabel
      from pg_enum
      where enumtypid = 'drive_upload_status'::regtype
      order by enumsortorder
    `);

    expect(enumValues.map((row) => row.enumlabel)).toStrictEqual([
      "not_uploaded",
      "uploading",
      "uploaded",
      "upload_failed",
    ]);

    const indexes = await queryRows<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'shipping_note_exports'
        and indexname = 'shipping_note_exports_artifact_storage_key_uidx'
    `);

    expect(indexes.map((row) => row.indexname)).toStrictEqual([
      "shipping_note_exports_artifact_storage_key_uidx",
    ]);
  });

  it("has audit viewer pagination index", async () => {
    await ensureDatabaseReady();

    const indexes = await queryRows<{ indexname: string; indexdef: string }>(sql`
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'audit_logs'
        and indexname = 'audit_logs_created_at_id_idx'
    `);

    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.indexdef).toContain("created_at DESC");
    expect(indexes[0]?.indexdef).toContain("id DESC");
  });
});
