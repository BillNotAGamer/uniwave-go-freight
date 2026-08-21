# Current Implementation Status

## A. Audit Metadata

- Audit date: 2026-07-29
- Branch: `feature/ui-overhaul`
- Commit: `1a1b02f18fc6a8c693bb946af5fe238227ac5946`
- Last commit: `1a1b02f feat(ui): implement semantic tokens, shell, and layout foundation`
- Working tree at audit start: modified UI/app files plus untracked `.claude/`, `docs/audit/`, `src/components/ui/feedback.tsx`, and `src/components/ui/status-badge.tsx`; no application source changes were made by this audit.
- Package manager: npm (`package-lock.json`, `package.json:5-15`)
- Framework: Next.js App Router `16.2.9`, React `19.2.4`, TypeScript strict mode (`package.json:25-27`, `tsconfig.json:7`)
- Database/ORM: PostgreSQL via Drizzle ORM and Neon serverless (`package.json:18,22`, `drizzle.config.ts:5-9`, `src/lib/db/client.ts:9-13`)
- Authentication system: Better Auth email/password with Drizzle adapter (`package.json:20`, `src/lib/auth/server.ts:15-47`)
- Deployment target: no committed deployment config or CI workflow found; `.vercel` is ignored (`.gitignore:27-28`)
- Runtime observed during validation: Node.js `v20.14.0`
- Commands executed:
  - `git status --short`
  - `git branch --show-current`
  - `git rev-parse HEAD`
  - `git log -1 --oneline`
  - `rg --files`
  - `npm run typecheck` - sandbox attempt failed with `EPERM: operation not permitted, lstat 'C:\Users\Admin'`; escalated rerun passed.
  - `npm run lint` - sandbox attempt failed with the same `EPERM`; escalated rerun passed.
  - `npm run build` - escalated due the same Node sandbox issue; passed.
  - Repository-owned test search with `rg --files ... | rg "(test|spec)..."` returned no files.

## B. Executive Status

- Actual current project maturity: uneven. Foundation, auth, shipping-note drafts, charge CRUD/calculations, VAT/tax domain foundation and UI, accounting review start/check/approval/lock/unlock/cancellation/reopen-for-correction, audit writes, tax-complete internal XLSX export, generated internal PDF export, unit/policy tests, and hosted database integration tests are implemented. Admin user management UI, Google Drive integration, CI, and deployment hardening are not implemented.
- Most advanced implemented phase: Phase 7B generated internal PDF export.
- Most advanced verified phase: Phase 6 partial behavior is live database-verified for the currently implemented workflow through `checked`; Phase 7 internal XLSX export-data eligibility is live database-verified for checked notes.
- Phase 7 implemented: PARTIAL. Internal XLSX V2, internal print HTML, and generated internal PDF V1 exist; Google Drive upload does not.
- Phase 8 implemented: DOCUMENTED ONLY. Environment placeholders and DB columns exist, but no Google Drive integration code was found.
- Phase 9 implemented: PARTIAL. Audit-log writes, unit/policy tests, and hosted database integration tests exist and pass; CI, audit-log viewer, browser E2E, and deployment hardening are missing.
- Main blockers: Google Drive upload, no user-management UI, no browser/session regression suite.
- Main security risks: no route-protection middleware backstop, no browser/session regression tests, no user-management implementation for deactivation/role changes/session invalidation.
- Recommended immediate next step: define and implement the remaining Phase 6 accounting workflow decisions, starting with VAT/tax behavior.

## B1. Phase 9A Test Foundation Follow-Up

- Implementation date: 2026-07-29
- Branch: `feature/ui-overhaul`
- Commit before implementation: `1a1b02f18fc6a8c693bb946af5fe238227ac5946`
- Test runner selected: Vitest `^2.1.9` with Node environment and repository `@/*` path alias resolution.
- Test commands:
  - `npm test` - runs all repository-owned tests once.
  - `npm run test:watch` - runs Vitest in watch mode for local development.
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Test areas now covered:
  - Role and permission matrix for sale, accountant, and admin.
  - BigInt-backed decimal primitives and charge money calculations.
  - Shipping note selling and financial summaries.
  - Current draft/accounting status policies and internal XLSX checked-status eligibility.
  - High-risk shipping note and charge Zod validation schemas.
  - Internal XLSX filename sanitization and HTTP same-origin/content-disposition helpers.
- Areas still unverified:
  - Database-backed RBAC and row visibility.
  - Drizzle migration apply behavior.
  - Better Auth session lifecycle and role-change/session invalidation behavior.
  - Real server-action authorization with a live database.
  - Browser workflows and form submissions.
  - XLSX workbook cell contents generated from real stored data.
  - Audit-log persistence and read access.
  - PDF export, Google Drive upload, VAT/tax UI/export mapping, and post-checked transitions because they remain out of scope or unimplemented.
