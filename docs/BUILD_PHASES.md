# Build Phases

## Phase 0 — Repository Audit and Project Bootstrap Plan

Objective:
- Inspect current repository state.
- Identify framework/package manager.
- Propose minimal setup plan.
- Do not build features yet unless repo is empty and prompt explicitly asks.

Deliverable:
- Report current state.
- Recommend setup commands/files.
- List blockers.

## Phase 1 — Minimal Next.js Foundation

Objective:
- Create/confirm Next.js App Router + TypeScript project.
- Add Tailwind/shadcn-compatible structure.
- Add base layout.
- Add basic route groups for auth/dashboard.
- Add lint/typecheck scripts.

Do not:
- Build full dashboard.
- Add database schema yet unless explicitly included.
- Add fake auth.

## Phase 2 — Database and Core Schema

Objective:
- Add Drizzle ORM.
- Define initial PostgreSQL schema:
  - users
  - roles/permissions or role enum
  - shipping_notes
  - parties
  - charges
  - exports
  - audit_logs
- Add migration scripts.
- Add environment variable documentation.

Do not:
- Connect to real production DB without user-provided connection string.
- Generate destructive migrations.
- Over-normalize beyond needed business queries.

## Phase 3 — Authentication and RBAC

Objective:
- Implement login/session.
- Implement server-side role checks.
- Add permission helpers.
- Add route protection.
- Add minimal user management for admin.

Do not:
- Trust frontend-only authorization.
- Expose accounting data to sale.
- Implement complex org/multi-tenant features unless asked.

## Phase 4 — Shipping Note Form MVP

Objective:
- Build create/edit shipping note flow.
- Desktop-first form sections:
  - general info
  - parties
  - shipment details
  - selling charges
- Add server validation.
- Save draft and submit.

Do not:
- Build accounting review yet.
- Build Excel/PDF export yet.
- Hardcode fragile calculations inside UI components.

## Phase 5 — Charge Calculation Engine

Objective:
- Add reusable calculation utilities.
- Support currency/exchange rate.
- Support line item totals.
- Support selling/buying totals and net profit, with role protection.

Do not:
- Implement Vietnam tax legal assumptions without explicit confirmation.
- Scatter formulas across components.

## Phase 6 — Accounting Review

Objective:
- Accountant list/review shipping notes.
- View protected financial fields.
- Configure/override VAT/tax percentage per charge.
- Add review/check/lock statuses.
- Add accounting filters and summary totals.

Do not:
- Add complex tax filing integration.
- Claim legal tax compliance without accountant confirmation.

## Phase 7 — Excel/PDF Export

Objective:
- Generate Excel based on the real shipping note template logic.
- Generate PDF preview/export.
- Store export records in DB.
- Add export status and versioning.

Do not:
- Use Google Drive as source of truth.
- Block request path with long-running exports if implementation becomes heavy.

## Phase 8 — Google Drive Integration

Objective:
- Upload generated artifacts to Drive.
- Store file ID/link/metadata.
- Add retry/error reporting.

Do not:
- Commit credentials.
- Assume customer Google Workspace admin settings.

## Phase 9 — Audit, QA, and Hardening

Objective:
- Add comprehensive audit logging.
- Add seed/dev test data.
- Add QA scenarios for each role.
- Add permission regression tests.
- Prepare deployment checklist.

Do not:
- Add unnecessary features during hardening.

## Audited Implementation Status — 2026-07-29

This section records observed implementation status from a repository-wide audit. It does not rewrite the planned phase requirements above, and it should not be used to weaken the intended architecture, security, QA, data model, or workflow rules.

- Branch: `feature/ui-overhaul`
- Commit: `1a1b02f18fc6a8c693bb946af5fe238227ac5946`
- Working tree during audit: dirty before documentation edits; pre-existing modified app/UI files and untracked `.claude/`, `docs/audit/`, `src/components/ui/feedback.tsx`, and `src/components/ui/status-badge.tsx` were not changed by the audit.
- Most advanced implemented phase: Phase 7B generated internal PDF export.
- Most advanced verified phase: Phase 6 partial behavior is live database-verified for the current workflow through `checked`; Phase 7 internal XLSX export-data eligibility is live database-verified for checked notes.
- Current-state reference: `docs/CURRENT_IMPLEMENTATION_STATUS.md`

| Phase | Audited status | Evidence summary |
| --- | --- | --- |
| 0 - Repository audit/bootstrap | VERIFIED | Repository structure, docs, scripts, schema, migrations, and source boundaries are present. |
| 1 - Minimal Next.js foundation | VERIFIED | Next.js App Router, TypeScript strict mode, Tailwind, route groups, shell layout, `npm run typecheck`, `npm run lint`, and `npm run build` pass. |
| 2 - Database and core schema | PARTIAL | Drizzle schema and migrations exist for main tables. Separate parties and accounting periods are still missing; Phase 6C.1 adds checked/approved timestamp metadata. |
| 3 - Authentication and RBAC | PARTIAL | Better Auth, active-user session checks, role permissions, and bootstrap scripts exist; admin user-management UI and route-protection middleware are missing. |
| 4 - Shipping Note Form MVP | IMPLEMENTED - LIVE DB VERIFIED | Create/edit/list/detail/submit flows and server validation exist; hosted database workflow tests passed against PostgreSQL. |
| 5 - Charge Calculation Engine | IMPLEMENTED - UNIT AND LIVE DB VERIFIED | BigInt decimal helpers, selling/buying charge CRUD, summaries, profit calculation, and VAT amount helpers exist; pure calculations are unit-tested; hosted DB charge and financial-summary tests passed. |
| 6 - Accounting Review | PARTIAL - LIVE DB VERIFIED FOR CURRENT FLOW | `submitted -> accounting_reviewing -> checked` exists with audit writes and passed hosted DB transition tests; Phase 6B.1 added tax-rule services, charge tax assignment/override, VAT summaries, and checked tax completeness; Phase 6B.2 added `/tax-rules`, accounting charge tax controls, VAT override UI, completeness UX, and VAT summary display; Phase 6C.2 adds Admin-only `checked -> approved`; Phase 6C.3 adds Admin-only `approved -> locked` and `locked -> approved`. Cancel/reopen transitions, accounting filters, accounting periods, and browser E2E are still missing. |
| 7 - Excel/PDF Export | PARTIAL | Internal XLSX export exists with template hash pinning, export records, sanitized errors, print view, and generated internal PDF V1. |
| 8 - Google Drive Integration | PARTIAL | Phase 8A adds durable Cloudflare R2/S3-compatible artifact storage metadata and Drive upload lifecycle foundation. Google Drive API/client/upload code is still not implemented. |
| 9 - Audit, QA, and Hardening | PARTIAL | Audit writes exist for mutations and export status changes; unit/policy tests and hosted DB integration tests pass; Phase 10A added an Admin-only safe audit viewer read-model foundation; Phase 10B exposed it at `/admin/audit`. CI, browser E2E, seed/dev QA data, and deployment checklist are missing. |

