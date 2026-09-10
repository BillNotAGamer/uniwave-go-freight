# Phase 11D.1 Residual Dependency Security Closure

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Working tree: intentionally dirty with accepted uncommitted work from prior phases. No reset, clean, stash, revert, checkout, history rewrite, or commit was performed.
- Runtime: Node `v24.19.0`, npm `10.8.1`
- Runtime policy preserved: `package.json` engines `>=24 <25`, `.nvmrc` value `24`, `.npmrc` `engine-strict=true`.
- Phase 11C migration wording was already corrected to `LIVE STATUS UNKNOWN / NOT VERIFIED` for `0003`, `0004`, and `0005`. No database was queried.

## B. Phase 11D Lead Review Corrections

- Better Auth advisory correction: GHSA-qq9h-g4jm-xgf3 applies to affected Better Auth configurations using magic-link or email-OTP sign-in together with email/password signup under the documented pre-account-hijacking conditions. The repository was re-inspected before classification.
- Vitest remediation correction: Vitest 4 is not the only remediation path. The preferred first target was the maintained patched v3 line, specifically `vitest@3.2.7`.
- Phase 11D accepted remediation was preserved: Next.js `16.3.3`, patched Tailwind/PostCSS path, safe transitive lockfile remediation, Node 24 validation, and database/integration safety controls were not reverted.

## C. Dependency Graph Investigation

- `npm ls` before Phase 11D.1 changes passed under Node 24, with `@emnapi/runtime@1.11.1 extraneous` reported.
- `npm ls --omit=dev` before Phase 11D.1 changes passed, also showing the same `@emnapi/runtime@1.11.1 extraneous` install artifact.
- `npm explain vitest`: direct dev dependency at `vitest@2.1.9` before remediation; also listed as an optional peer of `better-auth@1.6.20`.
- `npm explain vite`: `vite@5.4.21` was present through the Vitest 2 path before remediation.
- `npm explain better-auth`: direct runtime dependency at `better-auth@1.6.20`.
- `npm explain @tanstack/react-start`: no installed dependency found.
- `npm explain @emnapi/runtime`: initially reported `@emnapi/runtime@1.11.1 extraneous`.
- After `npm ci`, the extraneous `@emnapi/runtime@1.11.1` result was reproducible. The lockfile contains optional/native wasm paths that reference `@emnapi/runtime`, including `@img/sharp-wasm32`, `@tailwindcss/oxide-wasm32-wasi`, and `@unrs/resolver-binding-wasm32-wasi`. `npm ls` exits successfully, so this is recorded as a reproducible npm optional/native install artifact rather than a dependency-tree failure.

## D. Vitest Exposure Assessment

- Package scripts use `vitest run` for `npm test`.
- `npm run test:watch` starts local Vitest watch mode only.
- The integration test script invokes Vitest run mode through `node --conditions=react-server ./node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts`; integration was not executed.
- Repository search found no Vitest UI usage, no `@vitest/ui`, no `--ui`, no Browser Mode, no `browser.enabled`, no `api.host`, and no externally bound Vitest server configuration.
- Exposure classification before upgrade: development/test tooling only, with no project-configured public Vitest server surface.

## E. Vitest 3 Upgrade

- Attempted version: `vitest@3.2.7`
- Command used normal npm resolution: `npm install -D vitest@3.2.7`
- No `--force` and no `--legacy-peer-deps` were used.
- Result: success.
- Dependency result: `vitest@3.2.7`, `vite-node@3.2.4`, and `vite@7.3.6`.
- `npm ls` and `npm explain vitest`/`npm explain vite` showed a coherent Vitest 3 graph after the upgrade.
- Compatibility validation passed: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## F. Better Auth Configuration Reachability

- Repository auth server initialization uses `betterAuth(...)` with Drizzle adapter and `emailAndPassword.enabled = true`.
- No Better Auth `plugins` array is configured.
- Repository search found no magic-link plugin, no email-OTP plugin, no passwordless email login, and no equivalent affected sign-in flow.
- Client login uses `authClient.signIn.email`, matching email/password use.
- Reachability classification for GHSA-qq9h-g4jm-xgf3: `D - non-applicable under current configuration`.
- Guardrail: if magic-link, email-OTP, or any passwordless email flow is introduced later, this advisory must be re-evaluated and Better Auth should be upgraded to a patched compatible release before enabling that flow.

## G. Better Auth Upgrade

- Preferred target attempted first: latest stable `1.6.x`, `better-auth@1.6.30`.
- Minimum patched target also attempted: `better-auth@1.6.22`.
- Both attempts used normal npm dependency resolution only.
- Both attempts failed with npm `ERESOLVE`.
- Peer conflict chain:
  - Root requested `better-auth@1.6.30` or `better-auth@1.6.22`.
  - Better Auth declares optional peer `@sveltejs/kit@^2.0.0`.
  - npm selected `@sveltejs/kit@2.70.3`.
  - That path selected `@sveltejs/vite-plugin-svelte@7.3.0`.
  - `@sveltejs/vite-plugin-svelte@7.3.0` requires Vite `^8.0.0-beta.7 || ^8.0.0`.
  - The validated repository test toolchain uses `vite@7.3.6`.
