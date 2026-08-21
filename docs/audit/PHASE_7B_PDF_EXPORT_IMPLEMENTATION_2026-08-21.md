# Phase 7B PDF Export Implementation

## A. Starting State

- Branch: `feature/ui-overhaul`.
- HEAD at start: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`.
- Working tree: dirty before Phase 7B with pre-existing Phase 6/7 tracked and untracked files.
- Preservation: no reset, checkout, clean, stash, revert, amend, migration application, or mass formatting was performed.
- Optional handbook `docs/PROJECT_OVERVIEW_UNIWAVE_GO_FREIGHT_VI_2026-08-14.md`: absent, so it was not recreated.

## B. Dependency Compatibility Verification

- Node version: `v20.14.0`.
- npm version: `10.8.1`.
- Installed app versions from `npm ls react react-dom next`: React `19.2.4`, React DOM `19.2.4`, Next.js `16.2.9`.
- Registry check for `@react-pdf/renderer`: latest installed version `4.6.1`.
- Peer dependency result: `@react-pdf/renderer@4.6.1` declares `react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`, so React 19 is accepted.
- Engines result: no `@react-pdf/renderer` engine restriction was reported by `npm view`.
- Installation result: normal npm install, no `--force`, no `--legacy-peer-deps`, no React/Next downgrade.
- ESM considerations: PDF generation uses normal TypeScript ES imports and React-PDF's Node `renderToBuffer` API; no CommonJS compatibility hack was added.
- Install warnings: npm emitted pre-existing/transitive `EBADENGINE` warnings for packages requiring newer Node than `20.14.0` (`@noble/ciphers`, `@noble/hashes`, `eslint-visitor-keys`, `kysely`). Dependency resolution still completed normally and validation passed.

## C. PDF Artifact Contract

- Export type: `pdf`.
- `shipping_note_exports.version`: `1`.
- Layout identifier: `internal-pdf-v1`.
- MIME: `application/pdf`.
- Eligible statuses: `checked`, `approved`, `locked`.
- Denied statuses: `draft`, `submitted`, `accounting_reviewing`, `cancelled`, `exported`.
- Permission: `SHIPPING_NOTES_EXPORT_INTERNAL`.
- Business status behavior: PDF generation never mutates `shipping_notes.status` and never creates an operational `exported` transition.

## D. Unicode Font Contract

- Font family: Noto Sans.
- Weights: Regular and Bold.
- Runtime asset paths:
  - `assets/fonts/noto-sans/NotoSans-Regular.ttf`
  - `assets/fonts/noto-sans/NotoSans-Bold.ttf`
- License/provenance:
  - Source repository: `https://github.com/notofonts/noto-fonts`
  - Source paths: `hinted/ttf/NotoSans/NotoSans-Regular.ttf`, `hinted/ttf/NotoSans/NotoSans-Bold.ttf`
  - License: SIL Open Font License 1.1 copied to `assets/fonts/noto-sans/OFL-1.1-LICENSE.txt`
  - Provenance note: `assets/fonts/noto-sans/README.md`
- Tracing: `next.config.ts` includes only these two font files for the internal PDF route.
- Runtime remote resources: none.

## E. Shared Read Model

PDF uses the existing canonical internal export data path:

- `getInternalShippingNoteExportDataForUser(...)`
- `InternalShippingNoteExportDto`
- `buildInternalExportSections(...)`

No PDF-specific accounting query was added. PDF generation does not duplicate financial calculations, VAT calculations, tax completeness logic, current tax-rule lookup, or summary logic.

## F. PDF Content / Layout

The PDF V1 document renders:

