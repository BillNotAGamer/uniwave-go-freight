# Phase 11C Integration Database Safety Implementation

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Recent commits:
  - `513e60e up phase 8`
  - `3b0ff2c Phase 9A, 9B, 6A and 6B.1 check point`
  - `1a1b02f feat(ui): implement semantic tokens, shell, and layout foundation`
  - `35c458f feat(exports): add secure internal print view`
  - `178ea63 fix(auth): handle login errors and normalize email`
- Starting working tree: dirty with accepted Phase 8, Phase 9, Phase 10, Phase 11B, migration, documentation, and secret-safety changes already present.
- Pre-existing secret-safety state preserved: `.env.local` is an index deletion, remains local, and remains ignored.

## B. Node 24 Verification

- Active runtime during implementation and validation: Node `v24.19.0`.
- npm version during validation: `10.8.1`.
- Repository runtime policy remains Node 24:
  - `package.json` engines: `>=24 <25`
  - `.nvmrc`: `24`
  - `.npmrc`: `engine-strict=true`

## C. Existing Integration DB Threat Surface

Before Phase 11C, `npm run test:integration` loaded integration setup and could proceed toward Drizzle migration, fixture inserts, and cleanup/deletes using `DATABASE_URL` without an explicit target authorization proof.

The high-risk operations were:

- `migrate(...)` in `tests/integration/setup/database.ts`
- direct integration DB access through shared setup helpers
- destructive cleanup in `tests/integration/setup/cleanup.ts`
- fixture insert/update helpers under `tests/integration/fixtures`
- direct `npm run db:migrate`, which previously invoked Drizzle Kit migration behavior without a repository-owned authorization wrapper

## D. Authorization Contract

Integration database execution now requires all of:

- `NODE_ENV !== "production"`
- `INTEGRATION_TEST_DATABASE_AUTHORIZED === "true"`
- `DATABASE_URL` parses as a PostgreSQL URL
- `INTEGRATION_TEST_DATABASE_EXPECTED_HOST` is non-empty
- `INTEGRATION_TEST_DATABASE_EXPECTED_NAME` is non-empty
- parsed hostname exactly matches the expected host
- parsed database name exactly matches the expected database name

Canonical implementation:

- `src/lib/db/database-target-authorization.ts`
- `tests/integration/setup/database-authorization.ts`

## E. Exact Target Matching

- Host matching is exact after trim and lowercase normalization.
- Database-name matching is exact after trim and URL pathname decoding.
- Accepted protocols are `postgres:` and `postgresql:`.
- Similar hostname prefix and suffix attacks are denied, including names like `production-staging-db.example.invalid` and `staging-db.example.invalid.evil.example`.
- No wildcard, substring, heuristic, or database-name `"test"` inference is used.

## F. Secret-Safe Error Model

The guard throws `DatabaseTargetAuthorizationError` with stable codes:

- `INTEGRATION_DB_NOT_AUTHORIZED`
- `INTEGRATION_DB_PRODUCTION_ENV_FORBIDDEN`
- `INTEGRATION_DB_EXPECTED_HOST_REQUIRED`
- `INTEGRATION_DB_EXPECTED_NAME_REQUIRED`
- `INTEGRATION_DB_URL_INVALID`
- `INTEGRATION_DB_PROTOCOL_INVALID`
- `INTEGRATION_DB_HOST_MISMATCH`
- `INTEGRATION_DB_NAME_MISMATCH`

The safe target descriptor contains only:

- `hostname`
- `databaseName`
- `port`

Unit tests use synthetic credentials and assert that password, token, username, and full URL text are not leaked in failure messages.

## G. Integration Setup Guard Placement

`tests/integration/setup/environment.ts` loads integration environment variables, verifies non-database required auth variables, and then calls `assertAuthorizedIntegrationDatabaseTarget()`.

`tests/integration/setup/database.ts` also guards the migration path directly:

- authorization occurs before `migrate(rawDb, { migrationsFolder: "drizzle" })`
- the exported integration `db` is a guarded proxy that checks authorization before DB property access

