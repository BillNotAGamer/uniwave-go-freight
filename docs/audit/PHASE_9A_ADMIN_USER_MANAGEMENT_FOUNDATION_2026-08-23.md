# Phase 9A Admin User Management Foundation - 2026-08-23

## A. Starting State

- Branch: `feature/ui-overhaul`.
- HEAD at start: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Working tree was already dirty with pre-existing Phase 8A/8B/8C files and audit artifacts.
- Phase 9A preserved existing dirty/untracked work.
- No reset, checkout, clean, stash, revert, amend, commit, destructive operation, or mass-format was performed.
- Project handbook `docs/PROJECT_OVERVIEW_UNIWAVE_GO_FREIGHT_VI_2026-08-14.md` remains absent and was not recreated.

## B. Architecture Decision

- Accepted architecture implemented: application-owned Admin User Management foundation.
- Better Auth Admin plugin remains disabled.
- No Better Auth Admin plugin schema semantics were added:
  - no `banned`.
  - no `banReason`.
  - no `banExpires`.
  - no session `impersonatedBy`.
- No Better Auth `/admin/*` route surface was exposed.

## C. Role Model

- Authoritative role source remains `users.role`.
- Role values remain exactly:
  - `sale`
  - `accountant`
  - `admin`
- Role validation uses the existing app role catalog.
- Multi-role arrays are rejected.
- Comma-separated roles are rejected.
- Better Auth's separate role/access-control matrix was not introduced.

## D. Account State Model

Application account status is derived from existing fields only:

| Status | DB representation |
| --- | --- |
| `active` | `isActive = true`, `deletedAt = null` |
| `inactive` | `isActive = false`, `deletedAt = null` |
| `deleted` | `deletedAt != null` |

- Deleted wins over `isActive`.
- No account-state DB column was added.
- Inactive and soft-deleted access behavior remains enforced by existing auth/session helpers.

## E. User Management Permission

- `PERMISSIONS.USERS_MANAGE` is the only Admin User Management permission used in Phase 9A.
- Sale: denied.
- Accountant: denied.
- Admin: allowed through existing Admin-all semantics.

## F. Policy Helpers

Added pure policy helpers in `src/features/admin/users/policy.ts`:

- `canManageUsers`
- `getAdminUserAccountStatus`
- `isProductionUserHardDeleteAllowed`
- `normalizeOptionalAdminReason`
- `normalizeRequiredAdminReason`
- `isLastAdminSensitiveOperation`
- `canChangeUserRole`
- `canDeactivateUser`
- `canReactivateUser`
- `canSoftDeleteUser`
- `canSetTemporaryPassword`
- `canManuallyRevokeUserSessions`
- `shouldRevokeSessionsForUserOperation`

No mutation uses these helpers yet; Phase 9B will enforce them server-side inside mutation services.

## G. Self-Management Policy

Admin cannot use Admin User Management to:

- demote themselves.
- deactivate themselves.
- soft-delete themselves.
- Admin-reset their own password.

Harmless self-profile updates remain outside this phase.

## H. Last-Admin Foundation

Policy protects the invariant:

```text
at least one active non-deleted Admin must remain
```

Protected operations when the target is the last active Admin:

- Admin -> Sale role change.
- Admin -> Accountant role change.
- deactivate.
- soft delete.

The pure helper accepts `activeAdminCount` for unit testing and future service use.

Important concurrency requirement for Phase 9B:

- the active-admin count must be computed under serialized mutation protection, such as a transaction-level PostgreSQL advisory lock or an equivalent repository-approved mechanism.
- a simple count-then-update outside serialization is not sufficient.

## I. Session Revocation Matrix

| Operation | Revoke target sessions? |
| --- | --- |
| create user | no |
| role change | yes |
| deactivate | yes |
| reactivate | no |
| soft delete | yes |
| Admin temporary password reset | yes |
| manual revoke all sessions | yes |

- Individual session listing/revocation remains out of scope for MVP.
- Impersonation remains out of scope.
- Phase 9A does not delete session rows.

## J. Reason Policy

