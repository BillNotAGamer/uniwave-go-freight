# Phase 7A Tax Export Implementation - 2026-08-09

## A. Starting State

- Branch: `feature/ui-overhaul`
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`
- Working tree: dirty before Phase 7A implementation.

Pre-existing modified files recorded before implementation:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/SHIPPING_NOTE_QA.md`
- `docs/TESTING.md`
- `docs/VAT_TAX_IMPLEMENTATION.md`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/components/shell/nav-links.ts`
- `src/features/shipping-notes/components/accounting-review-controls.tsx`
- `src/features/shipping-notes/components/financial-summary.tsx`
- `tests/integration/tax-domain.integration.test.ts`

Pre-existing untracked files recorded before implementation:

- `docs/audit/CURRENT_STATE_REAUDIT_2026-08-09.md`
- `src/app/(dashboard)/tax-rules/page.tsx`
- `src/features/shipping-notes/tax/actions.ts`
- `src/features/shipping-notes/tax/components/accounting-tax-charge-table.tsx`
- `src/features/shipping-notes/tax/components/tax-completeness-panel.tsx`
- `src/features/shipping-notes/tax/ui-policy.test.ts`
- `src/features/shipping-notes/tax/ui-policy.ts`
- `src/features/tax-rules/actions.ts`
- `src/features/tax-rules/components/tax-rules-table.tsx`

## B. Implementation Summary

Phase 7A extends the checked-note internal accounting export to carry and render persisted VAT/tax snapshots. The export read model now includes stored tax rule identity, treatment, VAT percent, VAT amount, total including VAT, override flag, and override reason for active selling and buying charges.

The XLSX path now uses an immutable V2 template. The original `internal-v1.xlsx` is preserved, and new exports use `internal-v2.xlsx` with a pinned hash. The original `AK` worksheet is left intact and a dedicated `Tax Details` worksheet carries the V2 tax mapping.

The internal print HTML now displays the same tax semantics as XLSX V2 without adding a parallel data path or client-side accounting fetch.

## C. Export Contract

- Base amount: stored charge `amountVnd`, tax-exclusive.
- VAT percent: stored charge `vatPercent`.
- VAT amount: stored charge `vatAmount`; exported as the persisted historical amount.
- Tax treatment: stored `taxTreatmentSnapshot`, displayed as `Taxable`, `Zero-rated`, or `Non-taxable`.
- Tax rule identity: stored code/name snapshots; missing identity is displayed as `Unclassified`.
- Total including VAT: `amountVnd + vatAmount`, derived from persisted charge values by the canonical calculation helper.
- Gross profit: tax-exclusive selling subtotal minus tax-exclusive buying subtotal, using the canonical financial summary helper.

## D. XLSX V2 Mapping

- Template file: `assets/export-templates/shipping-note/internal-v2.xlsx`
- Template version: `internal-v2`
- Pinned SHA-256: `CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57`
- Historical template preserved: `assets/export-templates/shipping-note/internal-v1.xlsx`

| Business Field | Worksheet | Cell/Column/Row Range | Source Field | Notes |
| --- | --- | --- | --- | --- |
| Existing official internal export layout | `AK` | Existing mapped cells and rows | Existing internal export DTO fields | Preserved from V1. |
| Selling tax detail rows | `Tax Details` | Rows `4:11` | `sellingCharges[]` | One active selling charge per row; over-capacity remains an explicit export failure. |
| Buying tax detail rows | `Tax Details` | Rows `15:25` | `buyingCharges[]` | One active buying charge per row; over-capacity remains an explicit export failure. |
| Charge section | `Tax Details` | Column `A` | charge section | Displays `Selling` or `Buying`. |
| Charge name | `Tax Details` | Column `B` | `name` | Stored charge name. |
| Tax rule | `Tax Details` | Column `C` | `taxRuleCodeSnapshot`, `taxRuleNameSnapshot` | Uses stored snapshots only; missing identity displays `Unclassified`. |
| Tax treatment | `Tax Details` | Column `D` | `taxTreatmentSnapshot` | Stable human-readable treatment label. |
| Base excl. VAT | `Tax Details` | Column `E` | `amountVnd` | Stored tax-exclusive base amount. |
| VAT percent | `Tax Details` | Column `F` | `vatPercent` | Stored charge VAT percent. |
| VAT amount | `Tax Details` | Column `G` | `vatAmount` | Stored charge VAT amount. |
| Total incl. VAT | `Tax Details` | Column `H` | `totalIncludingVatVnd` | Derived from stored base plus stored VAT. |
| Override flag | `Tax Details` | Column `I` | `isOverride` | Indicates overridden VAT lines. |
| Override reason | `Tax Details` | Column `J` | `overrideReason` | Exact stored reason; no audit internals exposed. |
| Selling subtotal excl. VAT | `Tax Details` | `B28` | `summary.sellingSubtotalExcludingVatVnd` | Canonical summary. |
| Selling VAT | `Tax Details` | `B29` | `summary.sellingVatVnd` | Sum of persisted line VAT. |
| Selling total incl. VAT | `Tax Details` | `B30` | `summary.sellingTotalIncludingVatVnd` | Canonical summary. |
| Buying subtotal excl. VAT | `Tax Details` | `B31` | `summary.buyingSubtotalExcludingVatVnd` | Canonical summary. |
| Buying VAT | `Tax Details` | `B32` | `summary.buyingVatVnd` | Sum of persisted line VAT. |
| Buying total incl. VAT | `Tax Details` | `B33` | `summary.buyingTotalIncludingVatVnd` | Canonical summary. |
| Gross profit excl. VAT | `Tax Details` | `B34` | `summary.grossProfitExcludingVatVnd` | VAT-exclusive profit. |

## E. Print Mapping

The internal print charge tables now include:

- Base amount excluding VAT.
- Stored tax rule and treatment.
- VAT percent.
- VAT amount.
- Total including VAT.
- Override flag and exact stored override reason.

The print summaries now include:

- Selling subtotal excluding VAT.
- Selling VAT.
- Selling total including VAT.
- Buying subtotal excluding VAT.
- Buying VAT.
- Buying total including VAT.
- Gross profit excluding VAT.

## F. Security/RBAC Verification

The implementation preserves the existing internal export query boundary. Internal export remains available only through the server-side checked-note export path for roles already authorized by `SHIPPING_NOTES_EXPORT_INTERNAL`.

No sale-facing export DTO was added. Sale users still cannot receive buying charges, vendor costs, net profit, tax snapshots, override metadata, tax summaries, or internal accounting export artifacts.

## G. Historical Reproducibility

Export data is built from persisted charge-level snapshots:

- `taxRuleCodeSnapshot`
- `taxRuleNameSnapshot`
- `taxTreatmentSnapshot`
- `vatPercent`
- `vatAmount`
- `isOverride`
- `overrideReason`

The export read model does not query live `tax_rules` rows. A later tax-rule edit or deactivation cannot change the meaning of a previously checked shipping note export. Legacy checked records with incomplete snapshots are not backfilled during export; missing rule identity is rendered as `Unclassified`.

## H. Tests Added

- `src/features/shipping-notes/export/read-model.test.ts`
  - Verifies taxable, zero-rated, non-taxable, and overridden charge rows.
  - Verifies persisted VAT amounts and totals including VAT.
  - Verifies canonical selling/buying VAT summaries and gross profit excluding VAT.
  - Verifies legacy incomplete snapshot behavior without live tax-rule lookup.

- `src/features/shipping-notes/export/generator.test.ts`
  - Verifies the V2 template path/version/hash contract.
  - Generates a real workbook from deterministic in-memory export data.
  - Reopens the generated workbook and asserts exact `Tax Details` worksheet cells for selling base, VAT percent, VAT amount, total including VAT, buying VAT, VAT totals, totals including VAT, gross profit excluding VAT, tax rule display, treatment display, and override metadata.

- `src/features/shipping-notes/export/filename.test.ts`
  - Existing fixture updated to satisfy the expanded internal export summary type.

## I. Validation

| Command | Result |
| --- | --- |
| `npm test` | PASS - 15 files / 69 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED - current turn did not explicitly authorize the configured `DATABASE_URL` as test/staging |
| `npm run test:all` | SKIPPED - includes live DB integration and current DB authorization was not provided |

The first sandboxed attempts for `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` failed with `EPERM: operation not permitted, lstat 'C:\Users\Admin'`. Each required command was rerun outside the sandbox and passed.

## J. Files Changed

Pre-existing modified files:

- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/SHIPPING_NOTE_QA.md`
- `docs/TESTING.md`
- `docs/VAT_TAX_IMPLEMENTATION.md`
- `src/app/(dashboard)/shipping-notes/[id]/page.tsx`
- `src/components/shell/nav-links.ts`
- `src/features/shipping-notes/components/accounting-review-controls.tsx`
- `src/features/shipping-notes/components/financial-summary.tsx`
- `tests/integration/tax-domain.integration.test.ts`