- Important boundary: these are pure unit/policy characterization tests. They do not prove database integration, live auth/session behavior, or full workflow authorization.

## Phase 9B Hosted Database Integration Follow-Up

- Implementation date: 2026-07-29
- Live execution date: 2026-07-29
- Branch: `feature/ui-overhaul`
- Starting commit: `1a1b02f18fc6a8c693bb946af5fe238227ac5946`
- Database target: current `.env.local` `DATABASE_URL`, explicitly authorized by the project owner as hosted test/staging.
- Integration command: `npm run test:integration`
- Aggregate command: `npm run test:all`
- Integration test files: 6
- Integration tests: 28
- Migration result: committed Drizzle migrations applied or verified successfully; core tables, enums, columns, constraints, and migration metadata were verified.
- Stabilization result:
  - First live run: failed with two in-scope test/harness issues.
  - Affected-file rerun after fixes: passed, 2 files / 13 tests.
  - First complete clean run: passed, 6 files / 28 tests.
  - Second complete clean run: passed, 6 files / 28 tests.
  - Preserved-data run: passed, 6 files / 28 tests.
  - Aggregate `npm run test:all`: passed, unit 9 files / 46 tests plus integration 6 files / 28 tests.
- Preserved visual dataset run IDs:
  - `IT-CHG-20260729-080122-4705`
  - `IT-ACC-20260729-080132-F167`
  - `IT-MUT-20260729-080149-D0A3`
  - `IT-VIS-20260729-080157-995F`
  - `IT-BLANK-20260729-080202-B595`
- Integration domains covered by the live suite:
  - Drizzle migration application and schema metadata checks.
  - Shipping Note row-level visibility for sale/accountant/admin roles.
  - Draft creation, update, submission, server-controlled owner/status, and audit writes.
  - Selling and buying charge mutations, server-computed amounts, soft deletes, and summaries.
  - Persisted financial summaries including zero and negative gross profit.
  - Current accounting transitions through `checked`.
  - Internal XLSX export-data eligibility.
  - Audit persistence for successful business mutations and denied-operation no-op checks.
  - Blank optional form-field normalization through parser, schema, mutation, and persistence.
- Cleanup strategy: each integration file uses a unique run ID marker and deletes only matching audit, export, charge, note, auth, and user records. Two consecutive clean runs and `test:all` verified repeatability without duplicate users, duplicate Jobsheet Nos., stale run records, or cleanup order failures.
- Optional preserved-data strategy: `INTEGRATION_TEST_PRESERVE_DATA="true"` skips cleanup and prints only the run ID.
- Blank-field result: the real form parsing path could reject legitimate blank optional values; `readFormString` now normalizes blank form strings to `undefined` while preserving required validation and `"0"` values.
- Stabilization fixes:
  - Extracted `rejectInactiveOrSoftDeletedUsers` into `src/lib/auth/user-state.ts` so pure active/deleted user filtering can be tested without importing `next/navigation`; production session behavior still uses the same predicate.
  - Corrected an integration validation assertion to match the existing decimal validator message for negative unit prices.
- Remaining gaps: Better Auth live HTTP/session lifecycle, browser workflows, concurrent/stale updates, full XLSX binary inspection, VAT/tax, post-checked transitions, PDF, Drive, admin user management, CI/CD, and behavioral audit rollback via forced audit failure.

## Phase 6A VAT/Tax Domain Audit

- Audit date: 2026-07-29
- Output: `docs/VAT_TAX_DOMAIN_AUDIT.md`
- Status impact at audit time: no implementation status changed. Phase 6B.1 later implemented the VAT/tax domain foundation; see `docs/VAT_TAX_IMPLEMENTATION.md`.
- Evidence summary at audit time: existing charge VAT columns, a standalone `tax_rules` table, and tax-rule permissions were present, but production code still hardcoded VAT to zero, did not read tax rules, did not expose VAT UI, did not return VAT DTO fields, and did not export VAT.
- Hosted test/staging observation: `tax_rules` has 0 rows; all active selling and buying charges have zero VAT percent and zero VAT amount.
- Recommendation: Phase 6B should implement a hybrid tax-rule plus immutable per-charge snapshot model after product/accounting decisions for VAT basis, rounding, tax-inclusive pricing, zero/non-taxable treatment, and override authority.

## Phase 6B.1 VAT/Tax Domain Foundation

