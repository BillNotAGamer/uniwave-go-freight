# Post-Checked Workflow Audit - 2026-08-13

## A. Audit Metadata

- Audit date: 2026-08-13.
- Branch: `feature/ui-overhaul`.
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`.
- Task type: AUDIT ONLY. No workflow implementation, migrations, status transitions, permission changes, schema changes, or application source edits were performed.
- Working tree at audit start: dirty.
- Initial modified tracked files:
  - `docs/BUILD_PHASES.md`
  - `docs/CURRENT_IMPLEMENTATION_STATUS.md`
  - `docs/QA_CHECKLIST.md`
  - `docs/SHIPPING_NOTE_QA.md`
  - `docs/TESTING.md`
  - `docs/VAT_TAX_IMPLEMENTATION.md`
  - `next.config.ts`
  - `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
  - `src/app/(print)/shipping-notes/[id]/print/internal/internal-print.module.css`
  - `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`
  - `src/components/shell/nav-links.ts`
  - `src/features/shipping-notes/components/accounting-review-controls.tsx`
  - `src/features/shipping-notes/components/financial-summary.tsx`
  - `src/features/shipping-notes/export/constants.ts`
  - `src/features/shipping-notes/export/filename.test.ts`
  - `src/features/shipping-notes/export/generator.ts`
  - `src/features/shipping-notes/export/mutations.ts`
  - `src/features/shipping-notes/export/queries.ts`
  - `src/features/shipping-notes/export/types.ts`
  - `tests/integration/tax-domain.integration.test.ts`
- Initial untracked files:
  - `assets/export-templates/shipping-note/internal-v2.xlsx`
  - `docs/audit/CURRENT_STATE_REAUDIT_2026-08-09.md`
  - `docs/audit/PHASE_7A_TAX_EXPORT_IMPLEMENTATION_2026-08-09.md`
  - `src/app/(dashboard)/tax-rules/page.tsx`
  - `src/features/shipping-notes/export/generator.test.ts`
  - `src/features/shipping-notes/export/mutations.test.ts`
  - `src/features/shipping-notes/export/read-model.test.ts`
  - `src/features/shipping-notes/export/read-model.ts`
  - `src/features/shipping-notes/tax/actions.ts`
  - `src/features/shipping-notes/tax/components/accounting-tax-charge-table.tsx`
  - `src/features/shipping-notes/tax/components/tax-completeness-panel.tsx`
  - `src/features/shipping-notes/tax/ui-policy.test.ts`
  - `src/features/shipping-notes/tax/ui-policy.ts`
  - `src/features/tax-rules/actions.ts`
  - `src/features/tax-rules/components/tax-rules-table.tsx`
  - `src/next-config.test.ts`
- Required docs read: `PROJECT_BRIEF.md`, `ARCHITECTURE_DECISIONS.md`, `BUILD_PHASES.md`, `CURRENT_IMPLEMENTATION_STATUS.md`, `DATA_MODEL_RULES.md`, `SECURITY_RBAC_RULES.md`, `QA_CHECKLIST.md`, `TESTING.md`, `VAT_TAX_IMPLEMENTATION.md`, `docs/audit/CURRENT_STATE_REAUDIT_2026-08-09.md`, and `docs/audit/PHASE_7A_TAX_EXPORT_IMPLEMENTATION_2026-08-09.md`.
- Relevant source inspected: schema, constants, status policy, permissions, shipping-note mutations/actions/queries, tax mutations/queries/UI policy, export query/mutation/route, print route, status badge, dashboard/detail UI, audit helper, validators, and integration tests.
- Validation performed: repository reads and targeted searches only. `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` were not rerun because this audit changes no application code; current Phase 7A closure evidence already reports those commands passing. `npm run test:integration` and `npm run test:all` were not run because the current conversation does not explicitly authorize the configured `DATABASE_URL` as test/staging.

## B. Executive Conclusion

The current repository implements a business workflow state machine, not a combined business-and-artifact lifecycle. This is REPOSITORY-PROVEN by the separation between `shipping_notes.status` and `shipping_note_exports.status/version/generatedAt/checksum`.

Recommended default: keep Shipping Note status as a business workflow state. Do not use `shipping_notes.status = exported` for ordinary XLSX/PDF/Drive artifact generation. Export lifecycle should remain in `shipping_note_exports`, because exports can be retried, fail independently, exist in multiple formats/versions, and later include Drive upload status.

Recommended final state machine:

```text
draft
  -> submitted
  -> accounting_reviewing
  -> checked
  -> approved
  -> locked

cancelled is a terminal business exception from draft/submitted/accounting_reviewing/checked/approved.
reopen for correction is an explicit audited exception from checked/approved back to accounting_reviewing.
exported should not be a normal Shipping Note status.
```

Severity findings:

- P1 REPOSITORY-PROVEN: post-checked states are present in enum/UI but unreachable through application mutations.
- P1 REPOSITORY-PROVEN: `exported` as a note status conflicts with existing export records unless given a strict exceptional meaning.
- P1 REPOSITORY-PROVEN: `checkedAt`, `approvedAt`, `lockedById`, cancellation metadata, and correction metadata are missing for operational workflow reporting.
- P2 INFERRED: current status mutations use compare-and-set guards, but future post-checked transitions need the same guard discipline plus stronger charge-update stale protection.

## C. Current State Machine

Supported status values in schema/constants:

| Status | Reachable by app mutation | Queryable | Editable | Financially readable | Internal exportable | Tax mutable | UI renders badge | Mutation enters | Mutation leaves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `draft` | yes | yes | draft fields and selling charges for owner sale/admin | no | no | no | yes | create draft | submit |
| `submitted` | yes | yes | buying charges and tax for accountant/admin | yes | no | yes | yes | submit | start review |
| `accounting_reviewing` | yes | yes | buying charges and tax for accountant/admin | yes | no | yes | yes | start review | mark checked |
| `checked` | yes | yes | no normal charge/tax mutation | yes | yes | no | yes | mark checked | none |
| `approved` | no | yes if manually stored | no normal mutation | yes | no by current policy | no | yes | none | none |
| `exported` | no | yes if manually stored | no normal mutation | yes | no by current policy | no | yes | none | none |
| `locked` | no | yes if manually stored | no normal mutation | yes | no by current policy | no | yes | none | none |
| `cancelled` | no | yes if manually stored | no normal mutation | no in detail-page summary fetch; note remains list/detail queryable | no | no | yes | none | none |

Current implemented transitions:

```text
draft -> submitted
submitted -> accounting_reviewing
accounting_reviewing -> checked
```

Evidence:

- `src/lib/db/schema.ts` and `src/features/shipping-notes/constants.ts` define all eight statuses.
- `src/features/shipping-notes/status-policy.ts` defines only `submitted -> accounting_reviewing` and `accounting_reviewing -> checked` as current accounting transitions.
- `src/features/shipping-notes/mutations.ts` exports no approve/export/lock/cancel/reopen workflow functions.
- `src/features/shipping-notes/status-policy.test.ts` asserts `checked -> approved` and `checked -> exported` are unsupported and internal XLSX is `checked` only.

## D. Current `checked` Contract

Current `checked` guarantees:

- REPOSITORY-PROVEN: actor has `SHIPPING_NOTES_MARK_CHECKED`; accountant and admin have it, sale does not.
- REPOSITORY-PROVEN: note was in `accounting_reviewing` when updated; mutation uses `WHERE status = 'accounting_reviewing'`.
- REPOSITORY-PROVEN: all active charge rows must be tax-complete before entering `checked`.
- REPOSITORY-PROVEN: `checkedById` is set to the acting user.
- REPOSITORY-PROVEN: audit event `shipping_note.accounting_review.checked` is written in the same transaction as the status update.
- REPOSITORY-PROVEN: tax assignment/override is denied for checked notes because tax mutable statuses are only `submitted` and `accounting_reviewing`.
- REPOSITORY-PROVEN: buying charges are not mutable on checked notes because buying charge mutable statuses are only `submitted` and `accounting_reviewing`.
- REPOSITORY-PROVEN: selling charges are not mutable after draft.
- REPOSITORY-PROVEN: internal XLSX/print export is eligible only for checked notes.

Current gaps:

- P1 REPOSITORY-PROVEN: no `checkedAt` column exists; event time must be inferred from audit row or `updatedAt`.
- P2 REPOSITORY-PROVEN: `checked` does not guarantee approval by a second actor.
- P2 REPOSITORY-PROVEN: `checked` does not set `lockedAt` and is not terminal in the enum, but no forward transition exists.

## E. `approved` Analysis

`approved` can be meaningfully distinct from `checked` if the business wants a second-stage authorization that says the checked accounting record is accepted for official downstream artifacts or operational closure. It should not be added as another click unless the approval actor, eligibility, and downstream consequences are clear.

