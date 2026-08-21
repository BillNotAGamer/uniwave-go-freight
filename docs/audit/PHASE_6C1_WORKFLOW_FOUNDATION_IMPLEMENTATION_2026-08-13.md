# Phase 6C.1 Workflow Foundation Implementation - 2026-08-13

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Required starting safety commands were run: `git status --short`, `git diff --name-status`, `git ls-files --others --exclude-standard`, `git branch --show-current`, and `git rev-parse HEAD`.
- Working tree was already dirty with Phase 7A/export, VAT/tax UI, docs, and audit files. Those pre-existing files were preserved.
- Current reachable workflow before this patch: `draft -> submitted -> accounting_reviewing -> checked`.

## B. Lead Decisions Implemented

- Implemented only the post-checked foundation slice.
- Did not add approval, lock, unlock, cancellation, reopen, or exported mutations.
- Did not add UI controls.
- Did not change workflow status reachability.
- Did not make export mutate `shipping_notes.status`.
- Kept internal XLSX export eligibility checked-only.
- Did not backfill historical records.

## C. Schema Delta

Table: `shipping_notes`

| Column | Type | Nullable | FK | Reason |
| --- | --- | --- | --- | --- |
| `checked_at` | `timestamp (3)` | Yes | None | Persist the timestamp for newly checked notes. |
| `approved_at` | `timestamp (3)` | Yes | None | Reserve approval timestamp metadata for the future approval slice. |
| `locked_by_id` | `text` | Yes | `users.id`, `ON DELETE SET NULL` | Reserve lock actor metadata without making lock operational. |
| `lock_reason` | `text` | Yes | None | Reserve lock reason metadata. |
| `cancelled_by_id` | `text` | Yes | `users.id`, `ON DELETE SET NULL` | Reserve cancellation actor metadata. |
| `cancelled_at` | `timestamp (3)` | Yes | None | Reserve cancellation timestamp metadata. |
| `cancel_reason` | `text` | Yes | None | Reserve mandatory-future cancellation reason storage. |

No indexes were added because none of these fields are currently used by production queries.

## D. Migration

- Migration file: `drizzle/0003_hard_titania.sql`
- Snapshot file: `drizzle/meta/0003_snapshot.json`
- Journal updated: `drizzle/meta/_journal.json`
- Migration generation command: `npm run db:generate`
- The first sandboxed generation attempt failed with Node `EPERM` on `C:\Users\Admin`; escalated rerun passed.
- Migration is additive only. It adds nullable columns and two nullable user foreign keys. It does not rewrite data, delete data, rename columns, or alter existing enum values.
- Migration was generated but not applied to a live database in this conversation.

## E. checkedAt Behavior

- `markShippingNoteChecked` now creates one `Date` inside the existing transaction.
- The same transaction persists `status = "checked"`, `checked_by_id`, and `checked_at`.
- The checked audit event `shipping_note.accounting_review.checked` includes the new `checkedAt` value in its `after` payload.
- Existing guarded update behavior is preserved: the update still requires `status = "accounting_reviewing"` and `deleted_at IS NULL`.
- Historical checked records remain untouched and can retain `checked_at = NULL`.

## F. Permission Matrix

New permission constants:

| Permission | String | Sale | Accountant | Admin |
| --- | --- | --- | --- | --- |
| `SHIPPING_NOTES_APPROVE` | `shipping-notes:approve` | No | No | Yes |
| `SHIPPING_NOTES_LOCK` | `shipping-notes:lock` | No | No | Yes |
| `SHIPPING_NOTES_UNLOCK` | `shipping-notes:unlock` | No | No | Yes |
| `SHIPPING_NOTES_CANCEL` | `shipping-notes:cancel` | Yes | Yes | Yes |
| `SHIPPING_NOTES_CANCEL_FINALIZED` | `shipping-notes:cancel-finalized` | No | No | Yes |
| `SHIPPING_NOTES_REOPEN_FOR_CORRECTION` | `shipping-notes:reopen-for-correction` | No | No | Yes |

Admin inherits all permissions through the existing all-permissions role model.

## G. Status Policy Matrix

Pure policy helpers were added for future slices only:

| Helper | Allowed source statuses |
| --- | --- |
| `canApproveShippingNoteStatus` | `checked` |
| `canLockShippingNoteStatus` | `checked`, `approved` |
| `canUnlockShippingNoteStatus` | `locked` |
| `canCancelShippingNoteStatus` | `draft`, `submitted`, `accounting_reviewing` |
| `canCancelFinalizedShippingNoteStatus` | `checked`, `approved` |
| `canReopenShippingNoteForCorrectionStatus` | `checked`, `approved` |
| `isNormalBusinessWorkflowTargetStatus` | `submitted`, `accounting_reviewing`, `checked`, `approved`, `locked`, `cancelled` |

`hasNormalOutboundBusinessTransition` returns false for `cancelled` and `exported`.

## H. Exported Status Decision

`exported` remains in the database enum but was not made part of the normal Shipping Note business workflow. Export artifact state remains represented by `shipping_note_exports.status`, `shipping_note_exports.version`, and export metadata. Phase 6C.1 intentionally adds no transition into or out of `exported`.

## I. Tests Added/Changed

- `src/lib/permissions/permissions.test.ts`: covers the new permission constants and role grants/denials.
- `src/features/shipping-notes/status-policy.test.ts`: covers future source-state helpers and keeps `exported` outside normal workflow targets.
- `tests/integration/accounting-export-audit.integration.test.ts`: extends existing checked-transition integration expectations for `checked_at` and checked audit payload metadata. Not executed in this conversation.
- `tests/integration/migration.integration.test.ts`: extends schema verification for the new metadata columns and lock/cancel user foreign keys. Not executed in this conversation.

## J. Validation Results

| Command | Result |
| --- | --- |
| `node ./node_modules/vitest/vitest.mjs run src/lib/permissions/permissions.test.ts src/features/shipping-notes/status-policy.test.ts` | PASS, 2 files / 20 tests |
| `npm test` | PASS, 17 files / 79 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED, no current authorization for configured `DATABASE_URL` |
| `npm run test:all` | SKIPPED, no current authorization for configured `DATABASE_URL` |

The npm commands required escalation after sandboxed attempts failed with Node `EPERM` on `C:\Users\Admin`.

## K. Files Changed

Phase 6C.1 files changed:

- `drizzle/0003_hard_titania.sql`
- `drizzle/meta/0003_snapshot.json`
- `drizzle/meta/_journal.json`
- `src/lib/db/schema.ts`
- `src/lib/permissions/permissions.ts`
- `src/lib/permissions/permissions.test.ts`
- `src/features/shipping-notes/status-policy.ts`
- `src/features/shipping-notes/status-policy.test.ts`
- `src/features/shipping-notes/mutations.ts`
- `tests/integration/migration.integration.test.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_6C1_WORKFLOW_FOUNDATION_IMPLEMENTATION_2026-08-13.md`

Pre-existing dirty or untracked files outside this scope were preserved and not reset.

## L. Remaining Slices

1. Phase 6C.2 Approval transition
   - Blast radius: schema use, mutation, audit, RBAC, status policy, detail UI action.
   - Migration dependency: uses existing `approved_by_id` and new `approved_at`.
   - Tests: unit policy, DB guarded transition, audit atomicity, authorization, stale denial.

2. Phase 6C.3 Export eligibility extension
   - Blast radius: export query/policy and UI enablement only.
   - Migration dependency: none expected.
   - Tests: export eligibility for legacy checked notes and approved notes.

3. Phase 6C.4 Cancellation
   - Blast radius: status mutation, reason validation, audit, export blocking policy, UI confirmation.
   - Migration dependency: uses new cancel metadata columns.
   - Tests: source-state matrix, actor permissions, reason requirement, prior export preservation.

4. Phase 6C.5 Lock and unlock
   - Blast radius: mutability policy, status mutation, reason validation, audit, UI controls.
   - Migration dependency: uses existing `locked_at` plus new `locked_by_id` and `lock_reason`; unlock metadata may require a later decision if operational reporting needs it.
   - Tests: locked immutability, export remains representation-only unless product decides otherwise, admin-only unlock.

5. Phase 6C.6 Reopen for correction
   - Blast radius: status mutation, immutable tax snapshot correction model, export version history, audit.
   - Migration dependency: none expected for minimal reopen, but correction reason persistence may need a product decision.
   - Tests: stale transition denial, exports remain historical, later exports create new artifact records.

## M. Final Verdict

READY FOR LEAD REVIEW
