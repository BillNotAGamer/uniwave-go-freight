# Phase 7B PDF Export Audit

## A. Audit Metadata

- Audit date: 2026-08-14.
- Branch: `feature/ui-overhaul`.
- HEAD: `3b0ff2c841806ff0a6fe6b1b2d64c9fa83c30e8d`.
- Scope: audit-only architecture recommendation for generated internal PDF export.
- Source code changes: none.
- Artifact created by this audit: `docs/audit/PHASE_7B_PDF_EXPORT_AUDIT_2026-08-14.md`.
- Validation executed during this audit: repository inspection only. No `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:integration`, or `npm run test:all` was run.
- DB integration status: SKIPPED. Current conversation did not authorize the configured `DATABASE_URL` as test/staging.
- Optional document `docs/PROJECT_OVERVIEW_UNIWAVE_GO_FREIGHT_VI_2026-08-14.md`: not present.
- Working tree at audit start: dirty with pre-existing Phase 6/7 tracked and untracked files. These were preserved.

Finding labels used below: REPOSITORY-PROVEN, TEST-VERIFIED, DOCUMENTED-ONLY, INFERRED, DECISION REQUIRED, NOT IMPLEMENTED, STALE DOCUMENTATION.

## B. Executive Recommendation

Recommendation: implement Phase 7B as a server-side generated PDF binary using `@react-pdf/renderer`, backed by the existing authorized internal export read model and the existing `shipping_note_exports` table.

Recommended first PDF artifact contract:

- Export type: `pdf`.
- Export DB version: `1`.
- PDF layout identifier: `internal-pdf-v1`.
- Eligible statuses: `checked`, `approved`, `locked`.
- Denied statuses: `draft`, `submitted`, `accounting_reviewing`, `cancelled`, `exported`.
- Permission: reuse `SHIPPING_NOTES_EXPORT_INTERNAL`.
- Route: `POST /api/shipping-notes/[id]/exports/internal-pdf`.
- Runtime: Node.js route runtime, same as the current XLSX route.
- Business status mutation: none. PDF generation must not set `shipping_notes.status = exported`.
- Migration expectation: no migration.

This is the safest default because it avoids a browser executable, keeps generation server-side, produces a real PDF binary, can return `Buffer`/`Uint8Array` for future Drive upload, and keeps accounting/tax semantics in the existing export read model. The implementation must verify `@react-pdf/renderer` compatibility with the repository's current React/Next/Node versions before adding the dependency.

## C. Current Export Architecture

Current XLSX path is REPOSITORY-PROVEN:

```text
Shipping Note detail page
-> internal print link and internal export capability checks
-> POST /api/shipping-notes/[id]/exports/internal-xlsx
-> same-origin request metadata check
-> getCurrentSession()
-> getInternalShippingNoteExportDataForUser(noteId, user)
-> requirePermission(user.role, SHIPPING_NOTES_EXPORT_INTERNAL)
-> isInternalXlsxExportEligibleStatus(note.status)
-> buildInternalExportSections(...)
-> createPendingInternalXlsxExportRecord(...)
-> generateInternalShippingNoteXlsx(...)
-> markInternalXlsxExportGenerated(...) or markInternalXlsxExportFailed(...)
-> shipping_note.export.xlsx.generated/failed audit
-> binary HTTP response with no-store headers and safe Content-Disposition
```

Evidence:

- XLSX API route: `src/app/api/shipping-notes/[id]/exports/internal-xlsx/route.ts`.
- Export query/read model: `src/features/shipping-notes/export/queries.ts`, `src/features/shipping-notes/export/read-model.ts`, `src/features/shipping-notes/export/types.ts`.
- XLSX generator: `src/features/shipping-notes/export/generator.ts`.
- Export persistence: `src/features/shipping-notes/export/mutations.ts`.
- HTTP helpers: `src/features/shipping-notes/export/http.ts`.
- Filename helpers: `src/features/shipping-notes/export/filename.ts`.
- Export constants: `src/features/shipping-notes/export/constants.ts`.
- Status policy: `src/features/shipping-notes/status-policy.ts`.

