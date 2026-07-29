# Full Repository Audit — Reality vs Plan
Date: 2026-07-24
Branch: `feature/ui-overhaul`
Scope: Full read-only audit. No writes made outside this report file. No `npm install`, no migrations, no DB connection/mutation performed by the auditor.

Health checks executed (read-only, no DB required at build time — all routes are dynamic `ƒ`):
- `npm run typecheck` → **PASS**, zero errors.
- `npm run lint` → **PASS**, zero errors/warnings.
- `npm run build` → **PASS**, compiled successfully, all 9 routes resolved (`/`, `/_not-found`, `/api/auth/[...all]`, `/api/shipping-notes/[id]/exports/internal-xlsx`, `/dashboard`, `/login`, `/shipping-notes`, `/shipping-notes/[id]`, `/shipping-notes/[id]/print/internal`, `/shipping-notes/new`).

No secrets, tokens, or connection strings were printed at any point during this audit. Where environment variable names are cited, only the variable name is given, never a value.

---

## 1. Repository Inventory

**Stack** (`package.json`): Next.js `16.2.9` (App Router, Turbopack), React `19.2.4`, TypeScript `^5` (strict mode, `tsconfig.json:` `"strict": true`), Tailwind v4 (`@tailwindcss/postcss`), Drizzle ORM `^0.45.2` against `@neondatabase/serverless ^1.1.0`, Better Auth `^1.6.20`, ExcelJS `^4.4.0`, Zod `^4.4.3`, `@radix-ui/react-dialog ^1.1.19`, `lucide-react`, `clsx`/`tailwind-merge`.

**Scripts**: `dev`, `build`, `start`, `lint` (`eslint`), `typecheck` (`tsc --noEmit`), `admin:create-first`, `dev:user:create`, `db:generate`/`db:migrate`/`db:studio` (drizzle-kit).

**Finding I-1 (LOW)** — No `"engines"` field in `package.json`. `scripts/create-first-admin.ts:26-28` and `scripts/create-dev-user.ts` depend on `process.loadEnvFile`, a Node ≥20.6 API, and throw a clear runtime error if unavailable — but nothing prevents `npm install`/CI from running on an older Node version until that script is actually invoked.

**Finding I-2 (INFO, not a defect)** — `docs/UI_RULES.md`'s preferred stack lists React Hook Form, TanStack Table, date-fns, and Sonner. None of these are dependencies. Forms use plain `<form action={serverAction}>` + `useActionState`; tables are plain HTML `<table>`. This is consistent with AGENTS.md's "minimal dependencies" rule and is not a defect, but it is a documented-vs-actual mismatch (see §11).

**Environment variables** — `.env.example` declares: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `BOOTSTRAP_ADMIN_EMAIL/NAME/PASSWORD`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `GOOGLE_DRIVE_FOLDER_ID`.

A full `process.env.*` sweep of `src/` found only:
- `src/lib/env.ts:22-24` — `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (Zod-validated, `server-only`).
- `src/lib/auth/server.ts:12-13` — `NODE_ENV`, `AUTH_ALLOW_DEV_BOOTSTRAP_SIGNUP`.
- `src/lib/auth/client.ts:8` — `NEXT_PUBLIC_AUTH_URL` (client-side base URL fallback).

**Finding I-3 (LOW / doc drift)** — `NEXT_PUBLIC_AUTH_URL` is read by client code but is **absent from `.env.example`**. Also, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_DRIVE_FOLDER_ID` are declared in `.env.example` but a repo-wide grep for `google.?drive|googleapis` (case-insensitive) across `src/` returned **zero matches** — no Google Drive integration code exists anywhere. These four variables are currently dead placeholders for an unbuilt Phase 8 feature.

**Directory structure** matches AGENTS.md's prescribed layout: `src/app/`, `src/features/shipping-notes/`, `src/lib/{auth,db,permissions,calculations,env.ts}`, `src/components/{shell,ui,auth}`, `drizzle/`, `scripts/`, `docs/`. No stray/undocumented top-level source directories found.

