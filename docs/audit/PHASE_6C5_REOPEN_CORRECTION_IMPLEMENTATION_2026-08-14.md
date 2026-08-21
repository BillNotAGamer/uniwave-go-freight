# Phase 6C.5 Reopen Correction Implementation

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Starting tree: dirty with pre-existing Phase 6B, 7A, and 6C tracked/untracked work.
- Safety commands recorded before edits: `git status --short`, `git diff --name-status`, `git ls-files --others --exclude-standard`, `git branch --show-current`, and `git rev-parse HEAD`.
- No reset, checkout, clean, stash, revert, amend, mass-format, or commit was performed.

## B. Reopen Domain Contract

Reopen is an explicit accounting correction boundary for finalized accounting records. It implements only:

```text
checked  -> accounting_reviewing
approved -> accounting_reviewing
```

The operation is not a commercial Draft reopen, not cancellation restoration, not direct Locked reopen, and not an export transition.

## C. Accounting-Only Correction Scope

After reopen, the note is back in `accounting_reviewing`, so existing accounting mutation paths apply:

- Buying charge management can run through the existing Accounting Reviewing policy.
- Tax assignment and VAT override can run through the existing Accounting Reviewing tax policy.

The following remain unchanged and Draft-only:

- Shipping Note core/commercial field editing.
- Selling charge create/update/delete.

## D. Authorization / RBAC

- Permission: `SHIPPING_NOTES_REOPEN_FOR_CORRECTION`.
- Sale: denied.
- Accountant: denied.
- Admin: allowed through existing Admin-all permission semantics.
- Reason: mandatory for Admin.

## E. Metadata Clearing Policy

`checkedById`, `checkedAt`, `approvedById`, and `approvedAt` represent current finalization state metadata. Reopen clears all four fields so a currently Reviewing note does not still look currently Checked or Approved.

Preserved:

- `submittedAt`
- `createdAt`
- charge rows
- tax/VAT snapshots
- cancellation metadata
- lock metadata, except Locked is not an allowed source
- audit history
- export records

## F. Mutation / CAS Architecture

Production mutation added:

- `reopenShippingNoteForCorrection(...)`

Input is validated by `reopenShippingNoteForCorrectionInputSchema`:

- `id`
- `expectedStatus` limited to `checked | approved`
- mandatory trimmed `reason`

The update uses an expected-source guard:

```text
WHERE id = :id
AND status = :expectedStatus
AND deleted_at IS NULL
```

The mutation rejects stale requests and rejects allowed-source records that unexpectedly carry active lock metadata instead of silently treating reopen as unlock.

## G. Audit Contract

- Audit action: `shipping_note.reopen_for_correction`.
- Audit reason: mandatory normalized correction reason.
- Before snapshot: `status`, `checkedById`, `checkedAt`, `approvedById`, `approvedAt`.
- After snapshot: `status = accounting_reviewing`, `checkedById = null`, `checkedAt = null`, `approvedById = null`, `approvedAt = null`.
- Audit insert and status update are in the same database transaction.

## H. Tax / Buying Mutability Restoration

Reopen itself does not mutate charges or tax data. Once the status is `accounting_reviewing`, existing production policies again allow authorized Accountant/Admin users to correct buying charges and tax/VAT state.

Integration coverage was added to characterize representative buying-charge and tax-rule correction after reopen.

## I. Selling/Core Immutability

No Draft-only guard was widened. Selling charge mutation and Shipping Note core edit paths still require Draft status. Integration coverage was added to reject a selling charge create attempt after reopen.

## J. Export History Preservation

Previously generated export records remain unchanged when a note is reopened. Reopen does not delete, overwrite, fail, regenerate, or version-bump historical artifacts.

The Phase 7A internal XLSX artifact format remains:

- template: `internal-v2`
- metadata version: `2`

## K. Export Eligibility During/After Correction

Current export-eligible statuses remain:

```text
checked | approved | locked
```

After reopen, status is `accounting_reviewing`, so new internal XLSX and internal print export requests are denied through the existing canonical status policy.

After the existing `markShippingNoteChecked(...)` transition succeeds again, internal export becomes available again. Any later export record is a separate artifact record and does not change old export metadata.

## L. UI Behavior

UI component added:

- `CorrectionControls`

The Shipping Note detail page shows it only to Admin when current status is `checked` or `approved`. The UI requires a correction reason and explicit confirmation, and explains that finalization metadata is cleared while historical exports and audits are preserved.

Locked and Cancelled notes do not show Reopen.

## M. Tests

Unit/policy/validator tests changed:

- `src/features/shipping-notes/status-policy.test.ts`
- `src/features/shipping-notes/validators.test.ts`
- `src/lib/permissions/permissions.test.ts`

Integration tests extended but not executed:

- `tests/integration/accounting-export-audit.integration.test.ts`

Integration scenarios added cover Checked reopen, Approved reopen, Sale/Accountant denial, Locked denial, Cancelled denial, stale Checked/Approved requests, metadata clearing, audit snapshots, buying/tax correction after reopen, selling mutation denial after reopen, historical export preservation, export denial while Reviewing, export restoration after re-check, separate post-correction export records, and reapproval.

## N. Validation

| Command | Result |
| --- | --- |
| Focused tests | PASS, 5 files / 35 tests |
| `npm test` | PASS, 17 files / 83 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED, no current authorization for configured database |
| `npm run test:all` | SKIPPED, no current authorization for configured database |

Initial sandbox attempt for `npm run typecheck` hit `EPERM` on `C:\Users\Admin`; escalated rerun passed. Other npm validation was run with the same narrow npm-script escalation.

## O. Migration State

- New migration created: no.
- New reopen columns created: no.
- Reopen history storage: audit logs only.
- `drizzle/0003_hard_titania.sql` applied in this conversation: no, NOT RUN.

## P. Files Changed

Pre-existing dirty files were preserved. Files changed by Phase 6C.5:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_6C5_REOPEN_CORRECTION_IMPLEMENTATION_2026-08-14.md`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/features/shipping-notes/actions.ts`
- `src/features/shipping-notes/components/correction-controls.tsx`
- `src/features/shipping-notes/mutations.ts`
- `src/features/shipping-notes/status-policy.test.ts`
- `src/features/shipping-notes/validators.test.ts`
- `src/features/shipping-notes/validators.ts`
- `src/lib/permissions/permissions.test.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`

## Q. Final Phase 6 Workflow State

```text
draft
  -> submitted
  -> accounting_reviewing
  -> checked
  -> approved
  -> locked

locked -> approved

checked  -> accounting_reviewing
approved -> accounting_reviewing

draft                 -> cancelled
submitted             -> cancelled
accounting_reviewing  -> cancelled
checked               -> cancelled
approved              -> cancelled
```

Cancelled is terminal. Locked requires Unlock before correction or cancellation. No `exported` transition exists.

## R. Remaining Project Milestones

- PDF export.
- Google Drive upload.
- `exported` enum cleanup decision.
- Accounting filters and accounting periods.
- Audit viewer.
- Admin user management.
- Browser E2E coverage.

## S. Final Verdict

READY FOR LEAD REVIEW
