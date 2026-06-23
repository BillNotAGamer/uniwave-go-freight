# Architecture Decisions

## ADR-001: Use Next.js as Full-Stack MVP Framework

Decision:
Use Next.js App Router with TypeScript for the MVP frontend and backend.

Reason:
- Fast development for solo fullstack developer.
- Easy deployment to Vercel.
- Good fit for internal CRUD workflows.
- Can later split worker/backend services if export/reporting becomes heavy.

## ADR-002: Use Neon PostgreSQL as Source of Truth

Decision:
Use Neon-hosted PostgreSQL as the primary database.

Reason:
- Fits serverless/Next.js deployment.
- Strong relational model for accounting/reporting/audit.
- Google Drive should store exported artifacts, not primary data.

## ADR-003: Prefer Drizzle ORM

Decision:
Prefer Drizzle ORM for schema and database access unless a later blocker justifies Prisma.

Reason:
- TypeScript-native.
- Lightweight.
- Explicit schema and SQL-friendly approach.
- Good fit for reporting-heavy business apps.

## ADR-004: Use shadcn/ui for UI

Decision:
Use shadcn/ui, Tailwind CSS, and Radix primitives.

Reason:
- Flexible and customizable.
- Avoids heavy enterprise UI lock-in.
- Good fit for custom document-entry forms.
- Suitable for desktop-first internal apps.

## ADR-005: Use Role-Based Access Control From the Beginning

Decision:
Implement server-side RBAC early.

Reason:
- Financial data is sensitive.
- Sale, accountant, and admin need different access.
- UI hiding alone is insufficient.

## ADR-006: Export and Google Drive Can Start Simple, Then Move to Worker

Decision:
Begin with simple export flow when the phase arrives. If export/PDF/Drive operations become heavy, move them to a background worker on Render/Railway.

Reason:
- Keeps MVP simple.
- Avoids premature service splitting.
- Leaves a clear path for scale.