Answers:

1. Who performs `checked` today? Accountant or admin with `SHIPPING_NOTES_MARK_CHECKED`.
2. Who should perform `approved`? Recommended default: admin only for MVP, or a new explicit approval permission granted to a lead accountant/admin if product requires accounting-led approval. PRODUCT DECISION REQUIRED.
3. Is approval a second-person control? Recommended default: yes, if approval exists. Otherwise it adds little value over checked.
4. Can the same user check and approve? Recommended default: no for normal flow, but admin override can be a documented exception with reason. PRODUCT DECISION REQUIRED.
5. Should accountant approve? Not by default. Accountant already checks; lead accountant approval requires a distinct role/permission that does not exist.
6. Should admin approve? Yes by safe default, because admin has all permissions and currently owns destructive/override authority.
7. Should approval require a distinct permission? Yes. Add `SHIPPING_NOTES_APPROVE`; do not overload `SHIPPING_NOTES_MARK_CHECKED`.
8. Does approval add real meaning? Yes only if it represents a second-person/final business acceptance checkpoint.
9. Should approval be required before internal export? Recommended compatibility default: no initially; keep checked exports valid while adding approved as optional/forward state. A later policy may require approved for new records.
10. Should existing checked exports remain valid if approval is introduced? Yes. Historical V1/V2 export records remain valid artifacts.
11. Should previously checked notes require retroactive approval? No automatic retroactive requirement. Legacy checked notes should remain exportable unless product explicitly orders a migration/review queue.

## F. `exported` Status Analysis

Recommended default: `exported` should not be a normal Shipping Note status.

Repository evidence:

- `shipping_note_exports` already stores `exportType`, `version`, `status`, `fileName`, `checksum`, `generatedById`, `generatedAt`, `driveFileId`, and `driveUrl`.
- Export record statuses include `pending`, `generated`, `uploaded`, and `failed`.
- Phase 7A internal XLSX V2 persists export artifact version `2` independently from note status.
- Export mutation code never changes `shipping_notes.status`.

Why note-level `exported` is misleading:

- Multiple XLSX exports can exist.
- Future PDF can succeed while XLSX fails, or vice versa.
- Future Drive upload can fail after a local artifact is generated.
- Re-export creates a new artifact version without changing accounting state.
- A pending export can crash before failure is recorded.
- `shipping_note_exports.status = uploaded` already communicates Drive upload state more precisely than `shipping_notes.status = exported`.

Recommended classification for enum value:

- `exported`: REPLACE with export-record lifecycle for normal use.
- Keep reserved temporarily for schema compatibility, but do not implement a transition to it in the next workflow patch.
- Future migration may remove `exported` from `shipping_note_status` only after auditing data and application references.

Strict definition if business insists on keeping it:

- `exported` could mean "all required official artifact types for this note have at least one generated or uploaded export record." This is DERIVED state, not a primary mutable note status, and is unsafe until PDF/Drive requirements exist.

## G. Locking Analysis

Recommended default: `locked` means business data is immutable because the note is operationally closed, while read/export remains allowed.

What becomes immutable:

- Shipping Note fields.
- Selling charges.
- Buying charges.
- Tax snapshots and override metadata.
- Normal status transitions, except privileged unlock/correction/cancel if explicitly allowed.

What remains allowed:

- Reading by authorized users.
- Generating a representation of immutable data, including re-exporting XLSX/PDF.
- Upload retry for existing/generated export artifacts.
- Audit reads by authorized users once an audit viewer exists.

Lock policy answers:

1. Who may lock? Recommended default: admin with new `SHIPPING_NOTES_LOCK`; possibly lead accountant by product decision.
2. Manual or automatic? Manual in MVP. Automatic period locking belongs to a future accounting-period model.
3. Does export automatically lock? No. Export is an artifact side effect and may fail/retry; do not couple it to final business immutability.
4. Does approval automatically lock? Not by default. Approval and lock should be separate unless product wants approval to mean immediate closure.
5. Can admin unlock? Recommended: yes, with reason, as privileged override.
6. Can accountant unlock? Not by default; PRODUCT DECISION REQUIRED for lead-accountant role.
7. Is reason mandatory? Yes for unlock and recommended for lock.
8. Is unlock a workflow transition or override? Privileged override.
9. Does locking need `lockedById`? Yes for queryable actor metadata.
10. Is current `lockedAt` sufficient? No. It records time but not actor/reason, and no mutation uses it.
11. Is unlock timestamp needed? Yes if unlock is supported.
12. Should accounting periods eventually perform locking instead? Yes for bulk/monthly finalization. Note-level locking should not conflict: period locking should imply note-level immutability, not require changing every note status.

