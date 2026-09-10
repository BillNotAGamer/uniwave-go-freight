# Admin User Management Auth Audit - 2026-08-23

## A. Audit Metadata

- Repository: Uniwave Go Freight.
- Branch: `feature/ui-overhaul`.
- HEAD at audit start: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Audit date: 2026-08-23.
- Task type: AUDIT-ONLY.
- Source changes: none. This report is the only intended artifact.
- Working tree at start: dirty with pre-existing Phase 8A/8B/8C work; preserved.
- DB operations: not run.
- Migrations: not applied.
- Integration tests: not run; no current authorization for configured `DATABASE_URL` as test/staging.
- Better Auth installed version: `1.6.20` from `npm ls better-auth`, `package.json`, and `package-lock.json`.

Finding labels used below:

- `REPOSITORY-PROVEN`
- `TEST-VERIFIED`
- `DOCUMENTED-ONLY`
- `INFERRED`
- `DECISION REQUIRED`
- `NOT IMPLEMENTED`
- `STALE DOCUMENTATION`

## B. Executive Recommendation

Recommendation: **Option B - application-owned Admin User Management using Drizzle and the existing application RBAC/audit/session model.**

Do not enable the Better Auth Admin plugin for the MVP.

Rationale:

- `REPOSITORY-PROVEN`: the application has one business role source of truth: `users.role` as PostgreSQL enum `user_role = sale | accountant | admin` in `src/lib/db/schema.ts`.
- `REPOSITORY-PROVEN`: permissions are application-owned in `src/lib/permissions/permissions.ts`; Admin receives all declared app permissions through `hasPermission(role, permission)`.
- `REPOSITORY-PROVEN`: current sensitive app routes/actions use `getCurrentSession()` / `requireAuthenticatedUser()` and then re-query `users` fresh before applying permission checks.
- `REPOSITORY-PROVEN`: Better Auth Admin plugin is installed as package code but not configured in `src/lib/auth/server.ts`; therefore its `/api/auth/admin/*` endpoints are not currently enabled.
- `REPOSITORY-PROVEN`: Better Auth Admin plugin `1.6.20` adds its own role/access-control path, accepts role arrays that serialize to comma-separated strings, adds `banned` state fields, and exposes admin endpoints through the configured Better Auth route surface.
- `INFERRED`: enabling the plugin wholesale would create unnecessary endpoint and account-state surface area for this app, and would need extra tests to prove it cannot bypass application RBAC.

Recommended architecture:

- Build `src/features/admin/users/**` or equivalent application-owned services.
- Gate all read/actions with `PERMISSIONS.USERS_MANAGE`.
- Constrain roles to `ROLES = ["sale", "accountant", "admin"]`.
- Use `users.isActive` for reversible deactivation.
- Use `users.deletedAt` for user soft delete.
- Hard-delete users only in test cleanup/bootstrap tooling, never through production Admin UI.
- Revoke target sessions by deleting rows from `sessions` in the same application service flow.
- Write application audit logs for every user-management mutation.
- Use existing `accounts` credential storage for password administration; if a password helper is needed, use Better Auth's exported password hashing semantics or a narrowly vetted wrapper, not public signup.

## C. Current Auth Architecture

`REPOSITORY-PROVEN`

- Auth library: Better Auth `1.6.20`.
- Auth config: `src/lib/auth/server.ts`.
- Adapter: Better Auth Drizzle adapter with `authSchema`.
- Auth route: `src/app/api/auth/[...all]/route.ts` delegates `GET`, `POST`, `PATCH`, `PUT`, `DELETE` to `toNextJsHandler(auth)`.
- Login UI: `src/app/(auth)/login/page.tsx` and `src/components/auth/login-form.tsx`.
- Session helper: `src/lib/auth/session.ts`.
- Account-state predicate: `src/lib/auth/user-state.ts`.
- Public email/password signup is disabled by default. `AUTH_ALLOW_DEV_BOOTSTRAP_SIGNUP=true` only enables it outside production.
- Bootstrap scripts exist:
  - `scripts/create-first-admin.ts`
  - `scripts/create-dev-user.ts`
