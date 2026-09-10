# Phase 11G Security Deployment Hardening

## A. Starting State

- Phase: 11G - Security Headers, Deployment Contract & Production Runtime Hardening.
- Branch: `feature/ui-overhaul`.
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`.
- Runtime: Node `v24.19.0`, npm `10.8.1`.
- Working tree: intentionally dirty with accepted uncommitted work from Phases 8/9/10/11. The starting state included modified docs/config/source files, `.env.local` staged as an index deletion, and many accepted untracked phase reports/source files.
- Accepted baseline: Next.js `16.3.3`, React `19.2.4`, Vitest `3.2.7`, Playwright `1.62.1`, Better Auth `1.6.20`.
- Phase 11F follow-up: GitHub-hosted Actions execution was not yet verified.

## B. Deployment Runtime Assessment

| Area | Assessment |
| --- | --- |
| Required runtime | Node.js runtime. |
| Edge runtime | Not recommended for current application. |
| Evidence | Production routes use Better Auth with Drizzle/Neon PostgreSQL, `ws`, AWS S3-compatible R2 storage, Google Drive APIs, filesystem-traced XLSX/PDF assets, and server-side XLSX/PDF generation. |
| Existing provider config | No committed Vercel, Docker, Fly, Render, Netlify, or equivalent deployment target was found. |
| Recommended target | A Node 24-compatible Next.js 16 host or container runtime that supports server-side PostgreSQL/Neon connectivity, R2/S3-compatible access, Google Drive service-account calls, and document-generation workloads. |
| Deployment status | No deployment, DNS, infrastructure provisioning, or provider configuration was performed. |

The repository already declares Node runtime explicitly for export/download/Drive route handlers. Other routes rely on Next.js Node.js default behavior, which is appropriate for this server-heavy application.

## C. Existing Security Header Audit

| Header | Before Phase 11G | Assessment |
| --- | --- | --- |
| `X-Content-Type-Options` | Present only on selected export/download route responses. | Needed globally. |
| `Referrer-Policy` | Not configured globally. | Needed globally. |
| `Permissions-Policy` | Not configured. | Needed to disable unused browser capabilities. |
| `X-Frame-Options` / `frame-ancestors` | Not configured. | App has no iframe embedding requirement; clickjacking protection is appropriate. |
| `Content-Security-Policy` | Not configured. | Strict script/style CSP needs a larger nonce/rendering pass; a safe staged policy can be enforced now. |
| `Strict-Transport-Security` | Not configured. | Should be HTTPS deployment-layer verified, not emitted by local HTTP tests. |
| `Cross-Origin-Opener-Policy` | Not configured. | Safe baseline for this internal app. |
| `Cross-Origin-Resource-Policy` | Not configured. | Safe baseline for same-origin internal resources/downloads. |
| `X-Powered-By` | Next default unless disabled. | Disabled in Phase 11G. |
| Sensitive cache headers | Present on export/download/Drive API route handlers. | Extended to sensitive page/API route families through Next.js config. |

## D. Header Changes

Implemented in `next.config.ts`:

- `poweredByHeader: false`.
- Global headers on `/:path*`:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)`
  - `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  - `X-Frame-Options: DENY`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
- No-store headers on sensitive route families:
  - `/`
  - `/login`
  - `/dashboard/:path*`
  - `/shipping-notes/:path*`
  - `/admin/:path*`
  - `/tax-rules/:path*`
  - `/api/auth/:path*`
  - `/api/shipping-notes/:path*`
  - `/api/shipping-note-exports/:path*`

The policy does not add route runtime changes, provider-specific settings, rewrites, redirects, standalone output, or deployment target configuration.

## E. CSP Decision

Status: `STAGED/PARTIAL`.

The implemented CSP is enforced for stable low-risk directives:

- `frame-ancestors 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `object-src 'none'`

Full `script-src`/`style-src` enforcement is deferred because strict CSP for Next.js App Router requires nonce/hash architecture and authenticated browser verification. A weak policy with broad `default-src *`, `'unsafe-inline'`, or `'unsafe-eval'` was not added.

## F. Environment Variable Classification