## H. Cancellation Analysis

Recommended default: cancellation is a business state, not deletion. `cancelled` and `deletedAt` are different concepts.

- `cancelled`: record remains visible and auditable; business process stopped or invalidated.
- `deletedAt`: soft-deleted application record excluded from active reads, generally for mistaken/test/admin removal.

Cancellation by source state:

| Source | Recommendation | Actor | Reason | Reversible | Financial visibility | Prior exports |
| --- | --- | --- | --- | --- | --- | --- |
| `draft` | allow | owner sale or admin | recommended, not mandatory for sale draft | no normal reopen; create new draft if needed | no financial summary | none expected |
| `submitted` | allow | owner sale before review, accountant/admin after submission | mandatory | admin-only reopen if needed | accountant/admin can inspect if permitted | none expected |
| `accounting_reviewing` | allow | accountant/admin | mandatory | admin-only reopen to reviewing if product wants | financial/tax visible to authorized roles | none expected |
| `checked` | allow only as exceptional void/cancel | admin by default | mandatory | not by default; reopen correction preferred before cancel | financial/tax visible to authorized roles | remain historical artifacts, new exports blocked unless specifically "cancelled copy" is required |
| `approved` | allow only as exceptional void/cancel | admin by default | mandatory | not by default | financial/tax visible to authorized roles | remain historical artifacts |
| `exported` | avoid as note status | n/a | n/a | n/a | n/a | use export records |
| `locked` | do not directly cancel while locked; require unlock or privileged cancel-locked action | admin | mandatory | no | financial/tax visible to authorized roles | remain historical artifacts |

Cancelled notes should block new internal accounting exports by default. If a cancelled-note artifact is needed, make that a separately labeled cancellation/void document.

## I. Correction / Reopen Analysis

A practical workflow needs a way to handle mistakes found after checking or approval. Recommended default:

- Support `checked -> accounting_reviewing` as "reopen for correction" with mandatory reason and admin permission.
- Support `approved -> accounting_reviewing` only as stricter admin override with mandatory reason.
- Do not support reopening `locked` without a separate unlock action first.
- Do not silently mutate historical exports.
- After correction and re-check/approval, new exports create new `shipping_note_exports` records with current artifact version.

Tax consequences:

- Checked tax snapshots are immutable in normal flow.
- Reopen moves the note back into the tax-mutable status where tax corrections can be made through the same audited assignment/override services.
- Already-generated exports remain historical artifacts of the earlier checked state; they should not be rewritten.

Alternatives rejected:

- Cancellation and recreation only: safer but operationally heavy and fragments audit trail.
- Admin editing checked tax in place: high reproducibility risk unless it creates a new correction state/export version boundary.
- No correction in MVP: acceptable for a first slice, but risky once real accounting users rely on checked artifacts.

## J. Export Eligibility Analysis

Current policy:

```text
checked only
```

Recommended near-term policy:

```text
checked or approved or locked, excluding cancelled
```

Rationale:

- Backward compatibility preserves existing checked exports and historical Phase 7A behavior.
- Approved should not make checked artifacts invalid retroactively.
- Locked means immutable, so representation generation remains safe.
- Export generation should not mutate note status.

If product later makes approval mandatory:

- New records can require `approved` before official external PDF/Drive upload.
- Internal review XLSX should still support legacy checked records or display a clear legacy eligibility policy.
- Existing checked export records remain valid and untouched.

Locked notes should remain exportable/re-exportable because export changes artifact metadata, not business data.

## K. RBAC Matrix

| Capability | Sale | Accountant | Admin | Existing permission | Recommended permission |
| --- | --- | --- | --- | --- | --- |
| Mark checked | no | yes | yes | `SHIPPING_NOTES_MARK_CHECKED` | keep |
| Approve | no | no by default | yes | none | add `SHIPPING_NOTES_APPROVE` |
| Generate internal export | no | yes for eligible state | yes for eligible state | `SHIPPING_NOTES_EXPORT_INTERNAL` | keep; update eligible statuses later |
| Lock | no | decision required | yes | none | add `SHIPPING_NOTES_LOCK` |
| Unlock | no | no by default | yes | none | add `SHIPPING_NOTES_UNLOCK` |
| Cancel draft | owner sale allowed | no | yes | none | add `SHIPPING_NOTES_CANCEL` or split draft cancel |
| Cancel submitted/reviewing | no by default after submission; owner sale maybe submitted-before-review decision | yes for submitted/reviewing if product allows | yes | none | add `SHIPPING_NOTES_CANCEL` |
| Cancel checked/approved | no | no by default | yes | none | add `SHIPPING_NOTES_CANCEL_FINALIZED` or admin destructive action |
| Reopen for correction | no | no by default | yes | none | add `SHIPPING_NOTES_REOPEN_FOR_CORRECTION` |