Main audit conclusion: the owner's "Phase 7 or beyond" assumption is partially confirmed. The repository has implemented internal XLSX, internal print, and generated internal PDF export paths, while Google Drive upload and browser/session hardening remain incomplete.

## Phase 7A Tax-Complete Internal Export Update - 2026-08-09

Phase 7A implemented the tax-complete internal accounting export without changing the state machine, RBAC, schema, or existing `internal-v1.xlsx` template.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Internal XLSX current template: `assets/export-templates/shipping-note/internal-v2.xlsx`
- Internal XLSX current template version: `internal-v2`
- Internal XLSX current template SHA-256: `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`
- Implemented: persisted tax snapshots in the internal export read model, V2 XLSX `Tax Details` worksheet, VAT-aware internal print HTML, and focused read-model/workbook tests.
- Verification on 2026-08-09: `npm test` passed 15 files / 69 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Hosted integration status: skipped for this run because the configured database was not explicitly authorized as test/staging in the current working context.
- Still incomplete outside the Phase 7 artifact generators: full browser E2E and live Drive/R2 smoke validation remain deferred to hardening.

## Phase 7B Generated Internal PDF Export V1 - 2026-08-21

Phase 7B implemented a real server-generated internal PDF binary without replacing browser print HTML, changing XLSX V2, changing workflow statuses, or adding a database migration.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Engine: `@react-pdf/renderer` 4.6.1.
- PDF artifact contract: `exportType = pdf`, metadata version `1`, layout identifier `internal-pdf-v1`, MIME `application/pdf`.
- Unicode font strategy: local Noto Sans Regular/Bold TTF assets in `assets/fonts/noto-sans/`, licensed under SIL Open Font License 1.1.
- Data source: the existing authorized internal export read model; PDF uses persisted charge tax snapshots and does not query live `tax_rules`.
- Eligibility/RBAC: checked, approved, and locked notes are eligible for users with `SHIPPING_NOTES_EXPORT_INTERNAL`; Sale remains denied; cancelled, reopened reviewing, and exported statuses remain denied.
- UI: finalized note header exposes separate `Export XLSX`, `Export PDF`, and `Print` controls.
- Persistence/audit: PDF participates in `shipping_note_exports` pending/generated/failed lifecycle with SHA-256 checksum and `shipping_note.export.pdf.generated` / `shipping_note.export.pdf.failed` audit actions.
- Next tracing: route-specific PDF include covers only the two local font files for `/api/shipping-notes/[id]/exports/internal-pdf`.
- Deferred: Google Drive upload, pending export recovery, browser E2E, PDF logo/branding, and background worker.

## Phase 8A Durable Export Artifact Storage Foundation - 2026-08-21

Phase 8A makes newly generated internal XLSX/PDF artifacts durable after the HTTP generation request ends. It does not implement Google Drive upload.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Storage provider: Cloudflare R2 through the S3-compatible `@aws-sdk/client-s3` client.
- R2 env names: `ARTIFACT_R2_ACCOUNT_ID`, `ARTIFACT_R2_ACCESS_KEY_ID`, `ARTIFACT_R2_SECRET_ACCESS_KEY`, `ARTIFACT_R2_BUCKET_NAME`.
- Migration generated: `drizzle/0004_clean_power_man.sql`.
- Export artifact metadata added to `shipping_note_exports`: `artifact_storage_key`, `artifact_size_bytes`, and `artifact_mime_type`.
- Drive lifecycle foundation added independently from artifact generation status: `drive_upload_status`, `drive_uploaded_at`, `drive_folder_id`, and `drive_error_message`; existing `drive_file_id` and `drive_url` are preserved.
- Drive upload status values: `not_uploaded`, `uploading`, `uploaded`, `upload_failed`.
- Object key contract: `shipping-note-exports/<exportId>/artifact.xlsx` or `shipping-note-exports/<exportId>/artifact.pdf`.
- Generation invariant: new `generated` export records require generation success, SHA-256 checksum, durable storage PUT success, and persisted storage metadata. Storage failure marks the export `failed`.
- Historical export rows keep null artifact-storage metadata and are not fabricated or backfilled.
- Deferred: Google Drive adapter/upload/idempotency, export history UI, R2/DB reconciliation worker, public/presigned artifact download routes, and browser E2E.

## Phase 8B Google Drive Artifact Upload - 2026-08-22

