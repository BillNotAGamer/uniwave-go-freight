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
- Runtime policy after Lead Phase 11B amendment: Node.js 24.x, enforced by `.nvmrc` value `24`, package engines `>=24 <25`, and npm `engine-strict=true`.
- Runtime remediation on 2026-08-25: the obsolete system Node.js 20 fallback was replaced with Node.js 24 LTS so non-interactive shells and `C:\Program Files\nodejs\node.exe` resolve Node 24.
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

- Actual current project maturity: uneven. Foundation, auth, shipping-note drafts, charge CRUD/calculations, VAT/tax domain foundation and UI, accounting review start/check/approval/lock/unlock/cancellation/reopen-for-correction, audit writes, tax-complete internal XLSX export, generated internal PDF export, durable artifact storage, protected export history, historical durable download, Admin Google Drive upload/retry/recovery UI, Admin User Management policy/validation/read-model foundation, Admin User Management lifecycle services, Admin Users UI, existing-user Admin temporary password reset, Admin-only safe audit viewer read-model foundation, Admin audit viewer UI, unit/policy tests, browser E2E foundation, authenticated browser E2E/RBAC workflow verification, CI quality gates, security-header/deployment hardening, production migrations through `0005`, and production integration verification are implemented/verified. Remaining release gates are credential rotation, GitHub-hosted CI evidence, and live R2/Google Drive verification.
- Most advanced implemented phase: Phase 7B generated internal PDF export.
- Most advanced verified phase: Phase 6 partial behavior is live database-verified for the currently implemented workflow through `checked`; Phase 7 internal XLSX export-data eligibility is live database-verified for checked notes.
- Phase 7 implemented: PARTIAL. Internal XLSX V2, internal print HTML, and generated internal PDF V1 exist; Google Drive upload does not.
- Phase 8 implemented: IMPLEMENTED pending live smoke/integration execution. Durable Cloudflare R2/S3-compatible artifact storage, protected historical download, Admin-only service-account Google Drive upload/retry/recovery, and protected export-history UI now exist; live Google/R2 smoke testing and browser E2E are still missing.
- Phase 9 implemented: PARTIAL. Audit-log writes, unit/policy tests, hosted database integration tests, Admin User Management policy/validation/read-model foundation, lifecycle services, Admin Users UI, existing-user Admin temporary password reset, Admin audit viewer read-model foundation, and Admin audit viewer UI exist; CI, browser E2E, live authorized session regression execution, and deployment hardening are missing.
- Main blockers: production database credential rotation, no verified GitHub-hosted CI run, and no live Google/R2 smoke validation.
- Main security risks: no route-protection middleware backstop and no browser/session regression suite proving stale browser sessions are rejected after role/state/password changes.
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

## B2. Phase 11B Repository Runtime Safety Follow-Up

- Implementation date: 2026-08-24
- Scope: repository secret safety and Node runtime pin only.
- `.env.local` policy: local-only secret file, ignored by Git, and removed from the intended next committed index state without deleting the local file.
- `.env.example` policy: safe committed template only; it now documents `NEXT_PUBLIC_AUTH_URL` alongside `AUTH_URL`.
- Git history boundary: Phase 11B did not rewrite history. Any secret that was ever committed should be treated as potentially exposed until a human reviews and rotates it outside the repository.
- Runtime policy: originally Node 22.x in Phase 11B, subsequently amended by Lead to Node 24.x with `.nvmrc` value `24` and package engines `>=24 <25`.
- npm enforcement: `engine-strict=true` is enabled so unsupported Node versions fail during install instead of silently continuing.
- Deferred: integration database safety remains Phase 11C; dependency vulnerability triage remains Phase 11D; CI, browser E2E, security headers, deployment target selection, migrations, R2, and Google Drive smoke tests remain out of scope for Phase 11B.
- Checkpoint recommendation: create a human-reviewed checkpoint commit after Phase 11B and before authorized staging migration work.

## B3. Phase 11C Integration Database Safety Follow-Up

- Implementation date: 2026-08-25
- Scope: fail-closed integration database authorization guard, guarded manual migration command, and static migration readiness through `0005`.
- Integration authorization variables: `INTEGRATION_TEST_DATABASE_AUTHORIZED`, `INTEGRATION_TEST_DATABASE_EXPECTED_HOST`, and `INTEGRATION_TEST_DATABASE_EXPECTED_NAME`.
- Authorization requires exact hostname and exact database-name matching against parsed `DATABASE_URL`; hostname matching is case-insensitive only.
- `NODE_ENV="production"` is always refused for integration database execution.
- `npm run test:integration` and the integration setup fail before migration/cleanup/fixture mutation when authorization is absent or mismatched.
- `npm run db:migrate` now routes through a repository guard using separate variables: `DATABASE_MIGRATION_AUTHORIZED`, `DATABASE_MIGRATION_EXPECTED_HOST`, and `DATABASE_MIGRATION_EXPECTED_NAME`.
- Static migration readiness now covers `0003_hard_titania.sql`, `0004_clean_power_man.sql`, and `0005_perpetual_goblin_queen.sql`.
- No database, migration, integration, R2, or Google Drive execution occurred in Phase 11C.
- Live status of migrations `0003`, `0004`, and `0005` remains `LIVE STATUS UNKNOWN / NOT VERIFIED`; Phase 11C itself did not apply any migrations.
- Credential rotation remains an unresolved human-controlled security action, and dependency security triage remains Phase 11D.

