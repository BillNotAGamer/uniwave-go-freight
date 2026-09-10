# Phase 9C Admin Users UI + Existing-User Temporary Password + Session Regression

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Starting working tree: dirty before Phase 9C, including pre-existing Phase 8/9A/9B source, docs, package, drizzle, export, and integration-test files.
- Preservation: no reset, clean, checkout, stash, revert, commit, migration application, or mass-format was run.
- Existing accepted baseline: Phase 9A/9B application-owned Admin User Management foundation and lifecycle services were present; Better Auth Admin plugin remained disabled.

## B. Implemented Scope

Implemented Phase 9C only:

- Protected `/admin/users` dashboard page.
- Users navigation link for roles with `USERS_MANAGE`.
- Admin Users list/search/role filter/status filter/pagination UI.
- UI controls for create user, role change, deactivate, reactivate, soft delete, manual revoke-all-sessions, and set existing-user temporary password.
- Existing-user Admin temporary password mutation.
- Thin server actions for Admin Users UI forms.
- Focused unit/action/UI-policy/nav tests and integration-test extensions.

Not implemented: Better Auth Admin plugin, hard delete, email edit, restore, impersonation, audit viewer, individual session UI, workflow/export changes, browser E2E, or migrations.

## C. Admin Users Route/UI

- Route: `src/app/(dashboard)/admin/users/page.tsx`
- Server protection: authenticated user plus `USERS_MANAGE`; unauthorized Sale/Accountant are denied before user-list query execution.
- Data source: `listAdminUsersForUser(...)`, which returns only safe Admin User Management DTO fields.
- UI component: `src/features/admin/users/components/admin-users-table.tsx`
- Deleted users render read-only and do not expose mutation forms.
- The page exposes no password hashes, session tokens, Better Auth secrets, audit payloads, artifact storage keys, or Drive/R2 credentials.

## D. Navigation

- `src/components/shell/nav-links.ts` adds a Users link only when `hasPermission(role, PERMISSIONS.USERS_MANAGE)` is true.
- Pure regression test: `src/components/shell/nav-links.test.ts`
- Expected visibility: Admin yes; Sale/Accountant no.

## E. Server Actions

- File: `src/features/admin/users/actions.ts`
- Actions parse `FormData`, validate through existing Zod schemas, require the authenticated user, call production services, map errors to safe messages, and revalidate `/admin/users` on success.
- Authoritative authorization remains in services/read models; UI/actions are not the security boundary.
- Destructive/sensitive UI actions require confirmation where required by Phase 9C.

## F. Temporary Password Contract

- Service: `setAdminManagedUserTemporaryPassword(...)`
- Actor: active non-deleted Admin only through `USERS_MANAGE`.
- Target: another active or inactive non-deleted user.
- Denied targets: self, soft-deleted, missing, invalid state.
- Reason: mandatory and trimmed.
- Password hashing: existing Better Auth-compatible `hashCredentialPassword(...)` from `src/lib/auth/credentials.ts`.
- Credential account contract: update exactly one existing account with `providerId = "credential"` for the target user. Missing or ambiguous credential accounts fail with `USER_CREDENTIAL_ACCOUNT_NOT_FOUND`.
- No credential account is created for existing-user password reset.

## G. Credential Account Safety

The mutation updates only the selected credential account row and refuses to proceed when the exact existing credential contract is not met. It does not add schema fields and does not use Better Auth Admin plugin operations.

## H. Session Revocation

- Existing-user temporary password reset revokes all target sessions in the same DB transaction as the credential update and audit write.
- Role change, deactivation, soft delete, and manual revoke-all-session behavior from Phase 9B is preserved.
- Reactivation still does not create or restore sessions.
- Integration tests were extended to verify password reset deletes the prior target session token, but they were not executed without current DB authorization.

## I. Audit Contract

- Password reset audit action: `user.password_set_by_admin`
- Entity: `user`
- Audit after snapshot includes target user id, role, active/deleted state, and `revokedSessionCount`.
- Audit reason is the mandatory reset reason.
- Temporary password and password hash are intentionally excluded from audit payloads and user-facing messages.

## J. RBAC