This provides both setup-time and DB-access-time protection.

## H. Cleanup / Fixture Guarding

Cleanup is explicitly guarded:

- `cleanupIntegrationRun(...)` wraps destructive cleanup SQL in `runGuardedDatabaseOperation(...)`
- the private cleanup implementation is reachable only after authorization succeeds
- the guarded integration `db` proxy provides defense in depth

Fixtures were updated to call `assertAuthorizedIntegrationDatabaseTarget()` before creating or reading integration fixture records:

- `tests/integration/fixtures/users.ts`
- `tests/integration/fixtures/shipping-notes.ts`
- `tests/integration/fixtures/tax-rules.ts`

## I. test:integration / test:all Behavior

- `npm run test:integration` remains `node --conditions=react-server ./node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts`.
- With authorization variables missing or mismatched, the integration setup throws before migration, fixture mutation, or cleanup.
- Unauthorized integration execution fails closed. It does not skip, pass, or warn only.
- `npm run test:all` remains `npm test && npm run test:integration`; the unit phase may run first, then the integration phase fails closed if database authorization is absent.

These commands were not executed in Phase 11C.

## J. db:migrate Safety Assessment

Before Phase 11C, `npm run db:migrate` was a direct migration command and could mutate whichever database `DATABASE_URL` addressed.

That was a separate high-risk path from the integration harness because it bypassed integration setup files entirely.

## K. db:migrate Guard Implementation, If Applicable

Phase 11C added a repository-owned guarded migration wrapper:

- `scripts/guarded-db-migrate.ts`
- `src/lib/db/guarded-database-migration.ts`

`package.json` now routes `db:migrate` through:

```bash
node --import tsx scripts/guarded-db-migrate.ts
```

Migration execution now requires a distinct explicit contract:

- `DATABASE_MIGRATION_AUTHORIZED=true`
- `DATABASE_MIGRATION_EXPECTED_HOST`
- `DATABASE_MIGRATION_EXPECTED_NAME`

For Phase 11C, production `NODE_ENV` is still denied. The guarded command was not run.

## L. Migration Inventory

Static migration inventory was verified as:

- `drizzle/0000_new_nick_fury.sql`
- `drizzle/0001_dazzling_saracen.sql`
- `drizzle/0002_jittery_paper_doll.sql`
- `drizzle/0003_hard_titania.sql`
- `drizzle/0004_clean_power_man.sql`
- `drizzle/0005_perpetual_goblin_queen.sql`

No `0006_*.sql` migration was created.

## M. Migration 0003 Readiness

`0003_hard_titania.sql` was statically verified to contain the accepted post-checked workflow foundation:

- `checked_at`
- `approved_at`
- `locked_by_id`
- `lock_reason`
- `cancelled_by_id`
- `cancelled_at`
- `cancel_reason`
- lock and cancel user foreign keys

Integration readiness checks were updated to require those columns when an authorized integration target is eventually used.

## N. Migration 0004 Readiness

`0004_clean_power_man.sql` was statically verified to contain durable artifact and Drive lifecycle schema:

- `drive_upload_status`
- `drive_uploaded_at`
- `drive_folder_id`
- `drive_error_message`
- `artifact_storage_key`
- `artifact_size_bytes`
- `artifact_mime_type`
- unique artifact storage-key index

Integration readiness checks were updated to require those schema objects when an authorized integration target is eventually used.

## O. Migration 0005 Readiness

`0005_perpetual_goblin_queen.sql` was statically verified as an additive audit viewer pagination index only:

```sql
CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
```

Integration readiness checks were updated to require `audit_logs_created_at_id_idx`.

## P. Migration Journal Consistency

`drizzle/meta/_journal.json` was verified to contain ordered entries:

- `0:0000_new_nick_fury`
- `1:0001_dazzling_saracen`
- `2:0002_jittery_paper_doll`
- `3:0003_hard_titania`
- `4:0004_clean_power_man`
- `5:0005_perpetual_goblin_queen`

## Q. Tests Added

Added no-database tests:

- `src/lib/db/database-target-authorization.test.ts`
- `src/lib/db/guarded-database-operation.test.ts`
- `src/lib/db/guarded-database-migration.test.ts`
- `src/lib/db/migration-readiness.test.ts`

Updated integration-static coverage:

- `tests/integration/migration.integration.test.ts`

Coverage proves authorization denial, exact matching, protocol rejection, production denial, secret-safe errors, guarded orchestration, migration wrapper behavior, and static migration readiness through `0005`.

## R. Focused Test Results

Command:

```bash
npx vitest run src/lib/db/database-target-authorization.test.ts src/lib/db/guarded-database-operation.test.ts src/lib/db/guarded-database-migration.test.ts src/lib/db/migration-readiness.test.ts
```

Result under Node `v24.19.0` / npm `10.8.1`:

- PASS
- 4 files
- 30 tests

## S. Full Unit Test Result

Command:

```bash
npm test
```

Result under Node `v24.19.0` / npm `10.8.1`:

- PASS
- 48 files
- 275 tests

## T. Typecheck

Command:

```bash
npm run typecheck
```

Result under Node `v24.19.0` / npm `10.8.1`:

- PASS

## U. Lint

Command:

```bash
npm run lint
```

Result under Node `v24.19.0` / npm `10.8.1`:

- PASS

## V. Build

Command:

```bash
npm run build
```

Result under Node `v24.19.0` / npm `10.8.1`:

- PASS
- Next.js compiled `/admin/users`, `/admin/audit`, Shipping Note pages, XLSX/PDF export routes, historical artifact download route, and Google Drive upload route.

## W. Database / Integration Non-Execution

Not run:

- `npm run test:integration`
- `npm run test:all`
- `npm run db:migrate`
- `npm run db:studio`

No database connection was made. No migrations were applied. No integration suite was executed. No Cloudflare R2 or Google Drive operation was performed.

## X. Migration Live Status

Without database access, live migration state is not verified:

- `0003_hard_titania.sql`: LIVE STATUS UNKNOWN / NOT VERIFIED
- `0004_clean_power_man.sql`: LIVE STATUS UNKNOWN / NOT VERIFIED
- `0005_perpetual_goblin_queen.sql`: LIVE STATUS UNKNOWN / NOT VERIFIED

Repository static readiness was verified only from files and tests.

## Y. Files Changed

Phase 11C changed or added:

- `.env.example`
- `package.json`
- `scripts/guarded-db-migrate.ts`
- `src/lib/db/database-target-authorization.ts`
- `src/lib/db/database-target-authorization.test.ts`
- `src/lib/db/guarded-database-operation.ts`
- `src/lib/db/guarded-database-operation.test.ts`
- `src/lib/db/guarded-database-migration.ts`
- `src/lib/db/guarded-database-migration.test.ts`
- `src/lib/db/migration-readiness.test.ts`
- `tests/integration/setup/database-authorization.ts`
- `tests/integration/setup/environment.ts`
- `tests/integration/setup/database.ts`
- `tests/integration/setup/cleanup.ts`
- `tests/integration/fixtures/users.ts`
- `tests/integration/fixtures/shipping-notes.ts`
- `tests/integration/fixtures/tax-rules.ts`
- `tests/integration/migration.integration.test.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_11C_INTEGRATION_DB_SAFETY_IMPLEMENTATION_2026-08-25.md`

Pre-existing dirty work from earlier accepted phases was preserved.

## Z. Remaining Staging Prerequisites

Before staging migration or integration execution:

1. Confirm an isolated staging/test database target with a human operator.
2. Confirm backups or snapshots as appropriate.
3. Set `DATABASE_URL` securely.
4. Set exact integration or migration authorization variables for the intended operation.
5. Confirm `NODE_ENV` is not `production` for integration execution.
6. Run guarded migration/integration commands only after explicit authorization.
7. Keep credential rotation as a human-controlled security action for any historically committed secret.
8. Leave dependency vulnerability triage to Phase 11D.

## AA. Final Verdict

READY FOR LEAD REVIEW