## B4. Phase 11D Dependency Security Follow-Up

- Implementation date: 2026-08-26
- Scope: dependency vulnerability triage and smallest safe compatible remediation only.
- Applied updates: `next` `16.2.9 -> 16.3.3`, `@tailwindcss/postcss` to `^4.3.3`, `tailwindcss` to `^4.3.3`, and lockfile-only compatible transitive updates for `postcss`, `nanoid`, `js-yaml`, and `brace-expansion`.
- Audit before remediation: 18 total findings in `npm audit` and 16 total findings in `npm audit --omit=dev`.
- Audit after remediation: 11 total findings in both audit modes: 8 moderate, 2 high, and 1 critical.
- Superseded by Phase 11D.1: the initial Better Auth/Vitest follow-up was narrowed after lead review. Vitest was upgraded to patched `3.2.7`; Better Auth GHSA-qq9h-g4jm-xgf3 was reclassified against actual repository auth configuration.
- Remaining major-decision items after 11D: Drizzle Kit's audit-suggested downgrade to `0.18.1` and ExcelJS's audit-suggested downgrade to `3.4.0` were not applied.
- Validation after remediation passed: `npm ci`, `npm ls`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- No database, migration, integration, R2, Google Drive, credential-rotation, or deployment operation occurred in Phase 11D.
- Phase 11D status: accepted with Phase 11D.1 follow-up.

## B5. Phase 11D.1 Residual Dependency Security Closure

- Implementation date: 2026-08-26
- Scope: residual dependency-security closure only; no database, migration, integration, R2, Google Drive, credential rotation, dependency-force install, or application feature work.
- Applied update: `vitest` `^2.1.9 -> ^3.2.7`; the active Vitest path now uses `vitest@3.2.7`, `vite-node@3.2.4`, and `vite@7.3.6`.
- Vitest exposure: repository scripts and configs use `vitest run` plus local watch mode only. No Vitest UI, Browser Mode, API host, or externally bound Vitest server is configured.
- Better Auth reachability: repository auth uses `emailAndPassword.enabled = true` with the Drizzle adapter. No magic-link plugin, email-OTP plugin, passwordless email login, or equivalent affected flow was found, so GHSA-qq9h-g4jm-xgf3 is classified as non-applicable under current configuration.
- Better Auth upgrade attempts: normal npm installs of `better-auth@1.6.30` and `better-auth@1.6.22` both failed peer resolution through Better Auth's optional SvelteKit peer path selecting `@sveltejs/vite-plugin-svelte@7.3.0`, which requires Vite 8 while the validated repository test toolchain uses Vite 7. No `--force` or `--legacy-peer-deps` bypass was used.
- Final audit result: `npm audit` and `npm audit --omit=dev` both report 7 raw findings: 1 high and 6 moderate. The high finding is non-applicable under current Better Auth configuration; the remaining moderate findings are Drizzle Kit migration-tooling risk and ExcelJS transitive UUID risk.
- Validation passed under Node `v24.19.0`: `npm ci`, `npm ls`, `npm ls --omit=dev`, `npm test` (48 files / 275 tests), `npm run typecheck`, `npm run lint`, and `npm run build`.
- Phase 11D.1 status: ready for lead review; no reachable production High/Critical dependency vulnerability remains under current repository configuration.

## B6. Phase 11E Browser E2E Foundation

- Implementation date: 2026-08-26
- Scope: Playwright Chromium E2E foundation and DB-free public/auth-boundary browser tests only.
- Added dependency: `@playwright/test@1.62.1`.
- Added scripts: `npm run test:e2e` and `npm run test:e2e:headed`.
- Browser runtime: Chromium installed through Playwright's supported installer.
- E2E environment: the runner starts Next with explicit browser-E2E values for DB/auth/R2/Drive env variables and does not read `.env.local` contents.
- Tests implemented: login page smoke, password visibility, native required-field validation without auth submission, inert external callback parameter behavior, and unauthenticated redirects for `/dashboard`, `/shipping-notes`, `/admin/users`, and `/admin/audit`.
- Deferred: successful login, authenticated navigation, role/RBAC browser flows, Admin User Management mutations, Shipping Note mutations/workflow transitions, authenticated export/download, Drive upload, and Audit Viewer filtering until an isolated test/staging database is explicitly authorized.
- Validation passed: `npm run test:e2e` (1 file / 8 Chromium tests), `npm ci`, `npm ls`, `npm test` (48 files / 275 tests), `npm run typecheck`, `npm run lint`, and `npm run build`.
- Audit regression: `npm audit` and `npm audit --omit=dev` remain at the Phase 11D.1 baseline of 7 total findings: 0 critical, 1 high, 6 moderate; no new reachable production High/Critical vulnerability was introduced.
- Phase 11E status: ready for lead review.

