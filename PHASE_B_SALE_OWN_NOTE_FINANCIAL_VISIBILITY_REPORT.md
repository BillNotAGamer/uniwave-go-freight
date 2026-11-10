# Phase B — Sale Own-Note Financial Visibility Report

## Authorization design

Phase B adds the narrow permission `shipping-notes:read-own-financials` to Sale. It does **not** grant Sale any of the existing broad permissions:

- `buying-charges:read`
- `financial-summary:read`
- `net-profit:read`

The dedicated server read model requires the narrow permission, requires the actor role to be Sale, and includes both the requested Shipping Note ID and `created_by_id = authenticated user ID` in the database predicate. A guessed ID for another Sale user's note returns no result and never reaches the charge query.

Admin and Accountant continue to use the existing Accounting financial workspace and queries. OPS permissions and redaction are unchanged.

## Financial fields exposed

For an owned Shipping Note, Sale receives only:

- Buying Charge ID for stable row rendering.
- Charge name and description.
- Quantity and unit.
- Unit Buying Rate and its original currency.
- Original-currency line amount.
- Gross Profit excluding VAT in VND.

Gross Profit uses the existing authoritative `summarizeFinancialCharges` calculation: stored Selling VND amount minus stored Buying VND amount. This is explicitly labelled **Gross Profit excluding VAT**, not Net Profit.

The DTO excludes vendor/agent identity, exchange rate, VAT/tax classification, global summaries, Accounting evidence, audit data, exception data, and every mutation capability.

## Server-to-client boundary and UI

- New dedicated server query: `getSaleOwnNoteFinancialViewForUser`.
- New read-only component: `SaleOwnNoteFinancialView`.
- The Shipping Note detail route fetches this DTO only for Sale with the narrow permission.
- The full `UnifiedBuyingWorkspace`, broad Buying Charge query, and broad financial summary remain unavailable to Sale.
- Non-owned notes remain unavailable through the existing note-detail ownership predicate, and the dedicated financial query repeats the ownership check independently.
- The view provides an explicit empty state and no edit, delete, tax, approval, or exception controls.

## Verification

- Focused Vitest: **62/62 passed**.
  - Narrow permission matrix.
  - Exact SQL ownership predicate.
  - Guessed cross-owner ID denial.
  - DTO field allowlist and forbidden-field serialization checks.
  - Genuine server-rendered component output and empty state.
  - Shipping Note page RSC/component boundary.
- Disposable PostgreSQL 18 integration: **7/7 passed** in `charges-financial.integration.test.ts`.
  - Sale owner sees Buying Rate and authoritative Gross Profit.
  - Sale non-owner receives no financial view.
  - Sale remains denied from the broad Buying Charge query and mutations.
  - An authorized Accounting Buying update is reflected on the next read.
- Focused ESLint: **passed**.
- `git diff --check`: **passed**.

The disposable database ran on loopback port `55439`, database `uniwave_phase_ab_integration`, in the independently created PostgreSQL cluster with system identifier `7706690209855810012`. It is distinct from the protected QA port, database, and system identifier.

## Files changed

- `src/lib/permissions/permissions.ts`
- `src/lib/permissions/permissions.test.ts`
- `src/features/shipping-notes/sale-own-note-financial.ts`
- `src/features/shipping-notes/sale-own-note-financial.test.ts`
- `src/features/shipping-notes/components/sale-own-note-financial-view.tsx`
- `src/features/shipping-notes/components/sale-own-note-financial-view.test.ts`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/app/(dashboard)/shipping-notes/[id]/page.test.ts`
- `tests/integration/charges-financial.integration.test.ts`

## Remaining limitations

- This is a Shipping Note detail view, not a global Sale profit report.
- It exposes Gross Profit excluding VAT only; it does not invent or expose a Net Profit metric.
- Browser acceptance with authenticated disposable users is handled separately from the server, component, RSC, and PostgreSQL verification recorded here.
- Full tracked-source quality gates are recorded in the consolidated report after the Phase B commit.