- Internal header: Uniwave Go Freight, Internal Shipping Note, Jobsheet No, status, generated timestamp, layout identifier.
- Shipment fields from the export DTO.
- Selling charges with charge metadata, base excluding VAT, stored tax rule/treatment, VAT percent, VAT amount, and total including VAT.
- Buying charges with the same accounting semantics plus Vendor/Agent when present.
- Stored override indication and exact persisted override reason.
- Canonical summary: selling subtotal excluding VAT, selling VAT, selling total including VAT, buying subtotal excluding VAT, buying VAT, buying total including VAT, and gross profit excluding VAT.
- A4 portrait layout with stacked line-item blocks that flow across pages instead of inheriting XLSX fixed row capacity.

## G. Generator Architecture

- Generator file: `src/features/shipping-notes/export/pdf/generator.tsx`.
- Document file: `src/features/shipping-notes/export/pdf/document.tsx`.
- Server-only generation: `import "server-only"` in the generator.
- React-PDF Node API: `renderToBuffer`.
- Output: `Buffer`, filename, SHA-256 checksum, and layout version.
- Temporary files: none.

## H. Persistence Lifecycle

PDF uses the existing `shipping_note_exports` table:

- Pending: `exportType = pdf`, `version = 1`, `status = pending`, safe filename, generated actor.
- Generated: `status = generated`, version remains `1`, checksum is SHA-256 of exact bytes, `generatedAt` set, error cleared.
- Failed: `status = failed`, version remains `1`, checksum cleared, sanitized error code persisted.
- Transaction boundary: PDF render occurs outside DB transaction; generated/failed status update and audit write occur together in one transaction.
- Pending crash gap: unchanged and deferred.

## I. Audit Contract

Generated PDF audit action:

```text
shipping_note.export.pdf.generated
```

Failed PDF audit action:

```text
shipping_note.export.pdf.failed
```

Generated audit metadata includes export ID, format, metadata version, layout version, filename, checksum, generated timestamp, selling charge count, and buying charge count. Raw PDF bytes are not logged.

## J. HTTP Contract

- Route: `POST /api/shipping-notes/[id]/exports/internal-pdf`.
- Runtime: `nodejs`.
- Dynamic: `force-dynamic`.
- Security order: same-origin request metadata, current session, canonical internal export query, permission/status gate, pending export record, server PDF render, generated/failed lifecycle, safe response.
- Success headers: `Content-Type: application/pdf`, safe `Content-Disposition`, `Content-Length`, `X-Pdf-Layout-Version`, private no-store cache headers, `X-Content-Type-Options: nosniff`.
- Error response: sanitized export error code JSON.

## K. RBAC / Status Eligibility

| Role | Checked | Approved | Locked | Reviewing/Cancelled/Exported |
| --- | --- | --- | --- | --- |
| Sale | Denied | Denied | Denied | Denied |
| Accountant | Allowed | Allowed | Allowed | Denied |
| Admin | Allowed | Allowed | Allowed | Denied |

The UI mirrors this with internal export controls only when the current user has `SHIPPING_NOTES_EXPORT_INTERNAL` and the status is canonically eligible. The server route remains authoritative.

## L. Historical Reproducibility

- PDF uses persisted charge snapshots: `taxRuleCodeSnapshot`, `taxRuleNameSnapshot`, `taxTreatmentSnapshot`, `vatPercent`, `vatAmount`, `isOverride`, and `overrideReason`.
- PDF does not query current `tax_rules`.
- Legacy missing rule identity follows existing export semantics and displays as `Unclassified`.
- Reopen to `accounting_reviewing` denies new PDF export through the shared status policy until re-check.
- Cancellation denies new PDF export while preserving historical export records.
- PDF generation does not rewrite XLSX records or historical PDF records.

## M. Tests

Added/updated unit and pure tests:

- `src/features/shipping-notes/export/pdf/generator.test.ts`
  - Real `%PDF` bytes and minimum size.
  - PDF filename.
  - SHA-256 checksum format.
  - Extracted accounting/tax/override content.
  - Vietnamese Unicode extraction.
  - Multi-page fixture and late-row/summary extraction.
