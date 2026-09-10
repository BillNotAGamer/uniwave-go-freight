# QA Checklist

## General

- Node.js 24.x is selected before installing dependencies, running validation, or deploying.
- App builds successfully.
- TypeScript passes.
- Lint passes.
- Automated unit/policy tests pass with `npm test`.
- No secrets committed.
- `.env.local` remains ignored and untracked; `.env.example` is present and safe.
- No unused large dependencies added.
- No placeholder production credentials.
- Any credentials that were ever committed in a real env file have been reviewed and rotated outside the repository.
- Production deployment must use Node.js runtime on Node 24 (`>=24 <25`), not Edge runtime.
- Application security headers include `X-Content-Type-Options: nosniff`, a strict referrer policy, permissions restrictions, frame protection, COOP/CORP, powered-by suppression, and the staged CSP baseline.
- HSTS must be verified at the HTTPS deployment layer before production release; local HTTP validation intentionally does not emit or assert HSTS.
- Server secrets remain unprefixed and server-only. Only `NEXT_PUBLIC_AUTH_URL` is currently approved as a browser-exposed environment variable.

## Automated Validation

- Run `npm audit` and `npm audit --omit=dev` during dependency-security hardening and classify remaining findings by production reachability, dev-only reachability, and required remediation risk.
- Phase 11D.1 closure: Vitest is on patched `3.2.7`; the Better Auth GHSA-qq9h-g4jm-xgf3 advisory is non-applicable under current email/password-only configuration because no magic-link, email-OTP, or passwordless email login flow is configured.
- Before enabling magic-link, email-OTP, or any passwordless email auth flow, re-evaluate Better Auth version exposure and upgrade to a patched compatible release without `--force` or `--legacy-peer-deps`.
- Do not use `npm audit fix --force` as a release shortcut; dependency downgrades such as Drizzle Kit/ExcelJS or major tooling/runtime changes require explicit lead review.
- Run `npm test` for repository-owned pure unit and policy tests.
- Run `npm run test:e2e` for the DB-free Playwright Chromium browser suite covering public login and unauthenticated protected-route boundaries.
- Run `npm run test:e2e:auth` only when the current production/staging database target is explicitly authorized with exact host/name guards and production integration authorization. This suite performs scoped fixture mutation and is not part of normal CI.
- The DB-free Playwright suite verifies the `/login` security headers and confirms local HTTP does not receive HSTS.
- Run `npm run ci:security-audit` to enforce the accepted npm audit baseline and configuration-bound Better Auth waiver.
- Run `npm run test:e2e:headed` only for local browser diagnosis.
- Treat `npm test` as coverage for deterministic helpers only: permissions, decimal/money calculations, summaries, validation schemas, current status predicates, and selected export safeguards.
- Phase 7A automated export coverage includes persisted tax snapshot read-model tests and exact XLSX V2 `Tax Details` worksheet cell assertions.
- Run `npm run test:integration` only when `DATABASE_URL` points to an explicitly authorized hosted database and the integration safety variables exactly match the target host and database name. Production targets additionally require `INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED="true"`.
- Run `npm run test:all` before release candidates.
- Do not run integration tests or migrations unless the exact current database target is authorized. Unauthorized integration and migration commands must fail, not skip.
- Phase 11I authenticated browser coverage verifies successful real login, session persistence, logout, role-backed navigation, RBAC direct-route denial, selected Admin pages, Audit Viewer access, and the core Shipping Note workflow through lock/unlock using isolated fixture data.
- Continue using this checklist for manual QA of full application workflows.
- Hosted database integration currently verifies production query/mutation RBAC, row filtering, migrations, audit persistence, financial summaries, and current accounting/export eligibility paths covered by `tests/integration/**`.
- Phase 11H.1 production integration verification passed after resolving the AWS/Vitest module-resolution regression, admin duplicate-email error mapping, active-admin concurrency serialization, and the guarded migration wrapper warning. The full guarded production `npm run test:integration` suite passed 9 files / 95 tests, followed by zero fixture residue verification.
- Authenticated browser E2E now covers selected UI workflows, form submissions, redirects, and session behavior. Authenticated export/download bytes and live Drive/R2 behavior remain deferred.
- GitHub Actions `Quality Gates` must stay validation-only until staging/deployment hardening is explicitly authorized; it must not receive database, R2, Drive, or deployment secrets.
- GitHub-hosted CI execution remains a release gate until an actual GitHub Actions run is observed; local validation is not equivalent evidence.
- Phase 11K final release gate must not mark production ready while any mandatory owner/provider gate remains pending.
- Before production go-live, complete Phase 11J live artifact verification with customer-supplied R2 and Google Drive service-account configuration.
- Before production go-live, rotate the production database credential because a live-looking Neon URL was previously found in tracked `.env.example`.
- Before production go-live, verify an actual GitHub-hosted `Quality Gates` run on the release commit.
- Before production go-live, verify HTTPS, proxy host/origin handling, HSTS, and Secure/HttpOnly/SameSite session cookie behavior on the deployed origin.
- Phase 11K.1 verified the logical backup and disposable restore-drill procedure. Before production go-live, create a fresh release-time backup/recovery checkpoint and retain it according to the operator's secure backup policy.

