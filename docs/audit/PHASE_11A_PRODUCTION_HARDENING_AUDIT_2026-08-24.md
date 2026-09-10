# Phase 11A Production Hardening + Runtime Verification Readiness Audit

## A. Audit Metadata

- Date: 2026-08-24
- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Scope: audit-only production hardening and runtime verification readiness.
- Source-change policy: no application source code changes, no migrations, no package installs, no live database mutation, no R2/Drive calls, no deployment.
- New artifact created by this audit: `docs/audit/PHASE_11A_PRODUCTION_HARDENING_AUDIT_2026-08-24.md`
- Finding labels used: `REPOSITORY-PROVEN`, `TEST-VERIFIED`, `DOCUMENTED-ONLY`, `INFERRED`, `DECISION REQUIRED`, `NOT IMPLEMENTED`, `STALE DOCUMENTATION`.

## B. Executive Readiness Verdict

Final executive verdict: `NOT READY FOR STAGING`

The codebase has substantial completed feature work, but staging verification should not start until several repository-level safety gates are fixed:

- P0 `REPOSITORY-PROVEN`: `.env.local` is tracked by Git, and `.gitignore` explicitly unignores it. Treat any values that have ever been committed there as exposed until reviewed and rotated.
- P0 `REPOSITORY-PROVEN`: current local runtime is Node `v20.14.0`, while installed production dependency paths require newer engines: `kysely@0.29.2` requires Node `>=22.0.0`, and `@noble/ciphers@2.2.0` / `@noble/hashes@2.2.0` require Node `>=20.19.0`.
- P0 `REPOSITORY-PROVEN`: integration setup can automatically run migrations and cleanup against whatever `DATABASE_URL` is configured, with no explicit test/staging authorization guard.
- P1 `REPOSITORY-PROVEN`: migrations `0003`, `0004`, and `0005` exist in the repository but live database application status was not verified in this audit.
- P1 `REPOSITORY-PROVEN`: `npm audit --omit=dev` reports 16 vulnerabilities, including high/critical supply-chain findings affecting production dependency paths such as `next` and `better-auth`.
- P1 `NOT IMPLEMENTED`: no browser E2E coverage currently proves real Better Auth cookie/session behavior, stale-session invalidation, admin UI protection, export download auth, or audit viewer redaction at runtime.
- P1 `NOT IMPLEMENTED`: no CI/deployment configuration or Node pin was found.

The application is not production-ready. It is also not ready for staging verification until secrets hygiene, Node runtime pinning, and test database safety guards are addressed.

## C. Repository / Git State

Commands recorded before audit work:

- `git status --short`: dirty working tree with many pre-existing modified and untracked files.
- `git diff --name-status`: tracked modifications across docs, migrations metadata, package files, export routes, export domain code/tests, schema, and integration tests.
- `git ls-files --others --exclude-standard`: many untracked Phase 8/9/10 artifacts, including admin audit UI files, audit reports, migrations `0004_clean_power_man.sql` and `0005_perpetual_goblin_queen.sql`, artifact storage, Drive, export history, admin user management, and audit viewer tests.
- `git branch --show-current`: `feature/ui-overhaul`
- `git rev-parse HEAD`: `513e60edc34f4a0fec5686b927d861d09ec78934`

`REPOSITORY-PROVEN` P1: HEAD is behind the current implemented working tree. The latest commit is `up phase 8`, while much later Phase 8/9/10 work remains uncommitted. This creates release, rollback, review, and provenance risk.

Recommendation before any staging or production verification:

- create human-reviewed checkpoint commits for accepted implementation phases;
- keep this Phase 11A report as a separate audit commit;
- exclude local secrets and machine-only files.

## D. Runtime / Dependency Inventory

Runtime and package inventory:

- Node: `v20.14.0`
- npm: `10.8.1`
- Lockfile: `package-lock.json`, lockfileVersion `3`
- Next.js: `16.2.9`
- React: `19.2.4`
- React DOM: `19.2.4`
- Better Auth: `1.6.20`
- Drizzle ORM: `0.45.2`
- Drizzle Kit: `0.31.10`
- Neon serverless driver: `1.1.0`
- Vitest: `2.1.9`
- TypeScript: `5.9.3`
- ESLint: `9.39.4`
- Excel/PDF/remote storage dependencies include `exceljs`, `@react-pdf/renderer`, `@aws-sdk/client-s3`, and `googleapis`.