Reusable for PDF:

- Session/auth pattern.
- Same-origin request metadata check.
- `SHIPPING_NOTES_EXPORT_INTERNAL` permission.
- Canonical internal export eligibility.
- `getInternalShippingNoteExportDataForUser`.
- `InternalShippingNoteExportDto`.
- Financial summary/tax snapshot read model.
- Filename sanitization and Content-Disposition helper.
- `shipping_note_exports` lifecycle concept.
- Audit helper and audit action naming pattern.

Format-specific for PDF:

- PDF constants, MIME type, layout version, generator, layout components, page-break behavior, PDF-specific export persistence wrappers, and route response headers.

## D. Current Print HTML vs Real PDF

Current print HTML is REPOSITORY-PROVEN but is not a generated PDF binary.

Existing print flow:

```text
/shipping-notes/[id]/print/internal
-> server-rendered HTML page
-> browser print dialog
-> user may choose Save as PDF
```

Required generated PDF flow:

```text
server-side authorized POST
-> deterministic PDF bytes
-> checksum over exact bytes
-> shipping_note_exports record
-> generated/failed lifecycle and audit
-> downloadable application/pdf artifact
```

The current print page reuses `getInternalShippingNoteExportDataForUser`, renders VAT/tax charge details and summaries, and sets noindex metadata. It does not persist an export row or return `application/pdf`.

Recommendation: keep print HTML. Generated PDF should be a separate artifact workflow, not a replacement for the browser print view.

## E. PDF Engine Options

| Option | Strengths | Weaknesses | Fit |
| --- | --- | --- | --- |
| HTML to headless Chromium / Playwright / Puppeteer | Can reuse browser-like layout and CSS; high-fidelity rendering. | Large binary/runtime, cold starts, deployment complexity, possible Vercel/serverless friction, sandbox/executable concerns, SSRF/external resource hardening if HTML loads assets. | Not recommended for MVP. |
| React-PDF / `@react-pdf/renderer` | Real server-side PDF; no browser executable; component model; deterministic layout primitives; outputs bytes usable by HTTP/Drive. | Separate layout from browser CSS; font registration must be deliberate; tables/page wrapping require care; package compatibility must be verified before implementation. | Recommended. |
| PDFKit or equivalent low-level generator | Deterministic; relatively direct Node output; smaller conceptual runtime than Chromium. | Manual table layout, page breaks, wrapping, headers, and typography; higher risk of duplicated presentation/calculation logic; harder long-term maintenance. | Acceptable fallback only if React-PDF compatibility blocks. |
| Client-side PDF generation | Easy to attach to UI in simple apps. | Sensitive data exposure risk, duplicated auth/calculation logic, nondeterministic artifacts, weak audit/checksum control. | Rejected. |

Security risk ranking by engine:

- Highest: HTML-to-Chromium if remote resource loading or unsanitized HTML is allowed.
- Medium: low-level PDFKit due to manual escaping/layout mistakes.
- Lowest practical fit: React-PDF with server-only data, local assets, and no remote fetches.

## F. Recommended PDF Engine

Choose exactly one strategy: `@react-pdf/renderer`.

Rationale:

- Matches Next.js server-side generation requirement without needing Chromium.
- Keeps accounting data on the server.
- Produces a real PDF binary for checksum, persistence, download, and future Drive upload.
- Avoids relying on manual browser print.
- Encourages a dedicated document component while reusing the shared export DTO.
- Fits current ADR-006: start simple in-process, move to worker later only if export work becomes heavy.

Implementation caveat: this audit did not use network access or install packages. Before implementation, verify the current `@react-pdf/renderer` release supports the repository's installed React `19.2.4`, Next `16.2.9`, Node runtime, and TypeScript configuration.

## G. Deployment / Runtime Compatibility

Repository facts:

