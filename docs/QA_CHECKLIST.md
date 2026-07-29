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
- Automated: current accounting transitions are limited to `draft -> submitted -> accounting_reviewing -> checked`.
- Automated: checked transition requires every active charge to have complete tax snapshots.
- Automated: tax-rule create/deactivate, charge tax assignment, taxable VAT override, sale denial, checked immutability, and tax summaries are covered by hosted integration tests.
- Automated: Internal XLSX export data is limited to checked notes and authorized roles.
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
- Cannot manage users.

Test as accountant:
- Can view shipping notes.
- Can access accounting review.
- Can view buying/profit/tax fields.
- Can assign charge tax rules and override taxable VAT in submitted/accounting_reviewing status with a reason.
- Cannot create shipping note unless explicitly allowed.
- Cannot manage tax rules.
- Cannot manage users.

Test as admin:
- Can access all areas.
- Can manage users.
- Admin actions are audited.

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
- Review/lock status prevents unauthorized edits.
- Totals match stored line items.

## Export

- Export is generated from stored data.
- Export record is saved.
- Export version is tracked.
- Google Drive metadata is saved when uploaded.
- Failed export/upload has visible error status.

## Audit

- Create/update/delete/export actions are logged.
- Sensitive changes show before/after where appropriate.
- Audit logs are not visible to unauthorized roles.
