# VAT/Tax Implementation Notes

## Phase 6B.1 Foundation

Implementation date: 2026-07-29.

Phase 6B.1 implements the approved VAT/tax domain foundation without adding tax UI controls or XLSX template mappings.

Implemented:

- `tax_treatment` enum with `taxable`, `zero_rated`, and `non_taxable`.
- `tax_rules.code`, `tax_rules.description`, and `tax_rules.tax_treatment`.
- Charge-level tax snapshots:
  - `tax_rule_id`
  - `tax_rule_code_snapshot`
  - `tax_rule_name_snapshot`
  - `tax_treatment_snapshot`
  - existing `vat_percent`
  - existing `vat_amount`
  - existing `is_override`
  - existing `override_reason`
- Deterministic VAT formula:

```text
vatAmountVnd = round_half_up(amountVnd * vatPercent / 100, 2)
```

- Per-line persisted VAT is summed for tax summaries.
- Charge totals including VAT are derived as `amountVnd + vatAmount`.
- Gross profit remains tax-exclusive.
- Admin-only tax rule create/update/deactivate services.
- Accountant/admin tax rule read services.
- Accountant/admin charge tax assignment and taxable VAT override services.
- Sale users are denied tax rules, tax summaries, tax assignment, and tax overrides server-side.
- Checked transition requires every active selling and buying charge to be tax-complete.
- Checked tax is immutable in Phase 6B.1.
- Audit events:
  - `tax_rule.create`
  - `tax_rule.update`
  - `tax_rule.deactivate`
  - `shipping_note_charge.tax_assign`
  - `shipping_note_charge.tax_override`

Backfill behavior:

- Existing charge `vat_percent` and `vat_amount` values are preserved.
- New tax-rule snapshot fields remain null.
- Legacy zero VAT with null snapshots is treated as tax-incomplete for checked transitions.
- No official tax rates or default tax rules were seeded.

Deferred:

- Desktop tax management UI.
- Charge-row tax assignment UI.
- Sale-facing selling VAT display.
- XLSX/PDF tax mapping and template changes.
- Automatic tax-rule matching.
- Tax liability/payable/recoverable reporting.
- Post-checked correction or locked override workflow.

## Phase 6B.2 Accounting UI

Implementation date: 2026-07-29.

Phase 6B.2 adds a desktop-first VAT/tax UI on top of the Phase 6B.1 server services. It does not change the approved calculation, RBAC, snapshot, or checked immutability rules.

Implemented route:

- `/tax-rules`

Implemented UI modules:

- Tax Rules page with accountant read-only active-rule table.
- Admin tax-rule create/edit/deactivate controls.
- Shipping Note tax completeness panel for accountant/admin.
- Accounting-only selling and buying charge tax classification tables.
- Assign/change tax rule panels using active manual tax rules.
- Taxable VAT override panels with mandatory reason.
- VAT-aware accounting summary display.
- Mark Checked disabled reason when loaded tax completeness is incomplete.

Server boundaries:

- Sale users are server-denied from `/tax-rules` and the tax services.
- Sale Shipping Note detail continues to use sale-safe charge DTOs without tax fields.
- Accountant/admin tax UI is fed by `listChargeTaxDetailsForNoteForUser`, `listTaxRulesForUser`, and server-calculated financial summaries.
- UI actions call the Phase 6B.1 production services through server actions and never accept client-computed VAT amounts or tax snapshots.

Read-only behavior:

- Draft: tax classification is unavailable.
- Submitted/accounting_reviewing: accountant/admin assignment and taxable override controls are available.
- Checked: tax values are read-only; no checked override exists in this phase.

Still deferred:

- XLSX VAT mapping and template changes.
- PDF tax output.
- Full browser E2E.
- Better Auth HTTP/session E2E.
- Automatic tax-rule matching.
- Official VAT-rate seed data.
- Tax payable/recoverable/liability reporting.

## Phase 7A Tax-Complete Internal Export V2

Implementation date: 2026-08-09.

Phase 7A extends the existing checked-note internal accounting export so persisted VAT/tax state is represented in both XLSX and internal print HTML. It does not change tax calculation rules, checked eligibility, RBAC, status transitions, or stored data.

Implemented:

- Internal XLSX template version `internal-v2` at `assets/export-templates/shipping-note/internal-v2.xlsx`.
- Pinned V2 template SHA-256: `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`.
- Existing historical `internal-v1.xlsx` preserved.
- Export read model now carries persisted charge tax snapshots for active selling and buying charges.
- Export uses stored `taxRuleCodeSnapshot`, `taxRuleNameSnapshot`, `taxTreatmentSnapshot`, `vatPercent`, `vatAmount`, `isOverride`, and `overrideReason`; it does not look up current live tax rules.
- Tax-inclusive line total is rendered as stored base amount plus persisted VAT amount.
- Summary values include selling/buying subtotal excluding VAT, selling/buying VAT, selling/buying total including VAT, and gross profit excluding VAT.
- XLSX V2 preserves the original `AK` worksheet and adds a `Tax Details` worksheet for explicit VAT/tax mapping.
- Internal print HTML now shows tax rule/treatment, VAT percent, VAT amount, total including VAT, override metadata, and VAT-aware summaries.

Validation:

- `npm test` passed 15 files / 69 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run test:integration` and `npm run test:all` were not executed because the current turn did not explicitly authorize the configured database as test/staging.

Still deferred:

- Generated PDF output.
- Google Drive upload.
- Post-checked approve/export/lock/cancel transitions.
- Browser E2E and Better Auth HTTP/session E2E.
- Checked tax correction workflow.
