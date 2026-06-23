# QA Checklist

## General

- App builds successfully.
- TypeScript passes.
- Lint passes.
- No secrets committed.
- `.env.example` is present and safe.
- No unused large dependencies added.
- No placeholder production credentials.

## RBAC

Test as sale:
- Can create shipping note.
- Can edit own draft.
- Cannot access accounting pages.
- Cannot see buying rate.
- Cannot see net profit.
- Cannot manage users.

Test as accountant:
- Can view shipping notes.
- Can access accounting review.
- Can view buying/profit/tax fields.
- Cannot create shipping note unless explicitly allowed.
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