Phase 8B uploads existing durably stored export artifacts to Google Drive without regenerating XLSX/PDF bytes and without adding export-history UI.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Google client: official `googleapis` package with service-account authentication only.
- Drive env names: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- Deprecated placeholders: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `GOOGLE_DRIVE_FOLDER_ID` are unused by Phase 8B.
- Drive scope: `https://www.googleapis.com/auth/drive.file`; official Drive docs list this scope for `files.list` and `files.create`, and Phase 8B only creates/searches app-created artifacts by private `appProperties`.
- Route added: `POST /api/shipping-note-exports/[exportId]/drive`.
- Permission: Admin-only `EXPORTS_UPLOAD`; Sale and Accountant remain denied.
- Supported durable artifacts: XLSX metadata version `2` and PDF metadata version `1` with persisted artifact storage metadata and checksum.
- Byte source: upload uses `getVerifiedArtifactBytes(...)` from private R2/S3-compatible storage and blocks checksum mismatch before any Google call.
- Idempotency: primary identity is `shipping_note_exports.id`, stored in Drive `appProperties` as `uniwaveExportId`.
- Drive lifecycle: `not_uploaded` or `upload_failed` can claim to `uploading`; `uploaded` short-circuits; active `uploading` returns conflict/in-progress.
- Reconciliation: if DB is not complete but Drive already has a matching appProperties artifact in the configured root folder, DB is reconciled to `uploaded` without duplicate creation.
- Historical policy: generated durable artifacts may be uploaded even if the owning note is later reopened to Accounting Reviewing or Cancelled; soft-deleted owning notes are denied.
- Audit actions: `shipping_note.export.drive.uploaded` and `shipping_note.export.drive.failed` on `shipping_note_export`.
- No migration was created. Migrations `0003_hard_titania.sql` and `0004_clean_power_man.sql` were not applied in this conversation.
- Deferred to Phase 8C: Drive upload UI, retry buttons, export-history panel, stale `uploading` recovery UI/worker, live Google smoke test, and browser E2E.

## Phase 8C Export History, Historical Download, Drive UI - 2026-08-23

Phase 8C exposes generated durable artifacts through a protected internal back-office UI and completes the Phase 8 user-facing workflow.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Export History panel added to Shipping Note detail for Accountant/Admin only.
- Sale cannot read export history, historical downloads, Drive URLs, or Drive controls.
- Historical download route added: `GET /api/shipping-note-exports/[exportId]/download`.
- Historical download uses `getVerifiedArtifactBytes(...)` and never regenerates XLSX/PDF.
- Supported download/upload artifact contracts remain XLSX `excel` version `2` and PDF `pdf` version `1`.
- Legacy metadata-only rows display as history but are not downloadable or Drive-uploadable.
- Historical durable artifacts remain downloadable/uploadable after Reopen to Accounting Reviewing or Cancellation; soft-deleted owning notes remain denied.
- Admin Drive controls are available in history: Upload, Retry, Recover stale upload, and View in Drive.
- Accountant can view history, download durable artifacts, see Drive status, and open uploaded Drive links; Accountant cannot mutate Drive upload state.
- Stale Drive threshold: `DRIVE_UPLOAD_STALE_AFTER_MS = 10 * 60 * 1000`.
- Stale recovery reuses the existing Drive upload endpoint, searches Drive by `uniwaveExportId` first, reconciles exact matches without duplicate creation, and only then resets/retries when no file exists.
- Generation status and Drive status remain separate; no Shipping Note `exported` transition was added.
- No migration was created. Migrations `0003_hard_titania.sql` and `0004_clean_power_man.sql` were not applied in this conversation.
- Remaining gaps: live Google/R2 smoke tests, hosted integration execution with current DB authorization, browser E2E, audit viewer, and admin user management.

## Phase 9A Admin User Management Foundation - 2026-08-23

