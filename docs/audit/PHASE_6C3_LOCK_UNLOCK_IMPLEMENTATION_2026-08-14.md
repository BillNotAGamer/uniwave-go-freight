# Phase 6C.3 Lock / Unlock Implementation - 2026-08-14

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Required starting safety commands were run: `git status --short`, `git diff --name-status`, `git ls-files --others --exclude-standard`, `git branch --show-current`, and `git rev-parse HEAD`.
- Working tree was already dirty with Phase 6B, Phase 7A, Phase 6C.1, and Phase 6C.2 files. These were preserved.
- Existing Phase 6C.1 migration `drizzle/0003_hard_titania.sql` was present but not applied in this conversation.

## B. Corrected Lock Policy

- Implemented source: `approved -> locked`.
- Explicitly denied: `checked -> locked`.
- Reason: unlock returns `locked -> approved`; allowing checked to lock would implicitly create an Approved note without a `shipping_note.approve` event.
- Pure policy now reports `canLockShippingNoteStatus("approved") = true` and `canLockShippingNoteStatus("checked") = false`.

## C. Lock Contract

- Mutation: `lockShippingNote`.
- Action: `lockShippingNoteAction`.
- Actor: Admin only via `SHIPPING_NOTES_LOCK`.
- Source/target: `approved -> locked`.
- Lock reason: optional; blank input is normalized to `null`.
- Persistence: `status`, `lockedById`, `lockedAt`, `lockReason`, and `updatedAt`.

## D. Unlock Contract

- Mutation: `unlockShippingNote`.
- Action: `unlockShippingNoteAction`.
- Actor: Admin only via `SHIPPING_NOTES_UNLOCK`.
- Source/target: `locked -> approved`.
- Unlock reason: mandatory and non-blank.
- Current-lock metadata is cleared on unlock: `lockedById`, `lockedAt`, and `lockReason` become `null`.
- No unlock metadata columns were added; unlock history is stored in audit logs.

## E. Mutation / CAS Architecture

- Lock and unlock parse their Zod input schemas in the production mutation layer.
- Both mutations load only transition metadata required for status, lock actor/time, and reason snapshots.
- Lock uses a guarded update requiring `id`, `status = "approved"`, and `deleted_at IS NULL`.
- Unlock uses a guarded update requiring `id`, `status = "locked"`, and `deleted_at IS NULL`.
- One logical timestamp is used for lock `lockedAt`, lock `updatedAt`, and the lock audit after snapshot.
- Unlock uses one logical timestamp for `updatedAt`.

## F. Audit Contract

- Lock audit action: `shipping_note.lock`.
- Unlock audit action: `shipping_note.unlock`.
- Both audit writes occur inside the same DB transaction as the state update.
- Lock audit before/after includes `status`, `lockedById`, `lockedAt`, and `lockReason`.
- Unlock audit before/after includes the same current-lock fields and stores the mandatory unlock reason on the audit event.

## G. Locked Immutability

- Existing normal mutation guards already reject locked notes for draft field edits, selling charge mutation, buying charge mutation, tax assignment, VAT override, Mark Checked, and Approve.
- Integration tests were extended to cover high-risk locked mutation paths through production services: buying charge update, tax assignment, VAT override, and approval repetition.

## H. Export Compatibility

- Previous eligibility: `checked | approved`.
- New eligibility: `checked | approved | locked`.
- The canonical `isInternalXlsxExportEligibleStatus` helper backs the shared internal export data query.
- Internal XLSX and internal print HTML inherit the same locked eligibility through `getInternalShippingNoteExportDataForUser`.
- Export data access does not mutate `shipping_notes.status`.
- `exported` remains non-operational and non-exportable; `cancelled` remains non-exportable.

## I. RBAC Matrix

| Capability | Sale | Accountant | Admin |
| --- | --- | --- | --- |
| Lock | No | No | Yes |
| Unlock | No | No | Yes |
| Export Checked | No | Yes | Yes |
| Export Approved | No | Yes | Yes |
| Export Locked | No | Yes | Yes |

## J. UI Behavior

- The existing accounting review/finalization controls now show `Lock` only to Admin on Approved notes.
- The same controls show `Unlock` only to Admin on Locked notes.
- Lock exposes an optional reason field.
- Unlock requires a non-empty reason and a required confirmation checkbox.
- Sale and Accountant do not see lock or unlock controls.

## K. Tests

- Unit/policy tests updated for approved-only lock, locked-only unlock, and checked/approved/locked export eligibility.
- Validator tests cover optional lock reason normalization, required unlock reason, and invalid ID rejection.
- Permission tests assert Admin lock/unlock through all-permission semantics while Sale/Accountant remain denied.
- Production-path integration tests were extended for lock/unlock happy paths, auth denials, checked-lock denial, stale CAS denial, locked immutability, locked export eligibility, and unlocked approved export compatibility.
- Integration tests were not executed because no current database authorization was provided.

## L. Validation

| Command | Result |
| --- | --- |
| `node ./node_modules/vitest/vitest.mjs run src/lib/permissions/permissions.test.ts src/features/shipping-notes/status-policy.test.ts src/features/shipping-notes/validators.test.ts src/features/shipping-notes/export/read-model.test.ts src/features/shipping-notes/export/generator.test.ts` | PASS, 5 files / 32 tests |
| `npm test` | PASS, 17 files / 80 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED, no current authorization for configured `DATABASE_URL` |
| `npm run test:all` | SKIPPED, no current authorization for configured `DATABASE_URL` |

Sandboxed npm commands hit Node `EPERM` on `C:\Users\Admin`; escalated reruns passed.

## M. Migration State

- New migration created: no.
- Existing Phase 6C.1 migration `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- Migration apply status: NOT RUN.

## N. Files Changed

Phase 6C.3 files changed:

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
- `docs/audit/PHASE_6C3_LOCK_UNLOCK_IMPLEMENTATION_2026-08-14.md`

Pre-existing dirty/untracked files outside this phase were preserved.

## O. Remaining Workflow

- Cancellation
- Reopen for correction
- `exported` enum cleanup

## P. Final Verdict

READY FOR LEAD REVIEW
