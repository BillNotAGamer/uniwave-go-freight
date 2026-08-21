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
- Most advanced implemented phase: Phase 7B generated internal PDF export.
- Most advanced verified phase: Phase 6 partial behavior is live database-verified for the current workflow through `checked`; Phase 7 internal XLSX export-data eligibility is live database-verified for checked notes.
- Current-state reference: `docs/CURRENT_IMPLEMENTATION_STATUS.md`

| Phase | Audited status | Evidence summary |
| --- | --- | --- |
| 0 - Repository audit/bootstrap | VERIFIED | Repository structure, docs, scripts, schema, migrations, and source boundaries are present. |
| 1 - Minimal Next.js foundation | VERIFIED | Next.js App Router, TypeScript strict mode, Tailwind, route groups, shell layout, `npm run typecheck`, `npm run lint`, and `npm run build` pass. |
| 2 - Database and core schema | PARTIAL | Drizzle schema and migrations exist for main tables. Separate parties and accounting periods are still missing; Phase 6C.1 adds checked/approved timestamp metadata. |
| 3 - Authentication and RBAC | PARTIAL | Better Auth, active-user session checks, role permissions, and bootstrap scripts exist; admin user-management UI and route-protection middleware are missing. |
| 4 - Shipping Note Form MVP | IMPLEMENTED - LIVE DB VERIFIED | Create/edit/list/detail/submit flows and server validation exist; hosted database workflow tests passed against PostgreSQL. |
| 5 - Charge Calculation Engine | IMPLEMENTED - UNIT AND LIVE DB VERIFIED | BigInt decimal helpers, selling/buying charge CRUD, summaries, profit calculation, and VAT amount helpers exist; pure calculations are unit-tested; hosted DB charge and financial-summary tests passed. |
| 6 - Accounting Review | PARTIAL - LIVE DB VERIFIED FOR CURRENT FLOW | `submitted -> accounting_reviewing -> checked` exists with audit writes and passed hosted DB transition tests; Phase 6B.1 added tax-rule services, charge tax assignment/override, VAT summaries, and checked tax completeness; Phase 6B.2 added `/tax-rules`, accounting charge tax controls, VAT override UI, completeness UX, and VAT summary display; Phase 6C.2 adds Admin-only `checked -> approved`; Phase 6C.3 adds Admin-only `approved -> locked` and `locked -> approved`. Cancel/reopen transitions, accounting filters, accounting periods, and browser E2E are still missing. |
| 7 - Excel/PDF Export | PARTIAL | Internal XLSX export exists with template hash pinning, export records, sanitized errors, print view, and generated internal PDF V1. |
| 8 - Google Drive Integration | DOCUMENTED ONLY | `.env.example` and export table columns reserve Drive fields, but no Google Drive API/client/upload code exists. |
| 9 - Audit, QA, and Hardening | PARTIAL | Audit writes exist for mutations and export status changes; unit/policy tests and hosted DB integration tests pass; CI, audit viewer, seed/dev QA data, browser E2E, and deployment checklist are missing. |

Main audit conclusion: the owner's "Phase 7 or beyond" assumption is partially confirmed. The repository has implemented internal XLSX, internal print, and generated internal PDF export paths, while Google Drive upload and browser/session hardening remain incomplete.

## Phase 7A Tax-Complete Internal Export Update - 2026-08-09

Phase 7A implemented the tax-complete internal accounting export without changing the state machine, RBAC, schema, or existing `internal-v1.xlsx` template.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Internal XLSX current template: `assets/export-templates/shipping-note/internal-v2.xlsx`
- Internal XLSX current template version: `internal-v2`
- Internal XLSX current template SHA-256: `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`
- Implemented: persisted tax snapshots in the internal export read model, V2 XLSX `Tax Details` worksheet, VAT-aware internal print HTML, and focused read-model/workbook tests.
- Verification on 2026-08-09: `npm test` passed 15 files / 69 tests; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Hosted integration status: skipped for this run because the configured database was not explicitly authorized as test/staging in the current working context.
- Still incomplete for Phase 7: Google Drive upload remains unimplemented.

## Phase 7B Generated Internal PDF Export V1 - 2026-08-21

Phase 7B implemented a real server-generated internal PDF binary without replacing browser print HTML, changing XLSX V2, changing workflow statuses, or adding a database migration.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Engine: `@react-pdf/renderer` 4.6.1.
- PDF artifact contract: `exportType = pdf`, metadata version `1`, layout identifier `internal-pdf-v1`, MIME `application/pdf`.
- Unicode font strategy: local Noto Sans Regular/Bold TTF assets in `assets/fonts/noto-sans/`, licensed under SIL Open Font License 1.1.
- Data source: the existing authorized internal export read model; PDF uses persisted charge tax snapshots and does not query live `tax_rules`.
- Eligibility/RBAC: checked, approved, and locked notes are eligible for users with `SHIPPING_NOTES_EXPORT_INTERNAL`; Sale remains denied; cancelled, reopened reviewing, and exported statuses remain denied.
- UI: finalized note header exposes separate `Export XLSX`, `Export PDF`, and `Print` controls.
- Persistence/audit: PDF participates in `shipping_note_exports` pending/generated/failed lifecycle with SHA-256 checksum and `shipping_note.export.pdf.generated` / `shipping_note.export.pdf.failed` audit actions.
- Next tracing: route-specific PDF include covers only the two local font files for `/api/shipping-notes/[id]/exports/internal-pdf`.
- Deferred: Google Drive upload, pending export recovery, browser E2E, PDF logo/branding, and background worker.