## Database Integration

- Automated: committed migrations apply successfully.
- Automated: core auth, shipping note, charge, export, audit, and tax-rule tables exist.
- Automated: Sale ownership filtering is enforced by production queries.
- Automated: Accountant/admin access to permitted shipping notes, buying charges, and financial summaries is enforced.
- Automated: Sale access to buying charges and financial summaries is denied.
- Automated: draft create/update/submit mutations enforce role, owner, and status rules.
- Automated: Selling and buying charge mutations enforce role and status rules.
- Automated: soft-deleted shipping notes and charges are filtered from active reads and summaries.
- Automated: persisted financial summaries use exact stored numeric strings.
- Automated: current accounting transitions are `draft -> submitted -> accounting_reviewing -> checked -> approved -> locked`, with privileged unlock back to `approved`.
- Automated: new checked transitions persist `checked_at` with `checked_by_id`; cancel/reopen transitions are still not implemented.
- Automated: approval is Admin-only, does not require a separate checker, and persists `approved_at` with `approved_by_id`.
- Automated: locking is Admin-only from Approved, checked notes cannot lock, lock reason is optional, and unlock is Admin-only with mandatory reason.
- Automated: cancellation is contextual by source status and role: Sale-own Draft only, Accountant/Admin Submitted or Accounting Reviewing, and Admin-only Checked or Approved.
- Automated: cancellation reason is optional only for Sale-own Draft and mandatory for Admin Draft, Submitted, Accounting Reviewing, Checked, and Approved.
- Automated: Locked notes cannot be cancelled directly, and Cancelled notes remain terminal/read-only.
- Automated: Admin-only correction reopen is limited to Checked or Approved notes and returns them to Accounting Reviewing with mandatory reason.
- Automated: Reopen clears current Checked/Approved metadata while preserving submitted history, charges, tax data, audits, and export records.
- Automated: checked transition requires every active charge to have complete tax snapshots.
- Automated: tax-rule create/deactivate, charge tax assignment, taxable VAT override, sale denial, checked immutability, and tax summaries are covered by hosted integration tests.
- Automated: tax UI policy helpers cover sale denial, accountant/admin capabilities, status-specific controls, labels, override badges, completeness messaging, and Mark Checked disabled reasons.
- Automated: Internal XLSX/PDF export data is limited to checked, approved, or locked notes and authorized roles.
- Automated: audit rows persist for successful business mutations.
- Automated: denied operations do not create false success audit rows.
- Automated: integration cleanup removes only records owned by the current test run ID.
- Automated in Phase 11H: production migrations through `0005` were applied through the guarded migration wrapper and post-run cleanup verification returned all application tables to zero rows.
- Not automated: authenticated export/download bytes, live Drive/R2 behavior, stale-session invalidation after role/state/password changes, and full binary XLSX cell inspection through a browser.