- No Admin User Management UI/service exists.
- No route-protection middleware backstop exists; dashboard layout protection relies on `requireAuthenticatedUser()`.

## D. Current User Schema

`REPOSITORY-PROVEN`

Table: `users`

| Field | Type / behavior |
| --- | --- |
| `id` | text primary key, random UUID default |
| `email` | text, not null, unique |
| `name` | text, not null |
| `image` | text nullable |
| `emailVerified` | boolean, not null, default false |
| `role` | `user_role` enum, not null, default `sale` |
| `isActive` | boolean, not null, default true |
| `createdAt` | timestamp(3), not null, default now |
| `updatedAt` | timestamp(3), not null, default now, `$onUpdate` |
| `deletedAt` | timestamp(3), nullable |

Role enum:

```text
sale
accountant
admin
```

No current user fields:

- `banned`
- `banReason`
- `banExpires`
- `deletedById`
- `deleteReason`
- `deactivatedById`
- `deactivationReason`
- `passwordChangedAt`

Recommendation: do not add reason columns for MVP; use `audit_logs.reason`.

## E. Current Session Schema

`REPOSITORY-PROVEN`

Table: `sessions`

| Field | Type / behavior |
| --- | --- |
| `id` | text primary key, random UUID default |
| `createdAt` | timestamp(3), not null |
| `updatedAt` | timestamp(3), not null |
| `userId` | text, not null, FK to `users.id`, `onDelete: cascade` |
| `expiresAt` | timestamp(3), not null |
| `token` | text, not null, unique |
| `ipAddress` | text nullable |
| `userAgent` | text nullable |

Indexes:

- `sessions_user_id_idx`
- `sessions_token_idx`
- unique token constraint

No fields:

- `revokedAt`
- `impersonatedBy`
- role snapshot
- account-state snapshot

Session revocation model today: delete session rows.

## F. Current RBAC Source of Truth

`REPOSITORY-PROVEN`

Application role source:

- `src/lib/permissions/roles.ts`
- `ROLES = ["sale", "accountant", "admin"]`
- one role per user

Application permission source:

- `src/lib/permissions/permissions.ts`
- `PERMISSIONS.USERS_MANAGE = "users:manage"`
- `ROLE_PERMISSIONS.admin = ALL_PERMISSIONS`
- Sale and Accountant do not have `USERS_MANAGE`.

Application enforcement:

- `requirePermission()` / `requireAnyPermission()` in `src/lib/permissions/require-permission.ts`.
- Sensitive shipping-note/export/tax services use the app permission helpers.

`TEST-VERIFIED`

- `src/lib/permissions/permissions.test.ts` proves Sale and Accountant are denied `USERS_MANAGE`, and Admin has every declared permission.

Recommendation: keep application RBAC authoritative. Do not add a second independent Better Auth access-control matrix for business operations.

## G. Better Auth Admin Plugin Compatibility

`REPOSITORY-PROVEN`

Current plugin state:

- Better Auth package includes `better-auth/dist/plugins/admin`.
- `src/lib/auth/server.ts` does not configure `plugins: [admin(...)]`.
- Admin plugin endpoints are therefore not currently enabled.

Installed Admin plugin `1.6.20` capabilities found in local package:

- `setRole`
- `getUser`
- `createUser`
- `adminUpdateUser`
- `listUsers`
- `listUserSessions`
- `banUser` / `unbanUser`
- `impersonateUser` / `stopImpersonating`
- `revokeUserSession`
- `revokeUserSessions`
- `removeUser`
- `setUserPassword`
- `userHasPermission`

Plugin schema additions:

- user `role`
- user `banned`
- user `banReason`
- user `banExpires`
- session `impersonatedBy`

Compatibility concerns:

- `P0 REPOSITORY-PROVEN`: plugin exposes `/admin/*` endpoints under the Better Auth route when enabled.
- `P0 REPOSITORY-PROVEN`: plugin authorizes through its own `hasPermission()` using Better Auth role/access-control options, not this app's `PERMISSIONS.USERS_MANAGE`.
- `P1 REPOSITORY-PROVEN`: plugin role body accepts string or array; arrays become comma-separated strings. Current DB role column is a PostgreSQL enum, not a string/multi-role field.
- `P1 REPOSITORY-PROVEN`: plugin uses `banned` fields, while the app already uses `isActive` and `deletedAt`.
- `P1 INFERRED`: enabling plugin for all admin operations would require migrations or schema overrides and a careful endpoint exposure review.

Conclusion: do not enable the Admin plugin wholesale for this milestone.

## H. Role Model Analysis

`REPOSITORY-PROVEN`

Current model: one business role per user.

Evidence:

- `userRoleEnum = pgEnum("user_role", ROLES)`.
- `users.role` uses that enum.
- `Role` TypeScript type is a union of exactly `sale | accountant | admin`.
- `ROLE_PERMISSIONS` is keyed by one `Role`.
- No user-role join table exists.
- No multi-role parser exists in the app.

Recommendation:

- Preserve single-role semantics.
- Reject role arrays.
- Reject unknown role strings.
- Do not adopt comma-separated roles.

## I. Account State Model

`REPOSITORY-PROVEN`

Current fields:

- `isActive`
- `deletedAt`

Recommended MVP account state:

| State | Representation | Login | Existing app access | Admin list behavior |
| --- | --- | --- | --- | --- |
| Active | `isActive = true`, `deletedAt = null` | allowed | allowed by role | default visible |
| Inactive | `isActive = false`, `deletedAt = null` | denied | denied by session helper | visible with inactive filter |
| Soft-deleted | `deletedAt != null` | denied | denied by session helper | hidden by default, visible with deleted filter |

Do not introduce Better Auth `banned` for MVP. It would overlap with `isActive` and create three account-state concepts: active, banned, deleted.

## J. Role-Change Session Risk

Current application behavior:

- `REPOSITORY-PROVEN`: `getCurrentSession()` calls `auth.api.getSession()` and then performs a fresh DB query for `users` by session user ID.
- `REPOSITORY-PROVEN`: it returns the fresh DB `User`, after `rejectInactiveOrSoftDeletedUsers()`.
- `REPOSITORY-PROVEN`: application permission checks consume `session.user.role` from that fresh DB user object.
- `REPOSITORY-PROVEN`: Better Auth `session.cookieCache` is not configured in `src/lib/auth/server.ts`; local Better Auth code only uses cookie session data when `options.session.cookieCache.enabled` is true.

Scenario: Accountant -> Sale while the target user has an active app session.

- `REPOSITORY-PROVEN`: subsequent app requests through `getCurrentSession()` should use the downgraded DB role.
- `INFERRED`: buying charge reads, net profit reads, tax assignment, internal exports, Drive upload, and Admin routes guarded by app permissions should be denied immediately after the role DB update.
- `P1 INFERRED`: existing React UI may still display stale controls until refresh, but server actions/routes remain authoritative.

Policy recommendation:

- Revoke all target-user sessions after any role change anyway.
- Reason: defense in depth, immediate UI refresh, and protection against future routes that might accidentally use Better Auth session user data instead of the app session helper.

## K. Deactivation / Soft-Delete Session Risk

Current application behavior:

- `REPOSITORY-PROVEN`: session creation hook rejects inactive or soft-deleted users.
- `REPOSITORY-PROVEN`: `getCurrentSession()` rejects inactive or soft-deleted users on every app session read.

Deactivation:

- Recommended mutation: set `isActive = false`, leave `deletedAt = null`, audit, revoke all target sessions.
- `REPOSITORY-PROVEN`: app requests after DB state change should fail `getCurrentSession()` even before session deletion completes.
- `P1 INFERRED`: session deletion still matters for Better Auth-owned endpoints and stale browser state.

Soft delete:

- Recommended mutation: set `deletedAt = now`, audit, revoke all target sessions.
- Preserve historical FKs and user row.
- Hide from default Admin list.

