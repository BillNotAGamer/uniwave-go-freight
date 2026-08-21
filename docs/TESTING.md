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
- Phase 6C.1 extends migration checks for nullable post-checked workflow metadata columns and lock/cancel actor foreign keys.
- Phase 6C.2 extends production-path integration tests for Admin approval, same-checker approval, Sale/Accountant denial, stale approval denial, approved-note export eligibility, and legacy checked-note export compatibility. These tests require the authorized hosted test/staging database before execution.
- Phase 6C.3 extends production-path integration tests for Admin lock/unlock, checked-lock denial, Sale/Accountant lock/unlock denial, stale lock/unlock denial, locked immutability, locked export eligibility, and unlocked approved export compatibility. These tests require the authorized hosted test/staging database before execution.
- Phase 6C.4 extends production-path integration tests for contextual cancellation, finalized cancellation, locked direct-cancel denial, stale cancellation denial, cancelled terminal behavior, cancelled immutability, historical export preservation, cancelled export denial, and cancelled read-history boundaries. These tests require the authorized hosted test/staging database before execution.
- Phase 6C.5 extends production-path integration tests for Checked/Approved reopen, Sale/Accountant denial, Locked/Cancelled denial, stale reopen denial, finalization metadata clearing, accounting mutability restoration, selling/core immutability, historical export preservation, export denial while reopened, export restoration after re-check, separate post-correction export records, and reapproval. These tests require the authorized hosted test/staging database before execution.
- Phase 7B extends production-path integration tests for PDF export record persistence, generated/failed PDF lifecycle, PDF audit events, status preservation, and explicit `exported` status denial through the canonical internal export query. These tests require the authorized hosted test/staging database before execution.
- Do not generate migrations as part of test execution.

## Not Covered Yet

- Better Auth session lifecycle and role-change/session invalidation behavior.
- Server actions exercised with authenticated sessions.
- Browser workflows and form submissions.
- XLSX workbook contents generated from real stored database records.
- Audit-log read authorization because no audit-log read service exists yet.
- Behavioral transaction rollback on forced audit failure; the current mutation architecture does not expose a safe failure injection seam.
- Better Auth live HTTP/session lifecycle remains outside this suite; only the pure active/deleted user predicate and DB-backed role authorization paths are covered.
- Full browser E2E for VAT/tax workflows, Better Auth HTTP/session E2E, PDF download UX, Google Drive upload, correction/cancellation transitions, and admin user management.

## Adding Tests

- Prefer testing pure modules directly.
- Do not remove or bypass `server-only` imports to make tests pass.
- If a server-only module contains reusable deterministic logic, extract a small pure helper beside it and keep the original server call site using that helper.
- Avoid tests that require production secrets, a live Neon database, Google services, Docker, network access, or file mutation.
- Use exact expected values for financial calculations and avoid snapshots for business-critical amounts.
- Put hosted database tests under `tests/integration/**/*.integration.test.ts`.
- Integration tests should call production query/mutation services directly where possible and should not duplicate authorization or calculation logic.
