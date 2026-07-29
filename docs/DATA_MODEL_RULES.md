# Data Model Rules

## Data Modeling Principle

Model data for reporting, auditing, and permission checks. Do not store important financial data only as free text.

## Recommended Core Entities

- users
- shipping_notes
- shipping_note_parties
- shipping_note_charges
- shipping_note_exports
- audit_logs
- tax_rules
- accounting_periods, when needed

## Shipping Notes

Recommended fields:
- id
- jobsheet_no
- mawb_hawb_no
- shipping_mode
- shipper_id or shipper_text
- consignee_id or consignee_text
- customer_id or customer_text
- agent_id or agent_text
- aol
- aod
- final_destination
- etd
- eta
- volume_value
- volume_unit
- exchange_rate
- status
- created_by
- submitted_at
- checked_by
- checked_at
- approved_by
- approved_at
- locked_at
- created_at
- updated_at
- deleted_at

## Charges

Use line items:
- id
- shipping_note_id
- section: selling | buying
- charge_name
- description
- quantity
- unit
- unit_price
- currency
- exchange_rate
- amount_original
- amount_vnd
- vat_percent
- vat_amount
- tax_rule_id
- tax_rule_code_snapshot
- tax_rule_name_snapshot
- tax_treatment_snapshot: taxable | zero_rated | non_taxable
- vendor_or_agent_text or party_id
- is_override
- override_reason
- created_by
- created_at
- updated_at

## Calculations

Use deterministic calculation functions. Avoid duplicating calculation logic in UI and server.

All financial calculations must consider:
- currency
- exchange rate
- quantity
- unit price
- manual override
- VAT/tax percentage
- rounding policy

Phase 6B.1 VAT basis:
- VAT is calculated from stored `amount_vnd`.
- VAT is rounded per active charge line, half-up, to scale 2.
- Prices are tax-exclusive.
- Tax summaries sum persisted per-line VAT amounts.
- Gross profit remains tax-exclusive.
- Existing rows keep their commercial and VAT values; null tax snapshots are treated as unclassified.

Do not assume legal tax rates without explicit confirmation from the product owner/accountant.

## Status and Locking

Once a shipping note or accounting period is locked:
- Do not allow normal edits.
- Require admin/accountant override permission.
- Record reason in audit log.

## Soft Delete

Business records should be soft-deleted by default.