- Implementation date: 2026-07-29
- Output: `docs/VAT_TAX_IMPLEMENTATION.md`
- Status impact: VAT/tax domain foundation is implemented at schema, calculation, service, RBAC, audit, and hosted integration-test layers.
- Implemented decisions: VND basis, per-line half-up rounding to VAT scale 2, tax-exclusive prices, `taxable` / `zero_rated` / `non_taxable` treatments, admin-only tax-rule management, accountant/admin submitted/reviewing assignment and taxable override with reason, checked immutability, no seeded official rates, manual rule selection only, checked tax completeness gate, legacy null snapshots remain unclassified, tax-exclusive gross profit, and no XLSX VAT mapping.
- Hosted test/staging result: `npm run test:integration` applied/verified migration `0002_jittery_paper_doll` and passed 7 files / 37 tests after stabilization.
- Unit result: `npm test` passed 12 files / 58 tests.
- Remaining VAT/tax gaps: no UI controls, no export template changes, no automatic rule matching, no legal tax-rate content, no tax liability/payable/recoverable reporting.

## Phase 6B.2 Accounting VAT/Tax UI

- Implementation date: 2026-07-29
- Route added: `/tax-rules`
- Status impact: VAT/tax is now usable through an accountant/admin UI layer backed by the Phase 6B.1 services.
- Accountant behavior: read-only active tax-rule table; shipping-note tax completeness, tax charge tables, rule assignment, taxable VAT override with reason, and VAT-aware summaries.
- Admin behavior: active/inactive tax-rule table with create/edit/deactivate controls, plus all accountant charge-tax operations during submitted/accounting-reviewing statuses.
- Sale behavior: no Tax Rules navigation, direct route denied server-side, existing sale charge DTOs and components still receive no tax fields.
- Checked behavior: tax controls are read-only; Mark Checked is disabled in the UI when loaded tax completeness is incomplete, while the server mutation remains authoritative.
- Remaining VAT/tax gaps: XLSX/PDF tax mapping, full browser E2E, Better Auth HTTP/session E2E, no automatic matching, no official tax-rate seed, no checked override.

## Phase 7A Tax-Complete Internal Export V2

- Implementation date: 2026-08-09
- Branch: `feature/ui-overhaul`
- Starting commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Status impact: internal accounting XLSX and internal print HTML now represent persisted VAT/tax snapshots for checked notes.
- XLSX template: `assets/export-templates/shipping-note/internal-v2.xlsx`
- XLSX template version: `internal-v2`
- XLSX template SHA-256: `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`
- Workbook mapping: existing `AK` sheet is preserved; new `Tax Details` worksheet contains selling/buying tax detail rows and summary rows for subtotal excluding VAT, VAT, total including VAT, and gross profit excluding VAT.
- Print mapping: internal print view now shows base amount excluding VAT, stored tax rule/treatment, VAT percent, VAT amount, total including VAT, override flag/reason, and VAT-aware summaries.
- Historical behavior: export uses persisted charge snapshots only and does not resolve current live `tax_rules` rows.
- Validation: `npm test` passed 15 files / 69 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Integration status: `npm run test:integration` and `npm run test:all` were skipped because this run did not include explicit authorization for the configured database as test/staging.
- Remaining gaps: Google Drive upload, browser E2E, Better Auth HTTP/session E2E, pending-export crash recovery, admin user management, and audit viewer.

## Phase 7B Generated Internal PDF Export V1

- Implementation date: 2026-08-21
- Branch: `feature/ui-overhaul`
- Starting commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Status impact: no Shipping Note workflow status changes were added; PDF generation never transitions a note to `exported`.
- Engine: server-side `@react-pdf/renderer` 4.6.1 on the Node route runtime.
- PDF contract: `exportType = pdf`, metadata version `1`, layout identifier `internal-pdf-v1`, MIME `application/pdf`.
- Font contract: local Noto Sans Regular/Bold TTF files in `assets/fonts/noto-sans/`, licensed under SIL OFL 1.1, traced only for the PDF route.
- Data behavior: PDF uses the existing `getInternalShippingNoteExportDataForUser` read model, persisted charge-level tax snapshots, canonical summary values, VAT/tax-inclusive totals, and stored override reasons.
- Export behavior: internal XLSX, internal PDF, and internal print eligibility is `checked | approved | locked`. `cancelled`, `accounting_reviewing`, and `exported` remain non-exportable for new artifacts.
- RBAC: Sale is denied; Accountant/Admin can export eligible finalized notes through `SHIPPING_NOTES_EXPORT_INTERNAL`.
- Persistence and audit: PDF writes `shipping_note_exports` pending/generated/failed records with SHA-256 checksum and `shipping_note.export.pdf.generated` / `shipping_note.export.pdf.failed` audit events.
- UI behavior: finalized note detail exposes separate `Export XLSX`, `Export PDF`, and `Print` controls.
- Validation: focused tests passed 5 files / 27 tests; full `npm test` passed 18 files / 90 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Integration status: production-path integration tests were extended but `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.1 Post-Checked Workflow Foundation

- Implementation date: 2026-08-13
- Branch: `feature/ui-overhaul`
- Starting commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Status impact: no new reachable workflow transitions were added. The implemented workflow remains `draft -> submitted -> accounting_reviewing -> checked`.
- Schema impact: additive migration `drizzle/0003_hard_titania.sql` adds nullable transition metadata columns on `shipping_notes`: `checked_at`, `approved_at`, `locked_by_id`, `lock_reason`, `cancelled_by_id`, `cancelled_at`, and `cancel_reason`.
- Checked behavior: new checked transitions persist `checked_at` atomically with `checked_by_id`, status update, and audit logging.
- Permission impact: future capability constants exist for approval, lock, unlock, cancellation, finalized cancellation, and reopen-for-correction; no approve/lock/unlock/reopen capability is granted to sale or accountant.
- Export behavior at Phase 6C.1: internal XLSX eligibility remained checked-only; Phase 6C.2 supersedes this to `checked | approved`. `exported` remains outside the normal Shipping Note business workflow policy.
- Validation: `npm test` passed 17 files / 79 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Integration status: `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.

