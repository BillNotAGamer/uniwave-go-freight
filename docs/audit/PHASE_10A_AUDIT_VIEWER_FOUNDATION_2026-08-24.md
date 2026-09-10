# Phase 10A Audit Viewer Foundation Implementation

## A. Starting State

- Date: 2026-08-24
- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Starting working tree: dirty with pre-existing Phase 8/9/6C/7 files, generated migrations through `0004`, docs, admin-user files, export-history/Drive/artifact files, and integration tests.
- Preservation: no reset, checkout, clean, stash, revert, amend, mass format, or deletion was performed.
- Scope boundary: implemented only the server-side Admin Audit Viewer foundation. No UI route, navigation item, page, table, CSV export, search, or row expansion was added.

## B. RBAC

- Permission: `AUDIT_LOGS_READ`.
- Viewer roles: Admin only through existing Admin-all permission semantics.
- Sale and Accountant are denied in `listAuditViewerForUser(...)` before audit rows are queried.
- Authorization is enforced server-side in the read model, not left to future UI visibility.

## C. Audit DTO

- DTO fields: `id`, `action`, `actionLabel`, `category`, `entityType`, `entityId`, `entityLabel`, `entityHref`, `actor`, `reason`, `createdAt`, `createdAtDisplay`, `detailsAvailable`, and `changes`.
- Raw top-level `before` and `after` snapshots are not returned.
- `changes` uses explicit string/null before/after display values for known allowlisted fields only.

## D. Action Catalog

- Known action count: 34.
- Cataloged actions cover current Shipping Note workflow, charge mutations, tax-rule mutations, XLSX/PDF export generation/failure, Drive upload success/failure, and Admin User Management lifecycle events.
- The catalog is strict: filters only accept known actions, while presentation still safely handles unknown historical/future actions.

## E. Known Action Presenters

- Known action presenters use explicit field allowlists.
- Shipping Note workflow presenters expose state and transition metadata only.
- Charge presenters expose section, charge name, amount/currency/tax display fields, and deletion marker fields.
- Tax-rule presenters expose code/name/treatment/rate/active state.
- Export presenters expose artifact status/version/type/checksum/size/MIME/error fields, excluding storage and Drive identifiers.
- User presenters expose account lifecycle, role/status, reason, and session-revocation counts only.

## F. Unknown Action Policy

- Unknown actions return action identity, canonical label fallback, entity, actor, reason, and timestamps.
- Unknown actions set `detailsAvailable = false`.
- Unknown actions return `changes = []`.
- Unknown action snapshots are not inspected for display and do not expose any snapshot-derived field.

## G. Sensitive-Field Defense

- Presenter output is recursively sanitized for nested objects and arrays.
- Protected key concepts include password, passphrase, password hash, token families, private key, secret, client secret, credential, database URL, connection string, artifact storage key, authorization, and cookie.
- Defense applies after known-action presentation as a second layer behind field allowlists.
- Drive file IDs, Drive folder IDs, and artifact storage keys are intentionally not display fields.

## H. Actor Resolution

- Audit rows left join `users` for actor name/email.
- Actor DTO exposes only `id`, `name`, `email`, and `display`.
- Null actor fallback displays `Unknown actor`.
- Soft-deleted user rows can still be labeled safely when the user row remains available.

## I. Entity Resolution

- Entity labels are batched by entity type, avoiding per-row label queries.
- Supported entity label types:
  - `shipping_note`: Jobsheet number with `/shipping-notes/:id`.
  - `shipping_note_charge`: section/charge label linked to the parent Shipping Note.
  - `shipping_note_export`: filename/type/version linked to the parent Shipping Note.
  - `tax_rule`: code/name linked to `/tax-rules`.
  - `user`: name/email/status linked to `/admin/users?search=<email>`.
- Unknown entity types retain raw entity type/id without a link or label.

## J. Filters

- Supported filters: action, entity type, entity ID, actor ID, from, to, cursor, and limit.
- UUID filters are strictly validated.
- Date filters parse to `Date` and enforce `from <= to`.
- Limit is bounded with default 50 and max 100.
- Free-text search is intentionally not implemented in Phase 10A.

## K. Cursor / Pagination