Permission design recommendation:

- Add explicit capability constants instead of hardcoding role names.
- Admin keeps all permissions through existing `hasPermission` admin override.
- Accountant approval/unlock/cancel-finalized requires product decision and possibly a future lead-accountant role.

## L. Audit Event Contract

Recommended audit action names should follow current dot-delimited convention:

| Transition | Audit action | Entity | Before | After | Reason | Transaction |
| --- | --- | --- | --- | --- | --- | --- |
| `checked -> approved` | `shipping_note.approve` | `shipping_note` | prior status/actor/timestamps | approved status/actor/timestamp | optional unless same checker override | same tx as status update |
| `approved -> locked` or `checked -> locked` | `shipping_note.lock` | `shipping_note` | prior status/locked fields | locked status/actor/timestamp | recommended mandatory | same tx |
| `locked -> approved` or previous state | `shipping_note.unlock` | `shipping_note` | locked state | unlocked/restored state | mandatory | same tx |
| any allowed `-> cancelled` | `shipping_note.cancel` | `shipping_note` | prior status | cancelled fields/status | mandatory except possibly draft owner cancel | same tx |
| `checked/approved -> accounting_reviewing` | `shipping_note.reopen_for_correction` | `shipping_note` | finalized state | reviewing state/correction marker | mandatory | same tx |

Important rule: status/actor/timestamp/reason and audit log must update atomically in one database transaction. Export file generation should not run inside a status transition transaction.

## M. Timestamp / Actor Model

Current schema:

- Has `submittedAt`.
- Has `checkedById`, but no `checkedAt`.
- Has `approvedById`, but no `approvedAt`.
- Has `lockedAt`, but no `lockedById` or lock reason.
- Has no cancellation metadata.
- Has no correction/reopen metadata.

Recommendation:

- Add queryable columns for transition facts users filter/report on.
- Keep rich before/after details in audit logs.
- Do not rely solely on audit logs for common operational queries like "checked this week", "approved by whom", "cancelled why", or "locked by whom".

Recommended metadata:

| Concept | Recommended columns | Reason |
| --- | --- | --- |
| Checked | `checked_at` | pairs with existing `checked_by_id`; important for reports and export timelines |
| Approved | `approved_by_id`, `approved_at` | existing actor column needs timestamp |
| Locked | `locked_by_id`, `locked_at`, optional `lock_reason` | current `lockedAt` alone is insufficient |
| Cancelled | `cancelled_by_id`, `cancelled_at`, `cancel_reason` | cancellation is business-visible and reason-bearing |
| Reopen/correction | prefer audit only at first; optionally `reopened_by_id`, `reopened_at`, `reopen_reason` if frequent reporting is needed | avoids schema bloat until correction workflow volume is known |
| Unlock | audit only at first; add `unlocked_by_id`, `unlocked_at`, `unlock_reason` if unlock becomes a normal operation | unlock should be exceptional |

## N. Proposed Schema Delta

Do not generate this migration until decisions are approved.

| Table | Column | Type | Nullable/default | FK | Index | Backfill | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `shipping_notes` | `checked_at` | `timestamp(3)` | nullable | none | optional index with status if reporting needs | null for historical unless safely backfilled from audit | queryable checked time |
| `shipping_notes` | `approved_at` | `timestamp(3)` | nullable | none | optional | null | pairs with existing `approved_by_id` |
| `shipping_notes` | `locked_by_id` | `text` | nullable | `users.id` set null | optional | null | queryable lock actor |
| `shipping_notes` | `lock_reason` | `text` | nullable | none | none | null | visible reason if lock is manual |
| `shipping_notes` | `cancelled_by_id` | `text` | nullable | `users.id` set null | optional | null | queryable cancel actor |
| `shipping_notes` | `cancelled_at` | `timestamp(3)` | nullable | none | optional status/time index | null | queryable cancel time |
| `shipping_notes` | `cancel_reason` | `text` | nullable | none | none | null | mandatory for non-draft cancellation |