## Phase 6C.1 Post-Checked Workflow Foundation - 2026-08-13

Phase 6C.1 added only the metadata and policy foundation for future post-checked workflow slices. It did not make approval, lock, unlock, cancellation, correction, or exported-note transitions reachable.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Migration generated: `drizzle/0003_hard_titania.sql`
- Schema fields added to `shipping_notes`: `checked_at`, `approved_at`, `locked_by_id`, `lock_reason`, `cancelled_by_id`, `cancelled_at`, `cancel_reason`.
- Existing checked transition now persists `checked_at` with `checked_by_id`.
- Permission constants were reserved for approve, lock, unlock, cancel, finalized cancel, and reopen-for-correction; only normal cancellation capability was granted to sale/accountant, while admin inherits all permissions.
- Pure status policy helpers reserve future sources for approval, locking, unlocking, cancellation, and correction, and explicitly keep `exported` outside the normal Shipping Note business workflow.
- Internal XLSX export remains eligible only for `checked` notes until Phase 6C.2.
- Historical records were not backfilled, and no workflow statuses were changed.

## Phase 6C.2 Approval Transition + Export Compatibility - 2026-08-14

Phase 6C.2 made approval operational without adding lock, unlock, cancellation, correction, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Workflow added: `checked -> approved`.
- Approval actor: Admin only through `SHIPPING_NOTES_APPROVE`.
- Same-checker policy: the same Admin may check and approve; no four-eyes rule or approval reason is required.
- Approval persistence: `approved_by_id`, `approved_at`, and `updated_at` are written in a guarded transaction.
- Audit action: `shipping_note.approve`.
- Internal XLSX and internal print eligibility is now `checked | approved`; `locked`, `cancelled`, and `exported` remain non-eligible in this phase.
- Phase 7A artifact metadata is unchanged: template version `internal-v2`, metadata version `2`, SHA-256 `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.3 Lock / Unlock + Locked Export Compatibility - 2026-08-14

Phase 6C.3 made the final business lock state operational without adding cancellation, correction reopen, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Workflow added: `approved -> locked` and privileged `locked -> approved`.
- Corrected lock source policy: only `approved` can lock; `checked -> locked` is denied to avoid implicit approval on unlock.
- Lock actor: Admin only through `SHIPPING_NOTES_LOCK`.
- Unlock actor: Admin only through `SHIPPING_NOTES_UNLOCK`.
- Lock reason: optional; blank reason is stored as `null`.
- Unlock reason: mandatory and stored on the `shipping_note.unlock` audit event.
- Locked business data remains immutable through existing normal mutation guards.
- Internal XLSX and internal print eligibility is now `checked | approved | locked`; `exported` and `cancelled` remain non-exportable.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.4 Shipping Note Cancellation - 2026-08-14

Phase 6C.4 made the `cancelled` business state operational without adding correction reopen, restoration, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Normal cancellation sources: `draft`, `submitted`, and `accounting_reviewing`.
- Finalized cancellation sources: `checked` and `approved`.
- Role policy: Sale may cancel only their own Draft with an optional reason; Accountant may cancel Submitted or Accounting Reviewing with a mandatory reason; Admin may cancel Draft, Submitted, Accounting Reviewing, Checked, or Approved with a mandatory reason.
- Locked cancellation is denied directly; Admin must unlock to Approved first, then use finalized cancellation.
- Cancellation is not soft delete: `deleted_at` remains null, charges/tax/check/approval metadata and historical export records are preserved.
- New internal XLSX and internal print exports remain denied for Cancelled notes; historical export records are not modified.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.

## Phase 6C.5 Reopen for Accounting Correction - 2026-08-14

Phase 6C.5 made explicit accounting correction operational without adding commercial Draft reopen, direct Locked reopen, cancellation restoration, PDF, Drive, or note-level exported behavior.

- Branch: `feature/ui-overhaul`
- Commit at implementation start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Reopen sources: `checked` and `approved`.
- Reopen target: `accounting_reviewing`.
- Actor: Admin only through `SHIPPING_NOTES_REOPEN_FOR_CORRECTION`.
- Reason: mandatory, trimmed, and stored on the `shipping_note.reopen_for_correction` audit event.
- Current finalization metadata is cleared on reopen: `checked_by_id`, `checked_at`, `approved_by_id`, and `approved_at`.
- Accounting correction scope: buying charges and tax/VAT can again mutate through existing Accounting Reviewing policies; Shipping Note core fields and selling charges remain Draft-only.
- Historical exports remain unchanged. New internal XLSX and internal print exports are denied while reopened to Accounting Reviewing, and become available again after the existing Mark Checked flow succeeds.
- Locked and Cancelled notes cannot reopen directly; Locked requires Unlock to Approved first, and Cancelled remains terminal.
- No migration was created; migration `0003_hard_titania.sql` was not applied in this conversation.
