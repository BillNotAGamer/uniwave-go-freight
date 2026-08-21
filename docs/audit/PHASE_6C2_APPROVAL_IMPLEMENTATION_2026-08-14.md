# Phase 6C.2 Approval Implementation - 2026-08-14

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Required starting safety commands were run: `git status --short`, `git diff --name-status`, `git ls-files --others --exclude-standard`, `git branch --show-current`, and `git rev-parse HEAD`.
- The working tree was already dirty with Phase 6B, Phase 7A, and Phase 6C.1 files. Those files were preserved; no reset, checkout, clean, stash, commit, or mass-format was run.
- Phase 6C.1 migration `drizzle/0003_hard_titania.sql` existed but was not known to be applied to the configured database.

## B. Approval Contract

- Operational transition added: `checked -> approved`.
- Actor: Admin only through `SHIPPING_NOTES_APPROVE`.
- Sale and Accountant are not authorized to approve.
- Same-checker rule: no four-eyes rule in MVP. An Admin who checked the note may also approve it.
- Reason: not required.
- No other status can approve, including `draft`, `submitted`, `accounting_reviewing`, `approved`, `exported`, `locked`, or `cancelled`.

## C. Mutation Architecture

- Mutation: `approveShippingNote`.
- Input validation: `approveShippingNoteInputSchema` validates the note ID.
- Permission gate: `SHIPPING_NOTES_APPROVE`.
- Preload: only `id`, `status`, `approvedById`, and `approvedAt` are loaded for the transition snapshot.
- Guarded update: the update requires matching `id`, `status = "checked"`, and `deleted_at IS NULL`.
- Timestamp consistency: one `approvalTime` value is used for `approvedAt`, `updatedAt`, and the audit after snapshot.
- No financial, charge, VAT, tax snapshot, profit, or completeness recalculation occurs.

## D. Audit Contract

- Audit action: `shipping_note.approve`.
- The audit write occurs in the same database transaction as the approval update.
- Before snapshot includes `status`, `approvedById`, and `approvedAt`.
- After snapshot includes `status = approved`, `approvedById = actor.id`, and `approvedAt = approvalTime`.
- If the audit write fails, the approval transaction does not independently commit.

## E. Export Compatibility

- Previous eligibility: `checked`.
- New eligibility: `checked | approved`.
- The canonical helper `isInternalXlsxExportEligibleStatus` now backs the shared production export query.
- Internal XLSX and internal print HTML both use `getInternalShippingNoteExportDataForUser`, so both inherit the same status gate.
- `locked` is intentionally not export eligible in Phase 6C.2.
- `cancelled` and `exported` remain non-exportable.
- Phase 7A artifact contract is unchanged: template version `internal-v2`, metadata version `2`, and SHA-256 `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`.

## F. RBAC Matrix

| Capability | Sale | Accountant | Admin |
| --- | --- | --- | --- |
| Mark checked | No | Yes | Yes |
| Approve | No | No | Yes |
| Internal export: Checked | No | Yes | Yes |
| Internal export: Approved | No | Yes | Yes |

Approval uses the existing centralized Admin-all permission semantics.

## G. UI Behavior

- The existing accounting review controls now show `Approve` only when the note is `checked` and the user has `SHIPPING_NOTES_APPROVE`.
- For MVP this means Admin only.
- The approval form uses the existing server action result pattern and disables double submission while pending.
- No modal, reason field, or second-person warning was added.
- The Shipping Note detail export/print control mirrors the canonical export eligibility helper, so it remains available for checked notes and is now available for approved notes to authorized Accountant/Admin users.

## H. Tests

- Unit/policy tests updated for Admin approval permission and checked/approved export eligibility.
- Validator tests cover approval action ID validation.
- Integration tests were extended for:
  - Admin checked-to-approved happy path.
  - `shipping_note.approve` audit before/after snapshots.
  - same Admin checking and approving.
  - Sale approval denial.
  - Accountant approval denial.
  - stale/invalid approval denial without false audit rows.
  - approved-note internal export eligibility for Accountant/Admin.
  - Sale denial for approved internal export.
  - legacy checked-note export compatibility.
- Integration tests were not executed because no current database authorization was provided.

## I. Validation

| Command | Result |
| --- | --- |
| `node ./node_modules/vitest/vitest.mjs run src/lib/permissions/permissions.test.ts src/features/shipping-notes/status-policy.test.ts src/features/shipping-notes/validators.test.ts src/features/shipping-notes/export/read-model.test.ts src/features/shipping-notes/export/generator.test.ts` | PASS, 5 files / 31 tests |
| `npm test` | PASS, 17 files / 79 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED, no current authorization for configured `DATABASE_URL` |
| `npm run test:all` | SKIPPED, no current authorization for configured `DATABASE_URL` |

Sandboxed npm commands hit Node `EPERM` on `C:\Users\Admin`; escalated reruns passed.

## J. Migration State

- New migration created: no.
- Existing Phase 6C.1 migration `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- Migration apply status: NOT RUN.

## K. Files Changed

Phase 6C.2 files changed:

- `src/features/shipping-notes/mutations.ts`
- `src/features/shipping-notes/actions.ts`
- `src/features/shipping-notes/validators.ts`
- `src/features/shipping-notes/validators.test.ts`
- `src/features/shipping-notes/components/accounting-review-controls.tsx`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/features/shipping-notes/status-policy.ts`
- `src/features/shipping-notes/status-policy.test.ts`
- `src/features/shipping-notes/export/queries.ts`
- `src/features/shipping-notes/export/types.ts`
- `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`
- `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts`
- `src/lib/permissions/permissions.test.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_6C2_APPROVAL_IMPLEMENTATION_2026-08-14.md`

Pre-existing dirty/untracked files outside this phase were preserved.

## L. Remaining Workflow

- Lock/Unlock
- Cancellation
- Reopen for correction
- `exported` enum cleanup

## M. Final Verdict

READY FOR LEAD REVIEW
