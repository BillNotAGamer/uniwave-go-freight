import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

function readDotEnvValue(path, key) {
  if (!existsSync(path)) {
    return null;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const name = trimmed.slice(0, equalsIndex).trim();

    if (name !== key) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    return value;
  }

  return null;
}

function loadDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    readDotEnvValue(".env.local", "DATABASE_URL") ||
    readDotEnvValue(".env", "DATABASE_URL")
  );
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

function statusFor(expected, rows) {
  const row = rows.find((entry) => Number(entry.created_at) === expected.when);

  if (!row) {
    return "NOT APPLIED";
  }

  if (row.hash !== expected.hash) {
    return "INCONSISTENT";
  }

  return "APPLIED";
}

async function existsQuery(sql, text, params = []) {
  const rows = await sql.query(text, params);
  return Boolean(rows[0]?.exists);
}

const databaseUrl = loadDatabaseUrl();

if (!databaseUrl) {
  throw new Error("DATABASE_URL was not found.");
}

const target = new URL(databaseUrl);
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
const expected = journal.entries.map((entry) => ({
  tag: entry.tag,
  when: entry.when,
  hash: hashFile(`drizzle/${entry.tag}.sql`),
}));
const sql = neon(databaseUrl);

const migrationTableExists = await existsQuery(sql, `
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'drizzle'
      and table_name = '__drizzle_migrations'
  ) as exists
`);
const rows = migrationTableExists
  ? await sql`
      select id, hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at asc, id asc
    `
  : [];
const migrationStates = expected.map((entry) => ({
  tag: entry.tag,
  status: statusFor(entry, rows),
}));
const expectedWhen = new Set(expected.map((entry) => entry.when));
const extraMigrationRows = rows
  .filter((row) => !expectedWhen.has(Number(row.created_at)))
  .map((row) => ({ id: row.id, createdAt: row.created_at }));

const columnChecks = {};

for (const [table, column] of [
  ["shipping_notes", "checked_at"],
  ["shipping_notes", "approved_at"],
  ["shipping_notes", "locked_by_id"],
  ["shipping_notes", "lock_reason"],
  ["shipping_notes", "cancelled_by_id"],
  ["shipping_notes", "cancelled_at"],
  ["shipping_notes", "cancel_reason"],
  ["shipping_note_exports", "drive_upload_status"],
  ["shipping_note_exports", "drive_uploaded_at"],
  ["shipping_note_exports", "drive_folder_id"],
  ["shipping_note_exports", "drive_error_message"],
  ["shipping_note_exports", "artifact_storage_key"],
  ["shipping_note_exports", "artifact_size_bytes"],
  ["shipping_note_exports", "artifact_mime_type"],
]) {
  columnChecks[`${table}.${column}`] = await existsQuery(sql, `
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and column_name = $2
    ) as exists
  `, [table, column]);
}

const constraintChecks = {};

for (const constraint of [
  "shipping_notes_locked_by_id_users_id_fk",
  "shipping_notes_cancelled_by_id_users_id_fk",
]) {
  constraintChecks[constraint] = await existsQuery(sql, `
    select exists (
      select 1
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'shipping_notes'
        and constraint_name = $1
    ) as exists
  `, [constraint]);
}

const indexChecks = {};

for (const indexName of [
  "shipping_note_exports_artifact_storage_key_uidx",
  "audit_logs_created_at_id_idx",
]) {
  indexChecks[indexName] = await existsQuery(sql, `
    select exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = $1
    ) as exists
  `, [indexName]);
}

const enumChecks = {};

for (const enumName of ["drive_upload_status"]) {
  enumChecks[enumName] = await existsQuery(sql, `
    select exists (
      select 1
      from pg_type
      where typname = $1
    ) as exists
  `, [enumName]);
}

const baseTableChecks = {};

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
  const exists = await existsQuery(sql, `
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = $1
    ) as exists
  `, [tableName]);
  const check = { exists };

  if (exists) {
    const countRows = await sql.query(
      `select count(*)::text as count from public.${tableName}`,
    );
    check.rowCount = countRows[0]?.count ?? "unknown";
  }

  baseTableChecks[tableName] = check;
}

const integrationRunIds = await sql.query(`
  select distinct lower((regexp_match(
    email,
    '(it-[a-z]+-[0-9]{8}-[0-9]{6}-[0-9a-f]{4})',
    'i'
  ))[1]) as run_id
  from users
  where email like '%@integration.test'
  order by run_id asc
`);

const orphanAuditDiagnostics = await sql.query(`
  select
    action,
    entity_type as "entityType",
    actor_user_id is null as "actorUserIdMissing",
    exists(select 1 from users where users.id = audit_logs.actor_user_id) as "actorUserExists",
    coalesce(before::text, '') ilike '%IT-%' as "beforeContainsIntegrationMarker",
    coalesce(after::text, '') ilike '%IT-%' as "afterContainsIntegrationMarker"
  from audit_logs
  where not exists (select 1 from users where users.id = audit_logs.actor_user_id)
  order by created_at asc, id asc
`);

const orphanAuditIdentifiers = await sql.query(`
  select id, created_at as "createdAt"
  from audit_logs
  where action = 'shipping_note.lock'
    and entity_type = 'shipping_note'
    and actor_user_id is null
    and entity_id is not null
    and not exists (select 1 from shipping_notes where shipping_notes.id = audit_logs.entity_id)
    and coalesce(before::text, '') not ilike '%IT-%'
    and coalesce(after::text, '') not ilike '%IT-%'
  order by created_at asc, id asc
`);

console.log(JSON.stringify({
  target: {
    protocol: target.protocol.replace(":", ""),
    hostname: target.hostname.toLowerCase(),
    port: target.port || "default",
    databaseName: decodeURIComponent(target.pathname.replace(/^\/+/, "")),
    sslModePresent: target.searchParams.has("sslmode"),
  },
  migrationTableExists,
  migrationRows: rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
  })),
  migrationStates,
  extraMigrationRows,
  columnChecks,
  constraintChecks,
  indexChecks,
  enumChecks,
  baseTableChecks,
  integrationRunIds: integrationRunIds.map((row) => row.run_id),
  orphanAuditDiagnostics,
  orphanAuditIdentifiers,
}, null, 2));