**Tests**: `find . -iname "*.test.*"` (excluding `node_modules`/`.next`) returned **zero results**. No `tests/`, `__tests__/`, or `*.test.ts` files exist anywhere in the repository.

**PDF export**: grep for `pdf|jspdf|puppeteer` across `src/` and `package.json` returned exactly one hit — `src/lib/db/schema.ts:67`, the `export_type` Postgres enum value `"pdf"`. No PDF-generation code, library, or route exists.

---

## 2. Database Schema vs `DATA_MODEL_RULES.md`

Schema: `src/lib/db/schema.ts` (365 lines). Migrations: `drizzle/0000_new_nick_fury.sql` (initial), `drizzle/0001_dazzling_saracen.sql` (adds Better Auth `accounts`/`sessions`/`verifications` tables + `users.image`/`users.email_verified`). `drizzle/meta/_journal.json` records exactly these 2 migrations — no destructive `DROP COLUMN`/`DROP TABLE` migrations exist in history.

| Recommended entity (DATA_MODEL_RULES.md) | Status | Evidence |
|---|---|---|
| `users` | PRESENT | `schema.ts` — role enum `sale`/`accountant`/`admin`, `isActive`, `deletedAt` |
| `shipping_notes` | PRESENT | `schema.ts` — includes status enum, party/route/volume fields |
| `shipping_note_parties` (separate table) | **MISSING** | Parties are stored as **text-only columns** on `shipping_notes` (`shipperText`, `consigneeText`, `customerText`, `agentText`) — no FK to a reusable parties/entities table |
| `shipping_note_charges` | PRESENT (split selling/buying via `section` enum) | `schema.ts` — `quantity numeric(18,3)`, `unitPrice numeric(18,4)`, `amountOriginal numeric(20,4)`, `amountVnd numeric(20,2)`, `vatPercent numeric(6,2)` default `"0"`, `vatAmount numeric(20,2)` default `"0"`, `isOverride`, `overrideReason` |
| `shipping_note_exports` | PRESENT | `status` (pending/generated/uploaded/failed), `driveFileId`/`driveUrl` columns present but unused (no Drive code), `checksum`, **no `deletedAt`** (append/immutable by design — reasonable) |
| `audit_logs` | PRESENT | `before`/`after` jsonb, append-only (no `updatedAt`/`deletedAt` — correct for an audit trail) |
| `tax_rules` | PRESENT (schema only) | `vatPercent`, `effectiveFrom`/`effectiveTo`, `isActive` — **no code anywhere reads or writes this table** (see Finding C-1) |
| `accounting_periods` | **MISSING** | No table, no migration, no references anywhere in `src/` |

**Finding D-1 (HIGH)** — DATA_MODEL_RULES.md recommends `checked_at` and `approved_at` timestamp fields on `shipping_notes`. Schema has `checkedById` (`schema.ts:197`) and `approvedById` (`schema.ts:200`) FK columns but **no corresponding `checkedAt`/`approvedAt` timestamp columns**. `lockedAt` (`schema.ts:203`) does exist but is unused (no code ever sets it — see §7).

**Finding D-2 (MEDIUM)** — "Once a shipping note's accounting period is locked, do not allow normal edits" (DATA_MODEL_RULES.md) cannot currently be true or false in a testable sense: no `accounting_periods` table exists, `lockedAt` is never set by any mutation, and the `locked` status value in the enum is never reached by any code path (§7, §8). This rule is effectively **UNVERIFIED — requires manual QA** for now, but structurally the enforcement point doesn't exist yet.