Phase 9A establishes the application-owned Admin User Management policy, validation, protected read model, and tests without adding mutations or UI.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Architecture: application-owned Admin User Management; Better Auth Admin plugin remains disabled.
- Role model: one authoritative business role from `users.role` using `sale`, `accountant`, or `admin`; multi-role arrays and comma-separated roles remain unsupported.
- Account state model: Active is `is_active = true` and `deleted_at is null`; Inactive is `is_active = false` and `deleted_at is null`; Deleted is `deleted_at is not null`.
- Permission: Admin read foundation is protected by existing `USERS_MANAGE`; Sale and Accountant are denied.
- Hard delete policy: production hard delete is prohibited because historical actor FKs use `ON DELETE SET NULL`.
- Self-management policy: Admin cannot demote, deactivate, soft-delete, or Admin-reset their own password through Admin User Management.
- Last-admin foundation: pure helpers protect at least one active non-deleted Admin; future mutations must enforce this under serialized transaction/advisory-lock protection.
- Session revocation matrix: role change, deactivate, soft delete, Admin password reset, and manual revoke-all require target-session revocation; create and reactivate do not.
- Safe read model: Admin-only listing exposes `id`, `name`, `email`, `role`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`, derived `accountStatus`, and unexpired `activeSessionCount`.
- Filters: search by name/email, role, status `active | inactive | deleted | all`, bounded limit/offset/page pagination, deterministic `createdAt DESC, id ASC` ordering.
- Validation: focused tests passed 3 files / 20 tests; full `npm test` passed 31 files / 190 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- No migration was created. Migrations `0003_hard_titania.sql` and `0004_clean_power_man.sql` were not applied in this conversation.
- Remaining work: Phase 9B lifecycle mutations/session revocation/audit/last-admin transaction serialization; Phase 9C temporary password administration, Admin Users UI, and auth/session regression coverage.

## Phase 9B Admin User Lifecycle Mutations - 2026-08-23

Phase 9B turns the Phase 9A foundation into application-owned server-side lifecycle services without adding Admin Users UI, password reset for existing users, hard delete, email editing, Better Auth Admin plugin, or a migration.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Better Auth Admin plugin remains disabled; no `banned`, `banReason`, `banExpires`, or `impersonatedBy` fields were introduced.
- Credential creation uses Better Auth-compatible password hashing through `better-auth/crypto`, with credential account rows using `provider_id = credential`, `account_id = user.id`, and `user_id = user.id`.
- Admin-only lifecycle services are implemented for create user, role change, deactivate, reactivate, soft delete, and manual revoke-all-sessions through `USERS_MANAGE`.
- Role changes, deactivation, soft delete, and manual session revocation delete all target `sessions` rows in the same DB transaction as the user mutation and audit write.
- Automatic session revocation is recorded as `revokedSessionCount` in the parent lifecycle audit; manual revoke uses `user.sessions_revoked`.
- Last-active-admin reducing operations use one common transaction-scoped PostgreSQL advisory lock before active-admin counting and mutation.
- Self protections remain: Admin cannot self-demote, self-deactivate, self-soft-delete, self-reset password, or manually revoke their own sessions through Admin User Management.
- Soft delete preserves the `users` row, sets `is_active = false`, sets `deleted_at`, and preserves historical foreign keys.
- Audit actions added: `user.create`, `user.role_change`, `user.deactivate`, `user.reactivate`, `user.soft_delete`, and `user.sessions_revoked`.
- No migration was created. Migrations `0003_hard_titania.sql` and `0004_clean_power_man.sql` were not applied in this conversation.
- Remaining work: Phase 9C Admin Users page, create/role/state/session controls, existing-user temporary password reset, password credential update, browser/session regression tests, and final UX.

## Phase 9C Admin Users UI + Existing-User Temporary Password - 2026-08-24

Phase 9C exposes the application-owned Admin User Management workflow in the dashboard and adds Admin-managed temporary password resets for existing users.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Better Auth Admin plugin remains disabled; no `banned`, `banReason`, `banExpires`, or `impersonatedBy` fields were introduced.
- Route added: `/admin/users`, protected server-side by `USERS_MANAGE`; Sale and Accountant are denied.
- Navigation: Users link is visible only to roles with `USERS_MANAGE`.
- UI: Admin can list/search/filter/page users, create users, change roles, deactivate/reactivate, soft-delete, manually revoke sessions, and set a temporary password for another active/inactive non-deleted user.
- Deleted users are read-only in the Admin Users UI.
- Existing-user temporary password reset updates exactly one existing `provider_id = credential` account, never creates a missing credential account, revokes target sessions in the same transaction, and audits `user.password_set_by_admin` without password/hash disclosure.
- Deactivate, soft delete, temporary password reset, and manual revoke require reasons; role-change and reactivation reasons remain optional.
- Integration/session tests were extended but not executed because no current authorization was provided for the configured database as test/staging.
- No migration was created. Migrations `0003_hard_titania.sql` and `0004_clean_power_man.sql` were not applied in this conversation.
- Remaining work: live authorized integration/session run, browser E2E, audit viewer UI, CI, and deployment hardening.

## Phase 10A Admin Audit Viewer Foundation - 2026-08-24

Phase 10A adds the server-side foundation for an Admin audit viewer without adding a route, navigation item, page, or table UI.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Permission: Admin-only through existing `AUDIT_LOGS_READ`; Sale and Accountant are denied before audit data is queried.
- Safe DTO: exposes audit identity, action label/category, entity label/link, actor display, reason, formatted timestamp, `detailsAvailable`, and allowlisted `changes`; it does not expose raw top-level `before` or `after` snapshots.
- Action catalog: 34 current production audit actions are recognized with explicit presenters for Shipping Note workflow, charges, tax rules, exports, Drive upload, and Admin User Management events.
- Unknown actions: snapshots are hidden completely, `changes` is empty, and `detailsAvailable` is false.
- Sensitive-field defense: recursive sanitizer removes protected credential, token, secret, authorization, cookie, connection-string, and artifact-storage-key concepts from nested presenter output.
- Query foundation: supports action/entity/actor/date filters and keyset pagination by `created_at DESC, id DESC`; free-text search is intentionally deferred.
- Timezone policy: display formatting uses `Asia/Ho_Chi_Minh`.
- Migration generated: `drizzle/0005_perpetual_goblin_queen.sql`, an index-only migration for `audit_logs_created_at_id_idx` on `(created_at DESC, id DESC)`.
- No data migration or schema columns were added; migrations `0003_hard_titania.sql`, `0004_clean_power_man.sql`, and `0005_perpetual_goblin_queen.sql` were not applied in this conversation.
- Phase 10B later adds the protected Admin UI route, navigation, table/filter controls, and detail expansion.

## Phase 10B Admin Audit Viewer UI - 2026-08-24

Phase 10B exposes the accepted Phase 10A safe audit read model through a minimal Admin UI.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Route added: `/admin/audit`, protected server-side by `AUDIT_LOGS_READ`; Sale and Accountant receive not-found behavior before audit data is loaded.
- Navigation: Audit link is visible only to roles with `AUDIT_LOGS_READ`, which is Admin-only under current permissions.
- Filters: action, entity type, entity ID, actor ID, from date, and to date. Filter state is persisted in URL query parameters; changing filters clears any existing cursor.
- Date-only filters map to `Asia/Ho_Chi_Minh` business-day UTC boundaries before calling the Phase 10A validator/read model.
- Pagination: newest-first keyset pagination uses the opaque Phase 10A `nextCursor`; UI provides forward-only Next and relies on browser Back for prior pages.
- Table columns: Time, Actor, Action, Category, Entity, Reason, Details.
- Details: known actions render expandable allowlisted field changes only; unknown actions render no details and never expose raw snapshots.
- Security boundary: no raw JSON/source/debug affordance, no audit mutations, no CSV/export, no retention controls, and no client-side sanitizer.
- No migration was created. Migrations `0003_hard_titania.sql`, `0004_clean_power_man.sql`, and `0005_perpetual_goblin_queen.sql` were not applied in this conversation.
- Remaining gaps: browser E2E, live authorized integration/migration execution, CI, and deployment hardening.

## Phase 6C.1 Post-Checked Workflow Foundation - 2026-08-13

Phase 6C.1 added only the metadata and policy foundation for future post-checked workflow slices. It did not make approval, lock, unlock, cancellation, correction, or exported-note transitions reachable.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Migration generated: `drizzle/0003_hard_titania.sql`
- Schema fields added to `shipping_notes`: `checked_at`, `approved_at`, `locked_by_id`, `lock_reason`, `cancelled_by_id`, `cancelled_at`, `cancel_reason`.
- Existing checked transition now persists `checked_at` with `checked_by_id`.
- Permission constants were reserved for approve, lock, unlock, cancel, finalized cancel, and reopen-for-correction; only normal cancellation capability was granted to sale/accountant, while admin inherits all permissions.
- Pure status policy helpers reserve future sources for approval, locking, unlocking, cancellation, and correction, and explicitly keep `exported` outside the normal Shipping Note business workflow.
- Internal XLSX export remains eligible only for `checked` notes until Phase 6C.2.
- Historical records were not backfilled, and no workflow statuses were changed.

## Phase 11B Windows Node 24 Runtime Root Fix - 2026-08-25

Phase 11B runtime closure normalized the Windows development machine fallback runtime to the Lead-amended Node 24 LTS policy.

- Authoritative runtime: Node.js 24.x.
- Repository policy: `.nvmrc = 24`, package engines `>=24 <25`, and `.npmrc` `engine-strict=true`.
- Machine remediation: obsolete winget package `OpenJS.NodeJS.20` was removed and `OpenJS.NodeJS.LTS 24.19.0` was installed.
- FNM state: FNM remains installed with Node `v24.19.0` as default/current.
- Validation: `npm ci`, `npm ls`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` passed under Node `v24.19.0`.
- Integration/database execution remains deferred; `npm run test:integration`, `npm run test:all`, and migrations were not run.
- Credential rotation for any historically committed secrets remains a human-controlled security action.