## Phase 6C.2 Approval Transition + Export Compatibility

- Implementation date: 2026-08-14
- Branch: `feature/ui-overhaul`
- Starting commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Status impact: `checked -> approved` is now operational. No other post-checked transition was added.
- Approval policy: Admin only via `SHIPPING_NOTES_APPROVE`; Sale and Accountant are denied; the same Admin may check and approve; no approval reason is required.
- Mutation behavior: approval uses a guarded `checked`-only update, persists `approved_by_id`, `approved_at`, and `updated_at` with one logical timestamp, and writes `shipping_note.approve` in the same transaction.
- Data behavior: approval does not recalculate selling, buying, VAT, tax snapshots, profit, or tax completeness.
- Export behavior: internal XLSX and internal print eligibility is now `checked | approved`. `locked`, `cancelled`, and `exported` remain non-exportable in Phase 6C.2.
- Phase 7A artifact behavior: template version `internal-v2`, metadata version `2`, pinned SHA-256, workbook mapping, and print tax semantics are unchanged.
- Validation: focused tests passed 5 files / 31 tests; `npm test` passed 17 files / 79 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Integration status: production-path integration tests were extended but `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.3 Lock / Unlock + Locked Export Compatibility

- Implementation date: 2026-08-14
- Branch: `feature/ui-overhaul`
- Starting commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Status impact: `approved -> locked` and privileged `locked -> approved` are now operational. No cancellation, correction, or exported transition was added.
- Corrected lock policy: only Approved notes can lock. Checked notes cannot lock because unlock returns to Approved and must not imply approval without `shipping_note.approve`.
- Lock policy: Admin only via `SHIPPING_NOTES_LOCK`; lock reason is optional and blank input persists as `null`.
- Unlock policy: Admin only via `SHIPPING_NOTES_UNLOCK`; unlock reason is mandatory and preserved on `shipping_note.unlock` audit logs; current lock metadata is cleared.
- Data behavior: locked notes remain readable to permitted roles and immutable through normal note, charge, buying, tax, mark-checked, and approval mutation guards.
- Export behavior: internal XLSX and internal print eligibility is now `checked | approved | locked`. `cancelled` and `exported` remain non-exportable.
- Validation: focused tests passed 5 files / 32 tests; `npm test` passed 17 files / 80 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Integration status: production-path integration tests were extended but `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.4 Shipping Note Cancellation