Status enum recommendation:

- Keep `approved`, `locked`, and `cancelled`.
- Keep `exported` only as reserved/backward-compatible until a future enum cleanup migration.
- Do not add status values for correction unless product wants explicit correction reporting; `accounting_reviewing` plus audit reason is enough for MVP reopen.

## O. Legacy / Backfill Strategy

- Existing checked notes have `checkedById` but no `checkedAt`.
- Safest default: leave `checked_at` null for historical rows unless audit logs can be confidently matched.
- Optional one-time backfill from audit logs: use `audit_logs.created_at` for `shipping_note.accounting_review.checked` only if there is exactly one matching audit event for the note.
- Do not backfill `checked_at` from `updatedAt`; later edits or export metadata do not reliably indicate check time.
- Existing `approvedById` should remain null unless there is proven external data.
- Existing export records remain untouched.
- If `exported` rows exist from manual DB edits, do not auto-convert without a data audit.
- Cancelled metadata starts null; no historical cancellation should be invented.

## P. Concurrency / Transaction Analysis

Current strengths:

- Draft update uses `WHERE id = ? AND status = 'draft'`.
- Submit uses `WHERE id = ? AND status = 'draft'`.
- Start review uses `WHERE id = ? AND status = 'submitted'`.
- Mark checked uses `WHERE id = ? AND status = 'accounting_reviewing'`.
- Transition updates and audit writes occur in the same transaction.

Current weaknesses relevant to future work:

- Some charge mutations load parent status before the transaction and update the charge by id/section/deleted flag without joining/guarding the parent status inside the update.
- Tax mutations load charge and parent status inside a transaction, but charge update itself is by charge id only.

Future requirements:

- Every post-checked transition must use compare-and-set status guards.
- Every correction-sensitive charge/tax mutation should verify parent status inside the transaction immediately before update, or use a guarded update pattern that joins/checks parent state.
- Race examples:
  - Accountant approves while admin cancels: one guarded update wins; the loser receives stale-state denial.
  - Admin locks while accountant attempts reopen: lock/reopen must require expected source state; stale UI attempt fails.
  - Export starts while cancel happens: export read should re-check eligibility near metadata creation, and export should not change note status.

Export transaction boundary:

- File generation should remain outside database transactions.
- Pending export record creation can happen before generation.
- Generated/failed status plus audit event should remain transactional.
- A future background worker may repair stale pending records; do not solve that in post-checked workflow.

## Q. UI Interaction Recommendations

Do not redesign the page. Future controls should live in the existing financial/accounting area of `src/app/(dashboard)/shipping-notes/[id]/page.tsx`.

Recommended placement:

- Approve: in `AccountingReviewControls` or a sibling `FinalizationControls` panel shown for `checked` notes to authorized approvers.
- Lock: in a finalization/administration panel shown after `approved` or `checked` depending on final policy.
- Cancel: in a separate danger-area style panel; do not mix with routine review buttons.
- Reopen/unlock: admin-only control in the finalization/danger panel with explicit reason field.
- Export: remain near page header/action area; eligibility should be computed server-side and mirrored in UI.

Confirmation/reason UX:

- Routine start review/check: no confirmation; checked already has tax completeness gate.
- Approve: no dialog if second-person approval is routine; show clear disabled reason when same checker cannot approve.
- Cancel: confirmation required; reason mandatory except possibly draft owner cancel.
- Reopen: confirmation and reason required.
- Unlock: confirmation and reason required.
- Lock: reason recommended; confirmation optional if clearly labeled.

Sale boundary:

- Sale may see status labels if business-relevant.
- Sale must not receive buying charges, vendor costs, profit, tax snapshots, tax override reasons, export metadata, or audit details.
- Future action responses should return minimal success/error data only.

## R. Required Future Tests

Unit/policy tests:

- Valid transitions and invalid transitions for all statuses.
- Role permission matrix for approve, lock, unlock, cancel, reopen.
- Same-checker approval policy.
- Export eligibility for checked/approved/locked/cancelled.
- Cancellation source-state matrix.
- Locking mutability policy.
- Reopen/correction policy.
- Status label/badge coverage after enum decisions.

DB integration tests:

- Guarded status transition under expected source state.
- Actor/timestamp/reason persistence.
- Audit event atomicity with transition update.
- Stale transition denial.
- Sale denial.
- Accountant/admin boundaries.
- Cancelled export denial.
- Locked data immutability.
- Locked note remains exportable if policy says yes.
- Legacy checked note behavior with null `checked_at`.
- Correction creates new export version without mutating old export records.

