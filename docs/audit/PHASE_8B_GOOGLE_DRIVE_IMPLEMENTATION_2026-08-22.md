# Phase 8B Google Drive Implementation - 2026-08-22

## A. Starting State

- Branch: `feature/ui-overhaul`.
- HEAD at start: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Working tree was already dirty with accepted Phase 8A work, including durable artifact storage schema/code/docs and migration `drizzle/0004_clean_power_man.sql`.
- No existing work was reset, stashed, cleaned, reverted, or mass-formatted.
- Optional project handbook `docs/PROJECT_OVERVIEW_UNIWAVE_GO_FREIGHT_VI_2026-08-14.md` was absent and was not recreated.

## B. Dependency Compatibility

- Runtime gate:
  - `node --version`: `v20.14.0`.
  - `npm --version`: `10.8.1`.
- Registry gate:
  - `npm view googleapis version`: `176.0.0`.
  - `npm view googleapis engines`: `{ node: '>=18' }`.
  - `npm view googleapis dependencies`: `googleapis-common ^8.0.0`, `google-auth-library 10.5.0`.
  - `npm view google-auth-library@10.5.0 engines`: `{ node: '>=18' }`.
- Installed package:
  - `googleapis@176.0.0`.
  - Resolved auth dependency: `google-auth-library@10.5.0`.
- `npm install googleapis` completed without `--force` or `--legacy-peer-deps`.
- EBADENGINE warnings observed during install were for existing unrelated packages on Node `20.14.0` (`@noble/*`, `eslint-visitor-keys`, `kysely`), not for `googleapis` or `google-auth-library`.

## C. Authentication / Scope

- Authentication is server-only Google Service Account JSON.
- Required env names:
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- Deprecated OAuth-shaped placeholders remain documented as unused:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `GOOGLE_DRIVE_FOLDER_ID`
- Selected scope: `https://www.googleapis.com/auth/drive.file`.
- Scope rationale: official Drive API docs list `drive.file` for both `files.list` and `files.create`, and Phase 8B only creates/searches app-created artifacts by private `appProperties` in the configured folder. Broader `drive` scope was not used.

Official scope references used:
- Google Drive `files.list`: `https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list`
- Google Drive scopes: `https://developers.google.com/workspace/drive/api/guides/api-specific-auth`
- Google Drive `files.create`: `https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create`
- Google Drive appProperties: `https://developers.google.com/workspace/drive/api/guides/properties`

## D. Drive Target / Shared Drive Support

- Upload target is exactly one configured root folder ID.
- No folders are created.
- No public sharing or permissions are created.
- Drive operations include Shared Drive support flags:
  - `supportsAllDrives: true`
  - `includeItemsFromAllDrives: true` on search
  - `corpora: "allDrives"` on search because only root folder ID is configured, not a Shared Drive ID.

## E. Drive Adapter

- Server-only adapter files:
  - `src/lib/drive/config.ts`
  - `src/lib/drive/errors.ts`
  - `src/lib/drive/fake.ts`
  - `src/lib/drive/google-drive.ts`
  - `src/lib/drive/types.ts`
- Production adapter: `GoogleDriveArtifactUploader`.
- Test adapter: `FakeDriveArtifactUploader`.
- Google SDK types are contained at the Drive boundary and are not propagated into Shipping Note domain modules.

## F. Artifact Eligibility

- Upload target is `shipping_note_exports.id`.
- Supported artifact contracts:
  - `exportType = excel`, `version = 2`, MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - `exportType = pdf`, `version = 1`, MIME `application/pdf`.
- Required DB fields:
  - `status = generated`
  - `artifactStorageKey != null`
  - `artifactSizeBytes != null`
  - `artifactMimeType != null`
  - `checksum != null`
  - `fileName != null`
- Pending/failed generation rows are denied.
- Soft-deleted owning notes are denied.
- Current note generation eligibility is intentionally not reused for historical artifacts.

## G. Verified Artifact Source

- Upload uses `getVerifiedArtifactBytes(...)`.
- Bytes are read from private artifact storage and verified against persisted SHA-256 before any Google upload.
- XLSX/PDF generation routes are not called by Drive upload.
- Checksum mismatch blocks the Google call and records `ARTIFACT_CHECKSUM_MISMATCH` through Drive failure metadata/audit.