| Capability | Sale | Accountant | Admin |
| --- | ---: | ---: | ---: |
| Access `/admin/users` | No | No | Yes |
| See Users nav link | No | No | Yes |
| Create user | No | No | Yes |
| Change role | No | No | Yes |
| Deactivate/reactivate | No | No | Yes |
| Soft delete | No | No | Yes |
| Manual revoke all sessions | No | No | Yes |
| Set temporary password for existing user | No | No | Yes |

Self-protection remains: Admin cannot manage their own role/state/session revocation/password reset through Admin User Management.

## K. UI Policy

- Active non-self users expose role change, deactivate, soft delete, manual revoke sessions, and temporary password reset.
- Inactive non-self users expose role change, reactivate, soft delete, manual revoke sessions, and temporary password reset.
- Deleted users expose no mutation actions.
- Self rows expose no destructive/session/password/role-change actions.
- Non-manager viewer policy denies all row actions.

## L. Tests Added/Changed

- Added `src/features/admin/users/actions.test.ts`
- Added `src/components/shell/nav-links.test.ts`
- Updated `src/features/admin/users/mutations.test.ts`
- Updated `src/features/admin/users/validators.test.ts`
- Updated `src/features/admin/users/ui-policy.test.ts`
- Extended `tests/integration/admin-user-lifecycle.integration.test.ts` for password reset credential/session/audit behavior.

## M. Integration Tests Added But Not Run

Production-path integration coverage was extended for:

- Existing-user temporary password reset with exact credential account update.
- Old password rejection and new password verification.
- Target session revocation, including previous session token deletion.
- `user.password_set_by_admin` audit safety.
- Sale/Accountant/self/deleted-target denial without false password-reset audit.

Execution status: `SKIPPED`. `npm run test:integration` and `npm run test:all` were not run because this conversation did not explicitly authorize the configured `DATABASE_URL` as test/staging.

## N. Validation

- Focused tests: PASS, 5 files / 26 tests.
- `npm test`: PASS, 36 files / 212 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run test:integration`: SKIPPED, no current DB authorization.
- `npm run test:all`: SKIPPED, no current DB authorization.

The first sandboxed focused-test attempt failed with Windows `EPERM` while Node resolved `C:\Users\Admin`; the same command was rerun with escalation and passed. No database command was executed.

## O. Migration State

- New migration created: no.
- `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- `drizzle/0004_clean_power_man.sql` applied in this conversation: no.
- No schema changes were required for Phase 9C.

## P. Documentation Updates

Updated current project docs:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`

## Q. Files Changed By This Phase

Production/source:

- `src/app/(dashboard)/admin/users/page.tsx`
- `src/components/shell/nav-links.ts`
- `src/features/admin/users/actions.ts`
- `src/features/admin/users/components/admin-users-table.tsx`
- `src/features/admin/users/errors.ts`
- `src/features/admin/users/mutations.ts`
- `src/features/admin/users/ui-policy.ts`

Tests:

- `src/components/shell/nav-links.test.ts`
- `src/features/admin/users/actions.test.ts`
- `src/features/admin/users/mutations.test.ts`
- `src/features/admin/users/ui-policy.test.ts`
- `src/features/admin/users/validators.test.ts`
- `tests/integration/admin-user-lifecycle.integration.test.ts`

Docs/report:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_9C_ADMIN_USERS_UI_SESSION_IMPLEMENTATION_2026-08-24.md`

Pre-existing dirty/untracked files from earlier phases were preserved.

## R. Remaining Out Of Scope

- Better Auth Admin plugin.
- Hard delete.
- Email edit.
- Soft-delete restore.
- Impersonation.
- Individual session UI.
- Audit viewer.
- Browser E2E.
- Live Better Auth HTTP/session regression execution.
- Workflow/export changes.
- Migrations.

## S. Known Risks

- Live HTTP/browser session invalidation has not been executed because no current DB/test environment authorization was provided and no browser E2E harness is in scope for Phase 9C.
- The Admin Users UI is validated by unit/action/build coverage, not browser E2E form submission.
- Integration tests are ready but still require applying the existing migrations to an authorized test/staging database.

## T. Final Verdict

READY FOR LEAD REVIEW