Pre-existing untracked files:

- `docs/audit/CURRENT_STATE_REAUDIT_2026-08-09.md`
- `src/app/(dashboard)/tax-rules/page.tsx`
- `src/features/shipping-notes/tax/actions.ts`
- `src/features/shipping-notes/tax/components/accounting-tax-charge-table.tsx`
- `src/features/shipping-notes/tax/components/tax-completeness-panel.tsx`
- `src/features/shipping-notes/tax/ui-policy.test.ts`
- `src/features/shipping-notes/tax/ui-policy.ts`
- `src/features/tax-rules/actions.ts`
- `src/features/tax-rules/components/tax-rules-table.tsx`

Files changed by Phase 7A:

- `next.config.ts`
- `src/app/(print)/shipping-notes/[id]/print/internal/internal-print.module.css`
- `src/app/(print)/shipping-notes/[id]/print/internal/page.tsx`
- `src/features/shipping-notes/export/constants.ts`
- `src/features/shipping-notes/export/filename.test.ts`
- `src/features/shipping-notes/export/generator.ts`
- `src/features/shipping-notes/export/queries.ts`
- `src/features/shipping-notes/export/types.ts`
- `docs/BUILD_PHASES.md`
- `docs/CURRENT_IMPLEMENTATION_STATUS.md`
- `docs/QA_CHECKLIST.md`
- `docs/TESTING.md`
- `docs/VAT_TAX_IMPLEMENTATION.md`

