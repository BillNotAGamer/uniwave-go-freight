# Phase 9B Admin User Lifecycle Implementation - 2026-08-23

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Starting tree: dirty before Phase 9B. Pre-existing Phase 8/9A tracked and untracked work was preserved.
- Project handbook: absent; not recreated.
- Current live DB authorization: not provided in this conversation.

## B. Architecture

- Application-owned Admin User Management remains authoritative.
- Better Auth Admin plugin remains disabled.
- No Better Auth admin plugin operations are used.
- No Admin Users UI, server actions, browser E2E, email editing, hard delete, soft-delete restore, impersonation, or existing-user password reset was added.
- Production lifecycle services live in `src/features/admin/users/mutations.ts`.
- All services require an active non-deleted Admin actor with `USERS_MANAGE`.

## C. Credential Creation Compatibility

- Local Better Auth 1.6.20 source was inspected.
- Better Auth email/password signup and the disabled admin plugin both create credential accounts with:
  - `providerId = "credential"`
  - `accountId = user.id`
  - `userId = user.id`
  - `password = ctx.context.password.hash(password)`
- Phase 9B mirrors this through `src/lib/auth/credentials.ts`.
- Password hashing uses `better-auth/crypto` `hashPassword`.
- Verification tests use Better Auth-compatible `verifyPassword`.
- Password length policy is documented in `src/lib/auth/password-policy.ts`: min `8`, max `128`.

## D. Create User

- `createAdminManagedUser(...)` creates active internal users with one role: `sale`, `accountant`, or `admin`.
- Email is trimmed/lowercased through the Phase 9A validator.
- `emailVerified` remains `false`; Phase 9B does not fake verification.
- Temporary password is required only for creation.
- Password hash is generated before the DB transaction.
- User row, credential account row, and `user.create` audit write commit atomically.
- No session row is created.
- Duplicate DB unique violations are mapped to `USER_DUPLICATE_EMAIL`.

## E. Role Change

- `changeAdminManagedUserRole(...)` allows Admin to change active or inactive non-deleted users.
- Deleted users are denied.
- Same-role requests fail with `USER_ROLE_UNCHANGED`.
- Admin self-demotion is denied.
- Successful actual role changes revoke all target sessions in the same DB transaction.
- Parent audit action: `user.role_change`.
- Automatic session revocation count is stored as `revokedSessionCount` in the parent audit metadata.

## F. Deactivate / Reactivate

- `deactivateAdminManagedUser(...)` requires an active non-deleted target and a mandatory reason.
- Self-deactivation is denied.
- Successful deactivation sets `isActive = false`, revokes target sessions, and writes `user.deactivate` atomically.
- `reactivateAdminManagedUser(...)` requires inactive non-deleted target.
- Reactivation writes `user.reactivate`.
- Reactivation does not restore or create sessions.
- Deleted users cannot be reactivated.

## G. Soft Delete

- `softDeleteAdminManagedUser(...)` preserves the `users` row.
- Successful soft delete sets:
  - `isActive = false`
  - `deletedAt = mutationTime`
  - `updatedAt = mutationTime`
- Self soft-delete is denied.
- Already-deleted users are denied.
- Target sessions are revoked in the same transaction.
- Audit action: `user.soft_delete`.
- No production hard-delete service exists.

## H. Session Revocation

- Automatic revoke-all occurs for:
  - role change
  - deactivate
  - soft delete
- Manual revoke-all is implemented by `revokeAdminManagedUserSessions(...)`.
- Manual revoke-all allows active and inactive non-deleted targets.
- Manual revoke-all denies deleted users and actor self-target.
- Manual revoke-all requires a reason and writes `user.sessions_revoked`.
- Session IDs and tokens are never returned or audited.
- Zero-session manual revocation succeeds with `revokedSessionCount = 0`.

## I. Last-Admin Serialization

- Sensitive operations:
  - active Admin to Sale
  - active Admin to Accountant
  - deactivate active Admin
  - soft-delete active Admin