- Next.js App Router is used.
- Current XLSX route declares `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
- `package.json` has no deployment target beyond Next scripts; ADR-001 says Vercel is a good fit, while ADR-006 allows moving heavy export work to a worker later.
- `next.config.ts` currently traces only `./assets/export-templates/shipping-note/internal-v2.xlsx` for the internal XLSX route.
- No PDF dependencies are installed.
- No deployment-specific worker or queue exists.

Recommendation:

- PDF route should explicitly use Node runtime.
- Do not use Edge runtime for PDF generation.
- React-PDF should need no external executable, unlike Chromium.
- If local font files are introduced, update output file tracing narrowly to include only the PDF font assets used by the PDF route.
- Do not use repository-wide tracing wildcards.

## H. Font / Unicode Strategy

Repository facts:

- No local font files were found by asset search.
- Existing print HTML uses browser-rendered text/CSS; no explicit bundled PDF-safe font exists.
- The product domain includes Vietnam/VND, and user-entered party names, destinations, tax names, and override reasons may contain Vietnamese Unicode.

Recommendation:

- Do not rely on PDF built-in Helvetica/Times/Courier for production PDF if Vietnamese text may appear.
- Add locally packaged open-source Unicode fonts during implementation, preferably Noto Sans or equivalent with license verification.
- Register the local font in the PDF generator and trace only the exact font files required by the PDF route.
- Do not fetch fonts from a CDN at generation time.
- Do not redistribute proprietary fonts.

Business decision required:

- Whether the PDF must match a specific corporate font or official visual identity.
- Whether Vietnamese text support is mandatory for all free-text fields. The safe default is yes.

## I. PDF Content Contract

Recommended internal PDF content contract:

Header:

- Uniwave Go Freight document title.
- Jobsheet No.
- MAWB / HAWB.
- Shipping mode.
- Shipper.
- Consignee.
- Customer.
- Agent.
- AOL.
- AOD / final destination.
- ETD and ETA.
- Volume and unit.
- Exchange rate.
- Shipping Note status.
- Generated timestamp.
- PDF layout identifier `internal-pdf-v1`.

Selling section:

- Charge name.
- Description.
- Quantity / unit.
- Unit price and currency.
- Exchange rate where useful.
- Base amount excluding VAT in VND.
- Stored tax rule/treatment.
- VAT percent.
- VAT amount.
- Total including VAT.
- Override indicator and override reason when present.

Buying section:

- Same accounting semantics as selling.
- Vendor/agent text.
- Buying data remains internal-only and must only be available through internal export authorization.

Summary:

- Selling subtotal excluding VAT.
- Selling VAT.
- Selling total including VAT.
- Buying subtotal excluding VAT.
- Buying VAT.
- Buying total including VAT.
- Gross profit excluding VAT.

Finalization metadata:

- Include status immediately.
- If the business requires checked/approved/locked actor/timestamp display, extend the shared internal export read model minimally. The current DTO does not include `checkedAt`, `checkedById`, `approvedAt`, `approvedById`, `lockedAt`, `lockedById`, or actor display names.
- Do not expose audit JSON in the PDF.

## J. Shared Export Read Model

The existing `InternalShippingNoteExportDto` is mostly sufficient for a Phase 7B internal PDF.

REPOSITORY-PROVEN fields already present:

- Shipping Note business fields.
- Status.
- Selling charges.
- Buying charges.
- Stored tax rule code/name snapshots.
- Stored tax treatment snapshot.
- Stored VAT percent.
- Stored VAT amount.
- Tax-inclusive line total derived from stored amount plus stored VAT.
- Override flag and override reason.
- Selling/buying VAT-aware summaries.
- Gross profit excluding VAT.

Gaps if finalization metadata is required:

- The DTO currently omits checked/approved/locked timestamps and actors.
- It also omits generated export history, which should not be needed inside the generated document beyond current generated timestamp and export metadata.

Recommendation:

- Reuse `getInternalShippingNoteExportDataForUser` as the canonical PDF data source.
- Do not create a parallel PDF accounting query.
- If finalization metadata becomes required, extend this shared read model rather than adding a PDF-only query.
- Consider renaming policy/helper names from `Xlsx` to `InternalExport` in a focused compatibility-safe cleanup only if implementation scope allows. Do not change behavior.

## K. Historical Tax Reproducibility

Hard invariant: generated PDF must use persisted charge-level snapshots:

```text
taxRuleCodeSnapshot
taxRuleNameSnapshot
taxTreatmentSnapshot
vatPercent
vatAmount
isOverride
overrideReason
```

It must never render historical charge tax by re-querying current `tax_rules`.

Evidence:

- `src/features/shipping-notes/export/queries.ts` selects snapshot fields directly from `shipping_note_charges`.
- `src/features/shipping-notes/export/read-model.ts` derives totals from those selected fields.
- `docs/VAT_TAX_IMPLEMENTATION.md` states Phase 7A export does not look up current live tax rules.
- Current XLSX tests cover persisted tax snapshots and legacy unclassified snapshots.

Policy:

- Later tax-rule edits must not change old generated PDF content.
- Legacy checked notes with null snapshots should display missing rule identity as unclassified, consistent with current export semantics.

## L. Export Record / Versioning Contract

Schema facts:

- `export_type` enum includes `excel` and `pdf`.
- `export_status` enum includes `pending`, `generated`, `uploaded`, and `failed`.
- `shipping_note_exports` includes `shippingNoteId`, `exportType`, `version`, `status`, `driveFileId`, `driveUrl`, `fileName`, `checksum`, `errorMessage`, `generatedById`, `generatedAt`, `createdAt`, and `updatedAt`.

Recommendation:

- Use the existing table without migration.
- Treat `shipping_note_exports.version` as format-specific artifact metadata version.
- XLSX current contract: `exportType = "excel"`, `version = 2`, template identifier `internal-v2`.
- PDF initial contract: `exportType = "pdf"`, `version = 1`, layout identifier `internal-pdf-v1`.
- Do not infer PDF version from XLSX version.
- Do not use `shipping_notes.status = exported`.
- Do not rewrite historical export records.

PDF layout identifier placement:

- Code constant: `INTERNAL_PDF_LAYOUT_VERSION = "internal-pdf-v1"`.
- Persist artifact version as `shipping_note_exports.version = 1`.
- Include layout identifier in audit snapshots and optionally an HTTP response header such as `X-Pdf-Layout-Version`.
- Do not add a new DB column solely for layout identifier in Phase 7B.

## M. Route / HTTP Contract

Recommended route:

```text
POST /api/shipping-notes/[id]/exports/internal-pdf
```

Recommended route contract:

- Runtime: `nodejs`.
- Dynamic: force dynamic/no cache.
- Check same-origin request metadata before session lookup, matching XLSX route behavior.
- Require current session.
- Use `getInternalShippingNoteExportDataForUser(noteId, currentSession.user)`.
- Require `SHIPPING_NOTES_EXPORT_INTERNAL` through the shared query.
- Deny non-eligible statuses through canonical status helper.
- Create a pending PDF export record.
- Generate PDF bytes server-side.
- Compute SHA-256 over exact bytes.
- Mark export generated in a DB transaction with audit.
- Return `application/pdf`.
- Return safe `Content-Disposition: attachment; filename="..."`.
- Return private no-store headers and `X-Content-Type-Options: nosniff`.
- On failure after pending insert, mark failed with sanitized error code and audit.
- Do not expose stack traces, SQL errors, file paths, or raw renderer errors to users.

Recommended MIME type:

```text
application/pdf
```

## N. RBAC / Status Eligibility

Current internal export eligibility is REPOSITORY-PROVEN:

```text
checked | approved | locked
```

Current permission model is REPOSITORY-PROVEN:

- Sale lacks `SHIPPING_NOTES_EXPORT_INTERNAL`.
- Accountant has `SHIPPING_NOTES_EXPORT_INTERNAL`.
- Admin has all permissions through centralized admin semantics.

Recommendation:

- Reuse `SHIPPING_NOTES_EXPORT_INTERNAL` for PDF.
- Do not add `SHIPPING_NOTES_EXPORT_PDF` unless product explicitly requires different format-level authorization later.
- PDF must be denied to Sale through server-side authorization.
- PDF must be denied for `draft`, `submitted`, `accounting_reviewing`, `cancelled`, and `exported`.
- After reopen to `accounting_reviewing`, new PDF generation is denied until the note is checked again.
- Historical PDF records remain untouched after reopen or cancellation.

## O. Layout / Pagination Strategy

PDF must not assume one page.

Recommended layout strategy:

- Use A4 portrait unless product supplies an official layout requiring landscape.
- Use repeated table headers when charges continue across pages.
- Keep each line item together where practical.
- Allow long descriptions, party names, and override reasons to wrap.
- Prevent summary rows from splitting awkwardly when possible.
- Render selling and buying as separate sections.
- Include a footer with generated timestamp/page number if React-PDF supports it cleanly.
- Use deterministic widths and text wrapping rather than browser CSS.
- Do not truncate accounting values silently. If a field must be constrained, wrap first and only truncate non-critical display metadata with clear tests.

Capacity contrast:

- XLSX currently has fixed template row limits.
- PDF should support multi-page charge lists and should not inherit XLSX fixed row capacity.

## P. Failure / Checksum / Filename Strategy

Failure lifecycle:

- Reuse `pending -> generated` and `pending -> failed`.
- Persist sanitized error codes in `errorMessage`.
- Audit `shipping_note.export.pdf.generated` and `shipping_note.export.pdf.failed`.
- Never mutate Shipping Note status.

Checksum:

- Use SHA-256, matching current XLSX strategy.
- Compute over the exact generated PDF bytes.
- Persist checksum before returning success.

Filename:

- Reuse `sanitizeFilenamePart` and UTC timestamp formatting.
- Recommended format:

```text
ShippingNote_<safe-jobsheet>_<YYYYMMDD-HHMMSS>.pdf
```

- Reuse `buildContentDisposition`.
- Do not accept a client-supplied filename.

## Q. Security Analysis

P0 risks to prevent:

- Sale access to buying charges, profit, tax snapshots, override reasons, or generated PDF route.
- Current `tax_rules` lookup changing historical PDF semantics.
- PDF generation mutating `shipping_notes.status`.

P1 risks:

- Deployment-incompatible engine if Chromium or an unsupported React-PDF version is chosen.
- Filename/header injection if Content-Disposition is hand-built.
- Remote asset/font fetching causing SSRF or nondeterministic output.
- Raw renderer errors leaking internals.

P2 risks:

- Non-Unicode fonts corrupting Vietnamese names or locations.
- Huge note/long-text inputs causing memory or layout failures.
- Stale pending records if the process exits between pending insert and generated/failed update.

Security recommendations:

- Server-side generation only.
- No remote fonts/images/CSS.
- No client-side sensitive DTO exposure.
- Use same-origin metadata checks for POST.
- Keep permission/status checks inside server query/service.
- Return sanitized error codes.
- Use no-store headers.
- Use a local font asset with license verification.

## R. Test Strategy

Pure unit tests:

- PDF constants: MIME type, layout version `internal-pdf-v1`, metadata version `1`.
- PDF filename uses the shared sanitizer and `.pdf` extension.
- Export eligibility remains exactly `checked`, `approved`, `locked`.
- PDF persistence value builders use `exportType = "pdf"` and `version = 1`.
- Layout adapter maps snapshot fields, override reasons, and summary values from `InternalShippingNoteExportDto`.
- Permission reuse is covered through existing role permission tests or a focused assertion.

Real PDF binary tests:

- Generate actual PDF bytes from a deterministic fixture.
- Assert `%PDF` signature.
- Parse page count where practical.
- Verify critical text/values are extractable: jobsheet, status, selected selling/buying rows, tax treatment, VAT percent, VAT amount, override reason, summary totals.
- Include a multi-page fixture with many selling/buying charges and long descriptions.
- Avoid byte-for-byte snapshots unless the chosen library proves deterministic across machines.

PDF parser dependency:

- A PDF parser is justified as a devDependency only, not a production dependency.
- Candidate parser must be selected during implementation after compatibility review with current Node/Vitest.

Integration tests, not run in this audit:

- Checked PDF eligibility.
- Approved PDF eligibility.
- Locked PDF eligibility.
- Reviewing denial after reopen.
- Cancelled denial.
- Sale denial.
- Accountant/Admin success.
- `pending -> generated` metadata.
- `pending -> failed` if a safe failure seam exists.
- PDF export record does not mutate Shipping Note status.
- Historical export records remain independent across reopen/cancel/re-export.

Browser E2E future scenario:

```text
authorized Accountant/Admin
-> open finalized note
-> click Export PDF
-> receive application/pdf download
```

Direct route access by Sale must remain denied.

## S. Google Drive Future Compatibility

Phase 8 is DOCUMENTED-ONLY / NOT IMPLEMENTED in current code.

Recommended separation:

```text
Phase 7B:
generate PDF bytes
-> persist export generated
-> return download