## H. Idempotency / appProperties

- Primary idempotency identity: `shipping_note_exports.id`.
- Drive appProperties keys:
  - `uniwaveExportId`
  - `uniwaveShippingNoteId`
  - `uniwaveExportType`
  - `uniwaveExportVersion`
  - `uniwaveChecksumSha256`
- No Jobsheet, customer, cost, profit, VAT, override, or credential data is stored in appProperties.
- Already uploaded DB rows with `driveUploadStatus = uploaded`, `driveFileId`, and `driveUrl` short-circuit without a Google call.

## I. Upload State CAS

- Claim starts only from:
  - `not_uploaded -> uploading`
  - `upload_failed -> uploading`
- `uploaded` returns existing DB metadata.
- `uploading` returns conflict/in-progress.
- Claim uses a guarded DB update; no unconditional upload-state overwrite is used.
- Success/failure finalization updates are also guarded on `driveUploadStatus = uploading`.
- Artifact generation `status` remains `generated` on Drive failure.

## J. Retry / Concurrency

- Google adapter retries retryable errors up to two additional attempts.
- Retryable classes: `429`, `5xx`, and timeout/network-timeout style errors.
- Non-retryable classes: config/auth/permission/folder-not-found/duplicate/reconciliation/checksum errors.
- Request timeout is centralized as `GOOGLE_DRIVE_REQUEST_TIMEOUT_MS = 30000`.
- Stale `uploading` recovery is deferred to Phase 8C as a P2 hardening gap because no upload UI/history recovery surface exists yet.

## K. DB Failure / Reconciliation

- If DB is not already complete, the adapter searches Drive by `appProperties.uniwaveExportId`.
- A single matching file reconciles DB only if all expected appProperties and the configured parent folder match.
- Multiple matches fail with `DRIVE_DUPLICATE_ARTIFACT`.
- Metadata mismatch or wrong parent folder fails with `DRIVE_RECONCILIATION_CONFLICT`.
- Google success followed by DB failure is recoverable by retry: the next attempt can find and reconcile the existing Drive file.

## L. Error Semantics

Sanitized application codes include:

- `DRIVE_NOT_CONFIGURED`
- `DRIVE_AUTH_FAILED`
- `DRIVE_PERMISSION_DENIED`
- `DRIVE_FOLDER_NOT_FOUND`
- `DRIVE_RATE_LIMITED`
- `DRIVE_TEMPORARY_FAILURE`
- `DRIVE_DUPLICATE_ARTIFACT`
- `DRIVE_RECONCILIATION_CONFLICT`
- `ARTIFACT_STORAGE_READ_FAILED`
- `ARTIFACT_CHECKSUM_MISMATCH`
- `DRIVE_UPLOAD_FAILED`

Additional route/control codes:

- `DRIVE_UPLOAD_IN_PROGRESS`
- `DRIVE_ARTIFACT_NOT_ELIGIBLE`
- `DRIVE_EXPORT_NOT_FOUND`
- `DRIVE_INVALID_EXPORT_ID`

Raw credentials, tokens, stack traces, and Google raw response payloads are not persisted or returned.

## M. Audit Contract

- Success action: `shipping_note.export.drive.uploaded`.
- Failure action: `shipping_note.export.drive.failed`.
- Entity: `shipping_note_export`.
- Entity ID: `shipping_note_exports.id`.
- Safe audit metadata includes export ID, Shipping Note ID, export type, version, checksum, Drive file/folder IDs where applicable, current Shipping Note status, reconciliation flag, retry count, and sanitized error code.
- Final DB metadata update and audit write occur in the same DB transaction.
- Google API calls and R2 reads occur outside DB transactions.

## N. Security / RBAC

- Route: `POST /api/shipping-note-exports/[exportId]/drive`.
- Route runtime: Node.js.
- Route is force dynamic and returns private/no-store JSON.
- Security order:
  1. same-origin metadata
  2. session authentication
  3. export UUID validation
  4. `EXPORTS_UPLOAD`
  5. export/note load
  6. artifact eligibility
  7. upload orchestration