- All role-change/deactivate/soft-delete services acquire the same PostgreSQL transaction-scoped advisory lock before target reload, active-admin count, mutation, session deletion, and audit.
- Shared lock keys:
  - `909900901`
  - `909900902`
- Purpose: serialize active-admin reducing operations so concurrent requests cannot leave zero active non-deleted Admins.
- No new schema/version column was introduced.

## J. Concurrency

- Target user rows are selected `FOR UPDATE` before mutation decisions.
- Mutations use guarded updates against current status fields such as role, `isActive`, and `deletedAt`.
- Lifecycle mutation, session deletion, and audit write are in one transaction.
- If the guarded update fails, the service returns a safe `USER_INVALID_STATE` error.
- Integration coverage was added for the concurrent two-admin reduction scenario, but not executed without current DB authorization.

## K. Audit Contract

- Audit actions:
  - `user.create`
  - `user.role_change`
  - `user.deactivate`
  - `user.reactivate`
  - `user.soft_delete`
  - `user.sessions_revoked`
- Actor is the authenticated Admin user ID.
- Entity type is `user`; entity ID is the target user ID.
- Audit snapshots include safe state only: ID/name/email/role/active/deleted fields and revocation counts.
- Audit snapshots never include temporary password, password hash, session token, access token, refresh token, or account secrets.

## L. Security Boundaries

- Sale and Accountant are denied by the production service boundary.
- Existing safe list DTO remains unchanged.
- Better Auth Admin plugin remains disabled.
- No hard delete, email edit, existing-user password reset, impersonation, or individual-session management was implemented.
- Existing-user Admin password reset remains Phase 9C.

## M. Tests

- Focused unit/service tests added or updated:
  - `src/lib/auth/credentials.test.ts`
  - `src/features/admin/users/policy.test.ts`
  - `src/features/admin/users/validators.test.ts`
  - `src/features/admin/users/mutations.test.ts`
- Integration coverage added but not run:
  - `tests/integration/admin-user-lifecycle.integration.test.ts`
- Integration scenarios cover future live DB execution for create credentials, duplicate email, authorization denial, role change, deactivate/reactivate, soft delete, manual revoke-all, audit writes, session deletion, and advisory-lock concurrency behavior.

## N. Validation

- Focused tests: PASS, 4 files / 24 tests.
- `npm test`: PASS, 33 files / 198 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run test:integration`: SKIPPED, no current authorization for configured `DATABASE_URL` as test/staging.
- `npm run test:all`: SKIPPED, no current authorization for configured `DATABASE_URL` as test/staging.
- `npm run db:migrate`: NOT RUN.

## O. Migration Status

- New migration created: no.
- `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- `drizzle/0004_clean_power_man.sql` applied in this conversation: no.

## P. Files Changed

Phase 9B files:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_9B_ADMIN_USER_LIFECYCLE_IMPLEMENTATION_2026-08-23.md`
- `src/lib/auth/password-policy.ts`
- `src/lib/auth/credentials.ts`
- `src/lib/auth/credentials.test.ts`
- `src/features/admin/users/errors.ts`
- `src/features/admin/users/mutations.ts`
- `src/features/admin/users/mutations.test.ts`
- `src/features/admin/users/policy.ts`
- `src/features/admin/users/policy.test.ts`
- `src/features/admin/users/validators.ts`
- `src/features/admin/users/validators.test.ts`
- `tests/integration/admin-user-lifecycle.integration.test.ts`

Pre-existing dirty/untracked Phase 8/9A files were preserved and not reset, cleaned, stashed, or reverted.

## Q. Remaining Phase 9C Work

- Admin Users page.
- Create-user UI.
- Role/state controls.
- Manual revoke-all control.
- Existing-user Admin temporary-password reset.
- Password credential update.
- Automatic session revocation after password set.
- Better Auth live HTTP/session regression tests.
- Browser E2E for Admin User Management.
- Final user-management UX.

## R. Final Verdict

READY FOR LEAD REVIEW
