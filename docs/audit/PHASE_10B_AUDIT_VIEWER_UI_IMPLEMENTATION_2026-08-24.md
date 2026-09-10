# Phase 10B Audit Viewer UI Implementation

## A. Starting State

- Date: 2026-08-24
- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Starting working tree: dirty with pre-existing modified docs, package files, schema/export files, generated Phase 8/10A migrations, Admin User Management files, export history/Drive/artifact files, and integration tests.
- Preservation: no reset, checkout, clean, stash, revert, amend, delete, mass-format, migration apply, integration test execution, or `test:all` execution was performed.
- Project handbook: no handbook file was found; none was recreated.

## B. Route / RBAC

- Route added: `/admin/audit`.
- Page file: `src/app/(dashboard)/admin/audit/page.tsx`.
- The page resolves the authenticated active/non-deleted user through the existing session helper.
- Server authorization requires `PERMISSIONS.AUDIT_LOGS_READ` before query parsing can reach the audit read model.
- Sale and Accountant receive not-found behavior before audit rows are queried.
- Admin calls the Phase 10A `listAuditViewerForUser(...)` read model, which remains the authoritative policy/query boundary.

## C. Navigation

- Added an Audit nav item through the existing role-aware `getNavLinks(...)` infrastructure.
- Visibility rule: `hasPermission(role, PERMISSIONS.AUDIT_LOGS_READ)`.
- Current visibility: Admin visible, Sale hidden, Accountant hidden.
- Navigation visibility is not the authorization boundary; the page/read model still enforce server-side access.

## D. Filters

- Exposed structured filters only: action, entity type, entity ID, actor ID, from date, and to date.
- No free-text search was added.
- Action options are derived from the Phase 10A known-action catalog to avoid catalog drift.
- Entity type options are derived from Phase 10A known entity types.
- Entity ID and actor ID are exact UUID filters validated by the Phase 10A validator.
- Filter state persists in URL query parameters.
- Submitting new filters clears any existing cursor because the filter form does not include a cursor field.
- Clear filters links to `/admin/audit`.
- Date filters use date-only inputs and are translated to `Asia/Ho_Chi_Minh` business-day UTC boundaries before Phase 10A validation.

## E. Pagination

- Pagination remains keyset-based.
- The UI uses `hasNextPage` and `nextCursor` from the Phase 10A read model.
- Next links preserve current filters and append the exact opaque cursor.
- The UI does not decode or rebuild cursor payload fields.
- Previous page was intentionally not implemented; browser Back handles prior pages.

## F. Audit Table

- Columns: Time, Actor, Action, Category, Entity, Reason, Details.
- Time uses `createdAtDisplay` from the safe DTO.
- Actor uses `actor.display` and optionally `actor.email` from the safe actor DTO.
- Action shows readable `actionLabel` with canonical `action` secondarily.
- Entity uses `entityLabel` and `entityHref` from the safe DTO, falling back to entity type plus a shortened entity ID.
- Reason renders as React text.
- Long values wrap inside bounded cells.

## G. Safe Details

- Details use only `detailsAvailable` and `changes` from the Phase 10A DTO.
- Known actions with changes render an inline expandable details region.
- Each safe change displays label, before, and after.
- Null values render as `-`.
- No client-side JSON viewer, snapshot parser, or sanitizer was added.

## H. Unknown Action UX

- Unknown actions remain visible as events through action, actor, entity, time, and reason.
- Unknown actions show `No additional safe details available.`
- Unknown actions do not render a details toggle.
- Unknown action snapshots remain hidden.

## I. Timezone

- The UI displays `createdAtDisplay`, produced by the Phase 10A centralized `Asia/Ho_Chi_Minh` formatter.
- The UI does not call browser-local `toLocaleString()` for audit event timestamps.
- Date-only filters are mapped to business-day boundaries in `Asia/Ho_Chi_Minh` before server validation.

## J. Security Boundaries

- Raw audit snapshots are never passed to or rendered by the Audit Viewer UI.
- The UI consumes only the safe Phase 10A DTO.
- The UI does not query `audit_logs` directly.
- The UI does not expose raw JSON, source/debug views, CSV/XLSX/PDF exports, retention/archive/delete controls, or audit mutations.
- No generic audit API route was added.
- No client-side sanitizer was added; server-side Phase 10A presentation remains authoritative.
- Entity links are server-provided convenience links only; destination routes retain independent authorization.
- Reason and display fields render as React text, not HTML or Markdown.