## Phase 11C Integration Database Safety Guard - 2026-08-25

Phase 11C made integration and manual migration database mutation fail closed unless an exact target is explicitly authorized.

- Integration variables: `INTEGRATION_TEST_DATABASE_AUTHORIZED`, `INTEGRATION_TEST_DATABASE_EXPECTED_HOST`, and `INTEGRATION_TEST_DATABASE_EXPECTED_NAME`.
- Integration target policy: `INTEGRATION_TEST_DATABASE_AUTHORIZED` must equal `true`; parsed `DATABASE_URL` host and database name must exactly match the expected values; `NODE_ENV=production` is always denied.
- Guard placement: integration environment setup runs the guard before tests load; `ensureDatabaseReady()` runs the guard before Drizzle `migrate(...)`; cleanup and fixture helpers assert the same guard before destructive operations.
- Manual migration command: `npm run db:migrate` now uses a repository wrapper with separate `DATABASE_MIGRATION_*` authorization variables and fails closed by default.
- Static migration readiness covers `0003_hard_titania.sql`, `0004_clean_power_man.sql`, and `0005_perpetual_goblin_queen.sql`; no `0006` migration was created.
- Not executed: integration tests, `test:all`, `db:migrate`, Drizzle Studio, live database access, R2, and Google Drive.
- Live migration status remains `LIVE STATUS UNKNOWN / NOT VERIFIED` for `0003`, `0004`, and `0005`; Phase 11C itself did not apply any migrations.

## Phase 11D Dependency Vulnerability Triage - 2026-08-26

Phase 11D performed non-mutating npm audit triage, applied the smallest safe compatible dependency updates, and left major/risky remediation decisions explicit.

- Updated runtime/build dependencies: `next` from `16.2.9` to `16.3.3`, `@tailwindcss/postcss` to `^4.3.3`, and `tailwindcss` to `^4.3.3`.
- Applied non-force lockfile remediation for safe transitive findings, including patched `postcss`, `nanoid`, `js-yaml`, and `brace-expansion` versions where existing ranges allowed it.
- Rejected unsafe remediation suggestions: `exceljs` downgrade to `3.4.0`, `drizzle-kit` downgrade to `0.18.1`, and unapproved Vitest `2.x -> 4.x` major upgrade.
- Phase 11D.1 supersedes the initial Better Auth/Vitest follow-up: Vitest was moved to patched `3.2.7`, and the Better Auth advisory was reclassified against actual repository auth configuration.
- Validation after remediation: `npm ci`, `npm ls`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` passed under Node `v24.19.0`.
- Not executed: integration tests, `test:all`, `db:migrate`, Drizzle Studio, live database access, R2, Google Drive, credential rotation, and any new migration.
- Phase 11D verdict: accepted with Phase 11D.1 follow-up.

## Phase 11D.1 Residual Dependency Security Closure - 2026-08-26

Phase 11D.1 resolved the remaining Vitest exposure and conclusively classified residual dependency findings before browser E2E/CI hardening.

- Updated `vitest` from `^2.1.9` to `^3.2.7`, which also moved the active Vite test-tooling path to `vite@7.3.6` and cleared the prior Vitest/Vite server advisory from the audit results.
- Confirmed repository Vitest usage is `vitest run`/local watch only; no Vitest UI, Browser Mode, API host, or externally bound test server configuration is present.
- Re-inspected Better Auth configuration and found email/password only. No magic-link plugin, email-OTP plugin, passwordless email login, or equivalent affected flow is configured, so GHSA-qq9h-g4jm-xgf3 is classified as non-applicable under current configuration.
- Attempted normal npm upgrades to `better-auth@1.6.30` and `better-auth@1.6.22`; both were blocked by npm peer resolution through Better Auth's optional SvelteKit peer path selecting `@sveltejs/vite-plugin-svelte@7.3.0`, which requires Vite 8 while the validated test toolchain uses Vite 7. No `--force` or `--legacy-peer-deps` bypass was used.
- Final audit result remains 7 raw findings in both `npm audit` and `npm audit --omit=dev`: 1 high and 6 moderate. No reachable production High/Critical finding remains under current repository configuration.
- Residual moderate findings are documented as Drizzle Kit migration-tooling risk and ExcelJS transitive UUID risk; neither was resolved by unsafe downgrade.
- Validation passed under Node `v24.19.0`: `npm ci`, `npm ls`, `npm ls --omit=dev`, `npm test` (48 files / 275 tests), `npm run typecheck`, `npm run lint`, and `npm run build`.
- Not executed: integration tests, `test:all`, `db:migrate`, Drizzle Studio, live database access, R2, Google Drive, credential rotation, dependency force installs, and any new migration.

## Phase 11E Browser E2E Foundation - 2026-08-26

Phase 11E adds Playwright Chromium browser testing for DB-free public/auth-boundary behavior without introducing an auth bypass or authenticated browser workflows.

- Added dev dependency: `@playwright/test@1.62.1`.
- Browser runtime: Playwright Chromium installed through `npx playwright install chromium`.
- Scripts: `npm run test:e2e` and `npm run test:e2e:headed`; `test:integration` and `test:all` were not changed.
- E2E runner: `scripts/run-browser-e2e.mjs` builds and starts Next with explicit browser-E2E env values for `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_AUTH_URL`, R2 variables, and Google Drive variables, then stops the server after tests.
- Test directory: `tests/e2e`.
- Browser tests cover `/login`, password visibility, browser-native required-field validation without auth submission, inert external callback parameters, and unauthenticated redirects for `/dashboard`, `/shipping-notes`, `/admin/users`, and `/admin/audit`.
- Authenticated browser flows remain deferred until a current isolated test/staging database is explicitly authorized.
- Validation: `npm run test:e2e` passed 1 file / 8 tests in Chromium; `npm ci`, `npm ls`, `npm test` (48 files / 275 tests), `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Dependency audit after Playwright remained unchanged from the Phase 11D.1 accepted baseline: 7 total findings, 0 critical, 1 high, 6 moderate, with no new reachable production High/Critical issue.
- Not executed: integration tests, `test:all`, `db:migrate`, Drizzle Studio, live database access, R2, Google Drive, credential rotation, auth bypass, production credentials, and any new migration.

