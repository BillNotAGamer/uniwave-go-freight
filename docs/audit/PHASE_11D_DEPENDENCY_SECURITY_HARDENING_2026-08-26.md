# Phase 11D Dependency Vulnerability Triage and Remediation

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Working tree: intentionally dirty with accepted but uncommitted Phase 8, Phase 9, Phase 10, Phase 11B, and Phase 11C work. Existing changes were preserved.
- Runtime: Node `v24.19.0`
- npm baseline: `10.8.1`
- Repository policy:
  - `engines.node = ">=24 <25"`
  - `.nvmrc = 24`
  - `.npmrc = engine-strict=true`
- `.env.local`: preserved locally, ignored, and not tracked; contents were not read.

## B. Phase 11C Documentation Correction

Phase 11C/current documentation was corrected from `NOT APPLIED / NOT VERIFIED` to `LIVE STATUS UNKNOWN / NOT VERIFIED` for migrations:

- `0003_hard_titania.sql`
- `0004_clean_power_man.sql`
- `0005_perpetual_goblin_queen.sql`

No database query was performed. Phase 11C itself still accurately states that it did not apply migrations.

Files corrected:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_11C_INTEGRATION_DB_SAFETY_IMPLEMENTATION_2026-08-25.md`

## C. Dependency Baseline

Relevant direct dependencies before remediation:

| Package | Scope | Baseline |
| --- | --- | --- |
| `next` | production | `16.2.9` |
| `react` | production | `19.2.4` |
| `react-dom` | production | `19.2.4` |
| `better-auth` | production | `^1.6.20`, installed `1.6.20` |
| `drizzle-orm` | production | `^0.45.2` |
| `drizzle-kit` | dev/tooling | `^0.31.10`, installed `0.31.10` |
| `@neondatabase/serverless` | production | `^1.1.0` |
| `zod` | production | `^4.4.3` |
| `exceljs` | production export | `^4.4.0`, installed `4.4.0` |
| `@react-pdf/renderer` | production export | `^4.6.1` |
| `pdf-parse` | dev/test | `^1.1.1` |
| `googleapis` | production Drive integration | `^176.0.0` |
| `@aws-sdk/client-s3` | production R2/S3 artifact storage | `^3.1116.0` |
| `@tailwindcss/postcss` | build/dev | `^4`, installed `4.3.1` |
| `tailwindcss` | build/dev | `^4`, installed `4.3.1` |
| `vitest` | dev/test | `^2.1.9`, installed `2.1.9` |
| `typescript` | dev/build | `^5`, installed `5.9.3` |
| `eslint` | dev/build | `^9`, installed `9.39.4` |

Baseline `npm ls` passed under Node `v24.19.0` and npm `10.8.1`.

## D. Audit Before Remediation

Commands:

```bash
npm audit
npm audit --omit=dev
```

Initial sandbox attempts failed to reach the audit endpoint. Escalated non-mutating audit commands succeeded.

Full audit before remediation:

| Severity | Count |
| --- | ---: |
| Critical | 1 |
| High | 8 |
| Moderate | 9 |
| Total | 18 |

`--omit=dev` audit before remediation:

| Severity | Count |
| --- | ---: |
| Critical | 1 |
| High | 7 |
| Moderate | 8 |
| Total | 16 |

npm's `--omit=dev` output still included some packages declared in this repository as dev/tooling dependencies. Scope classification below is based on both npm output and `package.json`.

## E. Vulnerability Analysis

| Package | Advisory | Dependency path | Affected range | Current version | Fixed version / range | Reachability | Application impact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `next` | GHSA-6gpp-xcg3-4w24, GHSA-m99w-x7hq-7vfj, GHSA-89xv-2m56-2m9x, GHSA-p9j2-gv94-2wf4 plus moderate Next advisories | direct production dependency | `>=16.0.0 <16.2.11` for listed direct Next advisories; audit also grouped broader Next range | `16.2.9` | `16.3.3` | A - production reachable / credible application risk | App Router, server actions, routes, and build/runtime behavior are core application surfaces. |
| `postcss` through `next` | GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | `next -> postcss` | `<=8.5.22` | `8.4.31` under Next | fixed by `next@16.3.3`, now `postcss@8.5.23` under Next | B - production dependency but affected path appears limited | Build/runtime framework dependency; no user-supplied CSS processing endpoint exists, but framework supply-chain risk is credible. |
| `sharp` through `next` | GHSA-f88m-g3jw-g9cj | `next -> sharp` | `<0.35.0` | `0.34.5` | fixed by `next@16.3.3` audit grouping | B - production dependency but affected path appears limited | No custom image optimization workflow was found, but Next includes the dependency. |
| `better-auth` | GHSA-qq9h-g4jm-xgf3 | direct production dependency | `>=1.1.3 <1.6.22` | `1.6.20` | `>=1.6.22` | E - unresolved / insufficient evidence | App config enables Better Auth email/password only; no magic-link or email-OTP config was found. It remains a direct auth boundary dependency and cannot be dismissed safely. |
| `@tailwindcss/postcss` / `postcss` | PostCSS advisories above | direct dev/build dependency -> `postcss` | `@tailwindcss/postcss` `4.3.1`; `postcss <=8.5.22` | `4.3.1`, `postcss@8.5.15` | `@tailwindcss/postcss@4.3.3`, `postcss@8.5.26` | C - development/build/test-only | CSS build pipeline only; no runtime user CSS input path. |
| `nanoid` | GHSA-2v37-7h3g-55p8 | `postcss -> nanoid` | `<3.3.18` | `3.3.16` | `3.3.18` | C - development/build/test-only | Reached through PostCSS/tooling, not application ID generation. |
| `js-yaml` | GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj | `eslint -> @eslint/eslintrc -> js-yaml` | `>=4.0.0 <4.3.1` | `4.2.0` | `4.3.1` | C - development/build/test-only | ESLint config parsing only. |
| `brace-expansion` | GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895 | `eslint/minimatch`, `exceljs/archiver/readdir-glob/minimatch`, `googleapis/gaxios/rimraf/glob/minimatch` | affected `1.x`, `2.x`, and `5.x` ranges | `1.1.15`, `2.1.2`, `5.0.6` | `1.1.18`, `2.1.4`, `5.0.9` | B/C depending path | Application does not expose arbitrary glob expansion; production paths through ExcelJS/Google libraries appear non-user-controlled. Safe transitive patches were available and applied. |
| `vitest` | GHSA-5xrq-8626-4rwp | direct dev/test dependency | `<3.2.6` | `2.1.9` | `4.1.11` per npm audit | C - development/build/test-only | Repository scripts use `vitest run`, not Vitest UI. Still a critical dev-tool advisory and requires major upgrade decision. |
| `vite` | GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff plus esbuild | `vitest -> vite` | `<=6.4.2` | `5.4.21` | via `vitest@4.1.11` per npm audit | C - development/build/test-only | Dev/test server risk; no production Vite server is deployed. |
| `esbuild` through Vitest/Vite | GHSA-67mh-4wv8-2f99 | `vitest -> vite -> esbuild` | `<=0.24.2` | `0.21.5` | via `vitest@4.1.11` per npm audit | C - development/build/test-only | Dev server exposure only. |
| `drizzle-kit` / `@esbuild-kit/*` / `esbuild` | GHSA-67mh-4wv8-2f99 | `drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild` | `drizzle-kit 0.19.0 - 1.0.0-beta.1-fd8bfcc`; esbuild `<=0.24.2` | `drizzle-kit@0.31.10`, esbuild `0.18.20` in old loader path | npm suggests `drizzle-kit@0.18.1` | C - development/build/test-only | Migration/generation tooling only. Phase 11C guarded `db:migrate`; production runtime does not serve Drizzle Kit. |
| `exceljs` / `uuid` | GHSA-w5hq-g745-h8pq | `exceljs -> uuid` | `uuid <11.1.1`; audit groups `exceljs >=3.5.0` | `exceljs@4.4.0`, `uuid@8.3.2` | npm suggests `exceljs@3.4.0` | B - production dependency but affected path appears unreachable | XLSX generation uses `new ExcelJS.Workbook()`. No repository code passes attacker-controlled buffers into UUID v3/v5/v6 APIs. Downgrading ExcelJS would risk export behavior. |

## F. Changes Applied

Applied targeted changes:

- `next`: `16.2.9 -> 16.3.3`
  - Reason: fixes direct high/moderate Next advisories and Next-carried `postcss`/`sharp` audit grouping.
  - Scope: production runtime dependency.
  - Note: npm initially changed the manifest to `^16.3.3`; this was restored to exact `16.3.3` to preserve the repository's previous exact Next pin.
- `@tailwindcss/postcss`: `^4` / installed `4.3.1 -> ^4.3.3`
  - Reason: fixes direct Tailwind/PostCSS audit finding.
  - Scope: build/dev dependency.
- `tailwindcss`: `^4` / installed `4.3.1 -> ^4.3.3`
  - Reason: keep Tailwind package family aligned with `@tailwindcss/postcss`.
  - Scope: build/dev dependency.
- Lockfile-compatible transitive remediation through non-force `npm audit fix --package-lock-only`:
  - `postcss` to `8.5.26` where existing ranges allowed it.
  - `nanoid` to `3.3.18`.
  - `js-yaml` to `4.3.1`.
  - `brace-expansion` to patched `1.1.18`, `2.1.4`, and `5.0.9` paths.

No `npm audit fix --force` was run.

## G. Changes Explicitly Rejected

- `better-auth@1.6.22`
  - Attempted with normal npm resolution.
  - Rejected by npm with `ERESOLVE` because Better Auth's optional React Start peer path requires a Vite version incompatible with the current Vitest/Vite major.
  - `--force` and `--legacy-peer-deps` were not used.
- `vitest@4.1.11`
  - npm audit identifies this major upgrade as the fix for Vitest/Vite/esbuild findings.
  - A combined remediation attempt including Vitest 4 was rejected by the execution approval policy as an unreviewed major upgrade.
  - Left for lead decision.
- `drizzle-kit@0.18.1`
  - npm audit suggests this as a fix, but it is a downgrade from `0.31.10` and could break current Drizzle/migration behavior.
  - Rejected in Phase 11D.
- `exceljs@3.4.0`
  - npm audit suggests this as a fix for `uuid`, but it is a downgrade from `4.4.0` and would risk XLSX export behavior.
  - Rejected in Phase 11D.
- `npm audit fix --force`
  - Explicitly prohibited and not run.

## H. Audit After Remediation

Commands:

```bash
npm audit
npm audit --omit=dev
```

Both final audit commands completed with exit code 1 because vulnerabilities remain. Final counts:

| Severity | Before `npm audit` | After `npm audit` |
| --- | ---: | ---: |
| Critical | 1 | 1 |
| High | 8 | 2 |
| Moderate | 9 | 8 |
| Total | 18 | 11 |

| Severity | Before `npm audit --omit=dev` | After `npm audit --omit=dev` |
| --- | ---: | ---: |
| Critical | 1 | 1 |
| High | 7 | 2 |
| Moderate | 8 | 8 |
| Total | 16 | 11 |

Resolved from audit output:

- Next direct advisories.
- Next-carried `postcss` and `sharp` audit grouping.
- Tailwind/PostCSS direct finding.
- `js-yaml`.
- `nanoid`.
- vulnerable `brace-expansion` paths.

## I. Residual Vulnerabilities

| Package | Severity | Scope | Dependency chain | Reason remaining | Reachability | Mitigation / future action |
| --- | --- | --- | --- | --- | --- | --- |
| `better-auth@1.6.20` | High | Production | direct dependency | Patched `1.6.22` cannot be installed with npm's normal resolver while current Vite/Vitest major remains; no force/legacy peer flags used. | E - unresolved direct auth risk; magic-link/email-OTP not configured, but auth package is a production boundary. | Lead decision required: approve compatible Better Auth remediation path, likely alongside Vite/Vitest/toolchain decision or upstream peer-resolution fix. |
| `vitest@2.1.9` | Critical | Dev/test | direct -> `@vitest/mocker`, `vite`, `vite-node` | Fix requires major `vitest@4.1.11`. | C - dev/test only; repository uses `vitest run`, not Vitest UI. | Lead decision required for Vitest 4 migration and compatibility review. |
| `vite@5.4.21` | High | Dev/test | `vitest -> vite` | Fix tied to Vitest major. | C - dev/test only; no production Vite server. | Same Vitest 4 decision. |
| `esbuild@0.21.5` via Vite | Moderate | Dev/test | `vitest -> vite -> esbuild` | Fix tied to Vitest major. | C - dev/test only. | Same Vitest 4 decision. |
| `drizzle-kit@0.31.10` / `@esbuild-kit/*` / `esbuild@0.18.20` | Moderate | Dev/migration tooling | `drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild` | npm suggests downgrade to `drizzle-kit@0.18.1`, which is not safe. | C - migration/generation tooling only; Phase 11C guards `db:migrate`. | Wait for safe Drizzle Kit upstream fix or plan a controlled Drizzle tooling migration. |
| `exceljs@4.4.0` / `uuid@8.3.2` | Moderate | Production export | `exceljs -> uuid` | npm suggests downgrade to `exceljs@3.4.0`; no safe forward fix from audit. | B - app uses ExcelJS workbook generation; affected UUID buffer APIs are not called by repository code. | Monitor ExcelJS for a forward fix; do not downgrade XLSX engine without export compatibility plan. |

## J. Validation

| Command | Result |
| --- | --- |
| `npm ci` | PASS under Node `v24.19.0` / npm `10.8.1`; a prior non-escalated fetch failed on `js-yaml`, escalated rerun succeeded, final normal rerun also succeeded. |
| `npm ls` | PASS under Node `v24.19.0` / npm `10.8.1`; final output lists `@emnapi/runtime@1.11.1 extraneous` but exits 0. |
| `npm test` | PASS, 48 files / 275 tests under Node `v24.19.0` / npm `10.8.1`. |
| `npm run typecheck` | PASS under Node `v24.19.0` / npm `10.8.1`. |
| `npm run lint` | PASS under Node `v24.19.0` / npm `10.8.1`. |
| `npm run build` | PASS under Node `v24.19.0` / npm `10.8.1`; Next.js `16.3.3` compiled `/admin/users`, `/admin/audit`, Shipping Note routes, XLSX/PDF export routes, artifact download, and Google Drive upload route. |

## K. Non-Execution Confirmation

Phase 11D did not:

- connect to PostgreSQL or Neon;
- inspect live migration state;
- run `npm run db:migrate`;
- run `npm run db:studio`;
- run `npm run test:integration`;
- run `npm run test:all`;
- run migrations;
- create migration `0006`;
- call Cloudflare R2;
- call Google Drive;
- rotate credentials;
- rewrite Git history;
- run `npm audit fix --force`;
- use `--force` or `--legacy-peer-deps`.

## L. Files Changed

Phase 11D changed:

- `package.json`
- `package-lock.json`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_11C_INTEGRATION_DB_SAFETY_IMPLEMENTATION_2026-08-25.md`
- `docs/audit/PHASE_11D_DEPENDENCY_SECURITY_HARDENING_2026-08-26.md`

Pre-existing dirty files from earlier accepted phases were preserved.

## M. Final Verdict

BLOCKED — MAJOR UPGRADE DECISION REQUIRED
