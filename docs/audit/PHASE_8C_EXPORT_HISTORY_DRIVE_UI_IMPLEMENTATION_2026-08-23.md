# Phase 8C Export History Drive UI Implementation - 2026-08-23

## A. Starting State

- Branch: `feature/ui-overhaul`.
- HEAD at start: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Working tree was already dirty with accepted Phase 8A and Phase 8B work.
- Pre-existing Phase 8A/8B files were preserved; no reset, clean, stash, checkout, revert, amend, commit, or mass-format was performed.
- Optional project handbook `docs/PROJECT_OVERVIEW_UNIWAVE_GO_FREIGHT_VI_2026-08-14.md` remains absent and was not recreated.

## B. Export History Read Contract

- Server read model: `listShippingNoteExportHistoryForUser(...)`.
- Permission: `SHIPPING_NOTES_EXPORT_INTERNAL`.
- Sale is denied before querying export history.
- Accountant/Admin can read note-scoped export history after the normal Shipping Note access boundary confirms the note is visible and not soft-deleted.
- Rows are ordered newest first by `generated_at desc nulls last`, then `created_at desc`.
- Exposed fields include format, version, generation state, filename, checksum, generated timestamp, generated-by display name/email, artifact availability, artifact size, Drive status, Drive uploaded timestamp, Drive URL, created/updated timestamps, and stale upload flag.
- Excluded fields include `artifactStorageKey`, R2 config, `driveFolderId`, raw generation error text, Google raw response payloads, and credentials.

## C. Historical Download Contract

- Route: `GET /api/shipping-note-exports/[exportId]/download`.
- Requires same-origin metadata, authenticated session, valid export UUID, and `SHIPPING_NOTES_EXPORT_INTERNAL`.
- Download target is a specific export artifact row, not the current Shipping Note.
- Supported contracts:
  - XLSX: `exportType = excel`, `version = 2`, MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - PDF: `exportType = pdf`, `version = 1`, MIME `application/pdf`.
- Required state: `status = generated`, durable artifact metadata, filename, and checksum.
- Byte source: `getVerifiedArtifactBytes(...)`; checksum mismatch blocks response bytes.
- The route returns `Content-Type`, safe `Content-Disposition`, `Content-Length`, private/no-store headers, and `X-Content-Type-Options: nosniff`.
- The route never regenerates XLSX/PDF.

## D. RBAC

- Sale:
  - no export history panel.
  - no history DTO.
  - no historical download.
  - no Drive URL.
  - no Drive mutation controls.
- Accountant:
  - view history.
  - download generated durable artifacts.
  - view Drive status.
  - view uploaded Drive link.
  - cannot upload/retry/recover Drive artifacts.
- Admin:
  - all Accountant capabilities.
  - upload/retry/recover Drive artifacts through `EXPORTS_UPLOAD`.

## E. UI

- Added `ExportHistoryPanel` to the Shipping Note detail page.
- The panel is compact and uses the existing back-office table style.
- Existing top-level `Export XLSX`, `Export PDF`, and `Print` controls remain unchanged and still create new artifacts.
- History `Download` retrieves an existing artifact.
- History rows show artifact type/version, generation status, generated timestamp, filename, short checksum, size, Drive status, and available actions.
- Cancelled/Reopened notes retain the history panel for Accountant/Admin even when new generation is not eligible.

## F. Drive Action Matrix

For Admin:

| Drive status | Stale? | UI action |
| --- | --- | --- |
| `not_uploaded` | n/a | Upload to Drive |
| `upload_failed` | n/a | Retry Drive Upload |
| `uploading` | false | disabled/in-progress state |
| `uploading` | true | Recover Upload |
| `uploaded` + URL | n/a | View in Drive |

For Accountant:

- Download generated durable artifacts.
- See Drive status.
- View in Drive when uploaded and URL exists.
- No upload/retry/recover buttons.

## G. Stale Upload Policy

- Constant: `DRIVE_UPLOAD_STALE_AFTER_MS = 10 * 60 * 1000`.
- Server-side stale rule: `driveUploadStatus = uploading` and `updatedAt <= serverNow - DRIVE_UPLOAD_STALE_AFTER_MS`.
- Fresh `uploading` returns `DRIVE_UPLOAD_IN_PROGRESS`.
- Claiming upload now explicitly sets `updatedAt` to the claim timestamp.
- Success/failure finalization remains guarded on `driveUploadStatus = uploading`.

## H. Stale Recovery / Reconciliation

- Recovery reuses `POST /api/shipping-note-exports/[exportId]/drive`.
- Stale recovery searches Drive by `appProperties.uniwaveExportId` before any duplicate upload.
- Exact single Drive match:
  - validates all appProperties and configured parent folder.
  - reconciles DB to `uploaded`.
  - creates no new Drive file.
  - audits `shipping_note.export.drive.uploaded` with `reconciledFromDrive = true`.