## Phase 11F CI Quality Gates - 2026-08-26

Phase 11F adds a validation-only GitHub Actions workflow for safe automated quality gates without database, external-service, or deployment access.

- Workflow: `.github/workflows/quality-gates.yml`.
- Triggers: pull requests and pushes to `main`, `master`, `develop`, and `feature/ui-overhaul`.
- Permissions: `contents: read`; no write, deployment, package publishing, OIDC, or secret access is required.
- Runtime: `actions/setup-node@v4` pins Node `24`, verifies the active major, and confirms npm `engine-strict=true`.
- CI commands: `npm ci`, `npm ls`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npx playwright install --with-deps chromium`, `npm run test:e2e`, and `npm run ci:security-audit`.
- Browser diagnostics: `playwright-report/` and `test-results/` upload on failure only.
- Security audit gate: `scripts/ci-security-audit.mjs` runs both npm audit modes, fails on count regression or unwaived High/Critical findings, and preserves the accepted Better Auth waiver only while passwordless email auth remains disabled.
- Better Auth guardrail: `src/lib/auth/better-auth-security-policy.*` and focused unit tests protect the configuration-dependent waiver.
- Local validation passed under Node `v24.19.0`: `npm ci`, `npm ls`, `npm test` (49 files / 277 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (8 tests), and `npm run ci:security-audit`.
- GitHub-hosted CI was not executed locally; it will run after the workflow is pushed.
- Not executed: integration tests, `test:all`, `db:migrate`, Drizzle Studio, live database access, R2, Google Drive, credential rotation, deployment, external provisioning, auth bypass, and any new migration.

## Phase 11G Security Headers and Deployment Contract - 2026-09-02

Phase 11G establishes the production-facing security-header baseline and deployment/runtime contract without deploying or provisioning infrastructure.

- Required runtime: Node.js runtime, not Edge, because the app uses Better Auth with Drizzle/Neon, server-side PostgreSQL access, AWS S3-compatible R2 storage, Google Drive APIs, filesystem-traced XLSX/PDF assets, and server PDF/XLSX generation.
- Deployment target recommendation: a Node 24-compatible Next.js 16 platform or container runtime that supports server-side DB, R2, Drive, and document generation. No provider resource was created.
- Next.js hardening: `poweredByHeader: false` and global baseline headers for `nosniff`, referrer policy, permissions policy, frame protection, COOP, CORP, and a staged CSP enforcing `frame-ancestors`, `base-uri`, `form-action`, and `object-src`.
- HSTS is not emitted by local application config because this repository has no committed HTTPS production domain/provider contract yet. HSTS must be verified/enabled at the HTTPS deployment layer before production release.
- Sensitive route families receive `private, no-store, max-age=0` and `Pragma: no-cache` through Next.js headers; export/download routes also retain their route-level no-store/download headers.
- Public env boundary: `.env.example` documents only `NEXT_PUBLIC_AUTH_URL` as browser-exposed. Server secrets such as `DATABASE_URL`, `AUTH_SECRET`, R2 secrets, Google service-account JSON, and integration/migration authorization variables remain server-only.
- Security tests: static Next.js config tests and env-name boundary tests were added; Playwright now verifies headers on the DB-free `/login` route.
- GitHub-hosted CI execution remains `PENDING — NOT EXECUTED`; local validation does not prove GitHub-hosted workflow success.
- Remaining hardening checkpoints: `11H` authorized staging DB migration/integration verification, `11I` authenticated staging browser E2E, `11J` R2/Google Drive staging verification, and `11K` backup/recovery plus production release gate.
- Not executed: integration tests, `test:all`, `db:migrate`, Drizzle Studio, live database access, R2, Google Drive, deployment, DNS changes, infrastructure provisioning, credential rotation, auth bypass, and any new migration.

## Phase 11H Production DB Migration and Integration Verification - 2026-09-02

Phase 11H executed the owner-authorized production database migration path through the Phase 11C guarded wrapper, then ran the guarded production integration suite.

- Secret safety: `.env.example` contained a live-looking Neon `DATABASE_URL`; it was replaced with a non-secret placeholder without printing the original value. Production DB credential rotation remains required as a human security follow-up.
- Guard update: production database migration/integration remains denied by default and now additionally requires `DATABASE_MIGRATION_PRODUCTION_AUTHORIZED=true` or `INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED=true` when `NODE_ENV=production`.
- Production target descriptor verified without credentials: host `ep-falling-sky-az05o2cl-pooler.c-3.ap-southeast-1.aws.neon.tech`, port default, database `neondb`, SSL mode present.
- Live state before migration: no Drizzle journal and no application tables existed.
- Migration execution: `npm run db:migrate` applied `0000_new_nick_fury` through `0005_perpetual_goblin_queen`; post-migration read-only checks verified journal rows, expected workflow/export columns, foreign keys, enum, and indexes.
- Integration isolation: fixture rows are run-id namespaced and cleanup deletes only current-run records; post-run verification showed all application tables returned to zero rows.
- Integration result: `npm run test:integration` was executed twice under explicit production authorization and failed both times: 7 files passed, 2 files failed, 51 tests passed, 1 failed. Failures were an AWS SDK extensionless ESM import in `accounting-export-audit.integration.test.ts` and an admin duplicate-email error-code mismatch.
- DB-free validation passed: `npm ci`, `npm ls`, `npm test` (50 files / 286 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (9 Chromium tests), and `npm run ci:security-audit`.
- Phase 11H verdict: blocked by integration regression; no migration `0006`, R2 call, Google Drive call, deployment, DNS change, or credential rotation was performed.

## Phase 11H.1 Production Integration Regression Closure - 2026-09-03

Phase 11H.1 resolved the production integration regressions without repeating migration work.

- Cleanup: the previously orphaned `shipping_note.lock` audit row was removed under exact Lead authorization. The later `it-acc-20260902-225608-34ef` fixture namespace was rechecked and already had zero rows, so no namespace deletion was performed.
- AWS/Vitest fix: integration tests no longer run with global `react-server` conditions; `server-only` is mapped to a no-op integration module, and the AWS SDK path resolves through the Node-compatible entry.
- Admin duplicate email fix: wrapped PostgreSQL `23505` unique violations now map deterministically to `USER_DUPLICATE_EMAIL`.
- Admin concurrency fix: last-active-admin protection now locks active Admin rows instead of relying on ineffective advisory lock behavior.
- DEP0190 fix: guarded migration now launches Drizzle Kit through `process.execPath` and the resolved `drizzle-kit/bin.cjs` path without `shell: true`.
- Production integration result: `npm run test:integration` passed 9 files / 95 tests under exact production authorization. Post-run verification found zero fixture rows and confirmed migrations `0000` through `0005` remain applied and schema-consistent.
- Security audit follow-up: a newly reported transitive `qs` advisory through `googleapis-common` was remediated by lockfile-only resolution to `qs@6.16.0`; `npm run ci:security-audit` returned to the accepted 7-vulnerability baseline.
- Validation passed: `npm ci`, `npm ls`, `npm test` (50 files / 287 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (9 Chromium tests), and `npm run ci:security-audit`.
- Remaining gates: production database credential rotation, GitHub-hosted CI evidence, authenticated browser E2E, and live R2/Google Drive verification remain open.

## Phase 11I Authenticated Browser E2E and RBAC Workflow Verification - 2026-09-03

Phase 11I added a production-authorized authenticated Playwright suite that uses real Better Auth email/password login without a test auth bypass.

- Script: `npm run test:e2e:auth` runs a separate Chromium suite from `tests/e2e-auth`; `npm run test:e2e:auth:headed` is available for local diagnosis. The suite is intentionally not part of normal CI.
- Fixture safety: the runner creates a unique `E2E11I-*` namespace, seeds only fixture users/accounts and prerequisite Shipping Note data, creates browser sessions only through the real login UI/API, and runs scoped cleanup in `finally`.
- Browser coverage: Sale login/session/logout, Sale create/edit/submit draft, Sale/Admin route denial, Accountant accounting review start and Mark Checked, Admin `/admin/users`, Admin `/admin/audit`, Admin approval/lock, Admin unlock with reason, export-control visibility for locked notes, session persistence, cookie attributes, and authenticated `Cache-Control`.
- Production cleanup: after the passing run, read-only verification found zero fixture rows in `users`, `accounts`, `sessions`, `verifications`, `shipping_notes`, `shipping_note_charges`, `shipping_note_exports`, `audit_logs`, and `tax_rules`.
- Migration integrity: read-only verification confirmed `0000_new_nick_fury` through `0005_perpetual_goblin_queen` remain applied and schema-consistent; no migration was rerun or created.
- Validation passed: `npm ci`, `npm ls`, `npm test` (50 files / 287 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (9 Chromium tests), `npm run test:e2e:auth` (1 file / 3 Chromium tests), and `npm run ci:security-audit`.
- Not executed: migrations, `test:integration`, `test:all`, R2, Google Drive, deployment, DNS changes, credential rotation, auth bypass, and migration `0006`.
- Remaining gates: production database credential rotation, GitHub-hosted CI evidence, and live R2/Google Drive verification remain open.

## Phase 11J Live R2 and Google Drive Artifact Verification - 2026-09-03

Phase 11J added a narrow live-artifact verification harness but live verification is blocked by missing required R2 and Google Drive service-account configuration in the current environment.

- Script: `npm run verify:live-artifacts` runs the existing R2 durable artifact, historical download, Drive upload, reconciliation, idempotency, and cleanup paths with explicit live authorization.
- Required authorization: existing exact production/staging database target guards plus `LIVE_ARTIFACT_VERIFICATION_AUTHORIZED="true"`.
- Required live configuration was not present after loading local environment files: `ARTIFACT_R2_ACCOUNT_ID`, `ARTIFACT_R2_ACCESS_KEY_ID`, `ARTIFACT_R2_SECRET_ACCESS_KEY`, `ARTIFACT_R2_BUCKET_NAME`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- Deprecated OAuth-shaped Google variables were present, but the implemented Drive integration requires service-account configuration.
- The attempted live verification stopped before fixture creation, R2 upload, Drive upload, or DB mutation.
- Read-only production DB verification before and after the blocked attempt confirmed migrations `0000` through `0005` remain applied, no extra migration rows exist, schema checks are consistent, and fixture residue is zero.
- Validation passed: `npm ci`, `npm ls`, `npm test` (50 files / 287 tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (9 Chromium tests), and `npm run ci:security-audit`.
- Remaining gates: provide live R2 and Google Drive service-account configuration, rerun Phase 11J, production database credential rotation, GitHub-hosted CI evidence, and HTTPS secure-cookie verification.

## Phase 6C.2 Approval Transition + Export Compatibility - 2026-08-14

Phase 6C.2 made approval operational without adding lock, unlock, cancellation, correction, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Workflow added: `checked -> approved`.
- Approval actor: Admin only through `SHIPPING_NOTES_APPROVE`.
- Same-checker policy: the same Admin may check and approve; no four-eyes rule or approval reason is required.
- Approval persistence: `approved_by_id`, `approved_at`, and `updated_at` are written in a guarded transaction.
- Audit action: `shipping_note.approve`.
- Internal XLSX and internal print eligibility is now `checked | approved`; `locked`, `cancelled`, and `exported` remain non-eligible in this phase.
- Phase 7A artifact metadata is unchanged: template version `internal-v2`, metadata version `2`, SHA-256 `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.3 Lock / Unlock + Locked Export Compatibility - 2026-08-14