- `src/features/shipping-notes/export/mutations.test.ts`
  - PDF metadata version `1`, layout `internal-pdf-v1`, MIME `application/pdf`.
  - Pending/generated/failed PDF persistence values use `exportType = pdf` and version `1`.
- `src/features/shipping-notes/export/filename.test.ts`
  - Deterministic `.pdf` filename using the existing sanitizer and UTC timestamp.
- `src/next-config.test.ts`
  - Route-specific tracing for exact XLSX template and exact PDF font files.

Integration tests extended but not executed:

- PDF generated export record persistence.
- PDF failed export record persistence.
- PDF audit actions.
- Shipping Note status preservation after PDF export persistence.
- Explicit `exported` status denial through the canonical internal export query.

## N. Validation

| Command | Result |
| --- | --- |
| Focused PDF/export tests | PASS - 5 files / 27 tests |
| `npm test` | PASS - 18 files / 90 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED - current conversation did not authorize configured `DATABASE_URL` as test/staging |
| `npm run test:all` | SKIPPED - includes live DB integration and current DB authorization was not provided |

Sandbox note: npm commands were run outside the sandbox because npm fails inside this Windows sandbox with `EPERM: operation not permitted, lstat 'C:\Users\Admin'`.

Manual artifact note: no sample PDF was committed. Automated PDF generation plus parser extraction verified validity, Unicode text, accounting content, and multi-page output.

## O. Migration State

- New migration created: no.
- Migration `drizzle/0003_hard_titania.sql` applied in this conversation: no.
- Reason: existing schema already represents `exportType = pdf`, version, status, filename, checksum, generated actor/time, failed error, and future Drive fields.

## P. next.config.ts

Changed.

Existing XLSX tracing remained unchanged:

```ts
"/api/shipping-notes/[id]/exports/internal-xlsx": [
  "./assets/export-templates/shipping-note/internal-v2.xlsx",
]
```

Added route-specific PDF font tracing:

```ts
"/api/shipping-notes/[id]/exports/internal-pdf": [
  "./assets/fonts/noto-sans/NotoSans-Regular.ttf",
  "./assets/fonts/noto-sans/NotoSans-Bold.ttf",
]
```

Scope/security assessment: the include is limited to one route and two font files. It does not include repository-wide assets, secrets, `.env` files, tests, docs, or arbitrary source files.

## Q. Files Changed

Pre-existing dirty files were present before Phase 7B and preserved. Phase 7B intentionally changed or added:

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `assets/fonts/noto-sans/NotoSans-Regular.ttf`
- `assets/fonts/noto-sans/NotoSans-Bold.ttf`
- `assets/fonts/noto-sans/OFL-1.1-LICENSE.txt`
- `assets/fonts/noto-sans/README.md`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/app/api/shipping-notes/[id]/exports/internal-pdf/route.ts`
- `src/features/shipping-notes/components/internal-export-actions.tsx`
- `src/features/shipping-notes/export/constants.ts`
- `src/features/shipping-notes/export/filename.ts`
- `src/features/shipping-notes/export/filename.test.ts`
- `src/features/shipping-notes/export/mutations.ts`
- `src/features/shipping-notes/export/mutations.test.ts`
- `src/features/shipping-notes/export/pdf/document.tsx`
- `src/features/shipping-notes/export/pdf/generator.tsx`
- `src/features/shipping-notes/export/pdf/generator.test.ts`
- `src/next-config.test.ts`
- `src/types/pdf-parse-lib.d.ts`
- `tests/integration/accounting-export-audit.integration.test.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/audit/PHASE_7B_PDF_EXPORT_IMPLEMENTATION_2026-08-21.md`

## R. Deferred Gaps

- Google Drive upload.
- Pending export recovery/reconciliation.
- Browser E2E for PDF download UX.
- Better Auth live HTTP/session E2E.
- PDF logo/branding.
- Background worker/queue if exports become too heavy for request path.

## S. Final Verdict

READY FOR LEAD REVIEW