- No Drive match:
  - marks stale upload as `upload_failed` with `DRIVE_UPLOAD_STALE`.
  - immediately reclaims through normal `upload_failed -> uploading` flow.
  - uploads verified bytes once.
- Duplicate Drive matches fail with `DRIVE_DUPLICATE_ARTIFACT`.
- Metadata or parent mismatch fails with `DRIVE_RECONCILIATION_CONFLICT`.
- Recovery DB writes use stale cutoff guards where applicable.

## I. Historical Reopen / Cancellation Behavior

- Historical durable artifacts remain downloadable and Admin Drive-uploadable when the current note status is:
  - `accounting_reviewing` after reopen.
  - `cancelled`.
  - `checked`.
  - `approved`.
  - `locked`.
- Download and Drive upload do not mutate `shipping_notes.status`.
- New generation eligibility remains governed by the existing internal export status policy and is unchanged.

## J. Legacy Artifact Behavior

- Generated rows without durable artifact metadata remain visible in history as metadata.
- Legacy metadata-only rows are not downloadable.
- Legacy metadata-only rows are not Drive-uploadable.
- No storage keys are fabricated.
- No artifacts are regenerated.

## K. Security Boundaries

- Storage keys stay server-only.
- Google credentials stay server-only.
- Drive folder ID stays internal.
- Sale receives no history, Drive URL, or artifact bytes.
- Historical download is app-authenticated server streaming, not public R2/presigned URL access.
- Drive upload still uses service account auth, no OAuth, no browser Google SDK, no folder creation, no public sharing, and no deletion.

## L. Tests

Focused tests added/updated:

- `src/features/shipping-notes/export/history-ui-policy.test.ts`
- `src/features/shipping-notes/export/history.test.ts`
- `src/features/shipping-notes/export/download.test.ts`
- `src/features/shipping-notes/export/drive/service.test.ts`
- `src/app/api/shipping-note-exports/[exportId]/download/route.test.ts`

Integration tests extended but not executed:

- `tests/integration/accounting-export-audit.integration.test.ts`

Covered behavior:

- history roles and DTO security.
- safe generated-by display.
- artifact availability and legacy metadata-only behavior.
- historical download roles.
- XLSX/PDF download contracts.
- pending/failed/unsupported/soft-deleted denial.
- checksum mismatch denial.
- historical reopened/cancelled status download.
- Drive UI action matrix.
- stale threshold boundary.
- stale recovery exact-match reconciliation.
- stale no-match reset/retry/upload.
- duplicate/conflict recovery failure.
- route binary response headers and same-origin denial.

## M. Validation

- Focused 8C tests: PASS, 5 files / 48 tests.
- `npm test`: PASS, 28 files / 170 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run test:integration`: SKIPPED; no current authorization for configured `DATABASE_URL` as test/staging.
- `npm run test:all`: SKIPPED; no current authorization for configured `DATABASE_URL` as test/staging.
- Live Google/R2 smoke tests: SKIPPED; no dedicated test credentials/folder/storage authorization was provided.

## N. Migration Status

- New migration created by Phase 8C: no.
- `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- `drizzle/0004_clean_power_man.sql` applied in this conversation: no.
- Phase 8C uses existing Phase 8A schema fields.

## O. Files Changed

Phase 8C files added/changed:

- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/app/api/shipping-note-exports/[exportId]/download/route.ts`
- `src/app/api/shipping-note-exports/[exportId]/download/route.test.ts`
- `src/features/shipping-notes/components/export-history-panel.tsx`
- `src/features/shipping-notes/export/download.ts`
- `src/features/shipping-notes/export/download.test.ts`
- `src/features/shipping-notes/export/drive/service.ts`
- `src/features/shipping-notes/export/drive/service.test.ts`
- `src/features/shipping-notes/export/drive/repository.ts`
- `src/features/shipping-notes/export/history.ts`
- `src/features/shipping-notes/export/history.test.ts`
- `src/features/shipping-notes/export/history-ui-policy.ts`
- `src/features/shipping-notes/export/history-ui-policy.test.ts`
- `src/lib/drive/errors.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_8C_EXPORT_HISTORY_DRIVE_UI_IMPLEMENTATION_2026-08-23.md`

Pre-existing dirty/untracked Phase 8A/8B files were preserved.

## P. Remaining Production Gaps

- Hosted integration execution requires current explicit DB authorization.
- Live Google/R2 smoke tests require dedicated test credentials/folder/storage and explicit authorization.
- Browser E2E for Accountant/Admin/Sale history and Drive UI.
- Audit viewer.
- Admin user management.
- Optional future stale upload background/scheduled reconciliation.

## Q. Final Phase 8 State

Generated artifact -> durable private R2 artifact -> protected historical download -> Admin Drive archival upload -> idempotent/reconcilable Drive copy -> protected export-history UI.

- Accountant: generate, download, view history, view Drive status/link.
- Admin: all Accountant capabilities plus Drive upload/retry/recovery.
- Sale: none of the internal export/history/Drive capabilities.

## R. Final Verdict

READY FOR LEAD REVIEW
