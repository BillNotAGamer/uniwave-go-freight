# Phase 11H.1 Production Integration Regression Closure

## A. Historical Fixture Cleanup Authorization

- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Runtime: Node `v24.19.0`, npm `10.8.1`
- Dirty tree: expected; prior accepted Phase 8/9/10/11 work remains uncommitted and was preserved.
- Production target was parsed from the configured environment without printing credentials.
- Safe target descriptor: host `ep-falling-sky-az05o2cl-pooler.c-3.ap-southeast-1.aws.neon.tech`, database `neondb`, default port, SSL mode present.
- Exact production integration guards were required for database access:
  - `INTEGRATION_TEST_DATABASE_AUTHORIZED=true`
  - `INTEGRATION_TEST_DATABASE_PRODUCTION_AUTHORIZED=true`
  - exact expected host
  - exact expected database name
- First cleanup authorization covered one verified orphan audit row: `shipping_note.lock`, id `b4d6cb74-0596-4437-bb50-03c2942718c9`.
- Second cleanup authorization covered only fixture namespace `it-acc-20260902-225608-34ef`.

## B. Pre-cleanup Inventory

The one-row orphan cleanup used the strongest known immutable predicate:

- audit id `b4d6cb74-0596-4437-bb50-03c2942718c9`
- created timestamp `2026-09-02 22:31:12.815`
- action `shipping_note.lock`
- entity type `shipping_note`
- null actor user
- non-null entity id
- missing linked shipping note
- no `IT-` marker in `before` or `after`
- all application tables empty at the time of that cleanup

One-row orphan cleanup result:

| Check | Result |
| --- | ---: |
| Pre-delete match count | 1 |
| Affected row count | 1 |
| Post-delete match count | 0 |

The later exact namespace re-query for `it-acc-20260902-225608-34ef` found no remaining rows, so no namespace deletion was performed.

| Table | Pre-cleanup count |
| --- | ---: |
| `users` | 0 |
| `shipping_notes` | 0 |
| `shipping_note_charges` | 0 |
| `shipping_note_exports` | 0 |
| `audit_logs` | 0 |
| `tax_rules` | 0 |
| `sessions` | 0 |
| `accounts` | 0 |
| `verifications` | 0 |

## C. Cleanup Predicate and Ownership Proof

The namespace cleanup predicate was prepared but not executed because the authorized namespace already matched zero rows.

Secret-safe ownership rules used for inventory:

- fixture users: normalized email contains exact token `it-acc-20260902-225608-34ef` and `@integration.test`
- fixture notes: `jobsheet_no` or `mawb_hawb_no` contains exact marker `IT-ACC-20260902-225608-34EF`
- fixture charges: linked to fixture notes or contains the exact marker in charge fixture fields
- fixture exports: linked to fixture notes or exact marker in file name
- fixture tax rules: exact marker in fixture code/name/description
- fixture auth rows: linked to fixture users or exact marker in verification fields
- fixture audit rows: linked to fixture actors/entities or exact marker in JSON snapshots

No broad predicate such as action-only, temporal-only, unbounded email pattern, `TRUNCATE`, `DROP`, or `DELETE` without `WHERE` was used.

## D. Cleanup Execution

- One-row orphan audit cleanup: executed in an explicit transaction with re-select, exact assertion, scoped delete, affected-row assertion, and postcondition assertion.
- Namespace cleanup: not executed because the mandatory pre-cleanup inventory for `it-acc-20260902-225608-34ef` returned zero rows.
- Migration history was not modified.
- No schema objects were dropped or changed.

## E. Post-cleanup Verification

Read-only production verification after cleanup showed:

- `users`: 0
- `accounts`: 0
- `sessions`: 0
- `verifications`: 0
- `shipping_notes`: 0
- `shipping_note_charges`: 0
- `shipping_note_exports`: 0
- `audit_logs`: 0
- `tax_rules`: 0
- integration run IDs: none
- orphan audit diagnostics: none
- orphan audit identifiers: none

## F. AWS/Vitest Regression

Root cause:

- The integration command used `node --conditions=react-server`.
- The integration Vitest config also included `react-server` and `module` in resolution conditions.
- That caused incompatible package resolution in the Node/Vitest integration environment: AWS SDK packages could select an ESM path with extensionless internal imports, and React PDF could resolve React's `react-server` entry rather than the normal Node-compatible React runtime.

Fix:

- `package.json` integration script now runs Vitest without global `--conditions=react-server`.
- `vitest.integration.config.ts` now uses `["node", "import", "default"]` conditions.
- `server-only` is mapped to `tests/integration/setup/server-only.ts`, a no-op test marker module, so server modules can be imported by integration tests without changing production Next.js behavior.

Focused evidence:

- The previously affected accounting/export integration suite now passes as part of the full run.
- The full production-authorized integration suite passed 9 files / 95 tests.

## G. Duplicate Email Regression

Root cause:

- The Admin User Management contract expects normalized duplicate email creation to return `USER_DUPLICATE_EMAIL`.
- PostgreSQL unique-violation code `23505` can be wrapped under `error.cause` by the Neon/Drizzle path.
- The previous mapper inspected only the top-level error, so the duplicate condition fell through to `USER_INVALID_STATE`.

Fix:

- `src/features/admin/users/mutations.ts` now walks the error/cause chain and maps wrapped PostgreSQL `23505` unique violations to `USER_DUPLICATE_EMAIL`.
- `src/features/admin/users/mutations.test.ts` adds no-DB regression coverage for wrapped duplicate violations.

Focused evidence:

- `tests/integration/admin-user-lifecycle.integration.test.ts` passed 11/11 during focused verification.
- Full production integration also passed the duplicate normalized-email scenario.

## H. Admin Concurrency Regression

Root cause:

- The last-active-admin protection used an advisory-lock pattern that did not serialize the relevant concurrent production paths under the hosted Neon execution model.
- Concurrent active-admin reduction attempts could both observe a valid active-admin set and proceed.

Fix:

- Active-admin reduction paths now lock the current active Admin rows with `SELECT ... FOR UPDATE` inside the existing transaction before performing demotion/deactivation/soft-delete checks.
- This makes the invariant depend on row locks over the protected user set rather than advisory-lock behavior.

Focused evidence:

- The Admin lifecycle integration suite passed 11/11, including the concurrent active-admin reduction test.

## I. DEP0190

Status: `RESOLVED - REPOSITORY OWNED`

- The guarded migration wrapper previously launched Drizzle Kit through a shell-based spawn path.
- `scripts/guarded-db-migrate.ts` now resolves `drizzle-kit/bin.cjs` and launches it with `process.execPath` and argument array, with `shell: false`.
- The migration guard behavior and exit-code propagation are preserved.
- No migration was rerun for this investigation.

## J. Full Integration Result

Command:

```text
npm run test:integration
```

Authorization:

- exact production database target guards were set
- no guard was bypassed
- no concurrent integration invocation was launched

Final result:

| Metric | Result |
| --- | ---: |
| Test files | 9 passed / 9 total |
| Tests | 95 passed / 95 total |
| Failed test files | 0 |
| Failed tests | 0 |
| Unexpected skipped tests | 0 |

One intermediate rerun failed before the final pass because a test fixture generated a tax-rule code longer than the domain's 40-character validation limit. The fixture label was shortened from `REOPEN-BUY-TAX` to `RBT`; production behavior was unchanged.

## K. Final Production Cleanup Result

Read-only verification after the final passing suite showed:

- no fixture users
- no fixture shipping notes
- no fixture charges
- no fixture exports
- no fixture audit rows
- no fixture tax rules
- no fixture auth rows
- no integration run IDs
- no orphan audit rows

Final application table counts were all zero for the tested production database.

## L. Migration / Schema Integrity

Read-only production verification after cleanup and after the full integration suite:

| Migration | Status |
| --- | --- |
| `0000_new_nick_fury` | APPLIED |
| `0001_dazzling_saracen` | APPLIED |
| `0002_jittery_paper_doll` | APPLIED |
| `0003_hard_titania` | APPLIED |
| `0004_clean_power_man` | APPLIED |
| `0005_perpetual_goblin_queen` | APPLIED |

Additional checks:

- no extra migration rows
- post-checked workflow columns present
- artifact/Drive export columns present
- expected lock/cancel foreign keys present
- `drive_upload_status` enum present
- `shipping_note_exports_artifact_storage_key_uidx` present
- `audit_logs_created_at_id_idx` present

No migration was created, modified, or rerun during Phase 11H.1.

## M. Full Regression Validation

All validation ran under Node `v24.19.0` / npm `10.8.1`.

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 707 packages installed, 7 accepted audit findings reported |
| `npm ls` | PASS; dependency tree clean, no extraneous package listed |
| `npm test` | PASS; 50 files / 287 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; Next.js 16.3.3 compiled admin, shipping note, export, print, and API routes |
| `npm run test:e2e` | PASS; 9 Chromium tests |
| `npm run ci:security-audit` | PASS; full and production audits at 0 critical / 1 high / 6 moderate / 7 total |

Security audit note:

- A newly reported `qs@6.15.3` moderate advisory appeared through `googleapis-common@8.0.3`.
- It was remediated with a lockfile-only transitive resolution to `qs@6.16.0`.
- No direct dependency or application dependency major version was changed.

## N. Credential Rotation

`REQUIRED - NOT YET PERFORMED`

The Phase 11H finding remains: the prior tracked `.env.example` contained a live-looking Neon connection string. It has been replaced with a placeholder, but the production database credential must be reviewed/rotated by a human before final release.

## O. GitHub-hosted CI

`PENDING - NOT EXECUTED`

No actual GitHub-hosted Actions run evidence was available in this workspace. Local validation is not claimed as GitHub-hosted CI evidence.

## P. Files Changed

Phase 11H.1 changed or added:

- `package.json`
- `package-lock.json`
- `vitest.integration.config.ts`
- `tests/integration/setup/server-only.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`
- `src/features/admin/users/mutations.ts`
- `src/features/admin/users/mutations.test.ts`
- `scripts/guarded-db-migrate.ts`
- `scripts/phase11h-production-db-inspect.mjs`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_11H1_PRODUCTION_INTEGRATION_REGRESSION_CLOSURE_2026-09-03.md`

Temporary one-time cleanup scripts were created and removed during the phase so no reusable production deletion helper remains:

- `scripts/phase11h1-clean-orphan-audit.ts`
- `scripts/phase11h1-clean-fixture-namespace.ts`

Pre-existing accepted dirty files from earlier phases were preserved.

## Q. Final Verdict

READY FOR LEAD REVIEW
