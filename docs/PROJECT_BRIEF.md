# Project Brief — Uniwave Go Freight

## Goal

Build a secure internal web application for manually entering logistics shipping notes, storing them in PostgreSQL, exporting them to Excel/PDF, and saving/exporting generated files to Google Drive.

The app is based on a real customer workflow currently handled in Excel shipping note files.

## Primary Users

### Sale
- Creates shipping notes.
- Enters shipment and selling-related fields.
- Can view own assigned shipping notes.
- Must not access accounting-sensitive areas such as buying rates, net profit, tax settings, and audit details unless explicitly allowed.

### Accountant
- Reviews shipping note data.
- Views financial details and accounting reports.
- Enters VAT/tax percentages and accounting overrides.
- Can summarize revenue, cost, profit, and tax-related figures.
- Should not create shipping notes unless the product owner explicitly changes this rule.

### Admin
- Full system access.
- Creates and manages users.
- Manages roles/permissions.
- Can edit/delete users and records according to system policy.
- Can access shipping, accounting, export, and audit areas.

## Core Workflow

1. Sale creates a shipping note as Draft.
2. Sale fills shipment details and selling charges.
3. Sale submits the note for accounting review.
4. Accountant reviews financial/tax data.
5. Accountant/Admin checks or approves.
6. System exports Excel/PDF.
7. Exported file metadata is stored in DB.
8. File can be uploaded/saved to Google Drive.
9. Important changes are tracked in audit logs.

## Shipping Note Data Concepts

General:
- Jobsheet No.
- MAWB/HAWB No.
- Shipping Mode:
  - Domestics/Truck
  - Sea Export
  - Sea Import
  - Air Export
  - Air Import
- Shipper
- Consignee
- Customer
- Agent
- AOL
- AOD / Final Destination
- ETD
- ETA
- Volume
- Volume unit:
  - KGS
  - CBM
  - CONT 20
  - CONT 40
  - RT
- Exchange rate

Charges:
- Selling charges
- Buying charges
- Vendor/agent per charge
- Quantity
- Unit
- Unit price
- Currency
- Exchange rate
- VAT/tax percentage
- Calculated amount
- Optional override and note

Exports:
- Excel export
- PDF export
- Google Drive file ID/link
- Export version
- Exported by
- Exported at

## Security Priority

Financial details are sensitive. Buying rates, net profit, tax settings, and audit logs must be protected by server-side authorization.

## Out of Scope Until Explicitly Requested

- Public landing page
- Customer portal
- Mobile-first workflows
- Multi-tenant SaaS billing
- Complex BI dashboards
- E-invoice integration
- Automatic tax filing
- Full ERP replacement
