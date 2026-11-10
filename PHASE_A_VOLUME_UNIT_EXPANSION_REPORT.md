# Phase A — Volume Unit Expansion Report

## Baseline

- Branch: `feature/customer-volume-sale-financial`
- Parent commit: `dff107eebf571ae71dd186c1f36561db1a518085`
- Existing migration history: `0000` through `0022`
- New migration: `0023_expand_volume_units.sql`

## Implementation

The shared `volume_unit` domain now preserves the five historical values and adds:

| Stored value | User label |
| --- | --- |
| `carton` | Carton |
| `pallet` | Pallet |
| `packages` | Packages |
| `bales` | Bales |
| `rolls` | Rolls |

The shared selector is used by both create and draft-edit forms, including Sea and Air Shipping Notes. Detail, internal print, XLSX and PDF presentation use the same label resolver. Duplication retains the stored value unchanged.

## Migration design

- Additive PostgreSQL `ALTER TYPE ... ADD VALUE` statements only.
- No enum recreation, data rewrite, monetary change or removal of historical labels.
- SQL SHA-256: `1DE238CF05D8EEF12A8BE4C2117CDC8416EB3C3263F36CE781BB4AF7383F48AB`
- Snapshot SHA-256: `D73EC5AAB02207FA256BCFB26F595151895FA793895160361F1FF654F0AAEF29`
- PostgreSQL caveat: a newly added enum value cannot safely be consumed by later statements in the same transaction before the enum change commits. Migration 0023 only adds values and performs no dependent inserts or updates.

## Verification

- Focused Vitest: **139/139 passed** across validators, genuine server-rendered selectors, duplication, detail rendering, XLSX and PDF.
- Focused ESLint: **passed**.
- `git diff --check`: **passed**.
- Isolated PostgreSQL 18 cluster:
  - Host/port: loopback `127.0.0.1:55439`
  - Database: `uniwave_phase_ab`
  - System identifier: `7706690209855810012` (different from the protected QA identifier)
  - All migrations `0000`–`0023` applied to the disposable database.
  - Enum order and all ten labels verified.
  - Sea and Air inserts, reload, and update using the new values verified.
  - Unsupported `crate` value rejected by PostgreSQL.
- Repository-wide typecheck is pending clean tracked-source validation because unrelated untracked historical `scratch/*.ts` files currently fail compilation. Those files were not modified.

## Changed files

- `drizzle/0023_expand_volume_units.sql`
- `drizzle/meta/0023_snapshot.json`
- `drizzle/meta/_journal.json`
- `src/lib/db/schema.ts`
- `src/features/shipping-notes/constants.ts`
- `src/features/shipping-notes/validators.test.ts`
- `src/features/shipping-notes/components/shipping-note-create-form.tsx`
- `src/features/shipping-notes/components/shipping-note-draft-fields.tsx`
- `src/features/shipping-notes/components/shipping-note-draft-fields.test.ts`
- `src/features/shipping-notes/duplication.test.ts`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/app/(dashboard)/shipping-notes/[id]/page.test.ts`
- `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`
- `src/features/shipping-notes/export/generator.ts`
- `src/features/shipping-notes/export/generator.test.ts`
- `src/features/shipping-notes/export/pdf/document.tsx`
- `src/features/shipping-notes/export/pdf/generator.test.ts`

## Deployment prerequisite and risk

Migration 0023 must be applied through the guarded migration process before deploying code that can persist the new values. It was **not** applied to production. Existing Domestic and historical values remain unchanged. Full repository quality gates are recorded in the consolidated implementation summary after Phase B.