- Implementation date: 2026-08-14
- Branch: `feature/ui-overhaul`
- Starting commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Status impact: `cancelled` is now operational as a terminal business state. It is not soft deletion.
- Normal cancellation policy: Sale may cancel only their own Draft with optional reason; Accountant/Admin may cancel Submitted or Accounting Reviewing with mandatory reason; Admin may cancel Draft with mandatory reason.
- Finalized cancellation policy: Admin may cancel Checked or Approved with mandatory reason. Sale and Accountant are denied finalized cancellation.
- Locked cancellation: denied directly; the required path is existing Admin unlock back to Approved, then finalized cancellation.
- Persistence and audit: cancellation writes `cancelled_by_id`, `cancelled_at`, `cancel_reason`, `updated_at`, and `shipping_note.cancel` in one transaction with an expected-source status guard.
- Data preservation: cancellation does not set `deleted_at`, recalculate tax/financial data, clear charge/tax rows, clear checked/approval metadata, or modify historical export records.
- Read/export behavior: Accountant/Admin retain read-only historical accounting access on Cancelled notes; Sale remains limited to safe owned-note data. New internal XLSX and print exports are denied for Cancelled notes.
- Validation: focused tests passed 5 files / 34 tests; `npm run typecheck` and `npm run lint` passed before docs/report updates. Full `npm test`, final `npm run typecheck`, final `npm run lint`, and `npm run build` are reported in the Phase 6C.4 audit report.
- Integration status: production-path integration tests were extended but `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.5 Reopen for Accounting Correction

- Implementation date: 2026-08-14
- Branch: `feature/ui-overhaul`
- Starting commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Status impact: Admin-only `checked -> accounting_reviewing` and `approved -> accounting_reviewing` are now operational for explicit accounting correction.
- Permission: `SHIPPING_NOTES_REOPEN_FOR_CORRECTION`; Sale and Accountant are denied.
- Reason policy: mandatory correction reason; blank and whitespace-only reasons are rejected.
- Metadata behavior: reopen clears current `checked_by_id`, `checked_at`, `approved_by_id`, and `approved_at`; `submitted_at`, charges, tax snapshots, cancellation metadata, and export records are not modified.
- Correction scope: buying charges and tax/VAT mutation become available again through existing Accounting Reviewing policies; Shipping Note core fields and selling charges remain Draft-only.
- Export behavior: Accounting Reviewing remains non-exportable; historical export records remain unchanged; export becomes available again after the existing Mark Checked transition.
- Locked/Cancelled behavior: Locked cannot reopen directly and must be unlocked to Approved first; Cancelled remains terminal and cannot reopen.
- Integration status: production-path integration tests were extended but `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` was not applied in this conversation.

## C. Build Phase Matrix

| Phase | Status | Key implemented components | Missing components | Verification evidence | Blocking issues |
| --- | --- | --- | --- | --- | --- |
| 0 - Repository audit/bootstrap | VERIFIED | Coherent Next.js/TypeScript repository with docs, migrations, scripts, and source boundaries. | No committed CI or deployment config. | `rg --files`; `package.json:5-15`; `src/`, `drizzle/`, `docs/`. | None for local development. |
| 1 - Minimal Next.js foundation | VERIFIED | App Router, TypeScript strict, Tailwind v4, auth/dashboard route groups, shell layout. | shadcn is compatible by structure, not installed as a generated component set. | `src/app/(dashboard)/layout.tsx:9-11`; `src/app/(auth)/login/page.tsx:6-29`; `npm run build` passed. | None. |
| 2 - Database and core schema | PARTIAL | Drizzle schema and 4 migrations for users/auth, shipping notes, charges, exports, audit logs, tax rules, tax treatment enum, charge tax snapshots, and post-checked workflow metadata. | Separate `shipping_note_parties`; accounting periods. | `src/lib/db/schema.ts`; `drizzle/0003_hard_titania.sql`; hosted migration tests were extended but not executed in Phase 6C.1 because no current DB authorization was provided. | Schema still diverges from `DATA_MODEL_RULES.md` on parties and accounting periods. |
| 3 - Authentication and RBAC | PARTIAL | Better Auth, disabled public signup by default, active-user session recheck, role permission map, server authorization helpers, bootstrap scripts. | Admin user-management UI, role-change workflow, session invalidation on role changes, middleware backstop, tests. | `src/lib/auth/server.ts:11-47`; `src/lib/auth/session.ts:18-59`; `src/lib/permissions/permissions.ts:30-52`; `scripts/create-first-admin.ts:87-144`. | Admin management objective not implemented. |
| 4 - Shipping note form MVP | IMPLEMENTED - LIVE DB VERIFIED | List, create draft, edit draft, detail, submit; Zod server action parsing; draft-only server enforcement. | Browser form workflows, concurrency/stale-data handling, party table. | `src/features/shipping-notes/actions.ts:53-173`; `src/features/shipping-notes/mutations.ts:113-270`; `src/features/shipping-notes/validators.ts:129-155`; `npm run test:integration` passed 6 files / 28 tests. | Browser and concurrency coverage still missing. |
| 5 - Charge calculation engine | IMPLEMENTED - UNIT AND LIVE DB VERIFIED | BigInt decimal helpers, charge amount calculation, selling and buying charge CRUD, summaries, profit derivation, server-computed amounts. | VAT/tax; override reasons. | `src/lib/calculations/decimal.ts:25-201`; `src/lib/calculations/money.ts:141-186`; `src/lib/calculations/shipping-note.ts:42-100`; `npm test` covers pure helpers; `npm run test:integration` verifies persisted charge rows and summaries. | VAT/tax and overrides remain unimplemented. |
| 6 - Accounting review | PARTIAL - LIVE DB VERIFIED FOR CURRENT FLOW | Accountant/admin can view buying charges and financial summary; transitions `submitted -> accounting_reviewing -> checked`; Admin-only `checked -> approved`; Admin-only `approved -> locked` and `locked -> approved`; Admin-only Checked/Approved reopen to Accounting Reviewing; contextual cancellation to `cancelled`; buying charge management; tax-rule services and UI; charge tax assignment/override UI; checked tax completeness UX. | Accounting filters, accounting periods, browser E2E. | `src/features/shipping-notes/mutations.ts`; `src/features/shipping-notes/actions.ts`; `src/features/shipping-notes/status-policy.ts`; Phase 6C.5 unit tests passed; integration tests were extended but not run in this conversation. | Blocks clean claim of full accounting workflow completion. |
| 7 - Excel/PDF export | PARTIAL | Tax-complete internal XLSX V2 template mapping, generated internal PDF V1, hash/font tracing, same-origin checks, sanitized export errors, export records and audit events, VAT-aware print view. | Drive upload; background/queue architecture if exports become heavy; live DB/browser export workflow verification. | `src/features/shipping-notes/export/generator.ts`; `src/features/shipping-notes/export/pdf/generator.tsx`; `src/features/shipping-notes/export/read-model.ts`; `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts`; `src/app/api/shipping-notes/[id]/exports/internal-pdf/route.ts`; `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`; Phase 7B `npm test` passed 18 files / 90 tests on 2026-08-21. | Phase 7 is not complete because Drive upload is absent. |
| 8 - Google Drive integration | DOCUMENTED ONLY | `.env.example` placeholders and export DB columns. | Google API client, credential/token strategy, upload flow, retries, persistence usage. | `.env.example:13-17`; `src/lib/db/schema.ts:272-273`; repo search found no `googleapis` or Drive integration code. | Entire integration is unbuilt. |
| 9 - Audit, QA, hardening | PARTIAL | Audit write helper and audit writes inside mutations/export status updates; Vitest unit/policy test foundation; hosted database integration tests. | CI, audit viewer, seed/dev QA data, browser E2E, deployment checklist, observability. | `src/lib/audit/log.ts:28-41`; mutation/export audit calls in `src/features/shipping-notes/mutations.ts` and `src/features/shipping-notes/export/mutations.ts:112-176`; `npm test` covers 9 files / 46 tests; `npm run test:integration` covers 6 files / 28 tests. | No browser workflow regression suite yet. |

## D. Implemented Feature Inventory

- Next.js App Router shell with protected dashboard layout: `src/app/(dashboard)/layout.tsx:9-11`.
- Login page and Better Auth email/password client/server setup: `src/app/(auth)/login/page.tsx:6-29`, `src/components/auth/login-form.tsx`, `src/lib/auth/server.ts:15-47`.
- Role and permission matrix for sale/accountant/admin: `src/lib/permissions/roles.ts:1-13`, `src/lib/permissions/permissions.ts:3-52`.
- Local first-admin and dev-user scripts: `scripts/create-first-admin.ts:84-190`, `scripts/create-dev-user.ts:58-151`.
- Shipping note list/detail/create/edit/submit: `src/app/(dashboard)/shipping-notes/page.tsx`, `src/app/(dashboard)/shipping-notes/new/page.tsx`, `src/app/(dashboard)/shipping-notes/[id]/page.tsx`, `src/features/shipping-notes/mutations.ts:113-270`.
- Selling charge create/update/soft-delete and summary: `src/features/shipping-notes/mutations.ts:449-681`, `src/lib/calculations/shipping-note.ts:42-58`.
- Buying charge create/update/soft-delete for accountant/admin on submitted/reviewing notes: `src/features/shipping-notes/mutations.ts:683-917`.
- Financial summary and gross profit derivation: `src/lib/calculations/shipping-note.ts:64-100`, `src/features/shipping-notes/components/financial-summary.tsx`.
- Accounting review start/check: `src/features/shipping-notes/mutations.ts:273-365`, `src/features/shipping-notes/components/accounting-review-controls.tsx`.
- Internal XLSX export and print view: `src/features/shipping-notes/export/generator.ts:355-404`, `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts:103-189`, `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx:173-288`.
- Audit writes for business mutations and export status changes: `src/lib/audit/log.ts:28-41`, `src/features/shipping-notes/export/mutations.ts:112-176`.

## E. Route and Module Inventory

- Routes:
  - `/` redirects based on session: `src/app/page.tsx:5-8`.
  - `/login`: `src/app/(auth)/login/page.tsx`.
  - `/dashboard`: `src/app/(dashboard)/dashboard/page.tsx`.
  - `/shipping-notes`: `src/app/(dashboard)/shipping-notes/page.tsx`.
  - `/shipping-notes/new`: `src/app/(dashboard)/shipping-notes/new/page.tsx`.
  - `/shipping-notes/[id]`: `src/app/(dashboard)/shipping-notes/[id]/page.tsx`.
  - `/shipping-notes/[id]/print/internal`: `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`.
  - `/api/auth/[...all]`: Better Auth handler, `src/app/api/auth/[...all]/route.ts:1-5`.
  - `/api/shipping-notes/[id]/exports/internal-xlsx`: `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts`.
- Server actions: `src/features/shipping-notes/actions.ts:53-448`.
- Server mutations: `src/features/shipping-notes/mutations.ts:113-917`.
- Server queries: `src/features/shipping-notes/queries.ts:76-253`.
- Database modules: `src/lib/db/schema.ts`, `src/lib/db/client.ts`.
- Export modules: `src/features/shipping-notes/export/{constants,errors,generator,mutations,queries,types}.ts`.
- Integration modules: Better Auth exists; Google Drive modules not found.
- Test modules: none found outside `node_modules` and `.next`.

## F. Observed RBAC Matrix

This is observed code behavior, not the full intended RBAC policy.

| Capability | Sale | Accountant | Admin | Evidence |
| --- | --- | --- | --- | --- |
| Login/session | Yes if active and not soft-deleted | Yes if active and not soft-deleted | Yes if active and not soft-deleted | `src/lib/auth/session.ts:18-49`; `src/lib/auth/server.ts:23-46` |
| View shipping note list/detail | Own notes only | All non-deleted notes | All non-deleted notes | `src/features/shipping-notes/queries.ts:38-45`, `76-100` |
| Create shipping note draft | Yes | No | Yes | `src/lib/permissions/permissions.ts:31-35,51`; `src/features/shipping-notes/mutations.ts:117` |
| Edit/submit draft | Own draft only | No | Any draft | `src/features/shipping-notes/mutations.ts:82-95`, `169-270` |
| Selling charge CRUD | Own draft only | No | Any draft | `src/features/shipping-notes/mutations.ts:408-430`, `449-681` |
| Buying charge read/manage | No | Yes | Yes | `src/lib/permissions/permissions.ts:42-43,51`; `src/features/shipping-notes/queries.ts:200-223`; `src/features/shipping-notes/mutations.ts:683-917` |
| Financial summary/net profit | No | Yes on eligible statuses | Yes on eligible statuses | `src/features/shipping-notes/queries.ts:225-253` |
| Start review/mark checked | No | Yes | Yes | `src/lib/permissions/permissions.ts:39-40,51`; `src/features/shipping-notes/mutations.ts:273-365` |
| Internal XLSX export/print | No | Yes for checked notes | Yes for checked notes | `src/features/shipping-notes/export/queries.ts:23-87`; `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts:103-189` |
| User management | Not implemented | Not implemented | Not implemented in UI | Permission exists at `src/lib/permissions/permissions.ts:19`; no matching route found |
| Audit-log viewing | Not implemented | Not implemented | Not implemented | Permission exists at `src/lib/permissions/permissions.ts:18`; no matching route found |
| Tax-rule management | Not implemented | Not implemented in UI | Not implemented in UI | Permissions exist at `src/lib/permissions/permissions.ts:16-17`; no tax rule route/query found |

## G. Validation Results

| Command | Result | Key evidence | Blocking? |
| --- | --- | --- | --- |
| `git status --short` | Dirty | Pre-existing modified UI/app files and untracked `.claude/`, `docs/audit/`, UI components. | No, but docs edits must avoid app files. |
| `npm run typecheck` | PASS after escalation | `tsc --noEmit` completed with exit code 0. | No |
| `npm run lint` | PASS after escalation | `eslint` completed with exit code 0. | No |
| `npm run build` | PASS after escalation | Next.js compiled successfully; routes included `/api/shipping-notes/[id]/exports/internal-xlsx`, `/shipping-notes/[id]/print/internal`, `/shipping-notes/new`. | No |
| `npm test` | PASS twice | Vitest completed 9 test files / 46 tests on both final unit runs. | No for covered pure logic. |
| `npm run test:integration` | PASS twice plus preserved run | Hosted PostgreSQL suite completed 6 files / 28 tests on two clean runs and one preservation run. | No for covered DB-backed behavior. |
| `npm run test:all` | PASS | Unit suite completed 9 files / 46 tests; integration suite completed 6 files / 28 tests. | No for covered unit and DB-backed behavior. |
| Repo-owned test search | Tests now present | Unit/policy tests under `src/lib/**` and `src/features/shipping-notes/**`. | No for pure logic; yes for integration confidence. |

## H. Risks and Gaps

See the finding IDs below; these are repeated in the final audit report.

### P1 - High

- F-P1-01: VAT/tax UI and export mapping are still missing; the Phase 6B.1 service foundation is implemented.
- F-P1-02: Workflow cannot progress past `checked`; approve/export/lock/cancel transitions are missing.
- F-P1-03: Phase 7 is still partial because Google Drive upload is absent, although internal XLSX, internal print, and generated internal PDF export now exist.

### P2 - Medium

- F-P2-01: Automated pure unit/policy tests and hosted database integration tests now pass, but no browser E2E or CI runner is configured.
- F-P2-02: Admin user-management UI is missing.
- F-P2-03: Data model diverges from documented party/timestamp/accounting-period rules.
- F-P2-04: No middleware-level route-protection backstop.
- F-P2-05: Google Drive is documented/scaffolded only.
- F-P2-06: Audit logs are write-only from the application perspective.

### P3 - Low

- F-P3-01: Stale UI copy says buying charges are unavailable on a page that now renders them for accountant/admin.
- F-P3-02: No `engines` field documents the Node version even though scripts rely on modern Node behavior.
- F-P3-03: No committed CI/deployment workflow.

### Informational

- F-INFO-01: Foundation, typecheck, lint, and production build pass.
- F-INFO-02: Internal XLSX export has stronger-than-basic safeguards: template hash, sanitized errors, same-origin check, no-store headers.

## I. Recommended Next Implementation Sequence

1. Resolve VAT/tax scope for Phase 6.
   - Dependency: product/accounting decision for VAT rates, rounding, overrides, and reasons.
   - Risk addressed: incorrect financial/tax records.
   - Expected files/modules: `src/lib/calculations`, `src/features/shipping-notes/validators.ts`, `mutations.ts`, `taxRules` access layer, tests.
   - Validation required: calculation and RBAC tests.
   - Separate implementation prompt: yes.
2. Implement post-checked workflow transitions.
   - Dependency: product decision for approve/export/lock/cancel rules and actor permissions.
   - Risk addressed: workflow dead end at `checked`.
   - Expected files/modules: `src/features/shipping-notes/mutations.ts`, `actions.ts`, detail UI controls, audit tests.
   - Validation required: status-transition tests and build.
   - Separate implementation prompt: yes.
3. Implement minimal admin user management.
   - Dependency: role-change/deactivation/session-invalidation policy.
   - Risk addressed: inability to manage users through the app.
   - Expected files/modules: `src/app/(dashboard)/admin/users`, `src/lib/auth`, `src/lib/permissions`, audit logging.
   - Validation required: RBAC/user-management tests.
   - Separate implementation prompt: yes.
4. Finish Phase 7 only after Phase 6 is stable.
   - Dependency: export template authority and PDF requirements.
   - Risk addressed: exporting incomplete or incorrect accounting data.
   - Expected files/modules: export services/routes, PDF generation module, export tests.
   - Validation required: export fixture tests and build.
   - Separate implementation prompt: yes.
5. Implement Google Drive integration after export records are stable.
   - Dependency: credential strategy, folder ownership, token storage, retry policy.
   - Risk addressed: external artifact persistence.
   - Expected files/modules: server-only Drive integration, export status updates, retry/error handling.
   - Validation required: mocked integration tests; no live API calls in CI.
   - Separate implementation prompt: yes.

## J. Documentation Discrepancies

- `docs/BUILD_PHASES.md:35-41` lists parties as a Phase 2 schema objective; implementation stores party text fields directly on `shipping_notes` and has no `shipping_note_parties` table (`src/lib/db/schema.ts:175-178`).
- `docs/DATA_MODEL_RULES.md:41-44` references `checked_at`, `approved_at`, and `locked_at`; Phase 6C.1 now adds checked and approved timestamps plus lock/cancel metadata, but accounting periods and separate parties remain absent.
- `docs/BUILD_PHASES.md:98-100` describes VAT/tax and lock statuses as Phase 6 objectives; implementation now has review/check plus VAT/tax domain services, but VAT/tax UI and lock/future statuses remain incomplete.
- `docs/BUILD_PHASES.md:108-112` describes Excel and PDF export; implementation has internal XLSX only and schema enum value `"pdf"` only (`src/lib/db/schema.ts:67`, export modules under `src/features/shipping-notes/export/`).
- `docs/PROJECT_BRIEF.md:40,86-87` includes Google Drive; implementation has only env placeholders and DB columns (`.env.example:13-17`, `src/lib/db/schema.ts:272-273`).
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx:312-313` says buying charges are unavailable in this phase, but the same page renders buying charge UI for authorized users (`src/app/(dashboard)/shipping-notes/[id]/page.tsx:291-301`).
