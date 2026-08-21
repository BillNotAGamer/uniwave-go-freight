# Phase 6C.4 Cancellation Implementation

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Starting tree: dirty with pre-existing Phase 6B, 7A, 6C.1, 6C.2, and 6C.3 tracked/untracked work.
- Safety commands recorded before edits: `git status --short`, `git diff --name-status`, `git ls-files --others --exclude-standard`, `git branch --show-current`, and `git rev-parse HEAD`.
- No reset, checkout, clean, stash, revert, amend, mass-format, or commit was performed.

## B. Cancellation Domain Contract

Cancellation is now an operational business lifecycle state. It marks a Shipping Note workflow as intentionally terminated while preserving the business record.

Cancellation is not soft deletion. Successful cancellation does not set `deleted_at`, does not remove the note from normal historical reads, and does not delete charges, tax snapshots, check/approval metadata, export records, or audit logs.

## C. Role / Status Matrix

| Source status | Sale | Accountant | Admin |
| --- | --- | --- | --- |
| Draft | Own Draft only, reason optional | Denied | Allowed, reason mandatory |
| Submitted | Denied | Allowed, reason mandatory | Allowed, reason mandatory |
| Accounting Reviewing | Denied | Allowed, reason mandatory | Allowed, reason mandatory |
| Checked | Denied | Denied | Allowed via finalized cancellation, reason mandatory |
| Approved | Denied | Denied | Allowed via finalized cancellation, reason mandatory |
| Locked | Denied | Denied | Denied directly; unlock to Approved first |
| Cancelled | Terminal, no outbound cancellation | Terminal, no outbound cancellation | Terminal, no outbound cancellation |
| Exported | Reserved and non-operational | Reserved and non-operational | Reserved and non-operational |

## D. Reason Policy

- Sale owner Draft cancellation: optional reason.
- Admin Draft cancellation: mandatory reason.
- Submitted and Accounting Reviewing cancellation: mandatory reason.
- Checked and Approved finalized cancellation: mandatory reason.
- Reasons are trimmed.
- Blank optional reasons persist as `null`.
- Whitespace-only required reasons are rejected.

## E. Mutation Architecture

Two production mutations were added:

- `cancelShippingNote(...)` for `draft`, `submitted`, and `accounting_reviewing`.
- `cancelFinalizedShippingNote(...)` for `checked` and `approved`.

The normal mutation requires `SHIPPING_NOTES_CANCEL` and then applies contextual role/source checks. The finalized mutation requires `SHIPPING_NOTES_CANCEL_FINALIZED`, preserving the high-risk boundary for Checked and Approved records.

## F. CAS / Concurrency

Both cancellation mutations use an expected source status from validated input and persist through a guarded update:

```text
WHERE id = :id
AND status = :expectedStatus
AND deleted_at IS NULL
```

This prevents stale UI submissions from overwriting a concurrent transition, including Draft already submitted and Approved already locked.

## G. Audit Contract

- Audit action: `shipping_note.cancel`.
- Entity type: `shipping_note`.
- Entity ID: Shipping Note ID.
- Before snapshot includes `status`, `cancelledById`, `cancelledAt`, and `cancelReason`.
- After snapshot includes `status = cancelled`, `cancelledById`, `cancelledAt`, and `cancelReason`.
- Audit reason is the exact normalized cancellation reason, or `null` for optional Sale-owner Draft cancellation without a reason.
- Audit write and status update occur in the same database transaction.

## H. Historical Data Preservation

Cancellation changes only lifecycle and cancellation metadata:

- `status`
- `cancelled_by_id`
- `cancelled_at`
- `cancel_reason`
- `updated_at`

It does not recalculate or mutate selling charges, buying charges, amount fields, VAT values, tax snapshots, override metadata, checked metadata, approval metadata, lock metadata, or export records.

## I. Export Behavior

The canonical internal export eligibility remains exactly:

```text
checked | approved | locked
```

Cancelled notes are denied for new internal XLSX and internal print export requests. Historical export records are preserved unchanged when a note is later cancelled.

Known deferred race: an export already past eligibility before cancellation may still complete in the current synchronous request architecture. This phase guarantees new export requests evaluated after cancellation are denied.

## J. Read / UI Behavior

- Sale may continue reading owned Cancelled notes through the existing safe Shipping Note DTO and may see status `Cancelled`.
- Sale is not granted buying charges, financial summary, tax snapshots, cancellation reason, cancellation actor, export metadata, or audit logs.
- Accountant/Admin retain read-only historical accounting access to Cancelled notes where existing RBAC permits it.
- Cancellation metadata is queried through an internal-only helper requiring `SHIPPING_NOTES_READ_ALL`.
- The detail page has a separate Cancellation area.
- Locked notes show no direct cancel action; Admin sees guidance to unlock first.

## K. Tests

Unit/policy/validator tests changed:

- `src/features/shipping-notes/status-policy.test.ts`
- `src/features/shipping-notes/validators.test.ts`
- `src/lib/permissions/permissions.test.ts`

Integration tests extended but not executed:

- `tests/integration/accounting-export-audit.integration.test.ts`

Integration coverage added for Sale-owner Draft cancellation, Sale non-owner denial, Accountant Draft denial, Submitted/Reviewing role rules, Checked/Approved finalized cancellation, Locked denial, stale CAS denial, Cancelled terminal behavior, Cancelled immutability, historical export preservation, new export denial after cancellation, and Cancelled read-history boundaries.

## L. Validation

| Command | Result |
| --- | --- |
| Focused tests | PASS, 5 files / 34 tests |
| `npm test` | PASS, 17 files / 82 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED, no current authorization for configured database |
| `npm run test:all` | SKIPPED, no current authorization for configured database |

Initial sandbox attempts for `npm test`, `npm run typecheck`, and `npm run lint` hit `EPERM` on `C:\Users\Admin`; escalated reruns passed. `npm run build` was run with the same npm-script escalation and passed.

## M. Migration State

- New migration created: no.
- Required schema foundation: existing Phase 6C.1 fields `cancelled_by_id`, `cancelled_at`, and `cancel_reason`.
- `drizzle/0003_hard_titania.sql` applied in this conversation: no, NOT RUN.

## N. Files Changed

Pre-existing dirty files were preserved. Files changed by Phase 6C.4:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_6C4_CANCELLATION_IMPLEMENTATION_2026-08-14.md`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/features/shipping-notes/actions.ts`
- `src/features/shipping-notes/components/cancellation-controls.tsx`
- `src/features/shipping-notes/mutations.ts`
- `src/features/shipping-notes/queries.ts`
- `src/features/shipping-notes/status-policy.test.ts`
- `src/features/shipping-notes/types.ts`
- `src/features/shipping-notes/validators.test.ts`
- `src/features/shipping-notes/validators.ts`
- `src/lib/permissions/permissions.test.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`

## O. Remaining Workflow

- Phase 6C.5 Reopen for Correction.
- `exported` enum cleanup decision.
- PDF export.
- Google Drive upload.
- Audit viewer.
- Admin user management.
- Browser E2E coverage.

## P. Final Verdict

READY FOR LEAD REVIEW