Files created by Phase 7A:

- `assets/export-templates/shipping-note/internal-v2.xlsx`
- `src/features/shipping-notes/export/read-model.ts`
- `src/features/shipping-notes/export/read-model.test.ts`
- `src/features/shipping-notes/export/generator.test.ts`
- `docs/audit/PHASE_7A_TAX_EXPORT_IMPLEMENTATION_2026-08-09.md`

## K. Remaining Gaps

- Generated PDF export remains unimplemented.
- Google Drive upload remains unimplemented.
- Post-checked approve/export/lock/cancel workflow remains unimplemented.
- Browser E2E remains missing.
- Better Auth HTTP/session E2E remains missing.
- Pending-export crash recovery remains deferred.
- Admin user management remains incomplete.
- Audit-log viewer remains unimplemented.
- Hosted DB integration was not executed for this phase because current database authorization was absent.

## L. Final Verdict

READY FOR LEAD REVIEW

Phase 7A implementation is complete within scope: persisted VAT/tax snapshots flow through the checked-note internal export read model, XLSX V2 is versioned and hash-pinned, internal print HTML is tax-complete, focused workbook/read-model tests pass, and required local validation passes. Remaining gaps are outside the Phase 7A scope.

## Phase 7A Closure Review

### A. next.config.ts Exact Change

`next.config.ts` already contains a route-specific `outputFileTracingIncludes` entry for the internal XLSX export API route:

```ts
outputFileTracingIncludes: {
  "/api/shipping-notes/[id]/exports/internal-xlsx": [
    "./assets/export-templates/shipping-note/internal-v2.xlsx",
  ],
}
```

The Phase 7A change replaced the prior `internal-v1.xlsx` include with `internal-v2.xlsx`. No additional route behavior, build behavior, environment handling, or global tracing rule was added.

