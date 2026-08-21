# QA Checklist

## General

- App builds successfully.
- TypeScript passes.
- Lint passes.
- Automated unit/policy tests pass with `npm test`.
- No secrets committed.
- `.env.example` is present and safe.
- No unused large dependencies added.
- No placeholder production credentials.

## Automated Validation

- Run `npm test` for repository-owned pure unit and policy tests.
- Treat `npm test` as coverage for deterministic helpers only: permissions, decimal/money calculations, summaries, validation schemas, current status predicates, and selected export safeguards.
- Phase 7A automated export coverage includes persisted tax snapshot read-model tests and exact XLSX V2 `Tax Details` worksheet cell assertions.
- Run `npm run test:integration` when `DATABASE_URL` points to the authorized hosted test/staging database.
- Run `npm run test:all` before release candidates.
- Continue using this checklist for manual QA of full application workflows.
- Phase 9B live database integration currently verifies production query/mutation RBAC, row filtering, migrations, audit persistence, financial summaries, and current accounting/export eligibility paths covered by `tests/integration/**`.
- Add future browser E2E tests before claiming UI workflows, form submissions, redirects, downloads, or session behavior are verified.

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
- Not automated: browser form submissions, redirects, downloads, Better Auth HTTP/session lifecycle, and full binary XLSX cell inspection.

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
- Cannot approve checked notes.
- Cannot access internal export for checked or approved notes.
- Cannot lock or unlock notes.
- Can cancel only own Draft notes with optional reason.
- Cannot cancel Submitted, Accounting Reviewing, Checked, Approved, Locked, or another Sale user's Draft.
- Cannot reopen finalized notes for correction.

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
- Cannot manage tax rules.
- Cannot manage users.

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
- Can create, edit, and deactivate tax rules.
- Deactivated rules remain visible to admin and disappear from new assignment options.
- Cannot edit checked tax data in Phase 6B.2.

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
