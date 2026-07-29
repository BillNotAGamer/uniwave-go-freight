import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { db } from "@/lib/db/client";

let readyPromise: Promise<void> | null = null;

type BooleanRow = {
  exists: boolean;
};

type CountRow = {
  count: string | number;
};

function rowsFromResult<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }

  throw new Error("Unexpected database result shape.");
}

export async function queryRows<T>(query: Parameters<typeof db.execute>[0]): Promise<T[]> {
  return rowsFromResult<T>(await db.execute(query));
}

async function assertExists(label: string, query: Parameters<typeof db.execute>[0]): Promise<void> {
  const [row] = await queryRows<BooleanRow>(query);

  if (!row?.exists) {
    throw new Error(`Missing required database object: ${label}.`);
  }
}

export async function ensureDatabaseReady(): Promise<void> {
  readyPromise ??= (async () => {
    await migrate(db, { migrationsFolder: "drizzle" });

    for (const tableName of [
      "users",
      "accounts",
      "sessions",
      "verifications",
      "shipping_notes",
      "shipping_note_charges",
      "shipping_note_exports",
      "audit_logs",
      "tax_rules",
    ]) {
      await assertExists(
        `table ${tableName}`,
        sql`
          select exists (
            select 1
            from information_schema.tables
            where table_schema = 'public'
              and table_name = ${tableName}
          ) as exists
        `,
      );
    }

    for (const enumName of [
      "user_role",
      "shipping_mode",
      "volume_unit",
      "shipping_note_status",
      "charge_section",
      "currency_code",
      "export_type",
      "export_status",
      "tax_treatment",
    ]) {
      await assertExists(
        `enum ${enumName}`,
        sql`
          select exists (
            select 1
            from pg_type
            where typname = ${enumName}
          ) as exists
        `,
      );
    }

    for (const column of [
      ["shipping_notes", "deleted_at"],
      ["shipping_note_charges", "deleted_at"],
      ["shipping_note_charges", "tax_rule_id"],
      ["shipping_note_charges", "tax_rule_code_snapshot"],
      ["shipping_note_charges", "tax_rule_name_snapshot"],
      ["shipping_note_charges", "tax_treatment_snapshot"],
      ["tax_rules", "code"],
      ["tax_rules", "description"],
      ["tax_rules", "tax_treatment"],
      ["audit_logs", "before"],
      ["audit_logs", "after"],
    ] as const) {
      await assertExists(
        `column ${column[0]}.${column[1]}`,
        sql`
          select exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = ${column[0]}
              and column_name = ${column[1]}
          ) as exists
        `,
      );
    }

    const [migrationCount] = await queryRows<CountRow>(sql`
      select count(*)::text as count
      from drizzle.__drizzle_migrations
    `);

    if (Number(migrationCount?.count ?? 0) < 3) {
      throw new Error("Expected committed Drizzle migrations were not recorded.");
    }
  })();

  return readyPromise;
}

export { db };
