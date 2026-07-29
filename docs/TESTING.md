# Testing

## Prerequisites

- Node.js compatible with this Next.js project.
- npm dependencies installed.
- Unit/policy tests do not require a live database, Google credentials, production secrets, or `.env.local` values.
- Hosted integration tests use the current `.env.local` `DATABASE_URL`, which must be owner-authorized as a hosted test/staging database before execution.

## Commands

- `npm test` runs all repository-owned tests once.
- `npm run test:watch` runs Vitest in watch mode for local development.
- `npm run test:integration` runs hosted PostgreSQL integration tests once against the current `DATABASE_URL`.
- `npm run test:all` runs unit/policy tests first, then hosted database integration tests.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run lint` runs ESLint.
- `npm run build` validates the production Next.js build.

## Current Test Categories

- Permission matrix tests for sale, accountant, and admin roles.
- Decimal and money calculation tests with exact persisted string expectations.
- Shipping note summary tests for selling totals, buying totals, and gross profit.
- VAT calculation, treatment consistency, charge tax completeness, and tax-rule validator tests.
- Status-policy tests for the currently implemented draft, submitted, accounting-reviewing, and checked behavior.
- Zod validation tests for shipping notes and charge inputs.
- Internal XLSX export safeguard tests for filenames, same-origin metadata, and content disposition.
- Hosted database integration tests for migrations, shipping note visibility, draft mutations, submission, selling charges, buying charges, financial summaries, tax-rule management, charge tax assignment/override, checked tax completeness, accounting transitions, export eligibility, audit persistence, soft-delete filtering, and blank optional-field persistence.
- Live Phase 6B.1 result on 2026-07-29: `npm test` passed 12 files / 58 tests; `npm run test:integration` passed 7 files / 37 tests against the authorized hosted test/staging PostgreSQL database.

## Environment Expectations

- Tests run in a Node environment through Vitest.
- Tests use the repository `@/*` TypeScript path alias.
- Tests must be deterministic and must not depend on local timezone, locale, network, external services, or persisted export artifacts.
- Unit/policy tests do not require `.env.local`, a live database, Google services, or production secrets.
- Integration tests load current process environment first and then `.env.local` for missing values.
- Integration tests require `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`.
- `DATABASE_URL` must point to the explicitly authorized hosted test/staging database before running `npm run test:integration` or `npm run test:all`.
- Integration tests run with the React Server condition so production `server-only` modules remain protected.
- `AUTH_SECRET` and `AUTH_URL` are required because integration tests import production server modules that initialize Better Auth configuration through `src/lib/auth/server.ts`.

## Integration Data

- Integration records use unique run IDs such as `IT-VIS-20260729-142400-A4F9`.
- The run ID is embedded in test emails, Jobsheet Nos., MAWB/HAWB Nos., charge names, descriptions, and vendor text.
- Cleanup deletes only records associated with the current run ID and related users.
- Cleanup does not drop databases, drop schemas, truncate all tables, rewrite migration history, or delete unrelated hosted test data.
- Set `INTEGRATION_TEST_PRESERVE_DATA="true"` to keep run-owned records for visual inspection. The suite prints only the run ID in that mode.
- The 2026-07-29 repeatability check passed without duplicate users, duplicate Jobsheet Nos., stale run records, migration reapplication failures, cleanup-order failures, or test-order leakage.

## Migration Behavior

- `npm run test:integration` applies committed Drizzle migrations through the Drizzle migrator before integration scenarios run.
- Migration checks verify metadata, core tables, enum types including `tax_treatment`, required soft-delete/audit/tax snapshot columns, and selected uniqueness/foreign-key constraints.
- Do not generate migrations as part of test execution.

## Not Covered Yet

- Better Auth session lifecycle and role-change/session invalidation behavior.
- Server actions exercised with authenticated sessions.
- Browser workflows and form submissions.
- XLSX workbook contents generated from real stored records.
- Full XLSX binary inspection.
- Audit-log read authorization because no audit-log read service exists yet.
- Behavioral transaction rollback on forced audit failure; the current mutation architecture does not expose a safe failure injection seam.
- Better Auth live HTTP/session lifecycle remains outside this suite; only the pure active/deleted user predicate and DB-backed role authorization paths are covered.
- VAT/tax UI controls, XLSX/PDF tax mappings, Google Drive upload, approval/export/lock/cancel transitions, and admin user management.

## Adding Tests

- Prefer testing pure modules directly.
- Do not remove or bypass `server-only` imports to make tests pass.
- If a server-only module contains reusable deterministic logic, extract a small pure helper beside it and keep the original server call site using that helper.
- Avoid tests that require production secrets, a live Neon database, Google services, Docker, network access, or file mutation.
- Use exact expected values for financial calculations and avoid snapshots for business-critical amounts.
- Put hosted database tests under `tests/integration/**/*.integration.test.ts`.
- Integration tests should call production query/mutation services directly where possible and should not duplicate authorization or calculation logic.