HTTP/browser tests:

- Action visibility by role/status.
- Confirmation/reason UX.
- Stale UI submission failure message.
- Direct server action/API authorization.
- Sale cannot inspect accounting details in any new status.

## S. Decision Register

| Decision | Options | Repository Evidence | Recommended Default | Business Decision Required? |
| --- | --- | --- | --- | --- |
| Is `approved` needed? | no, optional, mandatory | enum/`approvedById` exist; no mutation | yes, as second-person final acceptance | yes |
| Who approves? | accountant, admin, lead accountant | accountant already checks; admin has all permissions | admin in MVP; lead accountant only if role/permission added | yes |
| Can checker approve? | yes, no, admin override | no current approval | no normal same-user approval; admin override with reason if needed | yes |
| Is `exported` a Shipping Note status? | yes, no, derived | export records already model artifact lifecycle | no normal note status; use export records | no for engineering default, yes if business insists |
| Does export change note status? | yes, no | current export path only writes `shipping_note_exports` | no | no |
| Is `locked` manual or automatic? | manual, on approval, on export, period-driven | `lockedAt` exists unused; no accounting periods | manual in MVP; period-driven later | yes |
| Does lock block export? | yes, no | export is read/artifact generation | no; locked should remain exportable | yes |
| Who can unlock? | admin, accountant, no one | no unlock permission | admin only with reason | yes |
| Is unlock supported? | no, yes override | lock is not implemented | yes as exceptional admin override if lock exists | yes |
| Cancellation allowed from which states? | all, early only, final exception only | enum exists, no mutation | draft/submitted/reviewing allowed; checked/approved admin exception; locked requires unlock | yes |
| Who can cancel? | sale/accountant/admin split | no permission | owner sale for draft; accountant/admin for in-review; admin for finalized | yes |
| Is reason required? | no, some states, all | audit supports reason | mandatory except possibly draft owner cancel | yes |
| Can cancelled notes be reopened? | yes, no, admin only | no current cancellation | no normal reopen; admin-only restoration only if product needs it | yes |
| Can checked notes be corrected? | no, reopen, in-place override | checked tax immutable; exports reproducible | audited reopen to accounting_reviewing | yes |
| What happens to exports after correction? | rewrite, invalidate, keep historical | export records are versioned append records | keep historical; new exports after re-check | no |
| Future export eligibility after approval | checked only, approved only, checked/approved/locked | checked-only current policy | checked/approved/locked excluding cancelled | yes |
| Legacy checked-note behavior | force approval, grandfather, migrate | existing checked exports valid | grandfather; no retroactive approval | yes |

## T. Recommended Final State Machine

Recommended state machine:

```text
draft
  -> submitted
  -> accounting_reviewing
  -> checked
  -> approved
  -> locked

draft -> cancelled
submitted -> cancelled
accounting_reviewing -> cancelled
checked -> cancelled
approved -> cancelled

checked -> accounting_reviewing        (reopen for correction)
approved -> accounting_reviewing       (privileged reopen for correction)
locked -> approved                     (unlock, if supported)
```

`exported` should not be a normal Shipping Note status. Exports are represented by `shipping_note_exports`.

Transition contract:

| Transition | Actor | Permission | Preconditions | Reason | Persist | Audit |
| --- | --- | --- | --- | --- | --- | --- |
| `draft -> submitted` | owner sale/admin | existing `SHIPPING_NOTES_EDIT_OWN` | draft; ownership for sale | no | `submittedAt` | existing `shipping_note.submit` |
| `submitted -> accounting_reviewing` | accountant/admin | existing `SHIPPING_NOTES_ACCOUNTING_REVIEW` | submitted | no | status | existing `shipping_note.accounting_review.start` |
| `accounting_reviewing -> checked` | accountant/admin | existing `SHIPPING_NOTES_MARK_CHECKED` | reviewing; all active charges tax-complete | no | `checkedById`, add `checkedAt` | existing `shipping_note.accounting_review.checked` |
| `checked -> approved` | admin or lead approver | new `SHIPPING_NOTES_APPROVE` | checked; approval policy satisfied | required if same-checker override allowed | `approvedById`, `approvedAt` | `shipping_note.approve` |
| `approved -> locked` | admin | new `SHIPPING_NOTES_LOCK` | approved; not cancelled | recommended | `lockedById`, `lockedAt`, status | `shipping_note.lock` |
| `checked -> locked` | admin | new `SHIPPING_NOTES_LOCK` | checked; if approval skipped by policy | recommended | lock fields/status | `shipping_note.lock` |
| early `-> cancelled` | sale owner/accountant/admin by policy | new cancel permission | not locked; status allowed | mandatory except maybe draft | cancel fields/status | `shipping_note.cancel` |
| finalized `-> cancelled` | admin | finalized cancel permission | checked/approved; not locked unless privileged | mandatory | cancel fields/status | `shipping_note.cancel` |
| `checked/approved -> accounting_reviewing` | admin | new reopen permission | no locked state; reason supplied | mandatory | status; optional correction metadata | `shipping_note.reopen_for_correction` |
| `locked -> approved` | admin | new unlock permission | locked; reason supplied | mandatory | clear/record lock state per policy | `shipping_note.unlock` |

