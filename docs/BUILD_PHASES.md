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

## Audited Implementation Status — 2026-07-29

This section records observed implementation status from a repository-wide audit. It does not rewrite the planned phase requirements above, and it should not be used to weaken the intended architecture, security, QA, data model, or workflow rules.

- Branch: `feature/ui-overhaul`
- Commit: `1a1b02f18fc6a8c693bb946af5fe238227ac5946`
- Working tree during audit: dirty before documentation edits; pre-existing modified app/UI files and untracked `.claude/`, `docs/audit/`, `src/components/ui/feedback.tsx`, and `src/components/ui/status-badge.tsx` were not changed by the audit.
- Most advanced implemented phase: Phase 7, but only the internal XLSX subset.
- Most advanced verified phase: Phase 6 partial behavior is live database-verified for the current workflow through `checked`; Phase 7 internal XLSX export-data eligibility is live database-verified for checked notes.
- Current-state reference: `docs/CURRENT_IMPLEMENTATION_STATUS.md`

| Phase | Audited status | Evidence summary |
| --- | --- | --- |
| 0 - Repository audit/bootstrap | VERIFIED | Repository structure, docs, scripts, schema, migrations, and source boundaries are present. |
| 1 - Minimal Next.js foundation | VERIFIED | Next.js App Router, TypeScript strict mode, Tailwind, route groups, shell layout, `npm run typecheck`, `npm run lint`, and `npm run build` pass. |
| 2 - Database and core schema | PARTIAL | Drizzle schema and migrations exist for main tables, and committed migrations apply successfully against the authorized hosted test/staging database. Separate parties, accounting periods, and checked/approved timestamps are missing. |
| 3 - Authentication and RBAC | PARTIAL | Better Auth, active-user session checks, role permissions, and bootstrap scripts exist; admin user-management UI and route-protection middleware are missing. |
| 4 - Shipping Note Form MVP | IMPLEMENTED - LIVE DB VERIFIED | Create/edit/list/detail/submit flows and server validation exist; hosted database workflow tests passed against PostgreSQL. |
| 5 - Charge Calculation Engine | IMPLEMENTED - UNIT AND LIVE DB VERIFIED | BigInt decimal helpers, selling/buying charge CRUD, summaries, profit calculation, and VAT amount helpers exist; pure calculations are unit-tested; hosted DB charge and financial-summary tests passed. |
| 6 - Accounting Review | PARTIAL - LIVE DB VERIFIED FOR CURRENT FLOW | `submitted -> accounting_reviewing -> checked` exists with audit writes and passed hosted DB transition tests; Phase 6B.1 added tax-rule services, charge tax assignment/override, VAT summaries, and checked tax completeness. VAT/tax UI, approve/export/lock/cancel transitions, accounting filters, and accounting periods are still missing. |
| 7 - Excel/PDF Export | PARTIAL | Internal XLSX export exists with template hash pinning, export records, sanitized errors, and print view; PDF export is not implemented. |
| 8 - Google Drive Integration | DOCUMENTED ONLY | `.env.example` and export table columns reserve Drive fields, but no Google Drive API/client/upload code exists. |
| 9 - Audit, QA, and Hardening | PARTIAL | Audit writes exist for mutations and export status changes; unit/policy tests and hosted DB integration tests pass; CI, audit viewer, seed/dev QA data, browser E2E, and deployment checklist are missing. |

Main audit conclusion: the owner's "Phase 7 or beyond" assumption is only partially confirmed. The repository has implemented an internal XLSX export and now has passing live hosted database coverage for the implemented shipping-note/accounting/export-data paths, but core Phase 6 accounting requirements and the PDF half of Phase 7 remain incomplete. Continue from Phase 6 hardening before expanding Phase 7/8.