### B. Why It Is Required

The XLSX generator reads the pinned template from `assets/export-templates/shipping-note/internal-v2.xlsx` at runtime. Next.js standalone/server deployments rely on file tracing to include non-imported runtime assets. This include exists so the production internal XLSX route can read the V2 workbook template after deployment.

### C. Tracing/Include Scope and Security Assessment

The include is narrowly scoped to one route and one file:

- Route: `/api/shipping-notes/[id]/exports/internal-xlsx`
- Included asset: `./assets/export-templates/shipping-note/internal-v2.xlsx`

It does not include a directory wildcard and cannot unintentionally bundle unrelated assets, secrets, `.env` files, arbitrary repository files, tests, documentation, or other unnecessary content. No config patch was required.

### D. Export Record Version Semantics

`shipping_note_exports.version` is the persisted internal export artifact metadata version. It is separate from:

- the template identifier, `INTERNAL_XLSX_TEMPLATE_VERSION`
- the pinned workbook SHA-256, `INTERNAL_XLSX_TEMPLATE_SHA256`

The export persistence path writes the artifact version during pending record creation and again during generated/failed updates through `INTERNAL_XLSX_METADATA_VERSION`.

### E. V1 Persisted Version

Historical V1 internal XLSX exports used:

- `INTERNAL_XLSX_METADATA_VERSION = 1`
- `INTERNAL_XLSX_TEMPLATE_VERSION = "internal-v1"`
- template hash `57B04720F08D543DB1622865EA3A70508AD60841521FAF6723C08F5939143426`

This was verified from `git show HEAD:src/features/shipping-notes/export/constants.ts` before the Phase 7A working-tree changes.

### F. V2 Persisted Version

New Phase 7A internal XLSX exports persist:

- `shipping_note_exports.version = 2`

The value is written for pending, generated, and failed internal XLSX export records. Historical export records are not rewritten.

### G. Template Identifier

The current template identifier is:

- `internal-v2`

This identifier is returned in the generated response metadata and included in export audit snapshots. It is not the same field as `shipping_note_exports.version`.

### H. Pinned Template SHA-256

The current pinned V2 template SHA-256 is:

```text
CFC150C44E49A368433D6295BE6FB2F70876139F8A7A70D0FE97963076284E57
```

### I. Tests Added/Changed

Added:

- `src/next-config.test.ts`
  - Verifies the production trace include is scoped to exactly the internal XLSX V2 template for the export route.
- `src/features/shipping-notes/export/mutations.test.ts`
  - Verifies metadata version `2`, template identifier `internal-v2`, and pinned V2 hash.
  - Verifies pending export record values persist version `2`.
  - Verifies generated and failed export updates keep version `2`.

Changed:

- `src/features/shipping-notes/export/mutations.ts`
  - Extracted small pure value builders used by the existing insert/update calls so export version persistence is directly testable without a live database.

Existing retained coverage:

- `src/features/shipping-notes/export/generator.test.ts`
  - Verifies the V2 template hash and workbook cell mapping.

### J. Validation Results

| Command | Result |
| --- | --- |
| Focused closure tests | PASS - 3 files / 6 tests |
| `npm test` | PASS - 17 files / 73 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:integration` | SKIPPED - current turn did not explicitly authorize the configured `DATABASE_URL` as test/staging |
| `npm run test:all` | SKIPPED - includes live DB integration and current DB authorization was not provided |

Sandboxed attempts for `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` failed with `EPERM: operation not permitted, lstat 'C:\Users\Admin'`. Each required command was rerun outside the sandbox and passed.

### K. Files Changed By This Closure Patch

- `src/features/shipping-notes/export/mutations.ts`
- `src/features/shipping-notes/export/mutations.test.ts`
- `src/next-config.test.ts`
- `docs/audit/PHASE_7A_TAX_EXPORT_IMPLEMENTATION_2026-08-09.md`

`next.config.ts` was verified only and was not changed by this closure patch.

### L. Migration Status

No migration was created.

### M. Final Closure Verdict

PHASE 7A CLOSED
