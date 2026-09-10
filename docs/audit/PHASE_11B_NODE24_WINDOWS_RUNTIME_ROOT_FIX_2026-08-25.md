# Phase 11B Node 24 Windows Runtime Root Fix

## A. Starting Mixed Runtime State

- Date: 2026-08-25
- Branch: `feature/ui-overhaul`
- HEAD: `513e60edc34f4a0fec5686b927d861d09ec78934`
- Starting Git state: dirty with substantial pre-existing accepted work.
- Initial Codex/system fallback history: previous non-interactive Codex shells resolved Node `v20.14.0`.
- Human/interactively observed state supplied by Lead: PowerShell with FNM resolved Node `v24.19.0`, while `C:\Program Files\nodejs\node.exe` resolved `v20.14.0`.

## B. Root Cause

The machine had two effective Node runtimes:

- FNM multishell runtime: Node `v24.19.0`.
- System fallback runtime: `C:\Program Files\nodejs\node.exe` at Node `v20.14.0`.

Codex/non-interactive shells did not reliably inherit the dynamic FNM multishell path and therefore fell back to stale system Node 20.

## C. Node Installation Inventory

Observed before remediation:

- `where.exe node` from the FNM-aware shell:
  - `C:\Users\Admin\AppData\Local\fnm_multishells\<dynamic-id>\node.exe`
  - `C:\Program Files\nodejs\node.exe`
- FNM node: `v24.19.0`
- Absolute system node: `v20.14.0`
- Absolute system npm: `10.8.1`
- Windows package inventory before remediation: `OpenJS.NodeJS.20 20.14.0`.

Observed after remediation:

- Windows package inventory: `OpenJS.NodeJS.LTS 24.19.0`.
- Absolute system node: `v24.19.0`.
- Absolute system npm: `10.8.1`.

## D. FNM State

FNM was present through winget:

- `fnm --version`: `fnm 1.39.0`
- `fnm list`: `v24.19.0 default`, `v26.7.0 latest`, and `system`
- `fnm current`: `v24.19.0`

No dynamic `fnm_multishells\<id>` path was added permanently.

## E. System Node Remediation

Actions performed:

```text
winget uninstall --id OpenJS.NodeJS.20 --exact --accept-source-agreements
winget install --id OpenJS.NodeJS.LTS --exact --version 24.19.0 --accept-source-agreements --accept-package-agreements
```

Result:

- obsolete system Node 20 removed;
- official Node.js LTS 24.19.0 installed;
- `C:\Program Files\nodejs\node.exe -v` now returns `v24.19.0`.

## F. Persistent PATH Review

Node-related user PATH entries:

- `C:\Program Files\nodejs`
- FNM winget package directory

Node-related machine PATH entries:

- `C:\Users\Admin\.config\herd\bin\nvm`
- `C:\Program Files\nodejs`
- `C:\Program Files\nodejs\`

No persistent dynamic FNM multishell path was added.

## G. FNM Default / Shell Initialization

FNM default/current is Node `v24.19.0`.

PowerShell profile check found the current-user Windows PowerShell profile exists, but no Node/FNM lines were printed by the Node/FNM-specific scan. Because the system fallback now resolves Node 24 and FNM already reports Node 24 default/current, no broad shell profile rewrite was performed.

One npm-specific Windows note:

- PowerShell can select `npm.ps1`, and the official Node-installed `npm.ps1` is unsigned.
- `npm.cmd` works in cmd.exe and PowerShell.
- This task did not weaken PowerShell execution policy.

## H. Repository Runtime Policy

Repository policy was updated from Node 22 to Node 24:

- `package.json` engines: `>=24 <25`
- `package-lock.json` root engine metadata: `>=24 <25`
- `.nvmrc`: `24`
- `.npmrc`: `engine-strict=true`

No dependency versions were intentionally changed.

## I. Cross-Shell Runtime Verification

Current Codex shell:

- `node -v`: `v24.19.0`

New cmd.exe child:

- `node -v`: `v24.19.0`
- `where node`: `C:\Program Files\nodejs\node.exe`

New Windows PowerShell without profile:

- `node -v`: `v24.19.0`
- `where.exe node`: `C:\Program Files\nodejs\node.exe`

New Windows PowerShell with normal profile:

- `node -v`: `v24.19.0`
- `where.exe node`: `C:\Program Files\nodejs\node.exe`

## J. System Binary Verification

Hard gate:

- `C:\Program Files\nodejs\node.exe -v`: `v24.19.0`

No PATH-visible default Node 20 runtime remained in the inspected Node paths.

## K. npm Consistency

System fallback npm:

- `C:\Program Files\nodejs\npm.cmd -v`: `10.8.1`
- `cmd.exe` child `npm -v`: `10.8.1`

FNM/current npm:

- FNM-aware shell `npm -v`: `11.17.0`

Validation was run under Node `v24.19.0`; `npm ci` was rerun with system PATH precedence using system npm `10.8.1`.

## L. npm ci

Command:

```text
cmd /d /c "set PATH=C:\Program Files\nodejs;%PATH%&& node -v && npm -v && npm ci"
```

Result:

- Node: `v24.19.0`
- npm: `10.8.1`
- `npm ci`: PASS
- Packages added: 702
- Audit output reported 18 vulnerabilities; no `npm audit fix` was run.

## M. Dependency Engine Validation

Commands:

- `npm ls`
- `npm explain kysely`
- `npm explain @noble/ciphers`
- `npm explain @noble/hashes`

Result:

- `npm ls`: PASS, exit code 0.
- No Node 24 engine blocker was reported.
- Previously sensitive packages are present and compatible under Node 24:
  - `kysely@0.29.2`
  - `@noble/ciphers@2.2.0`
  - `@noble/hashes@2.2.0`

Note:

- `npm ls` reports several extraneous native helper packages after clean install/prune, but exits 0 and reports no engine incompatibility. This was not treated as a dependency-upgrade task.

## N. Unit Tests

Command:

```text
cmd /d /c "node -v && npm -v && npm test"
```

Result:

- Node: `v24.19.0`
- npm: `10.8.1`
- Test files: 44 passed
- Tests: 245 passed
- Status: PASS

## O. Typecheck

Command:

```text
cmd /d /c "node -v && npm -v && npm run typecheck"
```

Result:

- Node: `v24.19.0`
- npm: `10.8.1`
- Status: PASS

## P. Lint

Command:

```text
cmd /d /c "node -v && npm -v && npm run lint"
```

Result:

- Node: `v24.19.0`
- npm: `10.8.1`
- Status: PASS

## Q. Production Build

Command:

```text
cmd /d /c "node -v && npm -v && npm run build"
```

Result:

- Node: `v24.19.0`
- npm: `10.8.1`
- Status: PASS

Compiled routes included:

- `/admin/audit`
- `/admin/users`
- `/api/shipping-note-exports/[exportId]/download`
- `/api/shipping-note-exports/[exportId]/drive`
- `/api/shipping-notes/[id]/exports/internal-pdf`
- `/api/shipping-notes/[id]/exports/internal-xlsx`
- Shipping Note routes

## R. `.env.local` Safety

Verified without reading contents:

- `.env.local` exists locally: yes.
- `.env.local` ignored: yes, by `.gitignore:19:.env*`.
- `.env.local` tracked: no, `git ls-files .env.local` returned no file.
- `.env.example` tracked: yes.
- `.env.example` ignored: no.

No secret contents were inspected or printed.

## S. Database / External Non-Execution

Not run:

- `npm run db:migrate`
- `npm run db:studio`
- `npm run test:integration`
- `npm run test:all`

Not accessed:

- `DATABASE_URL`
- Cloudflare R2
- Google Drive

## T. Migration Status

No database access occurred.

- `0003_hard_titania.sql`: NOT APPLIED / NOT VERIFIED
- `0004_clean_power_man.sql`: NOT APPLIED / NOT VERIFIED
- `0005_perpetual_goblin_queen.sql`: NOT APPLIED / NOT VERIFIED

No new migration was created.

## U. Files / Machine Configuration Changed

Machine changes:

- Removed winget package `OpenJS.NodeJS.20`.
- Installed winget package `OpenJS.NodeJS.LTS 24.19.0`.
- FNM default/current remained Node `v24.19.0`.

Repository files changed by this task:

- `.nvmrc`
- `package.json`
- `package-lock.json`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_11B_NODE24_WINDOWS_RUNTIME_ROOT_FIX_2026-08-25.md`

Pre-existing Phase 11B files remain part of the dirty tree:

- `.gitignore`
- `.env.example`
- `.npmrc`
- `.env.local` index deletion

## V. Remaining Human Actions

- Credential rotation remains unresolved for any secret that may have been historically committed.
- Dependency security triage remains deferred to Phase 11D.
- Integration database safety guard remains Phase 11C.
- CI, browser E2E, external smoke tests, security headers, and deployment hardening remain future work.
- A human-reviewed checkpoint commit is strongly recommended before Phase 11C/staging database work.

## W. Final Verdict

`READY FOR LEAD REVIEW`