## RBAC

Test as sale:
- Can create shipping note.
- Can edit own draft.
- Cannot access accounting pages.
- Cannot see buying rate.
- Cannot see net profit.
- Cannot read tax rules, tax summaries, tax overrides, or charge tax assignment services.
- Does not see Tax Rules navigation.
- Direct `/tax-rules` access is denied server-side.
- Does not see tax columns, VAT summaries, unclassified buying counts, assignment controls, or override controls.
- Cannot manage users.
- Cannot access `/admin/users`.
- Cannot approve checked notes.
- Cannot access internal export for checked or approved notes.
- Cannot lock or unlock notes.
- Can cancel only own Draft notes with optional reason.
- Cannot cancel Submitted, Accounting Reviewing, Checked, Approved, Locked, or another Sale user's Draft.
- Cannot reopen finalized notes for correction.
- Cannot upload generated export artifacts to Google Drive.
- Cannot query Admin User Management read models protected by `USERS_MANAGE`.
- Cannot call Admin User Management actions, including existing-user temporary password reset.

Test as accountant:
- Can view shipping notes.
- Can access accounting review.
- Can view buying/profit/tax fields.
- Can assign charge tax rules and override taxable VAT in submitted/accounting_reviewing status with a reason.
- Can open `/tax-rules` read-only and sees active rules only.
- Can see tax completeness on shipping note detail.
- Cannot assign or override tax on draft or checked notes.
- Cannot override zero-rated or non-taxable charges.
- Cannot create shipping note unless explicitly allowed.
- Cannot approve checked notes.
- Cannot lock or unlock notes.
- Can cancel Submitted or Accounting Reviewing notes with a mandatory reason.
- Cannot cancel Draft, Checked, Approved, Locked, or Cancelled notes.
- Cannot reopen Checked or Approved notes for correction.
- Can export checked, approved, or locked notes through internal export.
- Cannot upload generated export artifacts to Google Drive.
- Cannot manage tax rules.
- Cannot manage users.
- Cannot access `/admin/users`.
- Cannot query Admin User Management read models protected by `USERS_MANAGE`.
- Cannot call Admin User Management actions, including existing-user temporary password reset.

Test as admin:
- Can access all areas.
- Can manage users.
- Admin actions are audited.
- Can approve checked notes without a separate approver.
- Can lock approved notes with optional reason.
- Can unlock locked notes with mandatory reason and explicit confirmation.
- Can cancel Draft, Submitted, Accounting Reviewing, Checked, or Approved notes with a mandatory reason.
- Cannot cancel Locked directly; unlock to Approved first, then cancel.
- Can reopen Checked or Approved notes to Accounting Reviewing with a mandatory reason.
- Cannot reopen Locked directly; unlock to Approved first, then reopen.
- Cannot reopen Cancelled notes.
- Can export checked, approved, or locked notes through internal export.
- Can upload generated durable XLSX/PDF export artifacts to Google Drive through `EXPORTS_UPLOAD`.
- Can query the safe Admin User Management read model through `USERS_MANAGE`.
- Can access `/admin/users` and sees the Users navigation link.
- Can create internal users with temporary credentials.
- Can change a non-deleted user's role.
- Can deactivate and reactivate users.
- Can soft-delete users while preserving the user row.
- Can manually revoke all sessions for another active or inactive non-deleted user.
- Can set a temporary password for another active or inactive non-deleted user with a mandatory reason and confirmation.
- Cannot hard-delete users through production Admin User Management.
- Cannot demote, deactivate, soft-delete, manually revoke sessions for, or Admin-reset their own password through Admin User Management.
- Cannot remove the last active non-deleted Admin.
- Can create, edit, and deactivate tax rules.
- Deactivated rules remain visible to admin and disappear from new assignment options.
- Cannot edit checked tax data in Phase 6B.2.