Future Phase 8:
existing generated artifact
-> upload bytes/file to Drive
-> update driveFileId/driveUrl/status
```

PDF generator output should be:

```text
Uint8Array or Buffer
fileName
mimeType = application/pdf
checksumSha256
layoutVersion
metadataVersion
```

Do not couple PDF generation directly to Google Drive.

## T. Migration Assessment

Recommendation: NO MIGRATION for Phase 7B.

Reasons:

- `export_type` already includes `pdf`.
- `shipping_note_exports.version` can store PDF artifact version `1`.
- `shipping_note_exports.status` already supports `pending`, `generated`, `failed`, and future `uploaded`.
- Existing `fileName`, `checksum`, `generatedById`, and `generatedAt` fields are sufficient.
- Drive fields already exist for future upload metadata.

No schema field is essential for first generated internal PDF. If finalization actor names are required inside PDF content, that is a read-model/query extension, not a schema migration.

## U. Pending Export Crash Gap

Current XLSX behavior has a known gap: if the process exits after creating a pending export row but before marking generated or failed, the row can remain pending.

Recommendation for Phase 7B:

- Reuse the current behavior for parity.
- Do not introduce a background queue solely for PDF in Phase 7B.
- Do not block PDF implementation on pending-row recovery.
- Record this as a P2 operational hardening item.

Future hardening:

- Add a format-neutral stale-pending reconciliation job or admin-visible recovery action once export volume and operations need it.
- Consider moving heavy generation/upload to a worker only if PDF generation time or Drive upload latency exceeds request-path tolerance.

## V. Decision Register

| Decision | Options | Evidence | Recommendation | Business decision required? |
| --- | --- | --- | --- | --- |
| PDF engine | Chromium, React-PDF, PDFKit | No PDF deps; Next Node XLSX route exists; ADR-006 says simple first, worker later | React-PDF / `@react-pdf/renderer` | No, but package compatibility must be verified |
| Server-side generation | server, client, hybrid | Protected data includes buying/profit/tax; export records need checksum/audit | Server-side only | No |
| PDF version | reuse XLSX 2, start at 1 | `shipping_note_exports.version` is artifact metadata; `exportType` distinguishes `pdf` | PDF version `1` | No |
| Layout identifier | none, `internal-pdf-v1` | XLSX has separate template identifier `internal-v2` | `internal-pdf-v1` code/audit identifier | No |
| Permission | existing internal export, PDF-specific permission | Accountant/Admin already export internal artifacts; Sale denied | Reuse `SHIPPING_NOTES_EXPORT_INTERNAL` | No |
| Eligible statuses | checked only, checked/approved/locked, include cancelled | Current internal export helper allows checked/approved/locked | checked/approved/locked | No |
| Cancelled behavior | allow, deny, historical only | Current export policy denies cancelled; cancellation preserves old records | Deny new PDF; preserve history | No |
| Reopen behavior | allow reviewing PDF, deny until re-check | Reopen returns status to `accounting_reviewing`, export helper denies it | Deny new PDF until re-check | No |
| Print coexistence | keep, replace, merge | Print HTML exists and is useful but not binary artifact | Keep print HTML | No |
| Logo | no logo, local logo, remote logo | No local logo asset found; print/XLSX do not prove logo requirement | No logo unless product provides local approved asset | Yes |
| Font | built-in fonts, local Unicode font, remote font | No fonts found; Vietnamese text may appear | Local open-source Unicode font | Yes for exact brand font |
| Override reason visibility | include, hide | Internal XLSX/print include override metadata | Include stored reason exactly | No |
| Page breaks | one-page, multi-page | PDF differs from fixed XLSX rows | Multi-page with repeated headers/wrapping | No |
| Export record reuse | existing table, new PDF table | Existing enum/table supports PDF metadata | Reuse `shipping_note_exports` | No |
| Failure lifecycle | pending/generated/failed, route-only | Existing XLSX lifecycle and audit exists | Reuse lifecycle with PDF actions | No |
| Checksum | SHA-256, none, other | XLSX uses SHA-256 | SHA-256 over PDF bytes | No |
| Filename | client supplied, jobsheet/timestamp | Current sanitizer exists | `ShippingNote_<safe-jobsheet>_<timestamp>.pdf` | No |
| Migration | yes, no | Existing schema supports PDF | No migration | No |
| Pending crash gap | fix first, reuse/defer | Existing XLSX has same gap; no worker | Reuse/defer as P2 hardening | No |

## W. Risks

P0:

- PDF generation leaks Sale-restricted buying/profit/tax data.
- PDF uses live `tax_rules` instead of stored charge snapshots.
- PDF export mutates `shipping_notes.status` to `exported`.

P1:

- Chosen package is incompatible with React 19/Next 16/Node runtime.
- Headless browser engine creates deployment failures if used.
- PDF route omits server-side permission/status checks and relies on UI.
- PDF failure persists success metadata or exposes raw error details.

P2:

- Missing Unicode font corrupts Vietnamese or other non-ASCII text.
- Page breaks split rows or hide summary values on long notes.
- Pending export row remains stale after process crash.
- Large notes exceed serverless timeout/memory budget.

P3:

- PDF visual design drifts from print/XLSX labels.
- Reported generated timestamps are confusing if timezone policy is implicit.
- Maintenance cost grows if print HTML and PDF mapping diverge.

## X. Recommended Implementation Scope

Phase 7B can be one coherent implementation milestone if kept focused:

1. Add PDF constants and dependency after compatibility verification.
2. Add PDF generator/layout using `InternalShippingNoteExportDto`.
3. Add PDF-specific export persistence value builders and mutation wrappers.
4. Add `POST /api/shipping-notes/[id]/exports/internal-pdf` mirroring XLSX route safeguards.
5. Add UI export control beside current internal print/export controls.
6. Add focused unit/PDF binary tests.
7. Extend integration tests but run them only with current DB authorization.
8. Update current docs.

Do not include:

- PDF Drive upload.
- Background worker.
- Workflow status changes.
- `exported` transition.
- Cancellation/reopen changes.
- XLSX template changes.
- Schema migration.
- Browser E2E framework.

Recommended conceptual files:

```text
src/features/shipping-notes/export/pdf/constants.ts
src/features/shipping-notes/export/pdf/document.tsx
src/features/shipping-notes/export/pdf/generator.ts
src/features/shipping-notes/export/pdf/generator.test.ts
src/features/shipping-notes/export/pdf/filename.test.ts
src/app/api/shipping-notes/[id]/exports/internal-pdf/route.ts
```

Small shared updates likely needed:

- Filename helper to build `.pdf` name from existing sanitizer.
- Export mutation helpers for PDF metadata.
- UI action group on Shipping Note detail.
- Optional shared date/number formatting helpers to keep print/PDF consistent.

## Y. Recommended Immediate Next Task

Implement Phase 7B as server-side `@react-pdf/renderer` generated internal PDF using the existing authorized export read model and `shipping_note_exports`.

Before code changes:

- Verify current `@react-pdf/renderer` compatibility with React `19.2.4`, Next `16.2.9`, Node, and Vitest.
- Decide whether to include a local open-source Unicode font in Phase 7B. Safe default: include one with license documentation and narrow output tracing.
- Decide whether finalization actor/timestamp metadata is required in the PDF. If yes, extend the shared export read model minimally.

Final audit verdict:

```text
READY TO IMPLEMENT PHASE 7B
```