Phase 6C.3 made the final business lock state operational without adding cancellation, correction reopen, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Workflow added: `approved -> locked` and privileged `locked -> approved`.
- Corrected lock source policy: only `approved` can lock; `checked -> locked` is denied to avoid implicit approval on unlock.
- Lock actor: Admin only through `SHIPPING_NOTES_LOCK`.
- Unlock actor: Admin only through `SHIPPING_NOTES_UNLOCK`.
- Lock reason: optional; blank reason is stored as `null`.
- Unlock reason: mandatory and stored on the `shipping_note.unlock` audit event.
- Locked business data remains immutable through existing normal mutation guards.
- Internal XLSX and internal print eligibility is now `checked | approved | locked`; `exported` and `cancelled` remain non-exportable.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.4 Shipping Note Cancellation - 2026-08-14

Phase 6C.4 made the `cancelled` business state operational without adding correction reopen, restoration, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Normal cancellation sources: `draft`, `submitted`, and `accounting_reviewing`.
- Finalized cancellation sources: `checked` and `approved`.
- Role policy: Sale may cancel only their own Draft with an optional reason; Accountant may cancel Submitted or Accounting Reviewing with a mandatory reason; Admin may cancel Draft, Submitted, Accounting Reviewing, Checked, or Approved with a mandatory reason.
- Locked cancellation is denied directly; Admin must unlock to Approved first, then use finalized cancellation.
- Cancellation is not soft delete: `deleted_at` remains null, charges/tax/check/approval metadata and historical export records are preserved.
- New internal XLSX and internal print exports remain denied for Cancelled notes; historical export records are not modified.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.5 Reopen for Accounting Correction - 2026-08-14