## U. Implementation Slices

### Slice 1 - Status Policy Foundation and Timestamps

- Blast radius: schema, migration, status policy helpers, tests.
- Migration: add `checked_at`, `approved_at`, `locked_by_id`, cancellation metadata as approved.
- RBAC impact: add new permission constants but do not expose UI until transitions exist.
- Tests: unit policy matrix and schema/migration integration.
- Dependency: decision on approval actor and cancellation metadata.

### Slice 2 - Approval Transition

- Blast radius: mutations/actions/detail UI/accounting controls/tests.
- Migration: depends on Slice 1.
- RBAC impact: `SHIPPING_NOTES_APPROVE`.
- Tests: checked-to-approved, same-checker denial if chosen, audit atomicity, stale denial, sale/accountant/admin boundaries.
- Dependency: approval policy decision.

### Slice 3 - Export Eligibility Update

- Blast radius: `status-policy.ts`, export query, print route assumptions, tests.
- Migration: none expected.
- RBAC impact: none beyond existing export permission.
- Tests: checked/approved/locked eligibility, cancelled denial, legacy checked preservation.
- Dependency: approval/lock status semantics.

### Slice 4 - Cancellation

- Blast radius: validators, mutations/actions, UI danger area, queries/financial visibility policy, tests.
- Migration: cancellation fields.
- RBAC impact: cancel permissions.
- Tests: state matrix, reason requirement, export denial, prior export preservation, audit.
- Dependency: cancellation source-state decisions.

### Slice 5 - Lock/Unlock

- Blast radius: schema fields if not in Slice 1, status policy, mutations/actions, UI, tests.
- Migration: lock actor/reason fields and optional unlock metadata.
- RBAC impact: lock/unlock permissions.
- Tests: locked mutability denial, locked export allowed, unlock reason/audit, stale races.
- Dependency: manual vs automatic lock decision.

### Slice 6 - Reopen for Correction

- Blast radius: status policy, mutation/action, UI, charge/tax mutability checks, export history tests.
- Migration: optional correction metadata.
- RBAC impact: reopen permission.
- Tests: checked/approved reopen, locked denial, reason/audit, old export record preservation, new export after re-check.
- Dependency: correction policy and whether approval is mandatory.

## V. Risks

- P1: Implementing `exported` as a note status will conflict with multiple artifact versions and future partial PDF/Drive failures.
- P1: Adding approval without a second-person policy may create a hollow state that slows workflow without improving control.
- P1: Reopen/correction can break historical reproducibility if old export records are rewritten or checked tax snapshots mutate without a new review boundary.
- P2: Missing timestamp/actor columns will make operational reporting depend on audit JSON queries.
- P2: Charge mutation race windows should be tightened before adding correction/lock workflows.
- P2: Sale-facing UI or action responses could leak accounting data if new status panels reuse accountant DTOs.
- P3: Keeping `exported` in the enum as reserved creates ongoing documentation/UI confusion until cleaned up.

## W. Immediate Next Implementation Recommendation

Implement Slice 1 first: status policy foundation and transition metadata.

Why:

- It resolves the schema/auditability gap before UI or behavior depends on the new states.
- It allows tests to codify the chosen state machine before adding buttons.
- It keeps the first patch small: migration, constants/permissions, policy helpers, and unit/integration tests.
- It avoids premature PDF/Drive/export coupling and preserves existing Phase 7A export behavior.

Do not implement `shipping_notes.status = exported` in the next slice. Keep export lifecycle in `shipping_note_exports`.