## L. Session Revocation Capabilities

`REPOSITORY-PROVEN`

Core Better Auth current-user endpoints exist:

- `/list-sessions`
- `/revoke-session`
- `/revoke-sessions`
- `/revoke-other-sessions`

Better Auth Admin plugin endpoints exist if plugin is enabled:

- `/admin/list-user-sessions`
- `/admin/revoke-user-session`
- `/admin/revoke-user-sessions`

Repository-owned option:

- Directly delete from `sessions` where `userId = targetUserId`.
- Directly delete one `sessions.token` after verifying it belongs to the target user.

Recommendation:

- MVP: implement "Revoke all sessions" by application-owned deletion of `sessions` rows inside/after the user-management service flow.
- Defer per-session listing/revoke UI. The table has IP/user-agent/timestamps, but device/session UX is not required for the first secure milestone.

## M. User Creation / Password Administration

Current creation:

- `REPOSITORY-PROVEN`: dev/bootstrap scripts use `auth.api.signUpEmail()` only after setting `AUTH_ALLOW_DEV_BOOTSTRAP_SIGNUP = "true"` in non-production.
- `REPOSITORY-PROVEN`: public signup is disabled by default in production.
- `REPOSITORY-PROVEN`: `accounts.password` stores credential password hash for Better Auth.

Recommended Admin create-user MVP:

- Admin supplies name, email, single role, and temporary password.
- Normalize email to lowercase.
- Require password length >= current Better Auth minimum, currently 8.
- Create `users` and `accounts` credential record in one transaction where practical.
- Mark `isActive = true`, `deletedAt = null`.
- Write `user.create` audit event.
- Do not log password.
- Do not email credentials until an email/invitation subsystem exists.

Password administration:

- MVP: Admin may set a temporary password for a user.
- Require `USERS_MANAGE`.
- Require confirmation.
- Audit `user.password_set_by_admin` with actor and target, but never include password or hash.
- Revoke all target sessions after password change.
- Do not implement forgot-password email unless email delivery is explicitly added.
- Self-service password change can remain a later Better Auth user-account feature.

Implementation note:

- Avoid using public signup for Admin create-user.
- If using Better Auth password hashing directly, wrap it in a small server-only credential helper and add tests against sign-in behavior.
- If choosing Better Auth Admin plugin solely for password APIs later, it must be separately gated and audited; do not expose plugin client flows casually.

## N. Self-Management Policy

Recommendation:

| Action | Self allowed? | Reason |
| --- | --- | --- |
| Change own display name | Yes, if implemented | Low risk |
| Change own password | Yes, through normal account flow | Expected user capability |
| Reset own password via Admin UI | No for MVP | Avoid confused audit semantics |
| Demote self from Admin | No in Admin UI | Prevent lockout/confusing session state |
| Deactivate self | No | Prevent self-lockout |
| Soft-delete self | No | Prevent self-lockout and audit ambiguity |
| Revoke own current session | Use sign out | Existing flow |
| Revoke all own sessions | Optional later account-security feature | Not needed for Admin management MVP |

## O. Last-Admin Invariant

`P0 INFERRED`

The app must preserve at least one active, non-deleted Admin.

Forbidden when target is the last active Admin:

- demote Admin to non-admin
- deactivate Admin
- soft-delete Admin

Concurrency strategy:

- Use one transaction for target load, invariant check, mutation, and audit.
- Use a PostgreSQL advisory transaction lock for the user-admin-management invariant, or another repository-approved serialization mechanism.
- Re-count active non-deleted admins inside the transaction after acquiring the lock.
- Use guarded updates on target row state to prevent stale writes.

Simple pre-check counts are insufficient because two Admins could concurrently remove the last two Admin accounts.

## P. Historical Actor Integrity

`REPOSITORY-PROVEN`

User FKs:

- `sessions.userId -> users.id onDelete cascade`
- `accounts.userId -> users.id onDelete cascade`
- `shipping_notes.createdById -> users.id onDelete set null`
- `shipping_notes.checkedById -> users.id onDelete set null`
- `shipping_notes.approvedById -> users.id onDelete set null`
- `shipping_notes.lockedById -> users.id onDelete set null`
- `shipping_notes.cancelledById -> users.id onDelete set null`
- `shipping_note_charges.createdById -> users.id onDelete set null`
- `shipping_note_exports.generatedById -> users.id onDelete set null`
- `audit_logs.actorUserId -> users.id onDelete set null`
- `tax_rules.createdById -> users.id onDelete set null`

Hard delete consequence:

- Sessions/accounts are deleted.
- Historical actor FKs become null in business/audit tables.
- Attribution is weakened.

Recommendation:

- Production Admin UI must not hard-delete users.
- Use deactivation and soft delete.
- If user display data is needed after soft delete, keep the user row and display a safe historical identity.

## Q. Admin UI / Read Model

Recommended route:

```text
/admin/users
```

Server-side protections:

- Dashboard layout requires authenticated active user.
- Admin users page must additionally require `USERS_MANAGE`.
- Mutations/server actions must independently require `USERS_MANAGE`.

Recommended list DTO:

- `id`
- `name`
- `email`
- `role`
- `isActive`
- `deletedAt`
- `createdAt`
- `updatedAt`
- active session count if cheaply queryable

Never expose:

- password hash
- session token
- access/refresh/id tokens
- raw auth metadata
- audit payloads outside an explicit future audit viewer

MVP list:

- active users by default.
- search by name/email.
- role filter.
- status filter: active/inactive/deleted/all.
- pagination using limit/offset even if user count is small.

MVP detail shape:

- Table with an action panel or modal is sufficient.
- Separate detail page is not required unless session listing is added later.

Session UI recommendation:

- MVP: "Revoke all sessions" action only.
- Defer list/revoke individual sessions.

Impersonation:

- Out of scope and disabled.
- Do not enable Better Auth impersonation for MVP.

## R. Audit Requirements

Existing convention:

- Entity-specific dot actions such as `shipping_note.approve`, `tax_rule.create`, `shipping_note.export.drive.uploaded`.
- Audit schema supports actor, action, entity type, entity ID, before, after, reason, created timestamp.

Recommended user audit actions:

| Action | Entity | Reason |
| --- | --- | --- |
| `user.create` | `user` | optional |
| `user.role_change` | `user` | optional for MVP, recommended |
| `user.deactivate` | `user` | mandatory |
| `user.reactivate` | `user` | optional |
| `user.soft_delete` | `user` | mandatory |
| `user.password_set_by_admin` | `user` | mandatory or strongly recommended |
| `user.sessions_revoked` | `user` | optional when automatic, mandatory when manual |

Audit payload rules:

- Include target user ID, before role/state, after role/state.
- Include actor Admin ID.
- Include reason where required.
- Never include password, password hash, session token, OAuth token, R2 key, or Google credential data.

## S. Transaction / Failure Semantics

Recommended transaction boundaries:

- User role/state mutation and audit write should be atomic in one DB transaction.
- Last-admin invariant must be checked in that same transaction after acquiring the invariant lock.
- Session revocation can be in the same DB transaction if implemented as direct `delete from sessions where user_id = ?`.
- Password hash calculation should occur before opening the transaction when possible; credential row update and audit should be transactional.

Failure policy:

- If audit write fails, the user mutation must not commit.
- If session revocation fails in the same transaction, the user mutation must not commit.
- If implementation later uses an external Better Auth API outside the transaction and revocation fails after role/state commit:
  - the app is still safe for app routes because `getCurrentSession()` reads fresh DB role/state.
  - record the failure for operational visibility.
  - return a partial-failure error to Admin.

Preferred ordering for role/state:

1. Authenticate actor through app session helper.
2. Require `USERS_MANAGE`.
3. Validate input.
4. Start transaction.
5. Acquire user-management invariant lock where needed.
6. Load target row for update or use guarded update pattern.
7. Enforce self/last-admin rules.
8. Update user state.
9. Delete target sessions where required.
10. Write audit event.
11. Commit.