- Ordering: `createdAt DESC, id DESC`.
- Cursor payload: `{ createdAt, id }`.
- Cursor encoding: opaque base64url JSON.
- Cursor decoding is strict and rejects invalid JSON, non-datetime `createdAt`, non-UUID `id`, and extra keys.
- The read model fetches `limit + 1` rows to compute `hasNextPage` and `nextCursor`.

## L. Timezone

- Display timezone constant: `Asia/Ho_Chi_Minh`.
- `formatAuditViewerDateTime(...)` centralizes display formatting.
- Database filtering remains timestamp-based and does not reinterpret stored timestamps.

## M. Schema / Migration

- Schema change: added `audit_logs_created_at_id_idx` to `auditLogs` in `src/lib/db/schema.ts`.
- Migration generated: `drizzle/0005_perpetual_goblin_queen.sql`.
- Migration SQL:

```sql
CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
```

- Scope: index only, exactly for audit viewer keyset pagination.
- No columns, tables, constraints, enum values, or data rewrites were added.

## N. Tests

- Unit/policy tests added:
  - `src/features/admin/audit/policy.test.ts`
  - `src/features/admin/audit/cursor.test.ts`
  - `src/features/admin/audit/validators.test.ts`
  - `src/features/admin/audit/presentation.test.ts`
  - `src/features/admin/audit/queries.test.ts`
- Integration test added but not executed:
  - `tests/integration/audit-viewer.integration.test.ts`
- Integration coverage is prepared for Admin access, Sale/Accountant denial, ordering, cursor pagination, filters, soft-deleted actor labels, null actor fallback, unknown action hiding, and export/Drive sensitive-field hiding.

## O. Validation

- Focused tests: PASS, 5 files / 18 tests.
- `npm test`: PASS, 41 files / 230 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run test:integration`: SKIPPED. No current authorization was provided for the configured `DATABASE_URL` as test/staging.
- `npm run test:all`: SKIPPED. No current authorization was provided for the configured `DATABASE_URL` as test/staging.

## P. Migration Status

- New migration created: yes, index-only `drizzle/0005_perpetual_goblin_queen.sql`.
- Migration apply: NOT RUN.
- `drizzle/0003_hard_titania.sql`: not applied in this conversation.
- `drizzle/0004_clean_power_man.sql`: not applied in this conversation.
- `drizzle/0005_perpetual_goblin_queen.sql`: not applied in this conversation.
- `npm run db:migrate`: NOT RUN.

## Q. Files Changed

- Phase 10A source:
  - `src/features/admin/audit/types.ts`
  - `src/features/admin/audit/policy.ts`
  - `src/features/admin/audit/timezone.ts`
  - `src/features/admin/audit/cursor.ts`
  - `src/features/admin/audit/validators.ts`
  - `src/features/admin/audit/presentation.ts`
  - `src/features/admin/audit/queries.ts`
- Phase 10A tests:
  - `src/features/admin/audit/policy.test.ts`
  - `src/features/admin/audit/cursor.test.ts`
  - `src/features/admin/audit/validators.test.ts`
  - `src/features/admin/audit/presentation.test.ts`
  - `src/features/admin/audit/queries.test.ts`
  - `tests/integration/audit-viewer.integration.test.ts`
- Phase 10A migration/schema:
  - `src/lib/db/schema.ts`
  - `drizzle/0005_perpetual_goblin_queen.sql`
  - `drizzle/meta/0005_snapshot.json`
  - `drizzle/meta/_journal.json`
- Phase 10A docs:
  - `docs/BUILD_PHASES.md`
  - `docs/CURRENT_IMPLEMENTATION_STATUS.md`
  - `docs/QA_CHECKLIST.md`
  - `docs/TESTING.md`
  - `docs/audit/PHASE_10A_AUDIT_VIEWER_FOUNDATION_2026-08-24.md`

Pre-existing dirty/untracked files outside this phase were preserved.

## R. Remaining Phase 10B Work

- Add protected Admin audit viewer route and navigation.
- Add table UI with filters and cursor pagination.
- Add row expansion/detail presentation using the safe DTO only.
- Add browser/UI tests for route protection, role visibility, filters, pagination, and safe rendering.
- Keep raw snapshot JSON unavailable to the UI unless a later phase explicitly designs a safe redacted detail model.

## S. Final Verdict

READY FOR LEAD REVIEW