## B7. Phase 11F CI Quality Gates

- Implementation date: 2026-08-26
- Scope: validation-only CI automation and security-audit policy; no deployment, database, external-service, credential, migration, or authenticated browser work.
- Workflow: `.github/workflows/quality-gates.yml`.
- Triggers: pull requests and pushes to `main`, `master`, `develop`, and `feature/ui-overhaul`.
- CI runner: `ubuntu-latest` with explicit Node `24` from `actions/setup-node@v4` and npm cache.
- Permissions: `contents: read`.
- CI stages: runtime verification, `npm ci`, `npm ls`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, Playwright Chromium install, `npm run test:e2e`, and `npm run ci:security-audit`.
- Security audit policy: raw npm audit output is collected, but CI fails on accepted-baseline regression, any Critical vulnerability, or any unwaived High finding. The existing Better Auth High is waived only while the repository policy keeps magic-link, email-OTP, and passwordless email sign-in disabled.
- Better Auth guardrail: `src/lib/auth/better-auth-security-policy.json` is used by auth configuration and by policy tests; `src/lib/auth/better-auth-security-policy.test.ts` fails if the vulnerable Better Auth version remains and the waiver policy becomes invalid.
- Playwright diagnostics: failure-only upload of `playwright-report/` and `test-results/`.
- Local validation passed: `npm ci`, `npm ls`, `npm test` (49 files / 277 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (8 tests), and `npm run ci:security-audit`.
- GitHub-hosted CI execution status: not run locally; pending push/PR.
- Phase 11F status: ready for lead review.

## B8. Phase 11G Security Headers and Deployment Contract

- Implementation date: 2026-09-02
- Scope: production-facing security headers, deployment/runtime contract, environment classification, and no-DB security regression tests only.
- Runtime contract: Node.js runtime is required. Edge runtime is not appropriate for current server-side Better Auth/Drizzle/Neon, R2, Google Drive, filesystem-traced export assets, and PDF/XLSX generation paths.
- Deployment target: no provider is committed or provisioned. A suitable target must support Node 24 (`>=24 <25`), Next.js 16, PostgreSQL/Neon, Cloudflare R2 S3-compatible access, Google Drive API access, and server document generation.
- Next.js security config: framework powered-by header disabled; global `nosniff`, `strict-origin-when-cross-origin`, permissions policy, clickjacking protection, COOP, CORP, and staged CSP are configured in `next.config.ts`.
- CSP status: staged/partial. It enforces `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, and `object-src 'none'`; stricter `script-src`/`style-src` nonce work remains deferred until staging/browser validation can cover authenticated surfaces.
- HSTS status: deferred to HTTPS deployment verification. The local application config intentionally does not emit HSTS on plain HTTP localhost.
- Sensitive cache policy: `/`, `/login`, protected dashboard/admin/shipping/tax pages, auth API, shipping-note export APIs, and historical export APIs are configured as `private, no-store, max-age=0`.
- Env public boundary: only `NEXT_PUBLIC_AUTH_URL` is documented as browser-exposed. Server secrets remain unprefixed and server-only.
- GitHub-hosted CI execution status remains `PENDING — NOT EXECUTED`; local workflow validation does not prove GitHub-hosted execution.
- Deferred hardening: authorized staging DB migration/integration verification, authenticated staging browser E2E, R2/Google Drive staging verification, and backup/recovery production release gate.

## B9. Phase 11H Production Database Migration and Integration Verification

- Implementation date: 2026-09-02
- Scope: owner-authorized production database target inspection, guarded migration execution, integration isolation audit, guarded production integration execution, and post-run verification.
- Secret safety: `.env.example` contained a live-looking Neon `DATABASE_URL` and was corrected to a placeholder without printing the original value. Credential rotation for that production database credential remains a human-controlled security follow-up.
- Production authorization guard: `NODE_ENV=production` remains denied by default for migration/integration database operations unless the operation-specific production authorization variable is exactly `true` in addition to the exact host/name authorization.
- Live migration result: production Drizzle journal now records `0000_new_nick_fury` through `0005_perpetual_goblin_queen` as applied, with matching schema checks for post-checked workflow fields, Drive/artifact fields, and `audit_logs_created_at_id_idx`.
- Integration result after Phase 11H.1 closure: guarded production `npm run test:integration` passed 9 files / 95 tests under exact production authorization. Cleanup verification showed zero remaining fixture rows and migrations/schema remained consistent through `0005`.
- Regression validation passed after Phase 11H.1: `npm ci`, `npm ls`, `npm test` (50 files / 287 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (9 Chromium tests), and `npm run ci:security-audit`.
- Phase 11H.1 status: production integration regressions resolved; no R2, Google Drive, deployment, DNS, credential rotation, `test:all`, migration rerun, or migration `0006` work was performed.

## B10. Phase 11I Authenticated Browser E2E Follow-Up

- Implementation date: 2026-09-03
- Scope: authenticated Playwright E2E using real Better Auth email/password login and production-authorized isolated fixture data only.
- Added scripts: `npm run test:e2e:auth` and `npm run test:e2e:auth:headed`.
- Auth architecture: no session-cookie injection, hidden login endpoint, trusted Playwright header, or test-only auth bypass was added. Fixture setup creates users/accounts only; browser sessions are created by the normal login flow.
- Browser coverage: Sale login/session/logout, Sale create/edit/submit draft, Sale/Admin route denial, Accountant accounting review start and Mark Checked, Admin Users, Admin Audit Viewer, Admin approval/lock/unlock, locked-note export-control visibility, cookie attribute inspection, and authenticated no-store cache check.
- Cleanup: every object is namespaced with `E2E11I-*`; failed early selector runs and the final passing run all ended with zero fixture residue in auth, shipping, export, audit, and tax-rule tables.
- Production DB state after validation: migrations `0000` through `0005` remain applied and schema-consistent.
- Validation passed: `npm ci`, `npm ls`, `npm test` (50 files / 287 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (9 Chromium tests), `npm run test:e2e:auth` (1 file / 3 Chromium tests), and `npm run ci:security-audit`.
- Remaining release gates: production database credential rotation, GitHub-hosted CI evidence, and live R2/Google Drive verification.

## B11. Phase 11J Live R2 / Google Drive Verification Follow-Up

- Implementation date: 2026-09-03
- Status: blocked before live mutation.
- Added script: `npm run verify:live-artifacts`.
- Authorization model: requires the existing exact database target guards and `LIVE_ARTIFACT_VERIFICATION_AUTHORIZED="true"`; it is not part of normal CI.
- Current environment does not provide the implemented live artifact variables: `ARTIFACT_R2_ACCOUNT_ID`, `ARTIFACT_R2_ACCESS_KEY_ID`, `ARTIFACT_R2_SECRET_ACCESS_KEY`, `ARTIFACT_R2_BUCKET_NAME`, `GOOGLE_SERVICE_ACCOUNT_JSON`, or `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- Deprecated OAuth-shaped Google variables were present, but they are not used by the service-account Drive implementation.
- Live verification stopped before fixture creation or external-service mutation.
- Read-only production DB checks remained clean: migrations `0000` through `0005` applied, no extra migration rows, schema consistent, and zero fixture residue.
- Phase 11J remains blocked until live R2 credentials and Google Drive service-account configuration are supplied through ignored local/deployment environment configuration.

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

## Phase 8A Durable Export Artifact Storage Foundation

- Implementation date: 2026-08-21.
- Branch: `feature/ui-overhaul`.
- Starting commit: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Status impact: no Shipping Note workflow status changes were added; no `exported` transition was implemented.
- Storage provider: Cloudflare R2 through the S3-compatible `@aws-sdk/client-s3` package.
- Server-only storage modules: `src/lib/artifact-storage/**`.
- Export integration: internal XLSX and internal PDF routes now persist the same generated bytes to durable artifact storage before marking a new export row `generated`.
- Schema impact: `drizzle/0004_clean_power_man.sql` adds `drive_upload_status`, artifact storage metadata columns, Drive upload metadata columns, and a unique index on `artifact_storage_key`.
- Generation invariant: `shipping_note_exports.status = generated` now means generated bytes were durably stored and the stored object is tied to the persisted SHA-256 checksum.
- Drive foundation: `drive_upload_status` starts at `not_uploaded`; Phase 8A does not transition Drive statuses and does not call Google APIs.
- Historical behavior: existing metadata-only export rows keep null artifact storage fields and are not backfilled or regenerated.
- Config: `.env.example` documents R2 variable names only; no credentials are committed.
- Migration status: migration `0004_clean_power_man.sql` was generated but not applied in this conversation; `0003_hard_titania.sql` was also not applied.
- Remaining Phase 8A gaps after later slices: live R2 smoke testing and browser E2E.

## Phase 8B Google Drive Artifact Upload

- Implementation date: 2026-08-22.
- Branch: `feature/ui-overhaul`.
- Starting commit: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Status impact: Google Drive upload is now available as an Admin-only server capability for existing generated durable export artifacts. No Drive UI/export-history UI was added.
- Authentication model: server-only Google Service Account; no OAuth user delegation, refresh tokens, browser auth, or domain-wide delegation.
- Config: `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_ROOT_FOLDER_ID`; old OAuth-shaped placeholders remain documented as deprecated/unused.
- Scope: `https://www.googleapis.com/auth/drive.file`, used because Phase 8B creates and searches app-created Drive files by private `appProperties` and official Drive docs list this scope for `files.list` and `files.create`.
- Route: `POST /api/shipping-note-exports/[exportId]/drive`, with same-origin metadata check, session auth, UUID validation, `EXPORTS_UPLOAD`, and minimal no-store JSON.
- Permission: Admin-only through `EXPORTS_UPLOAD`; Sale and Accountant are denied.
- Supported artifacts: `excel` version `2` and `pdf` version `1`, both requiring `status = generated`, durable storage metadata, MIME validation, and checksum.
- Byte source: `getVerifiedArtifactBytes(...)` reads private artifact storage and rechecks SHA-256 before any Google upload; checksum mismatch records `ARTIFACT_CHECKSUM_MISMATCH` and does not call Google.
- Idempotency: `shipping_note_exports.id` is the identity, stored as Drive `appProperties.uniwaveExportId`; already uploaded DB rows short-circuit, existing matching Drive files reconcile, and duplicate/mismatched Drive files fail safely.
- Drive lifecycle: upload uses `drive_upload_status`; artifact generation `status` remains `generated` on Drive failure and no Shipping Note status is changed.
- Historical policy: stored generated artifacts may be uploaded after the owning note is reopened to Accounting Reviewing or Cancelled; soft-deleted notes are denied.
- Audit: final Drive metadata updates and `shipping_note.export.drive.uploaded` / `shipping_note.export.drive.failed` audit rows are written in the same DB transaction.
- Migration status: no new migration was created; migrations `0003_hard_titania.sql` and `0004_clean_power_man.sql` were not applied in this conversation.
- Remaining Phase 8 gaps: Drive upload/export-history UI, stale `uploading` recovery workflow, live Google smoke testing with dedicated credentials/folder, and browser E2E.

## Phase 8C Export History, Historical Download, Drive UI

- Implementation date: 2026-08-23.
- Branch: `feature/ui-overhaul`.
- Starting commit: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Status impact: protected export history, historical durable downloads, Drive status/actions, and stale upload recovery are now available on the Shipping Note detail page for internal roles.
- Read policy: Accountant/Admin can view export history through `SHIPPING_NOTES_EXPORT_INTERNAL`; Sale is denied and receives no history DTO, Drive URL, or storage metadata.
- Download route: `GET /api/shipping-note-exports/[exportId]/download`.
- Download behavior: reads exact private R2/S3-compatible bytes through `getVerifiedArtifactBytes(...)`, validates checksum and artifact contract, and never regenerates XLSX/PDF.
- UI behavior: history rows show format/version, generation state, generated timestamp, filename, short checksum, size, Drive status, Download, View in Drive, and Admin-only Upload/Retry/Recover controls.
- Drive action policy: Admin can upload `not_uploaded`, retry `upload_failed`, recover stale `uploading`, and view uploaded artifacts. Accountant can download/view status/link only.
- Stale recovery: `DRIVE_UPLOAD_STALE_AFTER_MS = 10 * 60 * 1000`; fresh `uploading` is not stolen. Stale recovery searches Drive by `uniwaveExportId` first, reconciles an exact match, fails duplicates/conflicts safely, or resets/retries when no Drive file exists.
- Historical policy: generated durable artifacts remain visible/downloadable/uploadable after Reopen to Accounting Reviewing or Cancellation; soft-deleted owning notes remain denied.
- Legacy behavior: generated rows without durable artifact metadata remain visible as metadata history but cannot download or Drive upload.
- Migration status: no new migration was created; migrations `0003_hard_titania.sql` and `0004_clean_power_man.sql` were not applied in this conversation.
- Remaining gaps: live Google/R2 smoke tests, hosted integration execution with current DB authorization, browser E2E, audit viewer, and admin user management.

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

## Phase 9A Admin User Management Foundation

- Implementation date: 2026-08-23.
- Branch: `feature/ui-overhaul`.
- Starting commit: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Status impact: Admin User Management now has application-owned policy helpers, Zod validators, a protected safe read model, and focused tests.
- Better Auth Admin plugin remains disabled; no Better Auth `banned`, `banReason`, `banExpires`, or `impersonatedBy` semantics were added.
- Role source of truth remains `users.role` with exactly one role: `sale`, `accountant`, or `admin`.
- Account state remains `isActive` plus `deletedAt`: active, inactive, or deleted.
- `USERS_MANAGE` protects the read model; Sale and Accountant are denied, Admin is allowed through existing Admin-all permission semantics.
- Safe DTO fields: `id`, `name`, `email`, `role`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`, derived `accountStatus`, and unexpired `activeSessionCount`.
- List filters: search by name/email, role, status `active | inactive | deleted | all`, bounded limit/offset/page pagination, deterministic `createdAt DESC, id ASC` ordering.
- Policy foundation prohibits production hard delete, self-demotion/deactivation/soft-delete/Admin-password-reset, and last-active-admin removal.
- Session revocation matrix is defined for future mutations; no session rows are deleted in Phase 9A.
- No Admin Users UI or user lifecycle mutations were added.
- Validation: focused tests passed 3 files / 20 tests; full `npm test` passed 31 files / 190 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Integration status: not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` and `drizzle/0004_clean_power_man.sql` were not applied in this conversation.

## Phase 9B Admin User Lifecycle Mutations

- Implementation date: 2026-08-23
- Branch: `feature/ui-overhaul`
- Starting commit: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Status impact: Admin User Management now has application-owned production lifecycle services for create user, role change, deactivate, reactivate, soft delete, and manual revoke-all-sessions.
- Better Auth Admin plugin remains disabled; the implementation does not use plugin operations or introduce Better Auth admin plugin fields.
- Credential strategy: Admin-created users get Better Auth-compatible credential accounts using `better-auth/crypto` password hashing, `provider_id = credential`, `account_id = user.id`, and `user_id = user.id`.
- Authorization: every service requires an active non-deleted Admin through `USERS_MANAGE`; Sale and Accountant are denied at the service boundary.
- Session revocation: successful role changes, deactivation, soft delete, and manual revoke-all delete target sessions in the same DB transaction as mutation/audit; reactivate creates no sessions.
- Last-admin invariant: active-admin reducing operations serialize through a shared transaction-scoped PostgreSQL advisory lock before counting active Admins.
- Audit actions: `user.create`, `user.role_change`, `user.deactivate`, `user.reactivate`, `user.soft_delete`, and `user.sessions_revoked`.
- Safety: production hard delete, email edit, existing-user password reset, soft-delete restore, impersonation, individual-session UI, and Admin Users UI remain unimplemented.
- Validation so far: focused tests passed 4 files / 24 tests; `npm run typecheck` passed before documentation finalization. Full validation is recorded in `docs/audit/PHASE_9B_ADMIN_USER_LIFECYCLE_IMPLEMENTATION_2026-08-23.md`.
- Integration status: production-path integration tests were added but `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` and `drizzle/0004_clean_power_man.sql` were not applied in this conversation.

## Phase 9C Admin Users UI and Temporary Password Reset

- Implementation date: 2026-08-24
- Branch: `feature/ui-overhaul`
- Starting commit: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Status impact: Admin User Management now has a protected `/admin/users` dashboard page, navigation link, safe list/search/filter/pagination UI, lifecycle action forms, and existing-user temporary password reset.
- Better Auth Admin plugin remains disabled; this implementation does not use plugin operations or introduce Better Auth admin plugin fields.
- Existing-user password reset updates exactly one existing `provider_id = credential` account for another active/inactive non-deleted user, never creates missing credentials, revokes target sessions in the same transaction, and audits `user.password_set_by_admin` without password/hash disclosure.
- UI/server-action scope: create user, role change, deactivate, reactivate, soft delete, manual revoke-all-sessions, and set temporary password call existing authoritative server mutations; server authorization remains in services/read models.
- Deleted users remain read-only in the UI. Production hard delete, email edit, soft-delete restore, impersonation, individual-session UI, audit viewer UI, and Better Auth Admin plugin remain unimplemented.
- Validation: focused tests passed 5 files / 26 tests; full `npm test` passed 36 files / 212 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Integration status: production-path integration tests were extended for temporary password reset/session revocation but `npm run test:integration` and `npm run test:all` were not run because this conversation did not authorize the configured database as test/staging.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql` and `drizzle/0004_clean_power_man.sql` were not applied in this conversation.

## Phase 10A Admin Audit Viewer Foundation

- Implementation date: 2026-08-24.
- Status impact: the audit viewer now has an Admin-only server-side policy, validator set, safe presenter layer, action catalog, entity/actor resolution read model, and focused tests. No UI route, navigation entry, or browser table was added.
- Permission: `AUDIT_LOGS_READ`; Admin is allowed through existing Admin-all semantics, Sale and Accountant are denied before audit rows are queried.
- Safe DTO: no raw top-level `before` or `after` snapshots are returned. Known actions expose only allowlisted `changes`; unknown actions expose no snapshot-derived fields and report `detailsAvailable = false`.
- Sensitive-field defense: presenter output is recursively sanitized for credential, password, token, secret, private-key, authorization, cookie, connection-string, database-url, client-secret, and artifact-storage-key key families.
- Action catalog: 34 current production audit action strings are explicitly registered.
- Query behavior: filters are action, entity type, entity ID, actor ID, from, to, cursor, and bounded limit. Free-text search is intentionally deferred to a later UI/search slice.
- Pagination: keyset cursor is opaque base64url JSON containing `createdAt` and `id`, matching `created_at DESC, id DESC`.
- Timezone: audit display formatting uses `Asia/Ho_Chi_Minh`.
- Migration generated: `drizzle/0005_perpetual_goblin_queen.sql`, containing only `audit_logs_created_at_id_idx` on `(created_at DESC, id DESC)`. No migration was applied in this conversation.

## Phase 10B Admin Audit Viewer UI

- Implementation date: 2026-08-24.
- Status impact: `/admin/audit` now exposes the Phase 10A safe audit viewer DTO through a protected Admin-only dashboard page.
- Route/RBAC: the page resolves the active authenticated user, requires `AUDIT_LOGS_READ`, validates query parameters, and calls `listAuditViewerForUser(...)`. Sale and Accountant are denied before audit data is loaded.
- Navigation: Audit link appears only for roles with `AUDIT_LOGS_READ`.
- Filters: action, entity type, entity ID, actor ID, from date, and to date are persisted in the query string. Applying filters clears the previous cursor.
- Date handling: date-only filter inputs are translated to `Asia/Ho_Chi_Minh` business-day UTC boundaries before Phase 10A validation.
- Pagination: newest-first forward keyset pagination preserves filters and carries the opaque `nextCursor` without decoding it in the UI.
- Table: displays Time, Actor, Action, Category, Entity, Reason, and Details.
- Details: known actions render safe expandable field-level changes; unknown actions render no details and never expose raw snapshots.
- Boundaries: no raw JSON, no debug/source view, no audit API, no audit mutations, no CSV/export, no retention controls, no free-text search, and no client-side sanitizer were added.
- Migration status: no new migration was created; `drizzle/0003_hard_titania.sql`, `drizzle/0004_clean_power_man.sql`, and `drizzle/0005_perpetual_goblin_queen.sql` were not applied in this conversation.

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
| 3 - Authentication and RBAC | PARTIAL | Better Auth, disabled public signup by default, active-user session recheck, role permission map, server authorization helpers, bootstrap scripts, Admin User Management policy/validation/read-model foundation, lifecycle services, protected Admin Users UI, and existing-user Admin temporary password reset. | Middleware backstop, live HTTP/session regression tests, browser E2E, audit viewer. | `src/lib/auth/server.ts:11-47`; `src/lib/auth/session.ts:18-59`; `src/lib/permissions/permissions.ts:30-52`; `scripts/create-first-admin.ts:87-144`; `src/app/(dashboard)/admin/users/page.tsx`; `src/features/admin/users/**`. | Admin management still lacks browser/live session regression execution. |
| 4 - Shipping note form MVP | IMPLEMENTED - LIVE DB VERIFIED | List, create draft, edit draft, detail, submit; Zod server action parsing; draft-only server enforcement. | Browser form workflows, concurrency/stale-data handling, party table. | `src/features/shipping-notes/actions.ts:53-173`; `src/features/shipping-notes/mutations.ts:113-270`; `src/features/shipping-notes/validators.ts:129-155`; `npm run test:integration` passed 6 files / 28 tests. | Browser and concurrency coverage still missing. |
| 5 - Charge calculation engine | IMPLEMENTED - UNIT AND LIVE DB VERIFIED | BigInt decimal helpers, charge amount calculation, selling and buying charge CRUD, summaries, profit derivation, server-computed amounts. | VAT/tax; override reasons. | `src/lib/calculations/decimal.ts:25-201`; `src/lib/calculations/money.ts:141-186`; `src/lib/calculations/shipping-note.ts:42-100`; `npm test` covers pure helpers; `npm run test:integration` verifies persisted charge rows and summaries. | VAT/tax and overrides remain unimplemented. |
| 6 - Accounting review | PARTIAL - LIVE DB VERIFIED FOR CURRENT FLOW | Accountant/admin can view buying charges and financial summary; transitions `submitted -> accounting_reviewing -> checked`; Admin-only `checked -> approved`; Admin-only `approved -> locked` and `locked -> approved`; Admin-only Checked/Approved reopen to Accounting Reviewing; contextual cancellation to `cancelled`; buying charge management; tax-rule services and UI; charge tax assignment/override UI; checked tax completeness UX. | Accounting filters, accounting periods, browser E2E. | `src/features/shipping-notes/mutations.ts`; `src/features/shipping-notes/actions.ts`; `src/features/shipping-notes/status-policy.ts`; Phase 6C.5 unit tests passed; integration tests were extended but not run in this conversation. | Blocks clean claim of full accounting workflow completion. |
| 7 - Excel/PDF export | PARTIAL | Tax-complete internal XLSX V2 template mapping, generated internal PDF V1, hash/font tracing, same-origin checks, sanitized export errors, export records and audit events, VAT-aware print view. | Drive upload; background/queue architecture if exports become heavy; live DB/browser export workflow verification. | `src/features/shipping-notes/export/generator.ts`; `src/features/shipping-notes/export/pdf/generator.tsx`; `src/features/shipping-notes/export/read-model.ts`; `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts`; `src/app/api/shipping-notes/[id]/exports/internal-pdf/route.ts`; `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`; Phase 7B `npm test` passed 18 files / 90 tests on 2026-08-21. | Phase 7 is not complete because Drive upload is absent. |
| 8 - Google Drive integration | IMPLEMENTED - LOCAL VALIDATION PASSED | Durable R2-backed artifact storage foundation, artifact storage schema metadata, Drive upload status foundation, server-only Google Drive adapter, Admin-only export-artifact upload route, protected history read model/UI, historical durable download route, appProperties idempotency, retry/reconciliation, and stale upload recovery. | Live Google/R2 smoke tests, hosted integration execution with current DB authorization, browser E2E. | `src/lib/artifact-storage/**`; `src/lib/drive/**`; `src/features/shipping-notes/export/drive/**`; `src/features/shipping-notes/export/history.ts`; `src/features/shipping-notes/export/download.ts`; `src/app/api/shipping-note-exports/[exportId]/**`; `drizzle/0004_clean_power_man.sql`. | External smoke/E2E hardening remains. |
| 9 - Audit, QA, hardening | PARTIAL | Audit write helper and audit writes inside mutations/export status updates; Vitest unit/policy test foundation; hosted database integration tests; Admin User Management policy/validation/read-model foundation, lifecycle services, protected UI, temporary password reset, Admin audit viewer read-model foundation, and `/admin/audit` UI. | CI, seed/dev QA data, browser E2E, deployment checklist, observability, live authorized session regression execution. | `src/lib/audit/log.ts:28-41`; mutation/export audit calls in `src/features/shipping-notes/mutations.ts` and `src/features/shipping-notes/export/mutations.ts:112-176`; `src/app/(dashboard)/admin/users/page.tsx`; `src/app/(dashboard)/admin/audit/page.tsx`; `src/features/admin/users/**`; `src/features/admin/audit/**`. | No browser/live session regression execution yet. |

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
- Admin audit viewer UI and safe read model: `src/app/(dashboard)/admin/audit/page.tsx`, `src/features/admin/audit/**`.

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
| User management | Denied | Denied | Protected Admin Users UI, safe list/read model, create, role change, deactivate/reactivate, soft delete, manual revoke-all-sessions, and existing-user temporary password reset | `USERS_MANAGE`; `src/app/(dashboard)/admin/users/page.tsx`; `src/features/admin/users/**` |
| Audit-log viewing | Denied | Denied | `/admin/audit` safe viewer UI | Protected by `AUDIT_LOGS_READ`; `src/app/(dashboard)/admin/audit/page.tsx`; `src/features/admin/audit/**` |
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
- F-P2-06: Audit logs now have an Admin-only safe UI/read-model foundation, but browser E2E and live authorized integration execution remain pending.

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
3. Harden Admin User Management with live session/browser regression coverage.
   - Dependency: current authorization for a hosted test/staging database and a browser E2E harness decision.
   - Risk addressed: stale browser sessions after role changes, deactivation, soft delete, manual revoke, and Admin password reset.
   - Expected files/modules: `tests/integration/**`, future browser E2E specs, auth/session helpers if defects are found.
   - Validation required: authorized `npm run test:integration`, browser/session regression run, and full local validation.
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

## K. Phase 11K Release Readiness Gate

- Phase 11J is `DEFERRED BY OWNER — CUSTOMER LIVE SERVICE CONFIGURATION PENDING`; no live R2 or Google Drive operation was attempted in Phase 11K.
- Production DB read-only verification confirms migrations `0000` through `0005` are applied, expected schema objects are present, and integration/auth fixture residue is zero.
- The production integration suite and authenticated browser E2E were re-run with explicit production authorization and exact target guards; cleanup verification returned application fixture tables to zero rows afterward.
- Backup/recovery status is incomplete: provider recovery is documented but not project-verified, local `pg_dump`/`pg_restore` tooling is unavailable, and no restore drill was executed.
- Production go-live remains blocked by owner/external gates: Phase 11J live verification, database credential rotation, GitHub-hosted CI evidence, HTTPS/proxy/secure-cookie verification, and backup/restore execution evidence.

## L. Phase 11K.1 Backup and Restore Drill Closure

- PostgreSQL 18.3 client tooling was found at `C:\Program Files\PostgreSQL\18\bin` and used against the PostgreSQL 18.6 production server.
- A custom-format logical production backup was created outside the repository, structurally validated, restored into a disposable local PostgreSQL cluster, and verified for migration journal count, expected tables, workflow columns, artifact/Drive columns, indexes, FKs, enum, and aggregate row counts.
- The temporary backup and disposable restore cluster were removed after verification; no dump was committed or left under source control.
- Backup procedure, restore drill, and recovery engineering are now verified at the logical-backup level.
- Provider recovery capability remains documentation-only because Neon project-level restore/PITR settings were not inspected through provider access.
- Engineering status: `ENGINEERING COMPLETE — RELEASE CANDIDATE`.
- Production readiness remains `NOT YET READY FOR PRODUCTION — EXTERNAL/OWNER RELEASE GATES REMAIN` because Phase 11J, production DB credential rotation, GitHub-hosted CI, and HTTPS/cookie/proxy verification are still open.
