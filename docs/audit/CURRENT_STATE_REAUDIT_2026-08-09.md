# Current State Re-Audit - 2026-08-09

## A. Audit Metadata

- Date/time: 2026-08-09T00:46:45+07:00.
- Branch: `feature/ui-overhaul`.
- HEAD commit: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`.
- Last commit: `3b0ff2c 2026-07-29T16:25:58+07:00 Phase 9A, 9B, 6A and 6B.1 check point`.
- Working tree at audit start: dirty before this audit.
  - Modified tracked files: `docs/BUILD_PHASES.md`, `docs/CURRENT_IMPLEMENTATION_STATUS.md`, `docs/QA_CHECKLIST.md`, `docs/SHIPPING_NOTE_QA.md`, `docs/TESTING.md`, `docs/VAT_TAX_IMPLEMENTATION.md`, `src/app/(dashboard)/shipping-notes/[id]/page.tsx`, `src/components/shell/nav-links.ts`, `src/features/shipping-notes/components/accounting-review-controls.tsx`, `src/features/shipping-notes/components/financial-summary.tsx`, `tests/integration/tax-domain.integration.test.ts`.
  - Untracked files: `src/app/(dashboard)/tax-rules/page.tsx`, `src/features/shipping-notes/tax/actions.ts`, `src/features/shipping-notes/tax/components/accounting-tax-charge-table.tsx`, `src/features/shipping-notes/tax/components/tax-completeness-panel.tsx`, `src/features/shipping-notes/tax/ui-policy.test.ts`, `src/features/shipping-notes/tax/ui-policy.ts`, `src/features/tax-rules/actions.ts`, `src/features/tax-rules/components/tax-rules-table.tsx`.
- Runtime observed: Node.js `v20.14.0`; npm `10.8.1`.
- Package manager: npm, proven by `package.json` scripts and `package-lock.json` lockfileVersion 3.
- Framework: Next.js App Router `16.2.9`, React `19.2.4`, TypeScript strict mode (`package.json`, `tsconfig.json`).
- Database/ORM: PostgreSQL/Neon via Drizzle ORM (`drizzle.config.ts`, `src/lib/db/client.ts`, `src/lib/db/schema.ts`).
- Auth framework: Better Auth email/password (`src/lib/auth/server.ts:15-47`, `src/app/api/auth/[...all]/route.ts:1-5`).
- Commands executed:
  - `git branch --show-current`
  - `git rev-parse HEAD`
  - `git log -1 --pretty=format:"%h %cI %s"`
  - `git status --short`
  - `git diff --name-status`
  - `git diff --stat`
  - `git ls-files --others --exclude-standard`
  - `node --version`
  - `npm --version`
  - repository file searches with `rg`
  - targeted source/doc reads with `Get-Content`
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Commands skipped:
  - `npm run test:integration`: SKIPPED. The harness appears run-scoped and docs say it requires an owner-authorized hosted test/staging database (`docs/TESTING.md:7-8`, `tests/integration/setup/cleanup.ts:14-83`), but this transcript does not independently authorize the configured `DATABASE_URL` as test/staging. The sandbox escalation reviewer rejected the run for that reason. No connection string was printed.
  - `npm run test:all`: SKIPPED because it includes `npm run test:integration`.
- Sandbox note: every sandboxed npm invocation failed with `EPERM: operation not permitted, lstat 'C:\Users\Admin'`. Read-only validation commands were rerun with approval except integration.

## B. Executive Summary

Current maturity is uneven but materially beyond the 2026-07-29 historical baseline in the working tree. The repository has a functional Next.js/TypeScript foundation, Better Auth login, server-side RBAC helpers, shipping note draft/create/edit/submit flows, selling and buying charge workflows, deterministic calculation helpers, current accounting review through `checked`, internal XLSX export, print HTML, audit writes, and a now-present VAT/tax domain plus accounting/admin tax UI.

The most advanced implemented phase is Phase 7 partial: internal XLSX export and internal print HTML exist. Generated PDF and Google Drive integration do not exist.

The most advanced verified phase in this audit is Phase 6 at unit/policy/build level: VAT/tax calculation, completeness, UI policy, validation, permissions, status policy, and tax-rule validators are covered by `npm test` (13 files, 65 tests). The DB integration suite exists but was not run in this audit, so DB-INTEGRATION-VERIFIED claims are not made from this run.

Major post-baseline work present in the current tree:
- `/tax-rules` route and tax-rule UI (`src/app/(dashboard)/tax-rules/page.tsx`, `src/features/tax-rules/components/tax-rules-table.tsx`).
- Tax-rule actions/services and validators (`src/features/tax-rules/actions.ts`, `queries.ts`, `mutations.ts`, `validators.ts`).
- Charge tax assignment/override actions and UI (`src/features/shipping-notes/tax/actions.ts`, `components/accounting-tax-charge-table.tsx`).
- VAT completeness UI and Mark Checked disabled reason (`src/features/shipping-notes/tax/components/tax-completeness-panel.tsx`, `src/features/shipping-notes/tax/ui-policy.ts`).
- VAT-aware accounting summary display (`src/features/shipping-notes/components/financial-summary.tsx`).

Top blockers:
- Integration/browser/session verification is incomplete in this audit.
- Post-checked transitions (`approved`, `exported`, `locked`, `cancelled`) remain schema/UI-reserved but not operational.
- XLSX and print HTML still omit VAT/tax mapping.
- Generated PDF export is absent.
- Admin user management and audit-log viewer are absent.

Top security/correctness risks:
- No middleware backstop; current route protection is layout/page/service based (`src/app/(dashboard)/layout.tsx:9-11`) and future routes can be missed.
- No app-level user-management workflow for deactivation/role changes/session invalidation.
- Missing `checked_at` / `approved_at` timestamps reduce auditability (`src/lib/db/schema.ts:202-209`).
- Export artifacts omit stored tax snapshots, so a checked note with tax is not fully represented in XLSX/print output.

Recommended immediate next task: implement VAT/tax mapping into the internal export read model, XLSX template/version, and print HTML output, with focused export fixture tests. This should come before PDF/Drive because exported financial artifacts are already available but incomplete for the current tax model.

## C. Repository Delta Since Previous Baseline

The previous historical baseline referenced 2026-07-29. Current HEAD is one commit after `1a1b02f`, at `3b0ff2c`, with last commit summary `Phase 9A, 9B, 6A and 6B.1 check point`. The working tree also contains uncommitted and untracked Phase 6B.2 tax UI work.

New or changed implementation present in the actual tree:
- New route: `/tax-rules` (`src/app/(dashboard)/tax-rules/page.tsx:11-39`).
- New tax-rule UI/action files: `src/features/tax-rules/actions.ts`, `src/features/tax-rules/components/tax-rules-table.tsx`.
- Charge tax UI/action files: `src/features/shipping-notes/tax/actions.ts`, `src/features/shipping-notes/tax/components/accounting-tax-charge-table.tsx`, `tax-completeness-panel.tsx`, `ui-policy.ts`.
- Tax-rule service layer exists in tracked files (`src/features/tax-rules/queries.ts:32-58`, `src/features/tax-rules/mutations.ts:65-200`).
- Tax assignment/override services exist (`src/features/shipping-notes/tax/mutations.ts:185-330`).
- Mark Checked now gates tax completeness server-side (`src/features/shipping-notes/mutations.ts:343-365`).
- Financial summaries include VAT subtotal/total fields (`src/lib/calculations/shipping-note.ts:64-112`).
- Unit/policy tests increased to 13 files / 65 tests from prior documentation claims.

No evidence found for:
- PDF generation route/service/library beyond `export_type` enum value `pdf` (`src/lib/db/schema.ts:73`).
- Google Drive client/upload code; only env placeholders and export columns exist (`.env.example:14-17`, `src/lib/db/schema.ts:285-286`).
- Admin user-management routes/services.
- Audit-log viewer/read service in application code.
- Browser E2E tests.
- CI/deployment config.

## D. Build Phase Matrix

| Phase | Current status | Implemented components | Missing components | Evidence | Verification level | Blockers |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | VERIFIED | Repo docs, schema, migrations, scripts, app structure. | No CI/deployment config. | `package.json`, `src/`, `drizzle/`, `docs/`. | REPOSITORY-PROVEN, build/test run. | None for local work. |
| 1 | VERIFIED | Next App Router, TypeScript strict, Tailwind v4, dashboard/auth route groups. | shadcn-compatible structure but no generated shadcn component set. | `src/app/(dashboard)/layout.tsx:9-11`, `tsconfig.json`. | TEST-VERIFIED via typecheck/build. | None. |
| 2 | PARTIAL | PostgreSQL schema for auth, notes, charges, exports, audits, tax rules. | Separate parties, accounting periods, checked/approved timestamps. | `src/lib/db/schema.ts:172-354`. | REPOSITORY-PROVEN; DB integration skipped. | Audit/reporting decisions. |
| 3 | PARTIAL | Better Auth, disabled public signup by default, active/soft-delete checks, permissions. | Admin user management, role-change/session invalidation flow, middleware backstop, HTTP/session E2E. | `src/lib/auth/server.ts:11-47`, `src/lib/auth/session.ts:19-50`, `src/lib/permissions/permissions.ts:33-57`. | Unit permission tests passed; HTTP unverified. | Product/security policy for user admin. |
| 4 | IMPLEMENTED | Draft create/edit, submit, list/detail, server validation, sale ownership. | Browser E2E, concurrency/stale update tests, party table. | `src/features/shipping-notes/mutations.ts:120-270`, `src/features/shipping-notes/queries.ts:38-100`. | Unit/build verified; DB integration skipped. | Browser/session coverage. |
| 5 | IMPLEMENTED | Decimal/money helpers, selling/buying charge CRUD, VND/original totals, profit. | Broader export fixture tests. | `src/lib/calculations/money.ts:141-186`, `src/lib/calculations/shipping-note.ts:42-112`, `src/features/shipping-notes/mutations.ts:470-948`. | TEST-VERIFIED by unit tests; DB integration skipped. | None for helper layer. |
| 6 | PARTIAL | Accounting review `submitted -> accounting_reviewing -> checked`, buying charges, financial summary, tax rules, tax assignment/override, completeness gate and UI. | Approve/export/lock/cancel transitions, accounting periods, accounting reports, browser E2E. | `src/features/shipping-notes/status-policy.ts:20-26`, `src/features/shipping-notes/tax/**`, `src/features/tax-rules/**`. | TEST-VERIFIED for helpers/UI policy; DB integration skipped. | Export tax mapping and post-checked workflow. |
| 7 | PARTIAL | Internal XLSX route/generator/metadata, print HTML view. | Generated PDF, XLSX VAT mapping, binary workbook fixture tests, Drive upload. | `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts:95-180`, `src/features/shipping-notes/export/generator.ts:324-372`, `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx:173-293`. | Unit/build verified; binary output not fixture-verified. | Tax/export template decision. |
| 8 | DOCUMENTED ONLY | Env placeholders and Drive metadata columns. | Google client, OAuth/service account strategy, upload/retry/status flow. | `.env.example:14-17`, `src/lib/db/schema.ts:285-286`; repo search found no Drive code. | REPOSITORY-PROVEN absence. | Credential/product decisions. |
| 9 | PARTIAL | Audit write helper, audit writes inside many mutations/export updates, unit tests. | Audit viewer, browser E2E, CI, deployment checklist, observability, integration run in this audit. | `src/lib/audit/log.ts:28-41`, mutation call sites. | TEST-VERIFIED for unit; DB integration skipped. | Verification infrastructure. |

## E. Route Inventory

| Route | Protected? | Intended roles | Actual server authorization | Sensitive data exposed | Evidence |
| --- | --- | --- | --- | --- | --- |
| `/` | Session-aware redirect | all | `src/app/page.tsx` redirects based on session. | none | `src/app/page.tsx` |
| `/login` | Public | unauthenticated users | Better Auth client login only. | no server data | `src/app/(auth)/login/page.tsx`, `src/components/auth/login-form.tsx:35-49` |
| `/dashboard` | Yes | sale/accountant/admin | `(dashboard)` layout calls `requireAuthenticatedUser()`. | status samples only | `src/app/(dashboard)/layout.tsx:9-11` |
| `/shipping-notes` | Yes | sale/accountant/admin | layout auth; query scopes sale to own rows. | list safe note fields | `src/features/shipping-notes/queries.ts:38-85` |
| `/shipping-notes/new` | Yes | sale/admin | layout auth; mutation requires `SHIPPING_NOTES_CREATE_OWN`. Admin passes via `hasPermission` admin override. | create form | `src/lib/permissions/permissions.ts:33-57`, `src/features/shipping-notes/mutations.ts:120-166` |
| `/shipping-notes/[id]` | Yes | sale owning note, accountant/admin all | layout auth; `getShippingNoteForUser` scopes sale; data sections gated by permissions. | buying/tax/profit only for accountant/admin | `src/app/(dashboard)/shipping-notes/[id]/page.tsx:50-134`, `src/features/shipping-notes/queries.ts:88-100` |
| `/tax-rules` | Yes | accountant/admin | layout auth plus `listTaxRulesForUser`; sale gets `AuthorizationError` mapped to 404. | tax rules | `src/app/(dashboard)/tax-rules/page.tsx:11-25`, `src/features/tax-rules/queries.ts:32-58` |
| `/shipping-notes/[id]/print/internal` | Yes | accountant/admin checked notes | page auth plus `getInternalShippingNoteExportDataForUser`; authorization/status failures become 404. | buying/profit, no VAT/tax | `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx:173-195` |
| `POST /api/auth/[...all]` and related methods | Better Auth | auth lifecycle | Better Auth handler. | credentials/session handling | `src/app/api/auth/[...all]/route.ts:1-5` |
| `POST /api/shipping-notes/[id]/exports/internal-xlsx` | Yes | accountant/admin checked notes | same-origin metadata check, session check, export permission, checked status. | XLSX binary with buying/profit, no VAT/tax | `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts:95-180`, `src/features/shipping-notes/export/queries.ts:24-89` |

No `middleware.ts` exists. Current route protection depends on route group layout/page/service calls.

## F. Service / Query / Mutation Inventory

Queries:
- `listShippingNotesForUser`, `getShippingNoteForUser`, `getShippingNoteById` (`src/features/shipping-notes/queries.ts:76-115`).
- `listSellingChargesForNoteForUser`, `listBuyingChargesForNoteForUser`, `getFinancialSummaryForNoteForUser` (`src/features/shipping-notes/queries.ts:168-254`).
- `listChargeTaxDetailsForNoteForUser`, `getTaxCompletenessForNoteForUser`, `getTaxSummaryForNoteForUser` (`src/features/shipping-notes/tax/queries.ts:32-117`).
- `listTaxRulesForUser` (`src/features/tax-rules/queries.ts:32-58`).
- `getInternalShippingNoteExportDataForUser` (`src/features/shipping-notes/export/queries.ts:24-147`).

Mutations:
- Draft/note workflow: `createShippingNoteDraft`, `updateShippingNoteDraft`, `submitShippingNote`, `startAccountingReview`, `markShippingNoteChecked` (`src/features/shipping-notes/mutations.ts:120-410`).
- Selling charge CRUD/soft-delete (`src/features/shipping-notes/mutations.ts:470-709`).
- Buying charge CRUD/soft-delete (`src/features/shipping-notes/mutations.ts:711-948`).
- Tax assignment/override (`src/features/shipping-notes/tax/mutations.ts:185-330`).
- Tax-rule create/update/deactivate (`src/features/tax-rules/mutations.ts:65-200`).
- Export metadata status updates (`src/features/shipping-notes/export/mutations.ts:49-178`).

Server actions:
- Shipping note and charge actions (`src/features/shipping-notes/actions.ts`).
- Charge tax actions (`src/features/shipping-notes/tax/actions.ts:25-78`).
- Tax-rule actions (`src/features/tax-rules/actions.ts:43-115`).

Auth services:
- Better Auth server config (`src/lib/auth/server.ts:15-47`).
- Session reader/require helper (`src/lib/auth/session.ts:19-50`).
- Active/soft-delete predicate (`src/lib/auth/user-state.ts:3-10`).
- Bootstrap scripts (`scripts/create-first-admin.ts`, `scripts/create-dev-user.ts`).

Audit services:
- Write helper only (`src/lib/audit/log.ts:28-41`).
- No application audit-log read service was found.

## G. Observed RBAC Matrix

| Capability | Sale UI | Sale server | Accountant UI | Accountant server | Admin UI | Admin server | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login | yes | active/non-deleted only | yes | active/non-deleted only | yes | active/non-deleted only | `src/lib/auth/server.ts:23-40`, `src/lib/auth/session.ts:27-40` |
| Public signup | no UI | disabled unless dev bootstrap flag | no | disabled | no | disabled | `src/lib/auth/server.ts:11-45` |
| List notes | yes | own only | yes | all non-deleted | yes | all non-deleted | `src/features/shipping-notes/queries.ts:38-85` |
| Detail notes | yes | own only | yes | all non-deleted | yes | all non-deleted | `src/features/shipping-notes/queries.ts:88-100` |
| Create note | yes | yes | no | denied | yes | yes via admin-all | `src/lib/permissions/permissions.ts:33-57`, `mutations.ts:120-166` |
| Edit/submit draft | own draft | own draft only | no | denied | yes | any draft | `src/features/shipping-notes/mutations.ts:93-270` |
| Selling charges | own draft controls | own draft only | read only | no mutation | draft controls | any draft | `src/features/shipping-notes/mutations.ts:444-681` |
| Buying charges | hidden | denied | visible/manage in submitted/reviewing | allowed | visible/manage | allowed | `src/app/(dashboard)/shipping-notes/[id]/page.tsx:66-83`, `mutations.ts:711-948` |
| Financial summary/net profit | hidden | denied | visible non-draft eligible statuses | allowed | visible | allowed | `src/features/shipping-notes/queries.ts:226-254` |
| Tax rules read | no nav | denied | nav/read active | allowed active | nav/all | allowed all | `src/components/shell/nav-links.ts:38-44`, `src/features/tax-rules/queries.ts:32-58` |
| Tax rules manage | no | denied | no | denied | create/edit/deactivate | allowed | `src/features/tax-rules/mutations.ts:65-200`, `tax-rules-table.tsx:270-395` |
| Charge tax assign | hidden | denied | visible submitted/reviewing | allowed | visible submitted/reviewing | allowed | `src/features/shipping-notes/tax/ui-policy.ts:37-43`, `tax/mutations.ts:185-260` |
| VAT override | hidden | denied | visible for taxable classified charge | allowed with reason | visible | allowed with reason | `src/features/shipping-notes/tax/ui-policy.ts:65-77`, `tax/mutations.ts:263-330` |
| Mark checked | hidden | denied | visible; disabled if tax incomplete | server enforces completeness | visible | server enforces completeness | `src/features/shipping-notes/mutations.ts:330-410` |
| Internal XLSX/print | hidden | denied | visible only checked | checked only | visible only checked | checked only | `src/app/(dashboard)/shipping-notes/[id]/page.tsx:78-80`, `export/queries.ts:24-89` |
| Audit log viewing | no | not implemented | no | not implemented | no | not implemented | only permission at `src/lib/permissions/permissions.ts:21` |
| User management | no | not implemented | no | denied | no | permission only | only permission at `src/lib/permissions/permissions.ts:22`; no route found |
| Deleted records | filtered | filtered | filtered | filtered | filtered | filtered | `isNull(deletedAt)` in note/charge queries |

## H. Shipping Note State Machine

Supported statuses in schema/constants: `draft`, `submitted`, `accounting_reviewing`, `checked`, `approved`, `exported`, `locked`, `cancelled` (`src/lib/db/schema.ts:49-58`, `src/features/shipping-notes/constants.ts:15-24`).

Current implemented transitions:

| From | To | Actor | Preconditions | Mutation | Audit | Tests | Transaction/stale check |
| --- | --- | --- | --- | --- | --- | --- | --- |
| none | draft | sale/admin | `SHIPPING_NOTES_CREATE_OWN`; unique jobsheet | `createShippingNoteDraft` | `shipping_note.create_draft` | unit schemas; integration exists but skipped | transaction; uniqueness checked before insert |
| draft | draft | owning sale/admin | `SHIPPING_NOTES_EDIT_OWN`; draft access | `updateShippingNoteDraft` | `shipping_note.update_draft` | unit schemas; integration exists but skipped | transaction; `WHERE status='draft'` |
| draft | submitted | owning sale/admin | `SHIPPING_NOTES_EDIT_OWN`; draft access | `submitShippingNote` | `shipping_note.submit` | integration exists but skipped | transaction; `WHERE status='draft'`; sets `submittedAt` |
| submitted | accounting_reviewing | accountant/admin | `SHIPPING_NOTES_ACCOUNTING_REVIEW`; current status submitted | `startAccountingReview` | `shipping_note.accounting_review.start` | status-policy unit; integration exists but skipped | transaction; `WHERE status='submitted'` |
| accounting_reviewing | checked | accountant/admin | `SHIPPING_NOTES_MARK_CHECKED`; current status reviewing; all active charges tax-complete | `markShippingNoteChecked` | `shipping_note.accounting_review.checked` | status/tax unit; integration exists but skipped | transaction; `WHERE status='accounting_reviewing'`; sets `checkedById` |

Not implemented:
- `checked -> approved`
- `checked -> exported`
- `approved -> exported`
- `exported -> locked`
- any `-> cancelled`
- any unlock/correction path

Dead-end states:
- `checked` is the highest reachable note status through app code.
- `approved`, `exported`, `locked`, and `cancelled` are representable in DB and UI badges but unreachable through app mutations.

Invalid transition risks:
- If a row is manually set to `approved`, `exported`, or `locked`, financial summary can read it (`src/features/shipping-notes/queries.ts:29-36`) but no transition/audit semantics exist.
- `lockedAt` exists but no mutation sets it (`src/lib/db/schema.ts:209`).
- `checkedById` is set, but no `checkedAt` column exists.

## I. VAT / Tax Status

Actual schema:
- `tax_treatment` enum with `taxable`, `zero_rated`, `non_taxable` (`src/lib/db/schema.ts:65-69`).
- `tax_rules` columns include `code`, `name`, `description`, `shippingMode`, `chargeSection`, `chargeNamePattern`, `taxTreatment`, `vatPercent`, active/effective fields (`src/lib/db/schema.ts:324-354`).
- Charge tax snapshot columns: `taxRuleId`, `taxRuleCodeSnapshot`, `taxRuleNameSnapshot`, `taxTreatmentSnapshot`, `vatPercent`, `vatAmount`, `isOverride`, `overrideReason` (`src/lib/db/schema.ts:245-259`).
- No charge `tax_assigned_by_id`, `tax_assigned_at`, `tax_overridden_by_id`, or `tax_overridden_at` columns exist. Actor/time are only in audit logs.

Calculation behavior:
- VAT basis is stored `amountVnd` (`src/features/shipping-notes/tax/calculations.ts:65-95`).
- Formula is half-up rounded to VAT scale 2 (`tax/calculations.ts:80-94`).
- Zero-rated and non-taxable force `0.00` VAT (`tax/calculations.ts:46-63`, `76-78`).
- Tax-exclusive totals are retained; total including VAT is derived as amount + VAT (`tax/calculations.ts:97-105`).
- Gross profit remains tax-exclusive (`src/lib/calculations/shipping-note.ts:102-109`).

Tax-rule behavior:
- Accountant can read active rules only; admin can read active/inactive (`src/features/tax-rules/queries.ts:38-47`).
- Admin creates/updates/deactivates; deactivation is soft/inactive, not delete (`src/features/tax-rules/mutations.ts:65-200`).
- Rule changes do not rewrite historical charge snapshots; UI copy explicitly says snapshots remain unchanged (`src/features/tax-rules/components/tax-rules-table.tsx:77-80`).

Permissions:
- Sale denied tax rules, tax assignment, override, and summaries by permissions (`src/lib/permissions/permissions.ts:33-57`).
- Accountant/admin can assign/override during `submitted` and `accounting_reviewing` only (`src/features/shipping-notes/tax/mutations.ts:33`, `120-123`).
- Checked tax is immutable because tax mutations reject non-mutable statuses (`tax/mutations.ts:120-123`) and UI suppresses controls for checked (`tax/ui-policy.ts:33-43`, `65-77`).

Checked completeness:
- `markShippingNoteChecked` loads all active charge tax rows and blocks if `summarizeTaxCompleteness(...).taxComplete` is false (`src/features/shipping-notes/mutations.ts:343-365`).
- Completeness requires code/name/treatment snapshot, normalized VAT percent, calculated VAT amount, and override reason if overridden (`src/features/shipping-notes/tax/completeness.ts:19-71`).

Exports:
- XLSX: VAT/tax is not mapped. Export query does not select tax fields (`src/features/shipping-notes/export/queries.ts:33-67`), DTO charge objects omit tax fields (`export/queries.ts:107-131`), and generator writes amount VND only (`src/features/shipping-notes/export/generator.ts:251-252`).
- Print HTML: VAT/tax is not mapped. Print rows display amount original/VND and totals/profit only (`src/app/(print)/shipping-notes/[id]/print/internal/page.tsx:121-160`, `244-284`).
- PDF: not implemented.

Tests:
- Unit/policy tests passed for VAT calculations, completeness, UI policy, tax-rule validators (`npm test`: 13 files, 65 tests).
- DB integration tax tests exist in `tests/integration/tax-domain.integration.test.ts`, but were skipped in this audit.
- Browser E2E is absent.

## J. Export Status

XLSX:
- IMPLEMENTED, partially verified.
- Entry point: `POST /api/shipping-notes/[id]/exports/internal-xlsx` (`src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts:95-180`).
- Authorization: same-origin metadata check, `getCurrentSession`, `SHIPPING_NOTES_EXPORT_INTERNAL`, checked status only (`route.ts:99-123`, `export/queries.ts:24-89`).
- Source data: joined note + active charges; includes selling/buying/profit, excludes VAT/tax (`export/queries.ts:32-147`).
- Template: `assets/export-templates/shipping-note/internal-v1.xlsx`; hash pinned in constants (`src/features/shipping-notes/export/constants.ts:3-9`).
- Library: ExcelJS (`src/features/shipping-notes/export/generator.ts:7`).
- File naming/content disposition: sanitized helpers unit-tested (`src/features/shipping-notes/export/filename.test.ts`, `http.test.ts`).
- Export record: pending created before generation, generated/failed status updates recorded (`src/features/shipping-notes/export/mutations.ts:49-178`).
- Audit: generated and failed events written inside export status transaction (`export/mutations.ts:112-176`).
- Known gap: pending export creation is not in the same transaction as generation and failure marking is best-effort (`route.ts:130-177`), so a process crash between pending create and failure mark could leave pending records.

Print HTML:
- IMPLEMENTED.
- Auth/authorization uses the same internal export query and checked status gate (`src/app/(print)/shipping-notes/[id]/print/internal/page.tsx:173-195`).
- It is browser print HTML, not generated PDF.
- Omits VAT/tax mapping.

Generated PDF:
- NOT IMPLEMENTED.
- Evidence: only `export_type` enum has `pdf` (`src/lib/db/schema.ts:73`); no PDF route/service/library found.

Google Drive:
- DOCUMENTED ONLY.
- Evidence: env placeholders (`.env.example:14-17`) and metadata columns (`src/lib/db/schema.ts:285-286`); no `googleapis`, OAuth, service account, upload, retry, or token storage code found.

## K. Data Model Divergences

| Divergence | Actual implementation | Documented intent | Classification | Evidence |
| --- | --- | --- | --- | --- |
| Parties | Free-text party fields on `shipping_notes`. | `shipping_note_parties` or party FK/text model. | Harmless intentional simplification for MVP unless reporting/dedup becomes required. | `src/lib/db/schema.ts:181-184`, `docs/DATA_MODEL_RULES.md:11` |
| Accounting periods | No table/reference. | `accounting_periods`, when needed. | Unresolved design divergence; blocks locking/reporting period semantics. | repo search, `docs/DATA_MODEL_RULES.md:16` |
| Checked timestamp | `checkedById` only; no `checkedAt`. | `checked_by` and `checked_at`. | Audit/reporting risk. | `src/lib/db/schema.ts:202-209`, `docs/DATA_MODEL_RULES.md:40-41` |
| Approved timestamp | `approvedById` only; no `approvedAt`; no approval mutation. | `approved_by` and `approved_at`. | Operational defect once approval is implemented. | `src/lib/db/schema.ts:206-209`, `docs/DATA_MODEL_RULES.md:42-43` |
| Locking | `lockedAt` column exists, but no lock mutation/status path. | locked records prevent normal edits. | Decision required / operational gap. | `src/lib/db/schema.ts:209`, no mutation setting it |
| Tax assignment actor/time | No dedicated columns. | VAT audit proposed actor/time fields in domain audit. | Unknown / decision required; audit logs may be sufficient, but query/reporting would be harder. | `src/lib/db/schema.ts:245-259`, `docs/VAT_TAX_DOMAIN_AUDIT.md:433-436` |
| Export tax snapshot version | No `calculation_version` or `tax_snapshot_version` columns. | Proposed in VAT domain audit. | Export reproducibility gap if formal tax exports are added. | `src/lib/db/schema.ts:275-296`, `docs/VAT_TAX_DOMAIN_AUDIT.md:437-438` |
| Export records soft delete | no `deletedAt`. | business records soft-delete by default. | Likely acceptable append-only export metadata, but should be explicit. | `src/lib/db/schema.ts:275-296`, `docs/DATA_MODEL_RULES.md:109` |

## L. Test Coverage Matrix

| Domain | Unit | DB Integration | HTTP/Auth | Browser E2E | Missing risk |
| --- | --- | --- | --- | --- | --- |
| Permissions/RBAC helpers | yes, `src/lib/permissions/permissions.test.ts` | integration files exist; skipped | no | no | Helper tests do not prove session/request behavior. |
| Auth/session | `user-state` indirectly in integration fixtures; no session unit suite | skipped | no Better Auth HTTP lifecycle tests | no | Deactivation/role-change/session invalidation unverified. |
| Shipping note draft/submit | validators/status tests | integration files exist; skipped | no server-action HTTP tests | no | Browser forms and stale updates unverified. |
| Selling/buying charges | money/summary unit tests | integration files exist; skipped | no | no | DB authorization not verified in this audit. |
| Financial calculations | yes | integration files exist; skipped | n/a | no | Export binary content not fully checked. |
| VAT/tax calculations | yes | `tax-domain.integration.test.ts` exists; skipped | no | no | DB tax RBAC/audit not current-run verified. |
| Tax-rule UI policy | yes | partial integration exists; skipped | no | no | Actual browser usability unverified. |
| Workflow transitions | status-policy unit tests | accounting integration exists; skipped | no | no | Post-checked transitions absent. |
| XLSX export | filename/http helper tests | export eligibility integration exists; skipped | API route not request-tested here | no | Workbook cell content/tax mapping unverified/missing. |
| PDF | no | no | no | no | Not implemented. |
| Google Drive | no | no | no | no | Not implemented. |
| Audit writes | no pure audit unit beyond helper use | integration files exist; skipped | no audit read auth | no | No audit viewer/read authorization. |

Repository-owned test inventory:
- Unit/policy files: 13.
- Integration files: 7.
- Current `npm test` result: 13 files passed, 65 tests passed.
- Current integration result: skipped.

## M. Validation Results

| Command | Result | Notes |
| --- | --- | --- |
| `npm --version` | PASS after escalation | `10.8.1`; sandbox npm failed with `EPERM` first. |
| `npm test` | PASS after escalation | 13 test files / 65 tests passed. |
| `npm run typecheck` | PASS after escalation | `tsc --noEmit` completed. |
| `npm run lint` | PASS after escalation | `eslint` completed. |
| `npm run build` | PASS after escalation | Next build completed; routes included `/tax-rules`, internal XLSX route, print route. |
| `npm run test:integration` | SKIPPED | Escalation rejected because configured DB was not independently authorized as test/staging in this transcript. |
| `npm run test:all` | SKIPPED | Includes integration command. |

## N. Findings

### P0 - Critical

No P0 findings were proven in this audit. No credential values or secrets were printed.

### P1 - High

F-P1-01 - Exported accounting artifacts omit VAT/tax data.
- Label: REPOSITORY-PROVEN.
- Evidence: export query omits tax fields (`src/features/shipping-notes/export/queries.ts:33-67`), generator writes amount VND only (`src/features/shipping-notes/export/generator.ts:251-252`), print table has no VAT columns (`src/app/(print)/shipping-notes/[id]/print/internal/page.tsx:121-160`).
- Impact: checked notes can have tax-complete charge snapshots but internal XLSX/print artifacts do not represent that accounting state.
- Implementation required: yes.
- Product/business decision required: likely yes for template labels/cells.

F-P1-02 - Post-checked workflow remains unreachable.
- Label: REPOSITORY-PROVEN.
- Evidence: status enum includes future states (`src/lib/db/schema.ts:49-58`), but current transition policy only lists `submitted -> accounting_reviewing` and `accounting_reviewing -> checked` (`src/features/shipping-notes/status-policy.ts:20-26`), and mutations only implement those transitions (`src/features/shipping-notes/mutations.ts:280-410`).
- Impact: workflow dead-ends at checked; approval/export/lock/cancel semantics and audits are absent.
- Implementation required: yes.
- Product/business decision required: yes.

F-P1-03 - Missing checked/approved timestamps weaken auditability.
- Label: REPOSITORY-PROVEN.
- Evidence: schema has `submittedAt`, `checkedById`, `approvedById`, `lockedAt`, but no `checkedAt` or `approvedAt` (`src/lib/db/schema.ts:202-209`); docs expect both (`docs/DATA_MODEL_RULES.md:40-44`).
- Impact: actor is stored for checked, but event time must be inferred from audit or updatedAt; later changes can obscure timeline in note table.
- Implementation required: likely yes.
- Product/business decision required: no, unless audit table is declared authoritative for transition times.

### P2 - Medium

F-P2-01 - Integration tests were not run in this audit.
- Label: DECISION REQUIRED.
- Evidence: `npm run test:integration` escalation rejected due lack of independent DB authorization in transcript; integration harness reads `.env.local` and applies migrations (`tests/integration/setup/environment.ts:19-62`, `tests/integration/setup/database.ts:45-48`).
- Impact: DB-backed RBAC, migrations, audit persistence, and tax service behavior are implemented/tested by files but not current-run verified.
- Implementation required: no.
- Product/business decision required: yes, authorize a specific staging/test database before running.

F-P2-02 - No middleware-level protection backstop.
- Label: REPOSITORY-PROVEN.
- Evidence: no `middleware.*` file found; dashboard routes rely on layout auth (`src/app/(dashboard)/layout.tsx:9-11`), print/API routes call session checks individually.
- Impact: existing routes are protected by convention, but future routes outside protected groups can be accidentally public.
- Implementation required: recommended.
- Product/business decision required: no.

F-P2-03 - Admin user-management UI/service is absent.
- Label: NOT IMPLEMENTED.
- Evidence: `USERS_MANAGE` permission exists (`src/lib/permissions/permissions.ts:22`), but route search found no admin/users route; only bootstrap scripts update users (`scripts/create-first-admin.ts`, `scripts/create-dev-user.ts`).
- Impact: admins cannot deactivate/reactivate/role-change users in-app; session invalidation behavior is undefined.
- Implementation required: yes.
- Product/business decision required: yes for role-change/session invalidation policy.

F-P2-04 - Audit logs are write-only from the app perspective.
- Label: NOT IMPLEMENTED.
- Evidence: audit write helper exists (`src/lib/audit/log.ts:28-41`) and permission exists (`src/lib/permissions/permissions.ts:21`), but no audit-log query/UI route was found.
- Impact: admins cannot inspect audit history through the app; override history depends on DB access.
- Implementation required: yes.
- Product/business decision required: likely for retention/read scope.

F-P2-05 - PDF export is absent.
- Label: NOT IMPLEMENTED.
- Evidence: `export_type` enum includes `pdf` (`src/lib/db/schema.ts:73`), but no PDF route/service/library found.
- Impact: Phase 7 is incomplete.
- Implementation required: yes.
- Product/business decision required: yes for real PDF vs print HTML requirements.

F-P2-06 - Google Drive integration is documented/scaffolded only.
- Label: DOCUMENTED-ONLY.
- Evidence: `.env.example:14-17`, `src/lib/db/schema.ts:285-286`; no Google/Drive API code found.
- Impact: exported artifacts are not uploaded externally.
- Implementation required: future Phase 8.
- Product/business decision required: yes for credential/storage policy.

F-P2-07 - Tax assignment actor/time fields are not queryable columns.
- Label: DECISION REQUIRED.
- Evidence: charge schema has snapshots and override reason only (`src/lib/db/schema.ts:245-259`); audit captures actor/time generally (`src/lib/audit/log.ts:28-41`).
- Impact: reporting "who assigned tax when" requires audit-log JSON queries rather than charge columns.
- Implementation required: decision-dependent.
- Product/business decision required: yes.

### P3 - Low

F-P3-01 - Documentation and current dirty tree contain stale or self-conflicting status.
- Label: STALE DOCUMENTATION.
- Evidence: `docs/CURRENT_IMPLEMENTATION_STATUS.md` now says integration passed previously and tax UI exists, but the file itself is modified before this audit; this audit could not rerun integration. `docs/VAT_TAX_DOMAIN_AUDIT.md` still contains historical "UI/export deferred" sections alongside implementation notes.
- Impact: docs are useful history but cannot be treated as current proof.
- Implementation required: no during audit.
- Product/business decision required: no.

F-P3-02 - Dashboard "Accounting" nav points to generic dashboard.
- Label: REPOSITORY-PROVEN.
- Evidence: `src/components/shell/nav-links.ts:30-35` links Accounting to `/dashboard` with comment that it is generic.
- Impact: possible UX confusion; no security impact.
- Implementation required: optional.
- Product/business decision required: no.

F-P3-03 - No committed CI/deployment workflow found.
- Label: NOT IMPLEMENTED.
- Evidence: no `.github`, `vercel.json`, `render.yaml`, `Dockerfile`, or deployment config found; `.gitignore` ignores `.vercel`.
- Impact: manual validation only.
- Implementation required: recommended.
- Product/business decision required: deployment target decision.

### INFO

F-INFO-01 - Core local validation passes.
- Label: TEST-VERIFIED.
- Evidence: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` passed after sandbox npm escalation.

F-INFO-02 - Better Auth is configured with disabled public signup by default.
- Label: REPOSITORY-PROVEN.
- Evidence: `src/lib/auth/server.ts:11-45`.

F-INFO-03 - Current app enforces sale row ownership in note reads and draft mutations.
- Label: REPOSITORY-PROVEN.
- Evidence: `src/features/shipping-notes/queries.ts:38-45`, `src/features/shipping-notes/mutations.ts:93-103`.

F-INFO-04 - Charge and workflow mutations write audit logs inside transactions.
- Label: REPOSITORY-PROVEN.
- Evidence: examples at `src/features/shipping-notes/mutations.ts:129-166`, `190-227`, `341-399`, `489-526`, `730-767`.

F-INFO-05 - Tax-rule changes are snapshotted into charges at assignment time.
- Label: REPOSITORY-PROVEN.
- Evidence: `src/features/shipping-notes/tax/mutations.ts:222-233`.

## O. Documentation Drift

- `docs/BUILD_PHASES.md` is partly current but modified before this audit; it now mentions Phase 6B.2 UI, while still preserving planned Phase 6/7/8 requirements. Treat it as planning plus historical status, not proof.
- `docs/CURRENT_IMPLEMENTATION_STATUS.md` is stale as an audit artifact because it is dated 2026-07-29 and modified in the current dirty tree. It claims hosted integration tests passed previously; this audit skipped integration.
- `docs/VAT_TAX_DOMAIN_AUDIT.md` is a historical design/audit document. It contains sections written before Phase 6B.1/6B.2 and should not be read as current implementation state without cross-checking `src/features/shipping-notes/tax/**` and `src/features/tax-rules/**`.
- `docs/DATA_MODEL_RULES.md` still describes `shipping_note_parties`, `checked_at`, `approved_at`, and accounting periods as intended model elements; actual schema lacks those except text party fields and `lockedAt`.
- `docs/PROJECT_BRIEF.md` still correctly names Excel/PDF and Google Drive as target workflow, but PDF and Drive are not implemented.
- `docs/TESTING.md` says hosted integration tests use an owner-authorized test/staging DB; this audit could not verify that authorization for the current configured environment, so integration was skipped.
- `docs/SHIPPING_NOTE_QA.md` includes historical manual QA language and current tax UI scenarios; it is useful but not proof.

## P. Recommended Next Engineering Sequence

1. Finish VAT/tax export mapping.
   - Objective: include stored tax snapshots, VAT percent, VAT amount, tax-inclusive totals, and tax-exclusive profit consistently in internal export DTO, XLSX, and print HTML.
   - Why now: checked notes can now be tax-complete, but exported artifacts omit tax.
   - Dependencies: approved template cells/labels and whether to increment template version/hash.
   - Expected modules/files: `src/features/shipping-notes/export/types.ts`, `queries.ts`, `generator.ts`, `constants.ts`, `src/app/(print)/.../page.tsx`, export tests, template asset.
   - Migration impact: likely none unless export metadata versioning needs new columns.
   - Security impact: must keep tax data accountant/admin only.
   - Tests required: export DTO unit tests, XLSX workbook fixture/cell tests, route helper tests, build.
   - Separate prompt: yes.

2. Authorize and run DB integration suite, then fix only proven regressions.
   - Objective: establish current DB-backed truth for migrations/RBAC/audits/tax services.
   - Why now: integration tests exist but were skipped in this audit.
   - Dependencies: explicit owner confirmation of test/staging DB target.
   - Expected modules/files: tests only if failures prove test/product issues.
   - Migration impact: committed migrations are applied by harness.
   - Security impact: prevents false confidence in server-side RBAC.
   - Tests required: `npm run test:integration`, optionally `npm run test:all`.
   - Separate prompt: yes.

3. Implement post-checked workflow transitions.
   - Objective: define and implement approve/export/lock/cancel transitions with timestamps, actors, audit reasons, and stale-status checks.
   - Why now: workflow dead-ends at `checked`.
   - Dependencies: product/accounting decision for statuses and permissions.
   - Expected modules/files: `src/lib/db/schema.ts`, migration, `src/features/shipping-notes/status-policy.ts`, `mutations.ts`, `actions.ts`, detail UI, tests.
   - Migration impact: likely add `checked_at`, `approved_at`, possibly `exported_at`, `cancelled_at`, reason fields.
   - Security impact: high; status controls protect records.
   - Tests required: unit status policy, DB integration transitions/audit/stale checks, browser later.
   - Separate prompt: yes.

4. Add minimal admin user management.
   - Objective: manage user role, active/deleted state, and session invalidation.
   - Why now: operational access control cannot be managed in-app.
   - Dependencies: session invalidation policy.
   - Expected modules/files: `src/app/(dashboard)/admin/users`, `src/lib/auth`, `src/lib/permissions`, audit logging.
   - Migration impact: probably none.
   - Security impact: high.
   - Tests required: permission tests, DB integration, HTTP/session tests.
   - Separate prompt: yes.

5. Add audit-log read UI/service.
   - Objective: admin/accounting audit lookup for notes, charges, tax overrides, exports.
   - Why now: tax overrides and sensitive mutations are audited but not inspectable.
   - Dependencies: read-scope and redaction policy.
   - Expected modules/files: `src/features/audit`, admin/audit route or note-level audit panel.
   - Migration impact: likely none; possibly indexes.
   - Security impact: high because audit data is sensitive.
   - Tests required: RBAC/read filtering tests.
   - Separate prompt: yes.

6. Implement generated PDF after export model is tax-complete.
   - Objective: produce real PDF binary, not only browser print.
   - Why now: Phase 7 requirement, but should depend on tax-complete export DTO.
   - Dependencies: PDF layout/official output requirements.
   - Expected modules/files: export PDF service/route/tests.
   - Migration impact: use existing export records if adequate.
   - Security impact: must preserve export RBAC.
   - Tests required: PDF generation smoke/metadata tests.
   - Separate prompt: yes.

7. Implement Google Drive integration last.
   - Objective: upload artifacts and persist Drive metadata/status.
   - Why now: external storage depends on stable export generation.
   - Dependencies: credential strategy, folder policy, retry/error handling.
   - Expected modules/files: server-only Drive client, export/upload services, env docs.
   - Migration impact: existing columns may be sufficient; token storage decision may need schema.
   - Security impact: very high for credentials/tokens.
   - Tests required: mocked integration tests; no live external calls in CI.
   - Separate prompt: yes.

## Q. Recommended Immediate Next Task

Select exactly one next implementation target: VAT/tax mapping for internal XLSX and print HTML export artifacts.

Why this task first:
- Dependency order: the tax domain and UI now exist, and `checked` requires tax completeness, so exports should consume the stored snapshots before PDF/Drive build on the same data.
- Business value: accountants/admins can generate internal artifacts today; those artifacts are incomplete for VAT/tax.
- Security/correctness value: using stored charge snapshots prevents historical exports from depending on live tax-rule changes.
- Manageable blast radius: scoped to export DTO/query/generator/print view/tests, likely no production schema migration unless version metadata is expanded.
- Testability: can be covered with pure export DTO/cell tests and build without needing browser E2E or external services.

Do not implement it inside the audit. Use a separate implementation prompt with the approved XLSX template/cell mapping and print labels.