**Finding D-3 (LOW)** — Soft-delete default: confirmed present (`deletedAt` column + default-active queries) on `users`, `shipping_notes`, and both charge tables. Correctly absent on `audit_logs` (append-only) and `shipping_note_exports` (LOW note: DATA_MODEL_RULES doesn't explicitly exempt exports, but immutability is a reasonable engineering choice worth confirming with the user is intentional).

Indexes present and reasonable: `shipping_notes_status_idx`, `shipping_notes_created_by_id_idx`, `shipping_note_charges_shipping_note_id_idx`, `shipping_note_exports_shipping_note_id_idx`, `audit_logs_entity_lookup_idx`, `tax_rules_lookup_idx`, plus Better Auth's own session/account/verification indexes.

---

## 3. Auth & Session

- `src/lib/auth/server.ts` — Better Auth config: `emailAndPassword: { enabled: true, disableSignUp: !allowDevBootstrapSignUp, minPasswordLength: 8 }`, where `allowDevBootstrapSignUp = process.env.NODE_ENV !== "production" && process.env.AUTH_ALLOW_DEV_BOOTSTRAP_SIGNUP === "true"` (`server.ts:12-13`). **Public self-registration is disabled by default in production** — confirmed, matches `docs/LOCAL_AUTH_BOOTSTRAP.md` and `docs/SHIPPING_NOTE_QA.md` claims.
- `databaseHooks.session.create.before` re-checks `user.isActive`/`user.deletedAt` directly against the DB and throws `APIError("UNAUTHORIZED", ...)` if the user is inactive or soft-deleted — enforced at session-creation time, not merely at login.
- `src/lib/auth/session.ts` — `getCurrentSession()` calls `auth.api.getSession()` then **re-queries `users` fresh** for `isActive`/`deletedAt` (defends against stale session data for a user deactivated mid-session). `requireAuthenticatedUser()` redirects to `/login` if no session. This is the **single canonical session helper** — no duplicated ad-hoc session-checking logic was found anywhere else in the codebase.
- `src/app/api/auth/[...all]/route.ts` — 5-line standard Better Auth `toNextJsHandler(auth)` boilerplate. No custom logic, no additional risk.
- **No `middleware.ts` exists anywhere in the repo** (`find src -iname "middleware*"` → empty). Route protection is enforced entirely via `requireAuthenticatedUser()` calls: once in `src/app/(dashboard)/layout.tsx:9` (covers `/dashboard`, `/shipping-notes`, `/shipping-notes/new`, `/shipping-notes/[id]`), and again independently in `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`.

**Finding A-1 (MEDIUM)** — Session/auth enforcement is **layout-scoped, not middleware-scoped**. Today, exactly one `(dashboard)` layout gates all dashboard routes and the print route independently re-checks, so current coverage is complete. But this architecture means any *future* page added outside the `(dashboard)` route group (or a new top-level route group) is **unprotected by default** unless a developer remembers to call `requireAuthenticatedUser()` explicitly — there is no repo-wide backstop. Recommend either a `middleware.ts` matcher-based gate or a lint rule/convention check as the route surface grows.

### Bootstrap scripts (verified against `LOCAL_AUTH_BOOTSTRAP.md`/`SHIPPING_NOTE_QA.md` claims)

- `scripts/create-first-admin.ts:87-89` — `if (process.env.NODE_ENV === "production") exitWithError(...)`. **Confirmed**: production guard is real, not just documented.
  - Refuses a second admin (`assertSingleUsableAdmin`, lines 55-82) unless the existing single admin matches the target email/active/non-deleted state.
  - Verifies the email is lowercased, the admin is active and non-deleted, and performs a real sign-in smoke test after creation (lines 149-189) before declaring success.
- `scripts/create-dev-user.ts:61-63` — same `NODE_ENV === "production"` guard, restricted to `DEV_ROLES = ["sale", "accountant"]` (line 7) — **cannot create an admin**, matching the QA doc's claim. Refuses to silently overwrite a user whose existing role differs from the requested role (lines 87-91).

Both scripts require `.env.local` to exist (`loadLocalEnvFile`) and validate their inputs with Zod before doing anything. No gaps found versus documentation for these two scripts.

---

## 4. RBAC Entry-Point Table

Permission model: `src/lib/permissions/roles.ts` (3 roles: `sale`, `accountant`, `admin`) and `src/lib/permissions/permissions.ts` (13 `PERMISSIONS` keys, `ROLE_PERMISSIONS` map, `hasPermission()`). Enforcement helpers: `src/lib/permissions/require-permission.ts` — `requireAnyPermission` (OR), `requireAllPermissions` (AND), `requirePermission` (alias for `requireAnyPermission`), all throwing `AuthorizationError` (`status = 403`) on failure.

**Critical architecture note**: authorization is enforced in `src/features/shipping-notes/mutations.ts` and `queries.ts`, **not** in `actions.ts`. The `"use server"` wrappers in `actions.ts` only parse `FormData` with Zod and delegate; every mutation/query function independently re-checks permission, so even if a UI gate were bypassed, the underlying data-layer call still enforces the same rule (defense in depth, not "hide it in the UI").

| Entry point | File:Line | Required permission / ownership check | Notes |
|---|---|---|---|
| `createShippingNoteDraft` | `mutations.ts:113` | `SHIPPING_NOTES_CREATE_OWN` | Uniqueness check on `jobsheetNo`, audit `shipping_note.create_draft` |
| `updateShippingNoteDraft` | `mutations.ts:169` | `SHIPPING_NOTES_EDIT_OWN` + `ensureDraftAccess` (`mutations.ts:82`, sale-ownership check at line 91) | `WHERE status='draft'` compare-and-set (race-safe); audit `shipping_note.update_draft` |
| `submitShippingNote` | `mutations.ts:230` | `SHIPPING_NOTES_EDIT_OWN` + `ensureDraftAccess` | Sets `status: "submitted"` (line 243); audit `shipping_note.submit` |
| `startAccountingReview` | `mutations.ts:273` | `SHIPPING_NOTES_ACCOUNTING_REVIEW` + `ensureAccountingTransitionAccess` (`mutations.ts:98`) | Sets `status: "accounting_reviewing"` (line 289) |
| `markShippingNoteChecked` | `mutations.ts:323` | `SHIPPING_NOTES_MARK_CHECKED` + `ensureAccountingTransitionAccess` | Sets `status: "checked"` (line 339), `checkedById = user.id` |
| `createSellingChargeForNote` | `mutations.ts:449` | `SHIPPING_NOTES_EDIT_OWN` + `ensureDraftAccess` | VAT hardcoded `"0"` (lines 483-484) |
| `updateSellingCharge` | `mutations.ts:515` | same | VAT hardcoded `"0"` (lines 717-718 *[shared helper region]*) |
| `softDeleteSellingCharge` | `mutations.ts:612` | same | |
| `createBuyingChargeForNote` | `mutations.ts:683` | `BUYING_CHARGES_MANAGE` + role/ownership + `BUYING_CHARGE_MUTABLE_STATUSES` (`mutations.ts:403`, ownership check line 428, status check line 442) | VAT hardcoded `"0"` (lines 812-813) |
| `updateBuyingCharge` | `mutations.ts:749` | same | |
| `softDeleteBuyingCharge` | `mutations.ts:850` | same | |
| `listShippingNotesForUser` / `getShippingNoteForUser` | `queries.ts` | DB-level `WHERE createdById = user.id` scoping for `sale`; accountant/admin see all non-deleted | Ownership enforced in the SQL, not just the UI |
| `listSellingChargesForNoteForUser` | `queries.ts` | Delegates to `getShippingNoteForUser` first; returns `[]` (not an error) if inaccessible | |
| `listBuyingChargesForNoteForUser` | `queries.ts:204` | `requireAnyPermission(user.role, BUYING_CHARGES_READ)` | |
| `getFinancialSummaryForNoteForUser` | `queries.ts:229` | `requireAnyPermission(user.role, FINANCIAL_SUMMARY_READ)`; restricted to statuses `submitted/accounting_reviewing/checked/approved/exported/locked` | Excludes `draft`/`cancelled` |
| Internal XLSX export query | `export/queries.ts:28` | `requirePermission(user.role, SHIPPING_NOTES_EXPORT_INTERNAL)` | Also requires `note.status === "checked"` |
| `POST /api/shipping-notes/[id]/exports/internal-xlsx` | `route.ts` | Origin/Sec-Fetch-Site CSRF-style check **before** session lookup, then `getCurrentSession()` (401), then the permission-gated query above | Errors never leak raw messages/stack traces to the client |
| `(dashboard)` layout | `layout.tsx:9` | `requireAuthenticatedUser()` | Sole route-group gate (no middleware — see Finding A-1) |
| `/shipping-notes/new` page | `new/page.tsx:13-17` | `requireAuthenticatedUser()` + `hasPermission(SHIPPING_NOTES_CREATE_OWN)` → redirect if denied | |
| Print route `/shipping-notes/[id]/print/internal` | `page.tsx` | `requireAuthenticatedUser()` then permission-gated data call; `AuthorizationError`/status-mismatch both map to a uniform `notFound()` | Avoids leaking existence vs. permission distinction |

**No route or UI exists anywhere for**: audit-log viewing, user management/administration, or tax-rule management, despite `AUDIT_LOGS_READ`, `USERS_MANAGE`, and `TAX_RULES_READ`/`TAX_RULES_MANAGE` all being defined permissions with role assignments in `ROLE_PERMISSIONS`. These permissions are dead code from a routing/UI perspective today (backing DB writes for audit logs happen; there is simply no reader UI).

---

## 5. Calculation Engine

`src/lib/calculations/decimal.ts` (201 lines) — BigInt-based fixed-point decimal library. No floating-point arithmetic anywhere in the money path. Key functions: `validateDecimalString`, `parseDecimalToScaledInteger`, `formatScaledInteger`, `roundScaledIntegerHalfUp` (true symmetric half-up rounding), `multiplyDecimalStrings`, `addDecimalStrings`, `subtractDecimalStrings`.

`src/lib/calculations/money.ts` (186 lines) — `calculateChargeAmounts({quantity, unitPrice, currency, exchangeRate})`: normalizes `quantity` (scale 3, positive), `unitPrice` (scale 4, non-negative), `exchangeRate` (scale 6; **VND is always forced to `"1"` regardless of input**; USD requires a positive value or throws). Computes `amountOriginal` (scale 4) and `amountVnd` (scale 2, multiplied by exchange rate only for USD). This function is called server-side inside `mutations.ts` for every charge create/update — client-submitted amounts are never trusted; the server always recomputes.

`src/lib/calculations/shipping-note.ts` (100 lines) — `summarizeSellingCharges()`/`summarizeFinancialCharges()`: pure bucketing/aggregation functions, no calculation logic duplicated, correctly built on top of `decimal.ts` primitives.

**Finding C-1 (CRITICAL)** — VAT/tax is **hardcoded to `"0"`** at three call sites: `mutations.ts:483-484`, `717-718`, `812-813` (`vatPercent: "0"`, `vatAmount: "0"`). The `taxRules` table and `TAX_RULES_READ`/`TAX_RULES_MANAGE` permissions exist in schema/RBAC but **no code path anywhere reads `taxRules` or computes a non-zero VAT amount**. This directly contradicts BUILD_PHASES.md Phase 6's objective to "configure/override VAT/tax rules" — that objective has not been started at the calculation-engine level, only scaffolded in the schema and permission matrix.

`src/features/shipping-notes/export/generator.ts` cross-validates that summed charge amounts match the summary totals before writing the XLSX (`assertCapacity`/summary-vs-charges comparison around lines 169-192), throwing `ExportError(INVALID_DATA)` on mismatch — a reasonable tamper-evidence check on top of the decimal engine.

---

## 6. Phase-by-Phase Completeness (BUILD_PHASES.md 0–9)

| Phase | Objective (paraphrased) | Status | Evidence |
|---|---|---|---|
| 0 | Project scaffolding, tooling | **DONE** | Next.js/TS/Tailwind/ESLint all configured and passing clean |
| 1 | DB schema + migrations foundation | **DONE** | `schema.ts`, 2 clean migrations, no destructive changes |
| 2 | Auth (Better Auth, roles, session) | **DONE** | §3 — production guard, session re-validation, no public sign-up |
| 3 | Minimal user management (admin) | **NOT STARTED (UI)** | `USERS_MANAGE` permission exists; no route/page anywhere manages users. Only CLI bootstrap scripts create users |
| 4 | Shipping note CRUD (draft→submit) | **DONE** | `createShippingNoteDraft`/`updateShippingNoteDraft`/`submitShippingNote`, ownership-scoped, audited |
| 5A/5B | Charges (selling/buying) CRUD | **DONE**, minus tax | Full CRUD, server-computed amounts, minimal-column projections; VAT hardcoded to 0 (Finding C-1) |
| 6 | Accounting review workflow + VAT/tax config | **PARTIAL** | Review-start/mark-checked transitions exist; **no `approve` transition, no tax-rule configuration UI or logic** |
| 6B | Financial/selling summaries | **DONE** | `summarizeSellingCharges`/`summarizeFinancialCharges`, `FinancialSummaryView`, role-gated |
| 7 | Export (Excel/PDF) | **PARTIAL** | Internal XLSX export fully built, hash-pinned template, CSRF-style origin check, audited. **PDF export: schema enum value only, zero implementation code** |
| 8 | Google Drive upload | **NOT STARTED** | Schema columns (`driveFileId`/`driveUrl`) exist and env vars are declared, but zero Google Drive/`googleapis` code anywhere in `src/` |
| 9 | Audit logging + regression tests | **PARTIAL** | Audit *writes* are solid and consistent across every mutation; **no audit-log viewer UI**; **zero test files** in the repo (no permission regression tests) |

**Overall assessment: the codebase has progressed unevenly.** Phase 7's internal-export security hardening (template hash pinning, CSRF-style origin checks, sanitized error responses) is more mature than Phase 6's core accounting objective (VAT/tax) and Phase 3's user management, which are largely unstarted at the UI/logic level despite schema and permission scaffolding existing for them. The project is not cleanly "at Phase N" — it's furthest along on Phases 0, 1, 2, 4, 5, 6B, and the export half of 7, while Phase 3, the tax portion of 6, the PDF portion of 7, Phase 8, and the UI portion of 9 remain effectively unstarted.

---

## 7. Status Machine

Enum (`src/features/shipping-notes/constants.ts:15-24`, mirrored in `schema.ts`): `draft → submitted → accounting_reviewing → checked → approved → exported → locked`, plus a terminal `cancelled`.

**Server-side transition code exists for only 4 of 8 states**:
- `draft → submitted`: `submitShippingNote` (`mutations.ts:230`)
- `submitted → accounting_reviewing`: `startAccountingReview` (`mutations.ts:273`)
- `accounting_reviewing → checked`: `markShippingNoteChecked` (`mutations.ts:323`)

A full `grep -n "export async function|export function"` sweep of `mutations.ts` confirms **exactly 11 exported functions total** (3 status-transition + 8 charge CRUD) — there is **no `approveShippingNote`, `exportShippingNote`, `lockShippingNote`, or `cancelShippingNote` function anywhere in the codebase**.

**Finding S-1 (HIGH)** — `checked → approved`, `approved → exported`, `exported → locked`, and any `→ cancelled` transition **do not exist in code**. A shipping note can currently never progress past `checked` through any application code path. The `approved`, `exported`, `locked`, and `cancelled` enum values, the `StatusBadge` component's styling for them (`status-badge.tsx:21-36`), and the `approvedById`/`lockedAt` schema columns are all present but structurally unreachable. This is the single largest gap between the data model / UI presentation layer and actual enforced business logic.

**Finding S-2 (MEDIUM, related to D-2)** — Because no code ever sets `lockedAt` or transitions to `locked`, the DATA_MODEL_RULES.md locking rule ("once locked, do not allow normal edits") has no enforcement point to audit. Marked **UNVERIFIED — requires manual QA** only in the sense that it cannot currently be exercised at all; there is no ambiguity about the code, only about whether this is an intentional phase gate.

---

## 8. UI Compliance vs `UI_RULES.md`

- Back-office-first, desktop-first layout confirmed: `AppShell` (`app-shell.tsx`) renders a fixed sidebar (`AppSidebar`, desktop) + `MobileNavigation` (Radix `Dialog`-based slide-over for mobile) + `AppTopbar`. Role-aware nav via `getNavLinks(role)` (`nav-links.ts`), which is UI convenience only — real enforcement is server-side (§4).
- shadcn/ui-style primitives present (`RoleBadge`, `StatusBadge`, `EmptyState`, `InlineAlert`, `LoadingSpinner`) using Tailwind + `cn()` merge utility; Radix Dialog used for the mobile nav — consistent with ADR-004.
- Preferred-stack deviations (React Hook Form, TanStack Table, date-fns, Sonner) are absent; plain HTML forms/tables and native `<input type="datetime-local">` are used instead (Finding I-2 — reasonable minimal-dependency deviation, not a defect).

**Finding U-1 (LOW / doc drift)** — `src/app/(dashboard)/shipping-notes/[id]/page.tsx` renders a note-edit UI whose copy states *"Buying charges, tax settings, audit logs [are] intentionally unavailable in this phase"*, while the **Buying Charges section is rendered immediately on the same page** for accountant/admin roles. The copy is stale relative to the actual (correctly gated) UI.

**Finding U-2 (LOW / doc drift)** — `src/components/shell/nav-links.ts` labels a nav item "Accounting" but routes it to `/dashboard` (a generic landing page), with an inline comment acknowledging this is a placeholder ("keeping simple"). There is no dedicated accounting review/filter page yet — accountants currently use the same `/shipping-notes` list as everyone else, scoped by role at the query layer, with no accounting-specific filters or summary totals on the list view itself (per-note financial summaries do exist on the detail page).

No client-side trust of financial calculations was found in any of the reviewed feature components (`selling-charge-form.tsx`, `buying-charge-form.tsx`, `*-list.tsx`, `financial-summary.tsx`, `selling-charge-summary.tsx`) — all display server-provided decimal strings; all mutations delegate to server actions.

---

## 9. Health Checks

| Check | Result |
|---|---|
| `npm run typecheck` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors/warnings |
| `npm run build` | PASS — compiled, all 9 routes resolved, no DB connection required at build time (all routes marked dynamic `ƒ`) |

No runtime DB smoke test was performed (out of scope — read-only audit, no production DB connection permitted).

---

## 10. Risk Register

| ID | Severity | Finding | Location |
|---|---|---|---|
| C-1 | **CRITICAL** | VAT/tax hardcoded to `"0"` at 3 call sites; `taxRules` table entirely unused by code | `mutations.ts:483-484,717-718,812-813` |
| S-1 | **HIGH** | No code path exists for `checked→approved→exported→locked` or any `→cancelled` transition; 4 of 8 status values are unreachable | `mutations.ts` (only 11 exported functions, none named approve/export/lock/cancel) |
| D-1 | **HIGH** | `checked_at`/`approved_at` timestamps recommended by DATA_MODEL_RULES.md are missing from schema (only `*ById` FKs exist) | `schema.ts:197,200` |
| A-1 | **MEDIUM** | No `middleware.ts`; route protection depends entirely on developers remembering to call `requireAuthenticatedUser()` per route group | repo-wide (no `middleware*` file found) |
| D-2 / S-2 | **MEDIUM** | Accounting-period locking rule has no enforcement point (`lockedAt` never set, no `accounting_periods` table) | `schema.ts:203`; no code sets it |
| — | **MEDIUM** | Zero test files anywhere in the repo; Phase 9's "permission regression tests" objective is entirely unstarted | repo-wide |
| — | **MEDIUM** | No user-management UI despite `USERS_MANAGE` permission and Phase 3 objective; no audit-log viewer UI despite `AUDIT_LOGS_READ` permission and Phase 9 objective | no matching routes exist |
| I-1 | LOW | No `"engines"` field despite a Node ≥20.6 API dependency in bootstrap scripts | `package.json` |
| I-3 | LOW | `NEXT_PUBLIC_AUTH_URL` used in code but missing from `.env.example`; 4 Google Drive env vars declared but entirely unused by code | `.env.example`, `auth/client.ts:8` |
| U-1 | LOW | Stale UI copy claims buying charges are unavailable while they render on the same page | `shipping-notes/[id]/page.tsx` |
| U-2 | LOW | "Accounting" nav item routes to generic `/dashboard`, not a dedicated accounting view | `nav-links.ts` |
| D-3 | LOW | No dedicated `shipping_note_parties` table; parties are free-text columns only (may be an intentional phase-scoping decision — confirm with user) | `schema.ts` |

---

## 11. Documentation Drift + Proposed Corrections

1. **`docs/DATA_MODEL_RULES.md`** — Add explicit note that `checked_at`/`approved_at` are not yet implemented (only actor FKs exist), and that the locking rule has no enforcement point yet pending Phase 6/7 completion.
2. **`docs/BUILD_PHASES.md`** — Phase 6 should be split or annotated to distinguish "review workflow" (done) from "VAT/tax configuration" (not started) — currently a single phase entry implies both are the same maturity.
3. **`docs/BUILD_PHASES.md`** Phase 7 — annotate that only the Excel half is implemented; PDF export is schema-only.
4. **`docs/UI_RULES.md`** — Either update the preferred-stack list to drop React Hook Form/TanStack Table/date-fns/Sonner (since the team has deliberately chosen plain HTML forms), or add a note explaining the deviation is intentional per AGENTS.md's minimal-dependency rule.
5. **In-app copy** (`shipping-notes/[id]/page.tsx`) — remove or correct the "buying charges...intentionally unavailable" string since it's rendered false by the same page.
6. **`.env.example`** — add `NEXT_PUBLIC_AUTH_URL`; consider removing or clearly marking the 4 Google Drive variables as "reserved for future Phase 8, not yet consumed by any code."

---

## 12. Next-Phase Recommendation

The most load-bearing, highest-severity gap is **C-1 (VAT hardcoded to zero)** combined with **S-1 (no transition past `checked`)** — together these mean the accounting workflow that is the stated core purpose of this app (per PROJECT_BRIEF.md) cannot currently produce a correct, approvable, lockable financial record. Recommend the next work phase focus narrowly on:
1. Implement `approveShippingNote`/`exportShippingNote`/`lockShippingNote` transitions with the same `ensureAccountingTransitionAccess` + audit pattern already established for `startAccountingReview`/`markShippingNoteChecked` — this is a small, low-risk addition since the pattern is already proven.
2. Wire `taxRules` into the charge-creation path so VAT is actually computed (or, if VAT is deliberately out of scope for now, update BUILD_PHASES.md/DATA_MODEL_RULES.md to say so explicitly rather than leaving it silently unimplemented).

Do not start Phase 8 (Google Drive) or Phase 3 (user management UI) until the status machine and VAT gaps are closed — those are lower-risk, additive features, while the status/VAT gaps affect the correctness of every financial record already in the system.