| Operation | Reason policy |
| --- | --- |
| role change | optional; trim; blank -> null |
| deactivate | mandatory |
| reactivate | optional; trim; blank -> null |
| soft delete | mandatory |
| Admin temporary password set | mandatory |
| manual revoke all sessions | mandatory |

- No reason columns were added.
- Future mutations should write reasons to `audit_logs.reason`.

## K. Admin User Read Model

Added protected server read model:

- `listAdminUsersForUser(actor, input)`
- `toAdminUserListItem(row)`
- `buildAdminUsersListWhere(query)`

Authorization:

- requires `USERS_MANAGE`.
- Sale and Accountant are denied before querying.

Active session count:

- read model counts unexpired `sessions` rows only.
- session tokens are never returned.

## L. Query / Filtering Contract

Supported filters:

- `search`: trimmed name/email search, max 120 chars.
- `role`: `sale | accountant | admin`.
- `status`: `active | inactive | deleted | all`.
- `limit`: default 20, maximum 100.
- `offset`: bounded non-negative integer.
- `page`: optional, translated to offset.

Default behavior:

- soft-deleted users are excluded unless `status = deleted` or `status = all`.
- active and inactive non-deleted users are included by default.
- ordering is deterministic: `createdAt DESC`, then `id ASC`.

## M. Safe DTO Boundary

Safe Admin user DTO fields:

- `id`
- `name`
- `email`
- `role`
- `isActive`
- `deletedAt`
- `createdAt`
- `updatedAt`
- `accountStatus`
- `activeSessionCount`

Excluded:

- password.
- password hash.
- session token.
- access token.
- refresh token.
- OAuth/account secrets.
- raw auth account records.
- raw audit JSON.
- artifact storage keys.
- Google/R2 credentials.

## N. Tests

Added focused tests:

- `src/features/admin/users/policy.test.ts`
- `src/features/admin/users/validators.test.ts`
- `src/features/admin/users/read-model.test.ts`

Coverage:

- Sale/Accountant denied user management.
- Admin allowed through `USERS_MANAGE`.
- account-status derivation.
- production hard-delete prohibition.
- self-demotion/deactivation/soft-delete/password-reset denial.
- last active Admin protection.
- inactive role preparation and reactivation.
- deleted-user mutation denial.
- session revocation matrix.
- reason normalization and mandatory reason rules.
- UUID, role, email, temporary password, list query, and pagination validators.
- safe DTO allowlist.
- protected Admin list-read behavior.

## O. Validation

- Focused Phase 9A tests: PASS, 3 files / 20 tests.
- `npm test`: PASS, 31 files / 190 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm run test:integration`: SKIPPED; no current authorization for configured `DATABASE_URL` as test/staging.
- `npm run test:all`: SKIPPED; no current authorization for configured `DATABASE_URL` as test/staging.

## P. Migration Status

- New migration created by Phase 9A: no.
- `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- `drizzle/0004_clean_power_man.sql` applied in this conversation: no.
- No Better Auth Admin plugin fields were added.

## Q. Files Changed

Phase 9A files added/changed:

- `src/features/admin/users/types.ts`
- `src/features/admin/users/policy.ts`
- `src/features/admin/users/validators.ts`
- `src/features/admin/users/read-model.ts`
- `src/features/admin/users/policy.test.ts`
- `src/features/admin/users/validators.test.ts`
- `src/features/admin/users/read-model.test.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_9A_ADMIN_USER_MANAGEMENT_FOUNDATION_2026-08-23.md`

Pre-existing dirty/untracked Phase 8A/8B/8C files and the prior Admin User Management audit report were preserved.

## R. Remaining Admin User Management Work

Phase 9B:

- user lifecycle mutations.
- create user.
- role change.
- deactivate/reactivate.
- soft delete.
- session revocation.
- audit events.
- last-admin transaction serialization.

Phase 9C:

- temporary password administration.
- Admin Users UI.
- auth/session regression coverage.

Still out of scope:

- Better Auth Admin plugin.
- hard delete.
- email update.
- impersonation.
- individual session management.
- browser E2E.

## S. Final Verdict

READY FOR LEAD REVIEW