- Permission: `EXPORTS_UPLOAD`.
- Role result:
  - Sale: denied.
  - Accountant: denied.
  - Admin: allowed.
- Drive upload route returns only `exportId`, `driveUploadStatus`, `driveFileId`, and `driveUrl`.
- No Sale-safe DTOs were broadened.
- No Drive UI was added.

## O. Tests

Unit/policy tests added:

- `src/lib/drive/google-drive.test.ts`
- `src/features/shipping-notes/export/drive/policy.test.ts`
- `src/features/shipping-notes/export/drive/service.test.ts`
- `src/app/api/shipping-note-exports/[exportId]/drive/route.test.ts`

Integration tests extended but not run:

- `tests/integration/accounting-export-audit.integration.test.ts`

Covered by focused unit tests:

- config parsing and deprecated OAuth separation
- files.list query shape, appProperties, fields, Shared Drive flags
- files.create metadata, parent folder, MIME/media, fields, Shared Drive flags
- sanitized Google error classification
- already uploaded short-circuit
- not_uploaded and upload_failed claim paths
- uploading conflict
- existing Drive file reconciliation
- missing Drive file upload
- duplicate Drive file failure
- metadata mismatch conflict
- checksum mismatch blocks Google
- missing storage metadata denied
- historical checked/approved/locked/reopened/cancelled artifact eligibility
- Sale/Accountant permission denial
- route safe JSON and same-origin denial

## P. Validation

- Focused Drive tests: PASS, 4 files / 34 tests.
- Final `npm test`: PASS, 24 files / 137 tests.
- Final `npm run typecheck`: PASS.
- Final `npm run lint`: PASS.
- Final `npm run build`: PASS; production route summary includes `/api/shipping-note-exports/[exportId]/drive`.
- `npm run test:integration`: SKIPPED; no current authorization for configured `DATABASE_URL` as test/staging.
- `npm run test:all`: SKIPPED; no current authorization for configured `DATABASE_URL` as test/staging.
- Live Google Drive smoke test: SKIPPED; no dedicated test credentials/folder were provided or authorized.

## Q. Migration Status

- New migration created by Phase 8B: no.
- `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- `drizzle/0004_clean_power_man.sql` applied in this conversation: no.
- Phase 8B uses existing Phase 8A Drive lifecycle columns.

## R. Files Changed

Phase 8B files added/changed:

- `.env.example`
- `package.json`
- `package-lock.json`
- `src/app/api/shipping-note-exports/[exportId]/drive/route.ts`
- `src/app/api/shipping-note-exports/[exportId]/drive/route.test.ts`
- `src/features/shipping-notes/export/drive/policy.ts`
- `src/features/shipping-notes/export/drive/policy.test.ts`
- `src/features/shipping-notes/export/drive/repository.ts`
- `src/features/shipping-notes/export/drive/service.ts`
- `src/features/shipping-notes/export/drive/service.test.ts`
- `src/lib/drive/config.ts`
- `src/lib/drive/errors.ts`
- `src/lib/drive/fake.ts`
- `src/lib/drive/google-drive.ts`
- `src/lib/drive/google-drive.test.ts`
- `src/lib/drive/types.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_8B_GOOGLE_DRIVE_IMPLEMENTATION_2026-08-22.md`

Pre-existing dirty/untracked Phase 8A files were preserved and not reverted.

## S. Remaining 8C Work

- Upload to Drive UI.
- Retry button.
- Export-history panel.
- View in Drive UI.
- Protected export-history query/read model.
- Stale `uploading` recovery workflow or worker policy.
- Browser E2E for Drive upload controls and stale/error UX.

## T. Deferred Gaps

- P2: stale `uploading` records have no timed recovery mutation/UI in Phase 8B.
- P2: no live Google smoke test was executed; requires dedicated test service account and folder.
- P2: integration tests were extended but not executed because no current DATABASE_URL authorization was provided.
- P3: no Drive folder existence preflight; create/search errors are mapped to sanitized failure codes.

## U. Final Verdict

READY FOR LEAD REVIEW