## K. Tests

- Focused Phase 10B tests:
  - `src/components/shell/nav-links.test.ts`
  - `src/features/admin/audit/ui.test.ts`
  - `src/features/admin/audit/components/admin-audit-table.test.ts`
  - `src/app/(dashboard)/admin/audit/page.test.ts`
- Covered behavior:
  - Admin Audit nav visible, Sale/Accountant hidden.
  - Admin page loads through the protected read model.
  - Sale/Accountant are denied before audit read.
  - Invalid query parameters are denied before audit read.
  - Filter options come from Phase 10A catalog/entity types.
  - Date-only filters translate to `Asia/Ho_Chi_Minh` UTC boundaries.
  - Next links preserve filters and carry the exact opaque cursor.
  - Filter-submit hrefs clear cursor.
  - Known-action details render only safe changes.
  - Unknown actions have no details toggle.
  - Reason text is escaped.
  - Server-provided entity links render, null links fall back to text.
- Existing Phase 10A tests remain green.

## L. Validation

- Focused tests: PASS, 4 files / 16 tests.
- `npm test`: PASS, 44 files / 245 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- Build route evidence: `/admin/audit` appears as a dynamic App Router route.
- `npm run test:integration`: SKIPPED. No current authorization was provided for the configured `DATABASE_URL` as test/staging.
- `npm run test:all`: SKIPPED. No current authorization was provided for the configured `DATABASE_URL` as test/staging.

## M. Migration Status

- New migration created in Phase 10B: no.
- Migration apply: NOT RUN.
- `drizzle/0003_hard_titania.sql`: not applied in this conversation.
- `drizzle/0004_clean_power_man.sql`: not applied in this conversation.
- `drizzle/0005_perpetual_goblin_queen.sql`: not applied in this conversation.
- Phase 10B uses the existing Phase 10A `audit_logs_created_at_id_idx` migration.

## N. Files Changed

- Phase 10B source/UI:
  - `src/app/(dashboard)/admin/audit/page.tsx`
  - `src/features/admin/audit/components/admin-audit-table.tsx`
  - `src/features/admin/audit/ui.ts`
  - `src/components/shell/nav-links.ts`
- Phase 10B tests:
  - `src/app/(dashboard)/admin/audit/page.test.ts`
  - `src/features/admin/audit/components/admin-audit-table.test.ts`
  - `src/features/admin/audit/ui.test.ts`
  - `src/components/shell/nav-links.test.ts`
- Phase 10B docs:
  - `docs/BUILD_PHASES.md`
  - `docs/CURRENT_IMPLEMENTATION_STATUS.md`
  - `docs/QA_CHECKLIST.md`
  - `docs/TESTING.md`
  - `docs/audit/PHASE_10B_AUDIT_VIEWER_UI_IMPLEMENTATION_2026-08-24.md`
- Pre-existing dirty/untracked files outside this phase were preserved.

## O. Remaining Production Gaps

- Browser E2E for `/admin/audit` direct access denial, filter submission, detail expansion, pagination, and sensitive-value rendering.
- Live authorized integration execution for the Phase 10A audit viewer integration tests.
- Migration application for pending migrations when the configured database is explicitly authorized as test/staging.
- CI and deployment hardening.
- Audit retention policy remains a future Product/Ops decision.

## P. Final Audit Viewer State

- Admin:
  - Can access `/admin/audit`.
  - Can structured-filter audit history.
  - Can browse newest-first events with forward keyset pagination.
  - Sees safe actor/entity labels.
  - Sees safe field-level details for known actions.
- Sale:
  - No Audit nav link.
  - No `/admin/audit` access.
- Accountant:
  - No Audit nav link.
  - No `/admin/audit` access.
- Security:
  - Raw snapshots are never browser-visible.
  - Unknown action snapshot details are hidden.
  - Secret/token/password fields are not displayed.
  - No audit mutation exists.
  - No audit export exists.
  - No retention controls exist.

## Q. Final Verdict

READY FOR LEAD REVIEW
