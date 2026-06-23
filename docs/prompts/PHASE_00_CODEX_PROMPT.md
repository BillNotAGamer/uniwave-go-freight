# Codex Prompt — Phase 00 Repository Audit

You are working inside the repository `/uniwave-go-freight`.

Before doing anything, read these files if they exist:
- `AGENTS.md`
- `docs/PROJECT_BRIEF.md`
- `docs/BUILD_PHASES.md`
- `docs/UI_RULES.md`
- `docs/SECURITY_RBAC_RULES.md`
- `docs/DATA_MODEL_RULES.md`
- `docs/QA_CHECKLIST.md`

## Mission

Perform a repository audit and prepare the project for Phase 1 planning.

## Rules

- Do not overbuild.
- Do not implement application features yet.
- Do not add authentication, database schema, UI pages, or dependencies unless the repository is empty and a minimal package inspection requires it.
- Do not create fake secrets.
- Do not modify files unless necessary to add missing project documentation or to make the audit possible.
- If you do change files, explain exactly why.

## Audit Checklist

Inspect and report:

1. Current folder structure.
2. Detected framework and package manager.
3. Existing `package.json` scripts.
4. TypeScript configuration status.
5. Next.js/App Router presence.
6. Tailwind/shadcn readiness.
7. Existing environment files and whether they are safe.
8. Existing database/ORM setup.
9. Existing auth setup.
10. Existing tests/linting.
11. Any obvious security or maintainability concerns.
12. Whether the repository is empty, partially initialized, or already contains app code.

## Expected Output

Return a concise report with these sections:

1. Repository Status
2. Current Stack Detected
3. Files Inspected
4. Risks or Issues Found
5. Recommended Phase 1 Scope
6. Exact Commands You Recommend Running Next
7. Files You Recommend Creating or Editing Next
8. Questions/Blockers, only if truly blocking

Do not proceed to Phase 1 implementation until the human tech lead approves.