Scripts present:

- `dev`
- `build`
- `start`
- `test`
- `test:watch`
- `test:integration`
- `test:all`
- `lint`
- `typecheck`
- `admin:create-first`
- `dev:user:create`
- `db:generate`
- `db:migrate`
- `db:studio`

`npm audit --omit=dev` result: failed with 16 reported vulnerabilities, including 8 moderate, 7 high, and 1 critical.

Notable production-path findings:

- `better-auth` advisory range includes installed `1.6.20`.
- `next` advisory range includes installed `16.2.9`.
- `postcss`, `sharp`, `nanoid`, `brace-expansion`, and `uuid` advisories are present through dependency paths.
- Some proposed audit fixes require major or forced dependency changes and must be reviewed deliberately.

## E. Node Runtime Recommendation

Recommended production Node policy: **pin Node 22 LTS**.

Rationale:

- `kysely@0.29.2`, reached through `better-auth`, requires Node `>=22.0.0`.
- `@noble/ciphers@2.2.0` and `@noble/hashes@2.2.0`, reached through `better-auth`, require Node `>=20.19.0`.
- Current local Node `v20.14.0` is below both the `@noble` requirement and the `kysely` requirement.
- Next.js 16, React 19, Better Auth, PDF generation, and server-side export routes should be verified on one pinned runtime instead of relying on platform defaults.

`REPOSITORY-PROVEN` P0: no `.nvmrc`, `.node-version`, package `engines`, Volta config, Dockerfile, CI runtime pin, or deployment runtime pin was found.

Required next step:

- add a single repository runtime policy, preferably Node `22.x` / `>=22 <23`, then run all local validation on that runtime.

## F. Migration Inventory

Repository migrations:

- `drizzle/0000_new_nick_fury.sql`
  - Creates base enums/tables for users, shipping notes, charges, exports, audit logs, tax rules, indexes, and foreign keys.
- `drizzle/0001_dazzling_saracen.sql`
  - Adds Better Auth account/session/verification tables and user auth metadata.
- `drizzle/0002_jittery_paper_doll.sql`
  - Adds tax treatment enum, charge tax snapshot columns, tax rule metadata, tax FKs, and indexes.
- `drizzle/0003_hard_titania.sql`
  - Adds workflow timestamp/actor/reason foundation: `checked_at`, `approved_at`, `locked_by_id`, `lock_reason`, `cancelled_by_id`, `cancelled_at`, `cancel_reason`, and related FKs.
- `drizzle/0004_clean_power_man.sql`
  - Adds Drive upload status enum and durable artifact storage metadata on `shipping_note_exports`, including `artifact_storage_key`, size, mime type, Drive folder/upload fields, and a unique index on artifact storage key.
- `drizzle/0005_perpetual_goblin_queen.sql`
  - Adds audit log ordering index on `(created_at DESC, id DESC)`.

`drizzle/meta/_journal.json` includes migration entries `0000` through `0005` and is internally consistent with the files present.

Live database migration status: `NOT VERIFIED`.

## G. Migration Safety / Ordering

Pending migration risk assessment:

- `0003`: additive nullable columns and FKs. Low data rewrite risk, but FK validation can still take locks and should be applied in a controlled maintenance window or staging rehearsal.
- `0004`: additive enum and columns. `drive_upload_status` is `NOT NULL DEFAULT 'not_uploaded'`, which is usually metadata-fast on modern PostgreSQL but must be tested against the actual production version. The unique index on `artifact_storage_key` permits multiple nulls but regular index creation can lock writes.
- `0005`: regular `CREATE INDEX` on `audit_logs`. On a large table, this can block writes. Consider a production-specific concurrent index strategy if audit volume is significant.

Ordering:

- Apply migrations in journal order only: `0000` -> `0001` -> `0002` -> `0003` -> `0004` -> `0005`.
- Do not deploy runtime code expecting Phase 6C/8/10 columns before migrations are applied.
- Do not execute integration tests against a shared database until test DB authorization and cleanup safeguards are added.