- `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, and `@tanstack/react-start` are not installed in the final dependency tree.
- Disposition: do not force or bypass peer resolution in Phase 11D.1. Current advisory is non-applicable under the repository's email/password-only configuration, but a future Better Auth upgrade remains recommended when npm can resolve it cleanly or when the affected auth flows are considered.

## H. Residual Drizzle Kit Finding

- Finding path: `drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild`.
- Severity: moderate.
- Scope: development/migration tooling.
- npm suggested remediation: `drizzle-kit@0.18.1`, a semver-major downgrade relative to the current `drizzle-kit@0.31.10`.
- Repository usage: Drizzle Kit commands are migration/generation/studio tooling. Phase 11C routes `npm run db:migrate` through a guarded repository wrapper and no database command was run in this phase.
- Reachability classification: `C - development/build/test-only` for application runtime; residual tooling risk when a developer intentionally runs Drizzle tooling.
- Disposition: do not downgrade Drizzle Kit. Track as residual tooling risk and revisit with a compatible Drizzle Kit upgrade/remediation path.

## I. Residual ExcelJS Finding

- Finding path: `exceljs@4.4.0 -> uuid@8.3.2`.
- Severity: moderate.
- Scope: production dependency because ExcelJS is used for internal XLSX export generation.
- npm suggested remediation: `exceljs@3.4.0`, a downgrade.
- Repository usage: XLSX generation uses `new ExcelJS.Workbook()` and workbook/worksheet/cell APIs in `src/features/shipping-notes/export/generator.ts`.
- Repository search found no direct use of vulnerable `uuid` APIs such as application calls to `uuid.v3`, `uuid.v5`, or UUID parsing helpers.
- Reachability classification: `B - production dependency but affected path appears unreachable`.
- Disposition: do not downgrade ExcelJS or redesign XLSX export in this closure phase. Track residual non-reachable transitive production risk and prefer a future compatible ExcelJS patched release if one becomes available.

## J. Audit Before/After

Phase 11D.1 starting point, from the accepted Phase 11D report:

- `npm audit`: 11 total findings: 8 moderate, 2 high, 1 critical.
- `npm audit --omit=dev`: 11 total findings: 8 moderate, 2 high, 1 critical.
- Meaningful residuals before 11D.1: Vitest/Vite tooling advisory, Better Auth advisory, Drizzle Kit tooling advisory, and ExcelJS UUID advisory.

Final Phase 11D.1 audit results:

- `npm audit`: 7 total findings: 0 critical, 1 high, 6 moderate.
- `npm audit --omit=dev`: 7 total findings: 0 critical, 1 high, 6 moderate.

Final residual findings:

| Package | Severity | Scope | Reachability | Disposition |
| --- | --- | --- | --- | --- |
| `better-auth` | High | Production dependency | `D - non-applicable under current configuration` | No affected magic-link/email-OTP/passwordless flow is configured; clean patched upgrade blocked by optional peer conflict. |
| `drizzle-kit` | Moderate | Dev/migration tooling | `C - development/build/test-only` | Do not downgrade; tooling commands remain guarded and not run in this phase. |
| `@esbuild-kit/esm-loader` | Moderate | Transitive dev tooling | `C - development/build/test-only` | Same Drizzle Kit path. |
| `@esbuild-kit/core-utils` | Moderate | Transitive dev tooling | `C - development/build/test-only` | Same Drizzle Kit path. |
| `esbuild` | Moderate | Transitive dev tooling through Drizzle Kit | `C - development/build/test-only` | Vitest/Vite esbuild path was cleared; remaining path is Drizzle Kit tooling. |
| `exceljs` | Moderate | Production export dependency | `B - production dependency but affected path appears unreachable` | Do not downgrade; XLSX generator does not call affected UUID APIs. |
| `uuid` | Moderate | Transitive through ExcelJS | `B - production dependency but affected path appears unreachable` | Same ExcelJS path. |

No reachable production High/Critical dependency vulnerability remains under the current repository configuration.

## K. Final Dependency Tree

- `npm ci`: passed under Node `v24.19.0`.
- `npm ls`: passed. Final tree includes `vitest@3.2.7`, `vite@7.3.6`, `next@16.3.3`, `better-auth@1.6.20`, `drizzle-kit@0.31.10`, and `exceljs@4.4.0`.
- `npm ls --omit=dev`: passed.
- `npm explain @emnapi/runtime`: reports `@emnapi/runtime@1.11.1 extraneous` after clean install. Because `npm ls` exits successfully and the lockfile contains optional/native wasm package references, this is documented as a reproducible optional/native install artifact rather than a blocking inconsistent dependency graph.
- `npm explain @tanstack/react-start`: no installed dependency found.

## L. Validation

Executed under Node `v24.19.0` and npm `10.8.1`:

| Command | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm ls` | PASS |
| `npm ls --omit=dev` | PASS |
| `npm test` | PASS, 48 files / 275 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm audit` | Completed; exits non-zero due documented residual findings |
| `npm audit --omit=dev` | Completed; exits non-zero due documented residual findings |

## M. Non-Execution Confirmation

Phase 11D.1 did not:

- connect to PostgreSQL, Neon, or any live database;
- inspect live migration state;
- run `npm run db:migrate`;
- run `npm run db:studio`;
- run `npm run test:integration`;
- run `npm run test:all`;
- call Cloudflare R2;
- call Google Drive;
- use live service credentials;
- rotate credentials;
- create a Drizzle migration;
- create migration `0006`;
- run `npm audit fix --force`;
- use `npm install --force`;
- use `--legacy-peer-deps`;
- weaken Phase 11C database guards.

## N. Files Changed

Phase 11D.1 changed:

- `package.json`
- `package-lock.json`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_11D1_RESIDUAL_DEPENDENCY_SECURITY_CLOSURE_2026-08-26.md`

Pre-existing accepted dirty files were preserved.

## O. Final Verdict

READY FOR LEAD REVIEW
