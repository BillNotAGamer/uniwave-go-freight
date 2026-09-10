# Testing

## Prerequisites

- Node.js 24.x. The repository policy is `.nvmrc` value `24` plus package engines `>=24 <25`.
- npm dependencies installed.
- Unit/policy tests do not require a live database, Google credentials, production secrets, or `.env.local` values.
- Unit/policy tests do not require Cloudflare R2 credentials; artifact storage uses fake/in-memory providers in tests.
- Unit/policy Drive upload tests use fake Drive and fake artifact storage; they must not call live Google Drive.
- Hosted integration tests use the current `.env.local` `DATABASE_URL`, which must be owner-authorized for the exact intended target before execution.
- `.env.local` is a local-only secret file and must not be tracked by Git. `.env.example` is the safe committed template.
- Integration tests mutate their target database through migrations, fixture inserts, and cleanup deletes. They fail closed unless `DATABASE_URL` is explicitly authorized by exact host and exact database name.

## Commands

- Select Node 24 before validation, for example with `nvm use` in environments that support `.nvmrc`.
- `npm test` runs all repository-owned tests once through Vitest `3.2.7`.
- `npm run test:e2e` builds and starts a local production-style Next server with browser-E2E environment values, then runs Chromium Playwright tests from `tests/e2e`.
- `npm run test:e2e:headed` runs the same browser suite with a visible Chromium browser.
- `npm run test:e2e:auth` builds and starts a local production-style Next server, seeds a uniquely namespaced authenticated E2E fixture set, runs Chromium tests from `tests/e2e-auth`, then cleans and verifies the fixture namespace.
- `npm run test:e2e:auth:headed` runs the authenticated browser suite with a visible Chromium browser.
- `npm run ci:security-audit` runs the repository npm-audit policy gate and preserves the accepted Better Auth waiver only while passwordless email auth remains disabled.
- `npm run test:watch` runs Vitest in watch mode for local development.
- `npm run test:integration` runs hosted PostgreSQL integration tests once against the current `DATABASE_URL`.
- `npm run test:all` runs unit/policy tests first, then hosted database integration tests.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run lint` runs ESLint.
- `npm run build` validates the production Next.js build.
- Dependency-security closure validation uses `npm audit` and `npm audit --omit=dev` as classification inputs, not as severity-count-only release gates. Phase 11D.1 leaves no reachable production High/Critical finding under the current configuration.
- Install Playwright's Chromium runtime with `npx playwright install chromium` on a fresh machine or CI runner before browser E2E.
- Playwright artifacts are local diagnostics only. `playwright-report/` and `test-results/` are ignored and must not contain real credentials.
- The GitHub Actions `Quality Gates` workflow runs validation only: Node 24 verification, `npm ci`, `npm ls`, unit tests, typecheck, lint, build, Playwright Chromium E2E, and the security-audit policy. It intentionally excludes integration tests, `test:all`, migrations, R2, Google Drive, deployment, and external resource provisioning.
- Phase 11G adds DB-free security hardening coverage:
  - `src/next-config.test.ts` verifies powered-by suppression, baseline security headers, staged CSP, sensitive-route no-store headers, and the deliberate absence of app-level HSTS in local HTTP config.
  - `src/lib/env-public-safety.test.ts` verifies `.env.example` variable names keep server secrets out of `NEXT_PUBLIC_*`.
  - `tests/e2e/public-auth-boundary.spec.ts` verifies the `/login` response headers in a production-style local Next server.
- Authenticated security-header, cookie, HSTS-over-HTTPS, and cache behavior must be reverified during authorized staging browser E2E because DB-backed sessions are intentionally not exercised by the DB-free suite.
- Do not run `npm run test:integration`, `npm run test:all`, `npm run db:migrate`, or Drizzle Studio until the exact current database target is authorized for that operation.
- `npm run test:integration` requires:
  - `DATABASE_URL`
  - `INTEGRATION_TEST_DATABASE_AUTHORIZED="true"`
  - `INTEGRATION_TEST_DATABASE_EXPECTED_HOST` matching the parsed `DATABASE_URL` hostname exactly, case-insensitively.
  - `INTEGRATION_TEST_DATABASE_EXPECTED_NAME` matching the parsed `DATABASE_URL` database name exactly.
- `NODE_ENV="production"` is refused for integration database execution unless `INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED="true"` is also present.
- `npm run test:e2e:auth` uses the same integration database target guard variables for fixture setup/cleanup, and production targets require `INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED="true"`. It is intentionally excluded from normal CI because it mutates the authorized database.
- `npm run db:migrate` is guarded separately and requires:
  - `DATABASE_MIGRATION_AUTHORIZED="true"`
  - `DATABASE_MIGRATION_EXPECTED_HOST`
  - `DATABASE_MIGRATION_EXPECTED_NAME`
  - `DATABASE_MIGRATION_PRODUCTION_AUTHORIZED="true"` when `NODE_ENV="production"`.

## Current Test Categories

- Permission matrix tests for sale, accountant, and admin roles.
- Decimal and money calculation tests with exact persisted string expectations.
- Shipping note summary tests for selling totals, buying totals, and gross profit.
- VAT calculation, treatment consistency, charge tax completeness, and tax-rule validator tests.
- VAT/tax UI policy tests for role capability, status-based controls, treatment labels, override badges, completeness messages, Mark Checked disabled reasons, and deactivation copy.
- Status-policy tests for the currently implemented draft, submitted, accounting-reviewing, and checked behavior.
- Status-policy tests for Phase 6C.1 future post-checked source-state helpers and the decision to keep `exported` outside the normal Shipping Note business workflow.
- Phase 6C.2 status-policy tests for checked/approved export eligibility while keeping locked, cancelled, and exported denied.
- Phase 6C.3 status-policy tests for approved-only lock, locked-only unlock, and checked/approved/locked export eligibility while keeping cancelled and exported denied.
- Phase 6C.4 status-policy and validator tests for normal cancellation sources, finalized cancellation sources, cancelled/exported/locked denial, optional Sale-own Draft reason, and mandatory finalized reason.
- Phase 6C.5 status-policy and validator tests for Checked/Approved-only correction reopen, mandatory reason, and locked/cancelled/exported/reviewing source denial.
- Zod validation tests for shipping notes and charge inputs.
- Internal XLSX export safeguard tests for filenames, same-origin metadata, and content disposition.
- Internal PDF export tests for metadata version, layout version, MIME type, PDF filename, generated/failed persistence values, local font tracing, real PDF bytes, extracted accounting/tax content, Vietnamese Unicode text, and multi-page output.
- Durable artifact storage tests for deterministic storage keys, fake put/get, R2 endpoint/config/request mapping, SDK stream conversion, SHA-256 verification, checksum mismatch rejection, and historical metadata-only rejection.
- Google Drive upload tests for service-account config parsing, Drive request mapping, appProperties lookup/create metadata, Shared Drive flags, sanitized error classification, artifact eligibility, idempotency, checksum blocking, historical reopened/cancelled artifact policy, and safe route JSON.
- Phase 8C tests for protected export-history DTOs, historical download authorization/checksum behavior, route headers, Drive UI action policy, stale upload threshold, and stale recovery reconciliation/retry behavior.
- Phase 9A Admin User Management foundation tests for `USERS_MANAGE`, account-status derivation, self-action denial, last-admin protection, hard-delete prohibition, session-revocation matrix, reason policy, role/password/list validators, safe DTO allowlisting, and protected Admin list-read behavior.
- Phase 9B Admin User Management lifecycle tests for Better Auth-compatible credential helper behavior, create-user account values, service-boundary Admin authorization, role-change session revocation/audit, same-role no-op/error, soft-delete semantics, and manual revoke self denial/zero-session behavior.
- Phase 9C Admin Users UI/action tests for existing-user temporary password reset service behavior, exact credential-account update contract, safe action error mapping, confirmation requirements, row action visibility, and Users nav visibility.
- Phase 10A Admin Audit Viewer foundation tests for Admin-only read policy, safe cursor encoding/decoding, filter validation, known-action catalog/presenter allowlists, unknown-action suppression, recursive sensitive-key sanitization, actor fallback, entity labeling, and safe paginated DTO output.
- Phase 10B Admin Audit Viewer UI tests for Admin-only route policy, Audit nav visibility, action/entity filter options, date-only business timezone translation, cursor preservation, filter cursor clearing, safe expandable details, unknown-action no-details behavior, entity links, pagination links, and plain-text reason escaping.
- Internal export read-model tests for persisted taxable, zero-rated, non-taxable, override, and legacy unclassified tax snapshots.
- Internal XLSX V2 workbook tests for the pinned template hash and exact `Tax Details` worksheet VAT/accounting cells.
- Hosted database integration tests for migrations, shipping note visibility, draft mutations, submission, selling charges, buying charges, financial summaries, tax-rule management and query visibility, charge tax assignment/override, checked tax completeness, accounting DTO boundaries, sale tax-data denial, accounting transitions, export eligibility, audit persistence, soft-delete filtering, and blank optional-field persistence.
- Live Phase 6B.1 result on 2026-07-29: `npm test` passed 12 files / 58 tests; `npm run test:integration` passed 7 files / 37 tests against the authorized hosted test/staging PostgreSQL database.
- Phase 6B.2 adds unit/presentation coverage and hosted query/DTO regression coverage for the VAT/tax UI contract.
- Phase 7A result on 2026-08-09: `npm test` passed 15 files / 69 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration was skipped because current DB authorization was not provided for this run.
- Phase 6C.1 result on 2026-08-13: `npm test` passed 17 files / 79 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration and `npm run test:all` were skipped because current DB authorization was not provided for this run.
- Phase 6C.2 result on 2026-08-14: focused tests passed 5 files / 31 tests; `npm test` passed 17 files / 79 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration and `npm run test:all` were skipped because current DB authorization was not provided for this run.
- Phase 6C.3 result on 2026-08-14: focused tests passed 5 files / 32 tests; `npm test` passed 17 files / 80 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration and `npm run test:all` were skipped because current DB authorization was not provided for this run.
- Phase 6C.4 result on 2026-08-14: focused tests passed 5 files / 34 tests. Full `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` results are recorded in `docs/audit/PHASE_6C4_CANCELLATION_IMPLEMENTATION_2026-08-14.md`. Hosted integration and `npm run test:all` were skipped because current DB authorization was not provided for this run.
- Phase 6C.5 result on 2026-08-14: focused tests passed 5 files / 35 tests. Full `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` results are recorded in `docs/audit/PHASE_6C5_REOPEN_CORRECTION_IMPLEMENTATION_2026-08-14.md`. Hosted integration and `npm run test:all` were skipped because current DB authorization was not provided for this run.
- Phase 7B result on 2026-08-21: focused PDF/export tests passed 5 files / 27 tests; full `npm test` passed 18 files / 90 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration and `npm run test:all` were skipped because current DB authorization was not provided for this run.
- Phase 8A result on 2026-08-21: focused storage/export tests passed 6 files / 28 tests before final validation. Hosted integration and `npm run test:all` remain gated by current `DATABASE_URL` authorization.
- Phase 8B result on 2026-08-22: focused Drive tests passed 4 files / 34 tests before final validation. Hosted integration, `npm run test:all`, migration application, and live Google smoke tests remain gated by current explicit authorization.
- Phase 8C result on 2026-08-23: focused 8C tests passed 5 files / 48 tests; full `npm test` passed 28 files / 170 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration, `npm run test:all`, migration application, and live Google/R2 smoke tests remain gated by current explicit authorization.
- Phase 9A result on 2026-08-23: focused Admin User Management foundation tests passed 3 files / 20 tests; full `npm test` passed 31 files / 190 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration, `npm run test:all`, migration application, and Better Auth live HTTP/session regression tests remain gated by current explicit authorization and later implementation slices.
- Phase 9B result on 2026-08-23: focused Admin User Management lifecycle tests passed 4 files / 24 tests before final validation. Hosted integration, `npm run test:all`, migration application, and Better Auth live HTTP/session regression tests remain gated by current explicit authorization.
- Phase 9C result on 2026-08-24: focused Admin Users UI/password tests passed 5 files / 26 tests; full `npm test` passed 36 files / 212 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration, `npm run test:all`, migration application, and Better Auth live HTTP/session regression tests remain gated by current explicit authorization.
- Phase 10A result on 2026-08-24: focused Admin Audit Viewer foundation tests passed 5 files / 18 tests; full `npm test` passed 41 files / 230 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration, `npm run test:all`, and migration application remain gated by current explicit authorization.
- Phase 10B result on 2026-08-24: focused Admin Audit Viewer UI/nav tests passed 4 files / 16 tests; full `npm test` passed 44 files / 245 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed. Hosted integration, `npm run test:all`, and migration application remain gated by current explicit authorization.

## Environment Expectations

- Tests run in a Node environment through Vitest.
- Tests and builds must run on Node 24.x. Node 20.14.0 is not sufficient for the current installed dependency tree.
- Tests use the repository `@/*` TypeScript path alias.
- Tests must be deterministic and must not depend on local timezone, locale, network, external services, or persisted export artifacts.
- Unit/policy tests do not require `.env.local`, a live database, Google services, or production secrets.
- Integration tests load current process environment first and then `.env.local` for missing values.
- Integration tests require `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`.
- `DATABASE_URL` must point to the explicitly authorized hosted database before running `npm run test:integration` or `npm run test:all`.
- Integration authorization requires an exact hostname and database-name match. Hostnames are normalized only for DNS case; substring, prefix, suffix, wildcard, and heuristic matches are denied.
- Production integration targets require the additional exact opt-in `INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED="true"`; production migration targets require `DATABASE_MIGRATION_PRODUCTION_AUTHORIZED="true"`.
- Google Drive live smoke tests require a dedicated test service account, a dedicated private test root folder, and explicit current opt-in before execution.
- Integration tests run with the React Server condition so production `server-only` modules remain protected.
- `AUTH_SECRET` and `AUTH_URL` are required because integration tests import production server modules that initialize Better Auth configuration through `src/lib/auth/server.ts`.

## Integration Data

- Integration records use unique run IDs such as `IT-VIS-20260729-142400-A4F9`.
- The run ID is embedded in test emails, Jobsheet Nos., MAWB/HAWB Nos., charge names, descriptions, and vendor text.
- Cleanup deletes only records associated with the current run ID and related users.
- Cleanup does not drop databases, drop schemas, truncate all tables, rewrite migration history, or delete unrelated hosted test data.
- Phase 11H production cleanup verification after a failed integration run found zero remaining rows in application tables.
- Set `INTEGRATION_TEST_PRESERVE_DATA="true"` to keep run-owned records for visual inspection. The suite prints only the run ID in that mode.
- The 2026-07-29 repeatability check passed without duplicate users, duplicate Jobsheet Nos., stale run records, migration reapplication failures, cleanup-order failures, or test-order leakage.

## Migration Behavior

- `npm run test:integration` applies committed Drizzle migrations through the Drizzle migrator before integration scenarios run.
- Migration checks verify metadata, core tables, enum types including `tax_treatment`, required soft-delete/audit/tax snapshot columns, and selected uniqueness/foreign-key constraints.
- Phase 6C.1 extends migration checks for nullable post-checked workflow metadata columns and lock/cancel actor foreign keys.
- Phase 6C.2 extends production-path integration tests for Admin approval, same-checker approval, Sale/Accountant denial, stale approval denial, approved-note export eligibility, and legacy checked-note export compatibility. These tests require the authorized hosted test/staging database before execution.
- Phase 6C.3 extends production-path integration tests for Admin lock/unlock, checked-lock denial, Sale/Accountant lock/unlock denial, stale lock/unlock denial, locked immutability, locked export eligibility, and unlocked approved export compatibility. These tests require the authorized hosted test/staging database before execution.
- Phase 6C.4 extends production-path integration tests for contextual cancellation, finalized cancellation, locked direct-cancel denial, stale cancellation denial, cancelled terminal behavior, cancelled immutability, historical export preservation, cancelled export denial, and cancelled read-history boundaries. These tests require the authorized hosted test/staging database before execution.
- Phase 6C.5 extends production-path integration tests for Checked/Approved reopen, Sale/Accountant denial, Locked/Cancelled denial, stale reopen denial, finalization metadata clearing, accounting mutability restoration, selling/core immutability, historical export preservation, export denial while reopened, export restoration after re-check, separate post-correction export records, and reapproval. These tests require the authorized hosted test/staging database before execution.
- Phase 7B extends production-path integration tests for PDF export record persistence, generated/failed PDF lifecycle, PDF audit events, status preservation, and explicit `exported` status denial through the canonical internal export query. These tests require the authorized hosted test/staging database before execution.
- Phase 8A extends migration integration checks for `drive_upload_status`, artifact storage metadata, Drive upload metadata, and artifact storage key uniqueness. It also extends production-path integration tests with fake artifact storage for XLSX/PDF storage metadata, storage failure, checksum verification, and historical metadata-only rejection. These tests require the authorized hosted test/staging database before execution and must not call Cloudflare R2.
- Phase 8B extends production-path integration tests with fake Drive and fake artifact storage for Admin upload success, Sale/Accountant denial, sanitized Drive failure, retry from `upload_failed`, Drive reconciliation, note-status preservation, historical reopened/cancelled artifacts, and uploading conflict. These tests require the authorized hosted test/staging database before execution and must not call live Google Drive.
- Phase 8C extends production-path integration tests with fake Drive and fake artifact storage for protected history, historical durable download, Reopened/Cancelled historical downloads, and stale Drive reconciliation. These tests require the authorized hosted test/staging database before execution and must not call live Google Drive or R2.
- Phase 9B adds production-path Admin User Management integration tests for create-user credentials, duplicate email mapping, Sale/Accountant denial, role change, deactivate/reactivate, soft delete, manual revoke-all-sessions, audit writes, session revocation, and last-admin serialization. These tests require the authorized hosted test/staging database before execution.
- Phase 9C extends production-path Admin User Management integration tests for existing-user temporary password reset, exact credential-account update, session revocation, audit safety, and Sale/Accountant/self/deleted-target denial. These tests require the authorized hosted test/staging database before execution.
- Phase 10A adds production-path Admin Audit Viewer integration tests for Admin-only access, Sale/Accountant denial, ordering, cursor pagination, filters, safe actor fallback, soft-deleted actor labels, unknown-action suppression, and Drive/export sensitive-field hiding. These tests require the authorized hosted test/staging database before execution.
- Do not generate migrations as part of test execution.

## Safe Staging / Integration Procedure

1. Provision an isolated test/staging database.
2. Verify the target with a human/operator.
3. Create a backup or snapshot before mutation.
4. Set `DATABASE_URL` securely.
5. Set `INTEGRATION_TEST_DATABASE_AUTHORIZED="true"`.
6. Set `INTEGRATION_TEST_DATABASE_EXPECTED_HOST` to the exact parsed host.
7. Set `INTEGRATION_TEST_DATABASE_EXPECTED_NAME` to the exact parsed database name.
8. Confirm `NODE_ENV` is not `production`.
9. Run migration and integration commands only after explicit current authorization.
10. Inspect results.
11. Remove or disable authorization variables after execution where operationally useful.

Live database state is never inferred from repository migration files. Before a staging or production migration run, inspect the live Drizzle journal and apply migrations in repository order. Phase 11C itself did not apply any migrations.

Phase 11H production verification on 2026-09-02 found the production target initially had no Drizzle journal or application tables, then applied `0000_new_nick_fury` through `0005_perpetual_goblin_queen` through `npm run db:migrate` with explicit production authorization. Post-migration schema verification passed.

Phase 11H.1 production integration closure on 2026-09-03 resolved the AWS/Vitest module-resolution regression, admin duplicate-email mapping, active-admin concurrency serialization, and the guarded migration wrapper `DEP0190` warning. The full guarded production `npm run test:integration` suite passed 9 files / 95 tests, followed by read-only verification that all fixture tables were clean and migrations/schema remained consistent through `0005`. Final validation passed `npm ci`, `npm ls`, `npm test` (50 files / 287 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (9 Chromium tests), and `npm run ci:security-audit`.

Phase 11I authenticated browser E2E on 2026-09-03 added `npm run test:e2e:auth` for production-authorized real-login browser tests. The passing run covered 1 file / 3 Chromium tests for Sale, Accountant, and Admin login/session/logout, direct-route RBAC denial, Sale draft create/edit/submit, Accountant review/check, Admin Users, Admin Audit Viewer, Admin approve/lock/unlock, locked export-control visibility, cookie attributes, and authenticated no-store cache behavior. Post-run production verification found zero fixture residue and confirmed migrations/schema through `0005`.

Phase 11J added `npm run verify:live-artifacts` as a live-service verification harness for R2 artifact upload/read/delete, historical artifact download, Google Drive upload/reconcile/idempotency, and run-ID-scoped DB cleanup. It is intentionally excluded from normal CI and requires explicit current authorization, exact production/staging database target guards, `LIVE_ARTIFACT_VERIFICATION_AUTHORIZED="true"`, live `ARTIFACT_R2_*` variables, and service-account Drive variables. The 2026-09-03 attempt was blocked before fixture creation because the required live R2 and Drive service-account variables were absent from the current environment.

Phase 11K release-gate validation may re-run `npm run test:integration` and `npm run test:e2e:auth` only with exact production authorization variables and sequential execution. After each DB-backed suite, run the read-only production inspection script to confirm migrations `0000` through `0005`, schema consistency, and zero fixture residue.

Backup and restore validation is not part of ordinary `npm test`, CI, or E2E commands. Use `docs/RECOVERY_RUNBOOK.md` and keep backup artifacts outside the repository because database backups are sensitive. Do not commit backup files, database URLs, provider tokens, or generated Playwright authenticated state.

Phase 11K.1 verified the recovery procedure with PostgreSQL client `18.3`: `pg_dump -Fc --no-owner --no-privileges`, `pg_restore --list`, restore into a disposable local PostgreSQL cluster, schema/journal/object verification, and cleanup of both the temporary dump and disposable cluster. Do not restore over production.

## Not Covered Yet

- Better Auth live HTTP/session lifecycle and browser-visible role-change/session/password-reset invalidation behavior.
- Server actions exercised with authenticated sessions.
- Browser workflows and form submissions.
- XLSX workbook contents generated from real stored database records.
- Audit viewer browser E2E for direct denied access, filter form submission, detail expansion, pagination, and sensitive-value rendering.
- Behavioral transaction rollback on forced audit failure; the current mutation architecture does not expose a safe failure injection seam.
- Better Auth live HTTP/session lifecycle remains outside this suite; only the pure active/deleted user predicate and DB-backed role authorization paths are covered.
- Full authenticated browser E2E for VAT/tax workflows, Better Auth HTTP/session E2E, PDF/download/export UX, Google Drive upload, correction/cancellation transitions, Admin Users UI workflows, and Audit Viewer filtering.
- Live Google Drive API behavior with real service-account credentials and a dedicated test folder.

## Adding Tests

- Prefer testing pure modules directly.
- Do not remove or bypass `server-only` imports to make tests pass.
- If a server-only module contains reusable deterministic logic, extract a small pure helper beside it and keep the original server call site using that helper.
- Avoid tests that require production secrets, a live Neon database, Google services, Docker, network access, or file mutation.
- Use exact expected values for financial calculations and avoid snapshots for business-critical amounts.
- Put hosted database tests under `tests/integration/**/*.integration.test.ts`.
- Integration tests should call production query/mutation services directly where possible and should not duplicate authorization or calculation logic.