Migration safety verdict: `BLOCKED FOR LIVE EXECUTION UNTIL DATABASE TARGET IS EXPLICITLY AUTHORIZED AND BACKED UP`.

## H. Integration Test Readiness

Integration test structure exists:

- Config: `vitest.integration.config.ts`
- Integration tests cover shipping note mutations, visibility, financial charges, tax domain, accounting/export/audit, blank optional fields, admin user lifecycle, audit viewer, and migration checks.
- Integration runs are serialized with one worker.

Readiness gaps:

- `tests/integration/setup/environment.ts` requires `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`, but does not require an explicit `TEST_DATABASE_AUTHORIZED=true` style safety flag.
- `tests/integration/setup/database.ts` calls Drizzle `migrate(...)` automatically, so `npm run test:integration` can mutate the configured database.
- `tests/integration/setup/cleanup.ts` deletes test-scoped rows by generated IDs/prefixes, but still performs destructive database operations against the configured `DATABASE_URL`.
- Migration assertions are partly stale after Phase 10: the general migration readiness checks do not fully prove migrations through `0005`, including the audit ordering index.

Integration readiness verdict: `NOT READY TO RUN AGAINST ANY LIVE DATABASE WITHOUT A TEST/STAGING AUTHORIZATION GUARD`.

## I. Test Database Safety

`REPOSITORY-PROVEN` P0:

- Integration setup can migrate and delete data on the configured database.
- No explicit test/staging authorization variable was found.
- No denylist for production hostnames or database names was found.
- No current conversation authorization was given to run integration tests.

Required guard before integration execution:

- require an explicit environment variable such as `INTEGRATION_TEST_DATABASE_AUTHORIZED=true`;
- reject known production-like database names/hosts where possible;
- print only safe database identity metadata, never credentials;
- require an isolated staging/test database;
- take a backup/snapshot before migration rehearsal.

Integration tests were not executed in this audit.

## J. Auth / Session Runtime Verification

Repository-proven behavior:

- Better Auth server config uses validated `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`.
- Production sign-up is disabled regardless of the development bootstrap flag because sign-up is only allowed when `NODE_ENV !== "production"` and the explicit bootstrap flag is set.
- Session lookup re-checks the user row and rejects inactive or soft-deleted users.
- Admin user lifecycle integration tests cover role updates, deactivation, soft delete, password reset, and session revocation at service/database level.

Verification gap:

- No browser E2E or live HTTP integration currently proves real cookie issuance, cookie invalidation, stale browser behavior after role changes/deactivation, protected dashboard route redirects, or admin route denial.
- No runtime verification was performed against a deployed or local server in this audit.

Auth/session verdict: `NOT RUNTIME-VERIFIED`.

## K. Browser E2E Readiness

`NOT IMPLEMENTED` P1:

- No Playwright, Cypress, or equivalent browser E2E test infrastructure was found.
- Current tests do not prove first-admin login, real session cookies, logout, stale-session invalidation, admin-user UI authorization, audit viewer authorization/redaction, export history downloads, or Drive upload UI behavior through a browser.

Minimum recommended E2E slice before production:

- login/logout smoke;
- role-based dashboard access for Sale, Accountant, and Admin;
- admin user management session invalidation;
- audit viewer redaction and filters;
- shipping-note finalize/export/history download authorization;
- stale role/deactivation behavior in an already-open browser session.

## L. R2 Production Readiness

Repository-proven behavior:

- R2 configuration is server-only and lazily validated.
- Required env vars are `ARTIFACT_R2_ACCOUNT_ID`, `ARTIFACT_R2_ACCESS_KEY_ID`, `ARTIFACT_R2_SECRET_ACCESS_KEY`, and `ARTIFACT_R2_BUCKET_NAME`.
- Export artifacts are written to deterministic private object keys under `shipping-note-exports/<exportId>/`.
- Downloads read artifacts back and verify SHA-256 checksum before returning bytes.
- Errors are normalized through artifact storage error types instead of exposing raw provider details.

Readiness gaps:

- No live R2 smoke test was run.
- Bucket existence, IAM scope, write/read/list-denial expectations, object retention policy, lifecycle policy, and backup/recovery behavior were not verified.
- R2 is now on the export generation path. Missing or invalid R2 configuration will prevent new internal XLSX/PDF export generation.

R2 verdict: `CONFIGURED IN CODE, NOT PRODUCTION-VERIFIED`.

## M. Drive Production Readiness

Repository-proven behavior:

- Drive configuration is server-only and lazily validated.
- Required env vars are `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- The configured OAuth scope is `https://www.googleapis.com/auth/drive.file`.
- Service-account JSON parsing requires `client_email` and `private_key`.
- Drive upload lookup uses app properties to support idempotency by export ID.
- Upload logic uses timeout/retry behavior and sanitized Drive error classification.
- No public sharing behavior was found in the code path.

Readiness gaps:

- No live Drive smoke test was run.
- Service account folder access, shared-drive flags, root folder correctness, duplicate lookup behavior, retry behavior, and operational failure modes were not verified.
- Drive upload remains an external side effect and should not be coupled to note status transitions.

Drive verdict: `CONFIGURED IN CODE, NOT PRODUCTION-VERIFIED`.

## N. Environment / Secret Inventory

Central app env:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`

Auth/browser-related env:

- `NEXT_PUBLIC_AUTH_URL` is referenced by the browser auth client fallback path but is not present in `.env.example` and is not validated by `src/lib/env.ts`.

Bootstrap/admin env:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_NAME`

Drive env:

- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- Deprecated Google OAuth placeholder variables remain in `.env.example`.

R2 env:

- `ARTIFACT_R2_ACCOUNT_ID`
- `ARTIFACT_R2_ACCESS_KEY_ID`
- `ARTIFACT_R2_SECRET_ACCESS_KEY`
- `ARTIFACT_R2_BUCKET_NAME`

Secret hygiene finding:

- `REPOSITORY-PROVEN` P0: `.env.local` is tracked by Git and `.gitignore` explicitly unignores it.
- This audit did not inspect or print `.env.local` contents.
- Treat any secrets that may have been committed to `.env.local` as exposed until reviewed.

Required before staging:

- stop tracking `.env.local`;
- remove the explicit `.gitignore` unignore for `.env.local`;
- rotate any committed credentials;
- replace local secret handling with untracked local env files and managed deployment secrets.

## O. Auth Production Configuration

Repository-proven strengths:

- Required auth env is validated on server startup.
- Production self-signup is disabled by construction.
- Session lookup rejects inactive and soft-deleted users.
- Admin-all permission semantics exist in centralized permission helpers.

Production gaps:

- `DECISION REQUIRED` P1: confirm deployed `AUTH_URL` exactly matches the public HTTPS origin.
- `INFERRED` P1: verify Better Auth cookie flags, secure cookie behavior, same-site behavior, and trusted origin handling in a deployed HTTPS environment.
- `NOT IMPLEMENTED` P1: add browser/runtime tests for deactivation, soft deletion, password reset session revocation, and role downgrade.

## P. Route / CSRF / Authorization Audit

Repository-proven strengths:

- Sensitive API routes inspected require authenticated sessions.
- Export generation and historical downloads require server-side authorization.
- Custom POST export/upload routes apply same-origin request checks.
- Server actions call production mutations/services that enforce authorization server-side.
- Sale-safe query boundaries are implemented for visible shipping-note data.

Gaps:

- `NOT IMPLEMENTED` P1: no global middleware backstop was found for dashboard/admin/API route protection.
- `INFERRED` P2: Next server actions rely on framework behavior plus service-layer authorization; no repository-level CSRF helper exists for all mutations.
- `NOT IMPLEMENTED` P1: no browser tests prove direct URL/API denial for Sale/Accountant across admin audit, admin users, export history, and artifact download routes.

## Q. Security Headers

`REPOSITORY-PROVEN` P1:

- No global security headers were found in `next.config.ts` or middleware.
- Download routes set targeted `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, which is appropriate for artifacts.
- No repository-level CSP, frame protection, Referrer-Policy, Permissions-Policy, or HSTS configuration was found.

Recommendation:

- add conservative global headers before production;
- handle HSTS at the deployment edge if preferred;
- introduce CSP carefully because Next.js and inline framework scripts require validation.

## R. Next.js / Deployment Runtime

Repository-proven:

- App uses Next.js App Router.
- Export/Drive routes declare Node runtime where needed.
- `next.config.ts` uses targeted `outputFileTracingIncludes` for the XLSX template and PDF fonts.
- No repository-wide wildcard tracing rule was found.

Deployment gaps:

- `DECISION REQUIRED` P1: deployment target is not documented or configured.
- `NOT IMPLEMENTED` P1: no Dockerfile, platform config, standalone output setting, CI deployment workflow, or runtime pin was found.
- `INFERRED` P2: synchronous XLSX/PDF generation plus R2/Drive calls require platform timeout verification.

Deployment target status: `UNSELECTED / NOT DOCUMENTED`.

## S. Database / Transaction / Advisory Lock Review

Repository-proven:

- Drizzle transactions are used for important business mutations and audit writes.
- Phase 6C transitions use compare-and-set style status guards.
- Export artifact creation keeps external artifact generation/storage outside note status transitions.
- Admin user lifecycle code uses a PostgreSQL advisory transaction lock for last-admin protection.

Runtime verification gap:

- `INFERRED` P1: advisory lock correctness depends on transaction/session behavior of the configured Neon serverless driver at runtime. The code structure is sound, but live staging concurrency verification is still required.

Recommended staging checks:

- concurrent last-admin deactivation/delete attempts;
- concurrent role downgrade and login/session access;
- concurrent workflow transitions;
- concurrent export generation or upload retry for the same export record.

## T. Deferred Concurrency Risks

Known deferred risks:

- `P1`: Last-admin protection should be stress-tested with real database concurrency.
- `P1`: Export upload idempotency should be tested with repeated Drive upload submissions and provider timeouts.
- `P2`: Shipping-note state transitions are CAS guarded, but browser stale-form behavior is not E2E-tested.
- `P2`: Historical download should be tested while export metadata changes are in progress.

No new locking or queueing mechanism is recommended before staging; first prove existing transaction and unique-index behavior under authorized staging conditions.

## U. Observability / Error Handling

Repository-proven strengths:

- Domain errors are normalized in export, artifact storage, Drive, admin users, and audit viewer code paths.
- Sensitive provider errors are generally not returned directly to users.
- Audit logs exist for important mutations.

Gaps:

- `NOT IMPLEMENTED` P1: no production error tracking integration was found.
- `NOT IMPLEMENTED` P2: no request correlation ID or structured application logger was found.
- `NOT IMPLEMENTED` P2: no operational dashboard or alerting plan was found for failed exports, failed Drive uploads, auth errors, or migration failures.

Recommendation:

- add structured server logging with request IDs;
- add provider failure metrics/log events for R2 and Drive;
- define alert thresholds for repeated artifact upload/download failures and authentication anomalies.

## V. Backup / Recovery / Retention

`DECISION REQUIRED` P1:

- Database backup/snapshot policy was not documented in repository files reviewed.
- R2 retention/lifecycle policy was not documented.
- Drive folder retention, manual deletion policy, and recovery process were not documented.
- No rollback runbook was found.

Minimum production requirements:

- database backup before migration application;
- verified restore process in staging;
- R2 object retention policy aligned with accounting/audit retention;
- Drive folder permissions and retention policy reviewed by business owner;
- documented rollback path for app deploy rollback and forward-only migration recovery.

## W. CI / Build Reproducibility

`NOT IMPLEMENTED` P1:

- No CI workflow was found.
- No Node runtime pin was found.
- No package manager version pin was found beyond the current lockfile.
- No deployment preview/staging workflow was found.

Expected CI minimum:

- Node 22 LTS;
- `npm ci`;
- `npm test`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- optional integration job requiring explicit test DB secrets and authorization flag.

## X. Dependency / Supply-Chain Findings

`npm audit --omit=dev` failed.

Highest-priority dependency findings:

- P1 `REPOSITORY-PROVEN`: `next@16.2.9` is within advisory ranges reported by `npm audit`.
- P1 `REPOSITORY-PROVEN`: `better-auth@1.6.20` is within advisory ranges reported by `npm audit`.
- P1 `REPOSITORY-PROVEN`: transitive advisories include `postcss`, `sharp`, `nanoid`, `brace-expansion`, and `uuid`.
- P2 `REPOSITORY-PROVEN`: the audit-suggested `exceljs` fix would force a downgrade, so it requires manual review rather than automatic application.

Do not run `npm audit fix --force` without a separate implementation task and regression pass.

## Y. Staging Acceptance Gate

Required before running staging verification:

- `.env.local` removed from Git tracking and committed history/secrets reviewed.
- Any exposed credentials rotated.
- Node 22 LTS pinned in repository and staging platform.
- Dependency advisories triaged, with security-sensitive updates applied or accepted with documented rationale.
- Test database safety guard added before running integration tests.
- Dedicated staging database provisioned and authorized in the current conversation/runbook.
- Migrations rehearsed against staging from backup/snapshot.
- R2 staging bucket and credentials provisioned with least privilege.
- Drive staging folder/service account provisioned with least privilege.

Staging gate status: `BLOCKED`.

## Z. Production Release Gate

Required before production:

- staging gate complete;
- all local and CI checks pass on pinned Node 22;
- authorized integration tests pass against isolated staging database;
- browser E2E smoke passes for auth, RBAC, admin users, audit viewer, export history, historical downloads, and Drive upload;
- R2 write/read/checksum smoke passes;
- Drive upload/idempotency smoke passes;
- migration lock/rehearsal timing documented;
- production secrets loaded through deployment secret manager;
- global security headers configured and verified;
- backup/restore procedure verified;
- rollback runbook approved.

Production gate status: `BLOCKED`.

## AA. Release / Rollback Sequence

Recommended release sequence:

1. Create reviewed checkpoint commits for existing accepted work.
2. Remove tracked local env files and rotate exposed credentials.
3. Pin Node 22 LTS and validate locally with `npm ci`, unit tests, typecheck, lint, and build.
4. Add integration database safety guard.
5. Provision isolated staging database, R2 bucket, and Drive folder/service account.
6. Apply migrations to staging in order.
7. Run integration tests against staging only after explicit authorization.
8. Run browser E2E smoke against staging.
9. Run R2 and Drive smoke tests with non-production artifacts.
10. Deploy production app only after production secrets, backups, headers, and rollback runbook are confirmed.

Rollback strategy:

- Application rollback should use the previous deploy artifact.
- Database rollback should be treated as forward-only unless a tested restore point is available.
- Preserve export artifacts and audit logs; do not delete historical accounting evidence during rollback.

## AB. Risk Register

| Severity | Classification | Risk | Evidence | Blocking Stage |
| --- | --- | --- | --- | --- |
| P0 | REPOSITORY-PROVEN | Tracked `.env.local` may expose real secrets. | `.gitignore` unignores `.env.local`; Git tracks `.env.local`. | Staging |
| P0 | REPOSITORY-PROVEN | Current Node is incompatible with installed production dependency engines. | Node `v20.14.0`; `kysely@0.29.2` requires `>=22.0.0`; `@noble/*@2.2.0` requires `>=20.19.0`. | Staging |
| P0 | REPOSITORY-PROVEN | Integration command can migrate/delete against configured DB without explicit authorization guard. | Integration setup auto-runs migrations and cleanup from `DATABASE_URL`. | Staging |
| P1 | REPOSITORY-PROVEN | Live DB migration state is unknown. | Migrations `0003`-`0005` exist; no DB authorization, no migration run. | Staging |
| P1 | REPOSITORY-PROVEN | Dependency audit reports high/critical vulnerabilities. | `npm audit --omit=dev` failed with 16 vulnerabilities. | Production |
| P1 | NOT IMPLEMENTED | Browser auth/RBAC/session behavior is not E2E-verified. | No browser E2E framework found. | Production |
| P1 | NOT IMPLEMENTED | CI/build reproducibility is missing. | No CI/runtime pin found. | Production |
| P1 | NOT IMPLEMENTED | Global security headers are not configured. | `next.config.ts` has tracing config only. | Production |
| P1 | DECISION REQUIRED | Deployment platform and runtime limits are unknown. | No platform config or runbook found. | Production |
| P1 | INFERRED | Advisory lock behavior requires live DB concurrency verification. | Admin user code uses transaction advisory lock; no live stress test run. | Production |

## AC. Decision Register

| Decision | Options | Repository Evidence | Recommended Default | Business Decision Required? |
| --- | --- | --- | --- | --- |
| Production Node version | Node 20, Node 22, platform default | Installed dependencies require Node `>=22` through Kysely. | Pin Node 22 LTS. | No |
| Runtime pin mechanism | `.nvmrc`, package `engines`, Docker/platform config, Volta | No pin found. | Add package `engines` plus platform/runtime pin. | No |
| Test DB execution | Any `DATABASE_URL`, guarded staging/test only | Integration auto-migrates and deletes data. | Require explicit test DB authorization flag and isolated DB. | No |
| Migration execution | Auto during tests, explicit job, manual SQL | Drizzle integration setup auto-runs migrations. | Explicit staged migration job; integration may verify after guard. | No |
| Deployment target | Vercel, Docker, other Node host | No target found. | Choose one before production hardening. | Yes |
| R2 artifact storage | Required, optional, disabled | Export generation persists artifacts to R2. | Required in staging/prod with private bucket. | No |
| Drive uploads | Required for prod, optional per environment | Drive code is implemented but external service not verified. | Enable only after staging smoke. | Yes |
| Browser E2E | None, smoke only, broad regression | No E2E framework found. | Add smoke coverage for auth/RBAC/export/admin/audit. | No |
| Security headers | App-level, edge-level, none | No global headers found. | Add app or edge headers; validate CSP separately. | No |
| Dependency audit policy | Ignore, force fix, curated update | Audit reports high/critical issues. | Curated updates with regression testing. | No |

## AD. Recommended Implementation Slices

### Slice 11B - Repository Safety and Runtime Pin

- Blast radius: low to medium.
- Work: remove `.env.local` tracking policy, document credential rotation, add Node 22 pin, add package engine policy, update `.env.example` for validated public auth URL if needed.
- Tests: `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` on Node 22.
- Dependencies: none.

### Slice 11C - Test Database Guard and Migration Readiness

- Blast radius: medium.
- Work: add explicit integration test DB authorization guard, update migration readiness assertions through `0005`, document safe integration execution.
- Tests: unit tests locally; integration only after current explicit staging DB authorization.
- Dependencies: Slice 11B recommended first.

### Slice 11D - Dependency Security Triage

- Blast radius: medium to high.
- Work: update vulnerable production dependencies deliberately, especially `next` and `better-auth`; avoid blind forced downgrades.
- Tests: full local suite and focused auth/export/admin tests.
- Dependencies: Node 22 pin.

### Slice 11E - Browser E2E Smoke

- Blast radius: medium.
- Work: add minimal browser tests for login, RBAC, stale sessions, admin users, audit viewer, export history, downloads, and Drive upload visibility.
- Tests: browser E2E against local/staging test database.
- Dependencies: test DB guard and stable seed users.

### Slice 11F - Staging External Service Verification

- Blast radius: medium.
- Work: provision staging R2 and Drive resources, run write/read/download/upload/idempotency smoke tests without production data.
- Tests: targeted external smoke and failure-mode checks.
- Dependencies: authorized staging secrets and database.

### Slice 11G - Production Release Controls

- Blast radius: medium.
- Work: CI, deployment target config, global security headers, backup/restore runbook, migration/release/rollback runbook.
- Tests: CI full validation and staging rehearsal.
- Dependencies: previous slices.

## AE. Exact Immediate Next Task

Implement **Phase 11B - Repository Safety and Runtime Pin**:

- remove `.env.local` from Git tracking policy without printing its contents;
- document and perform credential rotation outside the repository if real secrets were committed;
- pin Node 22 LTS in repository/runtime metadata;
- add a package engine policy;
- run local validation on the pinned runtime;
- do not touch database, R2, Drive, or production deployment in that slice.

Immediate next implementation verdict: start with repository/runtime safety before staging.