| Variable | Classification | Browser exposed? | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Server secret | No | PostgreSQL/Neon connection string. |
| `AUTH_SECRET` | Server secret | No | Better Auth secret. |
| `AUTH_URL` | Server non-secret deployment origin | No | Server-side Better Auth base URL. |
| `NEXT_PUBLIC_AUTH_URL` | Browser public / build-time public | Yes | Only approved `NEXT_PUBLIC_*` variable. |
| `ARTIFACT_R2_ACCOUNT_ID` | Server non-secret identifier | No | Used to build R2 endpoint. |
| `ARTIFACT_R2_ACCESS_KEY_ID` | Server secret | No | R2 credential. |
| `ARTIFACT_R2_SECRET_ACCESS_KEY` | Server secret | No | R2 credential. |
| `ARTIFACT_R2_BUCKET_NAME` | Server non-secret configuration | No | Private artifact bucket name. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Server secret | No | Service-account credential JSON. |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Server non-secret configuration | No | Private Drive root folder ID. |
| `BOOTSTRAP_ADMIN_EMAIL` | Server setup-only | No | Development bootstrap input. |
| `BOOTSTRAP_ADMIN_NAME` | Server setup-only | No | Development bootstrap input. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Server secret setup-only | No | Development bootstrap credential. |
| `INTEGRATION_TEST_DATABASE_AUTHORIZED` | Test-only safety authorization | No | Must not be exposed to browser. |
| `INTEGRATION_TEST_DATABASE_EXPECTED_HOST` | Test-only safety target | No | Integration guard input. |
| `INTEGRATION_TEST_DATABASE_EXPECTED_NAME` | Test-only safety target | No | Integration guard input. |
| `DATABASE_MIGRATION_AUTHORIZED` | Migration safety authorization | No | Guarded migration input. |
| `DATABASE_MIGRATION_EXPECTED_HOST` | Migration safety target | No | Guarded migration input. |
| `DATABASE_MIGRATION_EXPECTED_NAME` | Migration safety target | No | Guarded migration input. |
| `E2E_PORT` / `E2E_BASE_URL` | Browser E2E test-only | No committed production use | Used by DB-free Playwright runner. |

No `.env.local` contents were read or copied.

## G. Secret Exposure Assessment

- `.env.example` exposes only variable names and safe placeholders.
- `NEXT_PUBLIC_AUTH_URL` is the only documented browser-public variable.
- Server secrets are imported through server-only modules or service-specific server adapters.
- `src/lib/env-public-safety.test.ts` verifies `.env.example` does not document server secrets as `NEXT_PUBLIC_*`.
- Playwright continues to assert that the DB-free login HTML does not render obvious secret names or credential material.

## H. Production Environment Validation

Existing validation remains intentionally lazy where appropriate:

- Core server env validation exists in `src/lib/env.ts` for `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`.
- R2 configuration is validated in `src/lib/artifact-storage/r2.ts` when artifact storage is used.
- Google Drive configuration is validated in `src/lib/drive/config.ts` when Drive upload is used.
- No global production-env preflight was added because it would make DB-free build/E2E require real external-service credentials.

Production/staging startup must still be verified with real environment values in the later staging release gates.

## I. Host / Origin / Proxy Assessment

- Better Auth server base URL is deterministic through `AUTH_URL`; it is not derived from untrusted request headers in repository code.
- Browser auth client uses `window.location.origin` in the browser and `NEXT_PUBLIC_AUTH_URL` as non-browser fallback.
- Internal export/download routes already validate same-origin metadata before processing sensitive operations.
- Login page inert callback parameters remain covered by DB-free Playwright regression; no server-side external redirect behavior was added.
- No provider-specific trust of `Host`, `X-Forwarded-Host`, or `X-Forwarded-Proto` was introduced.

Authenticated callback/cookie behavior still requires staging verification behind the real HTTPS proxy.

## J. Better Auth Production Assessment

- `AUTH_SECRET` remains server-only.
- `AUTH_URL` remains server-side base URL.
- No magic-link, email-OTP, or passwordless email auth was enabled, preserving the accepted Better Auth advisory waiver.
- Email/password signup remains disabled in production unless the explicit development bootstrap flag is used outside production.
- Cookie attributes are delegated to Better Auth defaults; secure cookie behavior must be verified in an HTTPS staging environment because this phase does not execute live authenticated browser flows.

## K. Cache / Error Disclosure Assessment

- Sensitive route families now receive no-store headers from Next.js config.
- Export/download/Drive route handlers retain explicit route-level no-store, `nosniff`, and sanitized JSON error behavior.
- No broad global `no-store` was applied to static assets.
- Existing export/download error paths return stable error codes and avoid returning raw exception objects, DB URLs, R2 credentials, Google credentials, or stack traces.
- No logging subsystem or error architecture rewrite was performed.