## Admin User Management

- Phase 9A/9B/9C use application-owned Admin User Management; Better Auth Admin plugin remains disabled.
- Role model is single-role only: `sale`, `accountant`, or `admin`.
- Multi-role arrays and comma-separated roles are rejected.
- Account status derives from `isActive` and `deletedAt`: active, inactive, or deleted.
- Active users may authenticate/access according to role.
- Inactive users are denied login/access through existing auth/session helpers.
- Soft-deleted users are denied login/access through existing auth/session helpers.
- Production hard delete is prohibited because historical actor references must be preserved.
- Admin user list DTO exposes only safe fields: ID, name, email, role, active/deleted state, timestamps, derived status, and active session count.
- Admin user list DTO must not expose password hashes, session tokens, access tokens, refresh tokens, account secrets, raw audit JSON, artifact storage keys, or Google/R2 credentials.
- Admin user list supports search, role filter, status filter, bounded pagination, and deterministic ordering.
- `/admin/users` is server-protected by `USERS_MANAGE`; Sale and Accountant must be denied.
- Users navigation is visible only to roles with `USERS_MANAGE`.
- Admin Users UI lists safe user fields and exposes actions only for policy-allowed rows.
- Deleted users are read-only in the Admin Users UI.
- Role-change reason is optional and blank reasons normalize to null.
- Deactivate, soft delete, Admin temporary password reset, and manual revoke-all-sessions require a reason.
- Create-user stores a Better Auth-compatible credential account and must not create a login session.
- Existing-user Admin temporary password reset updates exactly one existing `provider_id = credential` account, must not create a missing credential account, revokes target sessions in the same transaction, and writes `user.password_set_by_admin`.
- Admin temporary password reset must not expose the temporary password or password hash in audit rows, UI messages, or logs.
- Temporary password reset requires explicit confirmation in the UI.
- Duplicate normalized email must return a safe domain error.
- Role change, deactivate, soft delete, manual revoke-all-sessions, and existing-user temporary password reset revoke all target sessions in the same transaction as mutation/audit.
- Automatic session revocation is recorded in parent lifecycle audit metadata; manual revoke writes `user.sessions_revoked`.
- Reactivate does not restore or create sessions.
- Last-active-admin reducing operations use a shared transaction-scoped advisory lock before counting/mutation.
- Phase 9C still does not include email editing, hard delete, soft-delete restore, impersonation, individual-session UI, audit viewer, Better Auth Admin plugin, or browser E2E.
- Hosted integration/session regression tests require current explicit database authorization before execution.

## Shipping Note Form

- Required fields validate.
- Shipping mode options are correct.
- Volume unit options are correct.
- Exchange rate is captured.
- Charge lines calculate correctly.
- Draft save works.
- Submit changes status correctly.

## Accounting

- Protected fields only visible to permitted roles.
- VAT/tax override requires permission.
- VAT/tax override requires a non-empty reason and is blocked after checked.
- Checked requires every active selling and buying charge to be tax-complete.
- UI disables Mark Checked when loaded tax completeness is incomplete.
- Existing server mutation still rejects stale incomplete checked attempts.
- Review/approved status prevents unauthorized edits.
- Admin can approve checked notes from the accounting/finalization area.
- Admin can lock approved notes and unlock locked notes from the accounting/finalization area.
- Cancellation actions are available only for allowed role/status combinations.
- Cancelled notes are terminal, remain historically visible, and are not soft-deleted.
- Correction reopen is available only to Admin on Checked or Approved notes.
- Reopened notes allow buying charge and tax/VAT accounting correction through existing Accounting Reviewing controls.
- Reopened notes do not allow core Shipping Note or selling charge editing.
- Totals match stored line items.

## Export

