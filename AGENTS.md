# AI Agent Operating Rules — Uniwave Go Freight

This repository is a business-critical internal web app for logistics shipping notes, accounting review, exports, and role-based access control.

## Prime Directive

Build only what is explicitly requested in the current phase. Do not overbuild. Do not add speculative abstractions, unused services, unused schema fields, mock dashboards, decorative UI, or future features unless the prompt explicitly asks for them.

When in doubt, preserve simplicity, security, correctness, auditability, and maintainability.

## Product Context

The app replaces a real Excel-based shipping note workflow. Users manually enter shipping note data, store it in PostgreSQL, export Excel/PDF, and upload/export artifacts to Google Drive.

Core roles:
- Sale: create and edit assigned shipping notes; no access to accounting-sensitive data unless explicitly allowed.
- Accountant: view shipping notes, review amounts, tax configuration, reports; cannot create shipping notes unless explicitly allowed.
- Admin: full access, including user/role management and destructive actions.

Sensitive data includes buying rates, profit, tax details, audit logs, user accounts, and exported financial documents.

## Non-Negotiable Engineering Rules

1. Use TypeScript strictly. Avoid `any` unless justified in a comment.
2. Validate all external input on the server using Zod or equivalent schema validation.
3. Enforce authorization on the server. Hiding UI is not security.
4. Never expose buying rates, net profit, tax configuration, or audit logs to unauthorized roles.
5. Do not create fake production credentials, fake connection strings, or fake secrets.
6. Do not hardcode business-critical formulas in scattered UI components. Put business logic in a dedicated server/core layer.
7. Do not store accounting data only as unstructured JSON if it must be queried, filtered, reported, or audited.
8. Prefer simple relational tables for shipping notes, parties, charges, exports, audit logs, users, and roles.
9. Every mutation that changes important business data must be auditable.
10. Destructive actions should be soft-delete by default unless explicitly requested.
11. Keep UI desktop-first, data-entry-first, and back-office-oriented. Do not build a marketing-style UI.
12. Do not add animations, gradients, landing pages, or visual polish that does not improve business workflow.
13. Keep dependencies minimal. Add a dependency only when it clearly reduces risk or complexity.
14. Each phase must end with a concise implementation report, changed files list, tests run, and known risks.

## Preferred Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Drizzle ORM
- Neon PostgreSQL
- Better Auth or Auth.js, depending on implementation fit
- TanStack Table for complex tables
- ExcelJS for Excel export when needed
- PDF generation should remain minimal until the export phase is explicitly started

## File and Folder Discipline

Use clear boundaries:

```txt
src/
  app/
  components/
  features/
  lib/
    auth/
    db/
    permissions/
    validators/
    audit/
    calculations/
  server/
  styles/
drizzle/
docs/
```

Avoid dumping business logic into page components.

## Reporting Format Required After Every Task

Return:

1. Summary
2. Files changed
3. What was implemented
4. What was intentionally not implemented
5. Security/RBAC considerations
6. Tests/checks run
7. Known risks or open questions
8. Suggested next phase

## Stop Conditions

Stop and report instead of guessing if:
- The requested change requires production credentials.
- A business rule is ambiguous and would affect accounting, tax, profit, or authorization.
- The change would require a major architecture decision outside the current phase.
- A migration could destroy or rewrite existing data.
