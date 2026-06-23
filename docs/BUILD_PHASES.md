# Build Phases

## Phase 0 — Repository Audit and Project Bootstrap Plan

Objective:
- Inspect current repository state.
- Identify framework/package manager.
- Propose minimal setup plan.
- Do not build features yet unless repo is empty and prompt explicitly asks.

Deliverable:
- Report current state.
- Recommend setup commands/files.
- List blockers.

## Phase 1 — Minimal Next.js Foundation

Objective:
- Create/confirm Next.js App Router + TypeScript project.
- Add Tailwind/shadcn-compatible structure.
- Add base layout.
- Add basic route groups for auth/dashboard.
- Add lint/typecheck scripts.

Do not:
- Build full dashboard.
- Add database schema yet unless explicitly included.
- Add fake auth.

## Phase 2 — Database and Core Schema

Objective:
- Add Drizzle ORM.
- Define initial PostgreSQL schema:
  - users
  - roles/permissions or role enum
  - shipping_notes
  - parties
  - charges
  - exports
  - audit_logs
- Add migration scripts.
- Add environment variable documentation.

Do not:
- Connect to real production DB without user-provided connection string.
- Generate destructive migrations.
- Over-normalize beyond needed business queries.

## Phase 3 — Authentication and RBAC

Objective:
- Implement login/session.
- Implement server-side role checks.
- Add permission helpers.
- Add route protection.
- Add minimal user management for admin.

Do not:
- Trust frontend-only authorization.
- Expose accounting data to sale.
- Implement complex org/multi-tenant features unless asked.

## Phase 4 — Shipping Note Form MVP

Objective:
- Build create/edit shipping note flow.
- Desktop-first form sections:
  - general info
  - parties
  - shipment details
  - selling charges
- Add server validation.
- Save draft and submit.

Do not:
- Build accounting review yet.
- Build Excel/PDF export yet.
- Hardcode fragile calculations inside UI components.

## Phase 5 — Charge Calculation Engine

Objective:
- Add reusable calculation utilities.
- Support currency/exchange rate.
- Support line item totals.
- Support selling/buying totals and net profit, with role protection.

Do not:
- Implement Vietnam tax legal assumptions without explicit confirmation.
- Scatter formulas across components.

## Phase 6 — Accounting Review

Objective:
- Accountant list/review shipping notes.
- View protected financial fields.
- Configure/override VAT/tax percentage per charge.
- Add review/check/lock statuses.
- Add accounting filters and summary totals.

Do not:
- Add complex tax filing integration.
- Claim legal tax compliance without accountant confirmation.

## Phase 7 — Excel/PDF Export

Objective:
- Generate Excel based on the real shipping note template logic.
- Generate PDF preview/export.
- Store export records in DB.
- Add export status and versioning.

Do not:
- Use Google Drive as source of truth.
- Block request path with long-running exports if implementation becomes heavy.

## Phase 8 — Google Drive Integration

Objective:
- Upload generated artifacts to Drive.
- Store file ID/link/metadata.
- Add retry/error reporting.

Do not:
- Commit credentials.
- Assume customer Google Workspace admin settings.

## Phase 9 — Audit, QA, and Hardening

Objective:
- Add comprehensive audit logging.
- Add seed/dev test data.
- Add QA scenarios for each role.
- Add permission regression tests.
- Prepare deployment checklist.

Do not:
- Add unnecessary features during hardening.