- Export is generated from stored data.
- Internal XLSX export uses template version `internal-v2` and the pinned template hash.
- Internal PDF export uses metadata version `1`, layout identifier `internal-pdf-v1`, MIME `application/pdf`, and local Noto Sans Regular/Bold TTF assets.
- Internal XLSX, internal PDF, and internal print are available for checked, approved, and locked notes only.
- Cancelled notes are not eligible for new internal XLSX, internal PDF, or internal print export.
- Reopened Accounting Reviewing notes are not eligible for new internal XLSX, internal PDF, or internal print export until checked again.
- Rechecked notes become internal export eligible again through the existing Checked policy.
- Historical export records remain unchanged when a Shipping Note is later cancelled.
- Historical export records remain unchanged when a Shipping Note is later reopened for correction.
- Internal XLSX export includes persisted tax rule/treatment snapshots, VAT percent, VAT amount, total including VAT, and override metadata for active selling and buying charges.
- Internal XLSX export summaries show selling/buying subtotal excluding VAT, selling/buying VAT, selling/buying total including VAT, and gross profit excluding VAT.
- Internal print view shows the same VAT/tax charge details and summary semantics as XLSX V2.
- Internal PDF export shows the same core internal accounting semantics as XLSX/print: selling, buying, stored tax snapshots, VAT amount, total including VAT, override metadata, and canonical summary.
- Internal PDF generation creates `shipping_note_exports` records with `exportType = pdf`, version `1`, generated/failed status, SHA-256 checksum on success, and PDF audit actions.
- Newly generated internal XLSX/PDF artifacts are durably persisted to private R2/S3-compatible artifact storage before the export row is marked Generated.
- The HTTP download bytes must be byte-identical to the durably stored bytes.
- Generated export rows must include `artifact_storage_key`, `artifact_size_bytes`, `artifact_mime_type`, and checksum.
- `artifact_storage_key` must use `shipping-note-exports/<exportId>/artifact.xlsx` or `shipping-note-exports/<exportId>/artifact.pdf`, never raw Jobsheet text.
- Storage failure after generation must mark the export Failed and must not return an unpersisted artifact as a successful Generated export.
- Durable artifact reads must verify stored bytes against `shipping_note_exports.checksum` and reject checksum mismatches.
- Historical metadata-only export rows with null artifact storage metadata are not considered durable and are not Drive-upload eligible.
- Drive upload status is tracked separately from generation status with `not_uploaded`, `uploading`, `uploaded`, and `upload_failed`.
- Google Drive upload uses a server-only service account configured by `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- Google Drive upload is artifact-specific: `POST /api/shipping-note-exports/[exportId]/drive`.
- Google Drive upload is Admin-only through `EXPORTS_UPLOAD`; Sale and Accountant are denied.
- Google Drive upload uses private R2/S3-compatible bytes read through `getVerifiedArtifactBytes(...)`; checksum mismatch must block the Google call and persist `ARTIFACT_CHECKSUM_MISMATCH`.
- Google Drive upload supports only generated durable XLSX V2 and PDF V1 artifacts with expected MIME types.
- Google Drive files use private `appProperties`: `uniwaveExportId`, `uniwaveShippingNoteId`, `uniwaveExportType`, `uniwaveExportVersion`, and `uniwaveChecksumSha256`.
- Google Drive upload is idempotent by `shipping_note_exports.id`: already uploaded DB rows short-circuit, matching Drive files reconcile, duplicate matches fail with `DRIVE_DUPLICATE_ARTIFACT`, and metadata conflicts fail with `DRIVE_RECONCILIATION_CONFLICT`.
- Historical generated artifacts may be uploaded after the owning Shipping Note is reopened to Accounting Reviewing or Cancelled; soft-deleted owning notes remain denied.
- Google Drive failure must leave `shipping_note_exports.status = generated` and only set `drive_upload_status = upload_failed`.
- Google Drive upload must never mutate `shipping_notes.status` or transition a note to `exported`.
- Google Drive upload does not create folders, public sharing permissions, Drive deletes, public R2 URLs, or presigned URLs.
- Export History is visible only to Accountant/Admin.
- Export History Download retrieves an existing durable artifact and must not generate a new XLSX/PDF record.
- Accountant/Admin can download durable generated XLSX/PDF artifacts even after the owning note is reopened to Accounting Reviewing or Cancelled.
- Legacy metadata-only generated rows appear as history but do not show active Download or Drive upload controls.
- Accountant can see Drive upload status and View in Drive links for uploaded artifacts but cannot Upload, Retry, or Recover.
- Admin can Upload to Drive for `not_uploaded`, Retry Drive Upload for `upload_failed`, Recover Upload for stale `uploading`, and View in Drive for uploaded artifacts.
- Fresh `uploading` records show an in-progress state and cannot be stolen.
- Stale `uploading` recovery uses the server threshold and reconciles Drive before creating a new file.
- Live Google Drive calls are not part of default automated validation; use fake Drive tests unless a dedicated test credential and folder are explicitly authorized.
- Phase 11J live artifact verification uses `npm run verify:live-artifacts` and must be run only with explicit current authorization plus exact production/staging DB target guards and `LIVE_ARTIFACT_VERIFICATION_AUTHORIZED="true"`.
- Phase 11J live verification requires configured `ARTIFACT_R2_*` variables and service-account Drive variables `GOOGLE_SERVICE_ACCOUNT_JSON` plus `GOOGLE_DRIVE_ROOT_FOLDER_ID`; deprecated OAuth-shaped Google variables are insufficient.
- The 2026-09-03 Phase 11J attempt stopped before fixture creation because the required R2 and Drive service-account variables were absent from the current environment.
- Internal PDF generation does not mutate `shipping_notes.status` to `exported`.
- Legacy checked notes with incomplete snapshots are not silently backfilled from live tax rules; missing rule identity is displayed as unclassified.
- Sale users cannot access internal accounting export, buying VAT, profit, or tax snapshot metadata.
- Export record is saved.
- Export version is tracked.
- Google Drive metadata is saved when uploaded.
- Failed export/upload has visible error status.

## Audit

- Create/update/delete/export actions are logged.
- Sensitive changes show before/after where appropriate.
- Audit logs are not visible to unauthorized roles.
- Audit viewer read model is Admin-only through `AUDIT_LOGS_READ`; Sale and Accountant are denied before rows are queried.
- Audit viewer DTO does not expose raw top-level `before` or `after` snapshots.
- Known audit actions expose only allowlisted presenter fields.
- Unknown audit actions expose no snapshot-derived fields, return `changes = []`, and set `detailsAvailable = false`.
- Recursive sanitizer removes password, token, secret, credential, authorization, cookie, database/connection string, private key, client secret, and artifact storage key concepts from nested presenter output.
- Actor labels are safe and tolerate missing or soft-deleted users.
- Entity labels are resolved for Shipping Notes, charges, exports, tax rules, and users without per-row lookup behavior.
- Audit viewer pagination uses `created_at DESC, id DESC` keyset cursors and a bounded limit.
- Audit viewer display timestamps use `Asia/Ho_Chi_Minh`.
- `/admin/audit` is server-authorized through `AUDIT_LOGS_READ`.
- Audit navigation is visible only to Admin.
- Audit filters include action, entity type, entity ID, actor ID, from date, and to date, and are persisted in the URL.
- Applying new filters clears any existing cursor.
- Audit pagination uses only the opaque next cursor returned by the read model.
- Known audit actions render expandable safe field-level changes.
- Unknown audit actions remain readable but have no details toggle or raw snapshot display.
- Reason text is rendered as plain text, not HTML or Markdown.
- Safe entity links come from the server DTO; the UI does not reconstruct entity URLs from snapshots.
- Audit viewer has no raw JSON/source/debug affordance, CSV/export action, audit mutation, retention/archive/delete control, free-text search, or client-side sanitizer.
- Browser E2E for `/admin/audit` remains final-hardening work.