## L. Security Tests

Added/updated:

- `src/next-config.test.ts`
  - verifies `poweredByHeader: false`;
  - verifies global security headers;
  - verifies staged CSP directives;
  - verifies HSTS is not emitted by local app config;
  - verifies sensitive no-store route families;
  - verifies static asset route families are not globally no-stored.
- `src/lib/env-public-safety.test.ts`
  - verifies only `NEXT_PUBLIC_AUTH_URL` is documented as browser-public;
  - verifies server-secret names are not documented as public variables.
- `tests/e2e/public-auth-boundary.spec.ts`
  - verifies `/login` response headers in a production-style local server;
  - verifies `X-Powered-By` is absent;
  - verifies local HTTP response does not emit HSTS.

## M. Browser E2E Result

- Command: `npm run test:e2e`.
- Browser: Chromium.
- Result: PASS.
- Count: 1 file / 9 tests.
- Coverage remains DB-free: public login page, client/native form behavior before auth submission, inert callback parameter behavior, unauthenticated protected-route redirects, and `/login` response security headers.

## N. Full Validation

All commands were run under Node `v24.19.0` with npm `10.8.1`.

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 708 packages installed from lockfile. |
| `npm ls` | PASS; known `@emnapi/runtime@1.11.1 extraneous` optional/native artifact remains. |
| `npm test` | PASS; 50 files / 282 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npm run build` | PASS; admin, shipping note, XLSX/PDF export, historical download, and Drive API routes compiled. |
| `npm run test:e2e` | PASS; 1 file / 9 Chromium tests. |
| `npm run ci:security-audit` | PASS; `npm audit` and `npm audit --omit=dev` both report 7 total, 0 critical, 1 high, 6 moderate. |

During validation, the npm registry reported a new dev-only `browserslist@4.28.4` High finding through `eslint-config-next -> eslint-plugin-react-hooks -> @babel/core -> @babel/helper-compilation-targets`. A normal non-force `npm update browserslist` remediated that transitive dev-tooling path to `browserslist@4.28.8` and `update-browserslist-db@1.3.2`; no application dependency was intentionally upgraded.

## O. GitHub-hosted CI Status

Status: `PENDING — NOT EXECUTED`.

Evidence: the workflow exists locally and local validation passed, but there is no repository evidence in this task of an actual GitHub-hosted workflow run.

## P. Non-Execution Confirmation

Phase 11G did not:

- connect to PostgreSQL/Neon;
- run migrations;
- run `npm run test:integration`;
- run `npm run test:all`;
- run `npm run db:migrate`;
- run `npm run db:studio`;
- call Cloudflare R2;
- call Google Drive;
- use production or staging credentials;
- deploy;
- change DNS;
- provision infrastructure;
- rotate credentials;
- create migration `0006`;
- add an auth bypass.

Live migration status remains:

- `0003_hard_titania.sql`: `LIVE STATUS UNKNOWN / NOT VERIFIED`
- `0004_clean_power_man.sql`: `LIVE STATUS UNKNOWN / NOT VERIFIED`
- `0005_perpetual_goblin_queen.sql`: `LIVE STATUS UNKNOWN / NOT VERIFIED`

## Q. Files Changed

Changed by Phase 11G:

- `next.config.ts`
- `src/next-config.test.ts`
- `src/lib/env-public-safety.test.ts`
- `tests/e2e/public-auth-boundary.spec.ts`
- `package-lock.json`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_11G_SECURITY_DEPLOYMENT_HARDENING_2026-09-02.md`

Pre-existing dirty/untracked work from prior accepted phases was preserved. `package.json` was already modified before this phase and was not intentionally changed by Phase 11G.

## R. Remaining Hardening Checkpoints

- `11H` - Authorized staging DB migration + integration verification.
- `11I` - Authenticated staging browser E2E.
- `11J` - R2 / Google Drive staging verification.
- `11K` - Backup / recovery + production release gate.

Additional staging checks needed before production:

- HSTS over real HTTPS/domain.
- Better Auth cookie attributes behind the real proxy.
- Authenticated cache behavior for dashboard/admin/shipping/export pages.
- GitHub-hosted Quality Gates workflow execution.
- Real provider environment values without exposing secrets.

## S. Final Verdict

READY FOR LEAD REVIEW
