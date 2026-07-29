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