## T. Test Strategy

Pure/unit tests:

- role input accepts only `sale`, `accountant`, `admin`.
- no multi-role arrays/CSV roles.
- Sale/Accountant denied user management.
- Admin allowed through `USERS_MANAGE`.
- self-demotion/deactivation/delete denied.
- last-admin policy matrix.
- account state transitions.
- reason policy.
- safe Admin user DTO excludes secrets/tokens.
- session invalidation decision matrix.

DB integration tests:

- Admin creates Sale/Accountant/Admin.
- duplicate email maps to safe error.
- role change persists and audits.
- role change revokes sessions.
- role downgrade blocks existing session from accountant/admin-only endpoints.
- deactivation blocks login and existing app access.
- soft delete blocks login and existing app access.
- hard delete not exposed in production service.
- last Admin cannot be demoted/deactivated/deleted.
- concurrent last-admin race is protected.
- password set updates credential hash without logging secrets.
- historical Shipping Note/export/audit actor relations survive soft delete.

HTTP/session E2E tests:

- Accountant logged in -> Admin changes role to Sale -> old session attempts accounting endpoint -> denied.
- Admin B logged in -> Admin A demotes B -> B attempts Admin endpoint -> denied.
- User logged in -> Admin deactivates -> old session attempts dashboard/API -> denied.
- Reactivated user must authenticate again after session revocation.

Do not run DB integration without current explicit test/staging DB authorization.

## U. Migration Assessment

Recommended MVP architecture migration: **No**, if scoped to:

- role changes using existing `users.role`.
- activation/deactivation using existing `users.isActive`.
- soft delete using existing `users.deletedAt`.
- session revocation by deleting existing `sessions` rows.
- password set using existing `accounts.password`.
- reasons stored in existing `audit_logs.reason`.

Better Auth Admin plugin migration impact:

- Would require or expect user fields `banned`, `banReason`, `banExpires`.
- Would require or expect session field `impersonatedBy`.
- Current schema does not have those fields.
- Plugin's `role` field overlaps existing `users.role`.

Current unapplied migration files:

- `drizzle/0003_hard_titania.sql`: present in working tree; not applied in this audit.
- `drizzle/0004_clean_power_man.sql`: present in working tree; not applied in this audit.

## V. Decision Register

| Decision | Options | Repository Evidence | Recommendation | Migration? |
| --- | --- | --- | --- | --- |
| Admin plugin | Enable all, do not use, hybrid | Plugin not configured; exposes its own endpoints/access control | Do not enable for MVP | No for recommended path |
| Role source | Better Auth role, app role, duplicate | `users.role` enum and app permission map | App `users.role` only | No |
| Multi-role | allow arrays/CSV, single role | enum + `Role` union | Single role only | No |
| Account enabled model | `isActive`, Better Auth banned, both | `isActive` already enforced by app session helper | Use `isActive` | No |
| User soft delete | none, `deletedAt`, hard delete | `users.deletedAt` exists and is enforced | Use `deletedAt` | No |
| Hard delete | allow, admin-only, forbid | FKs set null; history attribution weakens | Forbid in production UI | No |
| Create user | plugin create, public signup, app service | public signup disabled; accounts table exists | App service with credential helper | No expected |
| Password admin | none, set temp password, email reset | no mail/reset flow; accounts password exists | Admin set temp password, audited, revoke sessions | No expected |
| Role change | direct DB update, app service | app RBAC source is DB role | App service, CAS/transaction/audit | No |
| Session revocation | none, plugin API, direct delete | sessions table exists; app fresh DB role reduces risk | Revoke all by direct session delete | No |
| Self-demotion | allow, block | lockout risk | Block | No |
| Self-deactivation | allow, block | lockout risk | Block | No |
| Last-admin protection | none, precheck, serialized invariant | bootstrap protects first-admin; runtime absent | Serialized invariant in transaction | No |
| Session UI | none, revoke all, list/revoke one | sessions table has metadata | Revoke all only for MVP | No |
| Impersonation | enable, disabled | plugin supports; app has no need | Disabled/out of scope | No |
| Email update | allow MVP, defer | email unique/login identifier | Defer unless product requires | No |
| Audit reasons | no reasons, columns, audit reason | `audit_logs.reason` exists | Use audit reason | No |
| Route/UI shape | `/admin/users`, modal only, plugin UI | app dashboard shell exists | `/admin/users` protected page + action panel | No |