Phase 6C.5 made explicit accounting correction operational without adding commercial Draft reopen, direct Locked reopen, cancellation restoration, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Reopen sources: `checked` and `approved`.
- Reopen target: `accounting_reviewing`.
- Actor: Admin only through `SHIPPING_NOTES_REOPEN_FOR_CORRECTION`.
- Reason: mandatory, trimmed, and stored on the `shipping_note.reopen_for_correction` audit event.
- Current finalization metadata is cleared on reopen: `checked_by_id`, `checked_at`, `approved_by_id`, and `approved_at`.
- Accounting correction scope: buying charges and tax/VAT can again mutate through existing Accounting Reviewing policies; Shipping Note core fields and selling charges remain Draft-only.
- Historical exports remain unchanged. New internal XLSX and internal print exports are denied while reopened to Accounting Reviewing, and become available again after the existing Mark Checked flow succeeds.
- Locked and Cancelled notes cannot reopen directly; Locked requires Unlock to Approved first, and Cancelled remains terminal.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.

## Phase 11K Backup, Recovery, and Final Release Gate - 2026-09-05

Phase 11K establishes the final release-readiness gate without marking unresolved owner/provider work complete.

- Phase 11J status is `DEFERRED BY OWNER — CUSTOMER LIVE SERVICE CONFIGURATION PENDING`; live R2 and Google Drive verification still must run before production go-live.
- Production DB integrity was rechecked read-only: migrations `0000` through `0005` remain applied, no extra migration rows were found, expected schema checks remain consistent, and integration/auth fixture residue was zero.
- Recovery assessment: Neon publicly documents point-in-time restore/branch restore capabilities, but project-specific provider recovery was not verified from this environment.
- Logical backup assessment: local PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`) were not available, so no logical backup or restore drill was executed in Phase 11K.
- Release runbooks were added for pre-go-live, backup/recovery, rollback, and post-deployment smoke verification.
- Required go-live gates remain open: live R2/Drive verification, production database credential rotation, GitHub-hosted CI evidence, real HTTPS/proxy/secure-cookie verification, and an executed/restored backup checkpoint.

## Phase 11K.1 Backup and Restore Drill Closure - 2026-09-05

Phase 11K.1 closed the narrow backup/recovery patch from lead review.

- PostgreSQL client tooling was located at `C:\Program Files\PostgreSQL\18\bin`; `pg_dump`, `pg_restore`, and `psql` are version `18.3`.
- Production server compatibility was verified read-only as PostgreSQL `18.6`.
- A custom-format logical production backup was created outside the repository, structurally validated with `pg_restore --list`, restored into a disposable local PostgreSQL 18 cluster, verified for Drizzle journal/schema objects, and then removed.
- The disposable restore target and temporary dump were deleted after verification; no backup artifact was committed or left in the repository.
- Provider recovery remains `DOCUMENTATION ONLY`; the logical backup and restore drill are verified, but Neon project-level PITR/branch restore was not inspected through provider credentials.
- Engineering status moved to `ENGINEERING COMPLETE — RELEASE CANDIDATE`; production go-live remains blocked by Phase 11J, credential rotation, GitHub-hosted CI evidence, and real HTTPS/cookie/proxy verification.
