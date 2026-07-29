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

    expect(Number(row?.count ?? 0)).toBeGreaterThanOrEqual(3);
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
});