## W. Risks

| Severity | Risk | Classification | Mitigation |
| --- | --- | --- | --- |
| P0 | Better Auth Admin endpoints bypass app `USERS_MANAGE` if plugin enabled incorrectly | REPOSITORY-PROVEN / INFERRED | Do not enable plugin for MVP; if ever enabled, configure/test exact endpoint access |
| P0 | Last active Admin can be demoted/deactivated/deleted | NOT IMPLEMENTED | Add serialized last-admin invariant |
| P0 | Hard delete nulls historical actor attribution | REPOSITORY-PROVEN | Forbid production hard delete; use soft delete |
| P1 | Role downgrade leaves stale UI/session until refresh | INFERRED | Revoke all sessions after role change |
| P1 | Deactivated user keeps Better Auth session row | REPOSITORY-PROVEN / INFERRED | Revoke sessions on deactivation/soft delete |
| P1 | Plugin multi-role/CSV roles conflict with enum role | REPOSITORY-PROVEN | Reject multi-role; avoid plugin set-role |
| P1 | Password or session token leakage in audit/UI | INFERRED | DTO allowlist; never audit secrets/tokens |
| P1 | Concurrent Admin changes race the last-admin count | INFERRED | Advisory lock or equivalent transaction serialization |
| P2 | No route-protection middleware backstop | DOCUMENTED-ONLY / REPOSITORY-PROVEN | Add later middleware or keep per-route server guards strict |
| P2 | No live HTTP/session regression suite | DOCUMENTED-ONLY | Add E2E/session tests after service implementation |

## X. Recommended Implementation Scope

Slice 1 - Policy, DTO, and repository foundation:

- User management validators.
- Role/state policy helpers.
- Safe Admin user DTO/read model.
- `USERS_MANAGE` checks.
- Last-admin invariant helper.
- Unit tests.

Slice 2 - Mutations and audit:

- Create user.
- Change role.
- Deactivate/reactivate.
- Soft delete.
- Revoke all target sessions.
- Audit events and reason policy.
- DB integration tests.

Slice 3 - Password administration:

- Set temporary password.
- Credential hash/update helper.
- Revoke sessions.
- Audit without secrets.
- Sign-in/session regression tests.

Slice 4 - Minimal UI:

- `/admin/users` page.
- Table + action panel/modal.
- No impersonation.
- No individual session list in MVP.

Slice 5 - HTTP/session hardening:

- Tests proving old sessions are denied after role change/deactivation/soft delete.
- Optional route middleware backstop.

## Y. Remaining Inputs / Open Decisions

`DECISION REQUIRED`

- Whether Admin-created users should receive a manually communicated temporary password or wait for an email invitation/reset subsystem.
- Whether role-change reason is mandatory or optional. Recommendation: optional for MVP, mandatory can be added if operations require it.
- Whether Admin may edit user email in MVP. Recommendation: defer.
- Whether soft-deleted users can be restored. Recommendation: defer restore; allow reactivation only for inactive, non-deleted users.
- Whether self-service password change should be exposed in the same milestone. Recommendation: separate from Admin management.

## Z. Recommended Immediate Next Task

Implement Slice 1:

- `src/features/admin/users/policy.ts`
- `src/features/admin/users/validators.ts`
- `src/features/admin/users/read-model.ts`
- focused unit tests for role constraints, account-state policy, self-action policy, last-admin decision matrix, safe DTO, and session-revocation decision matrix.

Do not enable the Better Auth Admin plugin in Slice 1.

