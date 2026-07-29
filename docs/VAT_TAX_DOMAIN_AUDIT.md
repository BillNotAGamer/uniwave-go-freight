# VAT/Tax Domain Audit

## 1. Audit Metadata

- Audit date: 2026-07-29
- Branch: `feature/ui-overhaul`
- Commit: `1a1b02f18fc6a8c693bb946af5fe238227ac5946`
- Last commit: `1a1b02f feat(ui): implement semantic tokens, shell, and layout foundation`
- Task type: audit and implementation specification only
- Database target: current `.env.local` `DATABASE_URL`, authorized hosted test/staging database
- Database access mode for audit queries: read-only
- Validation performed: `npm test`, `npm run test:integration`, `npm run test:all`, `npm run typecheck`, `npm run lint`, `npm run build`
- Important working tree note: Phase 9A/9B changes and unrelated UI changes were already uncommitted before this audit. This audit only adds/updates documentation.

## 2. Executive Conclusion

Existing VAT/tax maturity was scaffold-only at audit time. Phase 6B.1 now implements the domain foundation described in `docs/VAT_TAX_IMPLEMENTATION.md`: tax treatment enum, tax-rule metadata, charge tax snapshots, calculation helpers, tax services, RBAC boundaries, checked completeness, audits, and hosted database tests. UI and export template work remain deferred.

Implementation can begin after the unresolved accounting and product decisions in the decision register are answered. The safest engineering target is Model E: default tax rule with per-charge override and immutable charge-level snapshot. This matches the existing charge-line model, avoids dynamic historical recalculation, and can reuse existing `vatPercent`, `vatAmount`, `isOverride`, and `overrideReason` fields.

Do not treat repository data as legal tax policy. Phase 6B.1 intentionally seeds no official tax rates and performs only manual tax-rule assignment.

## 3. Existing Implementation Inventory

### Database

- `shipping_note_charges.vat_percent`: `numeric(6,2) not null default 0`.
- `shipping_note_charges.vat_amount`: `numeric(20,2) not null default 0`.
- `shipping_note_charges.is_override`: `boolean not null default false`.
- `shipping_note_charges.override_reason`: nullable `text`.
- `tax_rules`: `id`, `name`, `shipping_mode`, `charge_section`, `charge_name_pattern`, `vat_percent`, `is_active`, `effective_from`, `effective_to`, `created_by_id`, `created_at`, `updated_at`.
- `tax_rules_lookup_idx`: `(shipping_mode, charge_section, is_active)`.
- No `shipping_note_charges.tax_rule_id`.
- No tax rule code, tax treatment, soft delete, priority, snapshot label/code, override actor, or override timestamp.
- No checked timestamp; only `checked_by_id` exists on `shipping_notes`.

### Calculations

- `calculateChargeAmounts` computes `amountOriginal` and `amountVnd`.
- Current scales:
  - quantity: scale 3
  - unit price: scale 4
  - exchange rate: scale 6
  - amount original: scale 4
  - amount VND: scale 2
- Rounding is deterministic half-up with BigInt scaled integers.
- VND exchange rate is forced to `1.000000`.
- USD requires a positive exchange rate.
- VAT does not enter current calculations or summaries.

### Mutations

- Selling charge create hardcodes `vatPercent: "0"`, `vatAmount: "0"`, `isOverride: false`, `overrideReason: null`.
- Buying charge create hardcodes the same fields.
- Buying charge update resets `vatPercent: "0"`, `vatAmount: "0"`, `isOverride: false`, `overrideReason: null`.
- Selling charge update does not return or explicitly preserve tax fields in its update payload; because it does not set VAT fields, existing DB values would remain, but there is no tax workflow to create non-zero values.
- No tax-rule mutations exist.
- No charge-tax assignment mutation exists.

### Queries and DTOs

- Sale-safe selling charge DTO omits VAT and override fields.
- Accountant/admin buying charge DTO also omits VAT and override fields.
- Financial summary rows include only `section`, `currency`, `amountOriginal`, and `amountVnd`.
- Internal XLSX export DTO omits VAT and override fields.
- No audit-log read service exists.

### RBAC

- Existing permissions:
  - `TAX_RULES_READ`
  - `TAX_RULES_MANAGE`
  - `BUYING_CHARGES_READ`
  - `BUYING_CHARGES_MANAGE`
  - `FINANCIAL_SUMMARY_READ`
  - `NET_PROFIT_READ`
  - `SHIPPING_NOTES_ACCOUNTING_REVIEW`
  - `SHIPPING_NOTES_MARK_CHECKED`
  - `SHIPPING_NOTES_EXPORT_INTERNAL`
- Accountant has tax-rule read/manage permissions.
- Admin has all permissions.
- Sale has no tax-rule, buying-charge, financial-summary, or net-profit permissions.
- No explicit VAT edit, VAT override, financial override, checked override, or lock override permission exists.

### UI

- Selling charge forms show charge name, description, quantity, unit, unit price, currency, and exchange rate.
- Buying charge forms show the same plus vendor/agent.
- Charge tables show base and VND amounts only.
- Financial summary shows selling total, buying total, gross profit, charge counts, and original totals by currency.
- No VAT columns, tax-rule selector, override reason, tax summary, or tax read-only display exists.
- Detail page still contains stale copy saying buying charges are available only when status is exactly submitted, while code permits submitted and accounting_reviewing.

### Audit

- Existing audit JSON uses `JSON.stringify` snapshots, preserving decimal strings without numeric precision loss if tax values remain strings.
- Existing mutation audit writes occur inside transaction callbacks for covered charge/note mutations.
- No tax-specific audit events exist.
- `audit_logs.reason` exists and can store override reasons.

### XLSX and Print

- Template: `assets/export-templates/shipping-note/internal-v1.xlsx`.
- Worksheet: `AK`.
- Selling rows: 17-24, total `E25`.
- Buying rows: 26-36, total `E37`.
- Profit label: `NET PROFIT (USD)` at `A38`, value `E38`.
- Generator writes charge VND amounts into column D, party/vendor text into column E, and formulas into total cells.
- Export query uses stored charge values and recalculates summary from active charge rows.
- No VAT fields are selected or exported.
- Template contains text examples with `Chua VAT`, which suggests tax-exclusive charge text, but does not define a complete VAT calculation or reporting policy.

### Tests

- Unit tests cover decimal, money, summaries, validators, permissions, status policy, export filename/http helpers, and form data.
- Integration tests cover migrations, RBAC, visibility, mutations, charges, financial summaries, accounting transitions, export eligibility, audit persistence, and blank optional fields.
- No test covers tax-rule persistence, VAT calculation, VAT override, VAT export, or tax summary.

## 4. Hosted Database Observations

Read-only hosted test/staging inspection found:

- `tax_rules`: 0 rows.
- Active selling charges: 72.
- Active buying charges: 59.
- Selling rows with non-zero VAT percent: 0.
- Buying rows with non-zero VAT percent: 0.
- Selling rows with non-zero VAT amount: 0.
- Buying rows with non-zero VAT amount: 0.
- Rows with override flags: 0.
- Rows with override reasons: 0.
- Active selling currency split: 68 VND, 4 USD.
- Active buying currency split: 51 VND, 8 USD.
- Missing exchange rates: 0.
- Preserved integration active charges: 12 selling, 6 buying, all zero tax.

Status-level observations:

| Status | Section | Active charge count | Non-zero tax count | Override count |
| --- | --- | ---: | ---: | ---: |
| draft | selling | 2 | 0 | 0 |
| submitted | selling | 8 | 0 | 0 |
| submitted | buying | 4 | 0 | 0 |
| accounting_reviewing | selling | 2 | 0 | 0 |
| accounting_reviewing | buying | 1 | 0 | 0 |
| checked | selling | 60 | 0 | 0 |
| checked | buying | 54 | 0 | 0 |

Classification: DATA-OBSERVED. This proves current test/staging data does not exercise tax behavior. It does not prove tax should be zero.

## 5. Existing Schema and Migration Analysis

The existing schema anticipated charge-level VAT and a rule table, but it does not connect them. There is no FK from charge to tax rule, no immutable rule snapshot, and no explicit tax treatment. The current `tax_rules` table has enough fields for basic lookup by shipping mode, charge section, active flag, and charge-name pattern, but not enough for robust rule history, priority, or unambiguous reporting.

Existing `is_override` and `override_reason` are ambiguous because there is no override type. They could mean commercial amount override, tax override, or both. Phase 6B should either scope them explicitly to tax behavior or introduce tax-specific override fields to avoid conflating future financial overrides.

## 6. Existing Calculation Analysis

Current formula:

```text
amountOriginal = quantity * unitPrice
```

Current VND formula:

```text
if currency = VND:
  exchangeRate = 1.000000
  amountVnd = round_half_up(quantity * unitPrice, 2)

if currency = USD:
  exchangeRate = validated positive rate
  amountVnd = round_half_up(quantity * unitPrice * exchangeRate, 2)
```

Tax fields do not participate in:

- selling summary
- financial summary
- gross profit
- export validation
- export totals
- print view

The current code cannot distinguish tax-exclusive price, VAT amount, and tax-inclusive total.

## 7. Existing RBAC Analysis

Repository-proven behavior:

- Sale cannot read buying charges or financial summary.
- Sale can read selling charges and selling summary for accessible own notes.
- Accountant/admin can read buying charges and financial summary.
- Accountant/admin can generate internal XLSX for checked notes.

Tax-specific gaps:

- No explicit permission for applying VAT to charges.
- No explicit permission for overriding a VAT percentage.
- No explicit permission for modifying checked tax data.
- Existing `TAX_RULES_MANAGE` is broad and should not automatically authorize per-charge overrides without a separate policy decision.

## 8. Existing Workflow Analysis

Current verified workflow:

```text
draft -> submitted -> accounting_reviewing -> checked
```

Current charge mutability:

- Selling charges: sale/admin can mutate on draft only, subject to ownership for sale.
- Buying charges: accountant/admin can mutate on submitted and accounting_reviewing.
- Checked notes are read-only for current charge mutation paths.

VAT is not assigned at any status today. There is no final tax snapshot boundary, but `checked` is the current export eligibility boundary.

## 9. Existing UI Analysis

The current UI is back-office oriented and charge-line based. VAT controls should fit into existing selling and buying charge sections rather than a separate marketing-style screen.

Gaps:

- No tax-rule selector.
- No VAT percentage display.
- No VAT amount display.
- No total including VAT.
- No override action.
- No override reason field.
- No checked read-only tax snapshot display.
- No tax management screen.

Sale UI must not receive buying VAT, buying tax rules, profit, or override history.

## 10. Existing Export/Template Analysis

The current export uses stored charge amounts and active charge rows. It does not dynamically recompute amounts except to assert summaries match. That is a good foundation for historical reproducibility.

The template does not contain first-class VAT columns. Existing example descriptions include `Chua VAT`, so the safest inference is that amount rows are tax-exclusive, but this requires accountant approval before implementation.

Current export records capture:

- export type
- version
- status
- file name
- checksum
- generated user/time

They do not capture calculation version or tax snapshot version.

## 11. Model Comparison

| Model | Compatibility | Migration impact | Usability | Historical correctness | RBAC impact | Export compatibility | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A - Manual percentage per charge | High; existing `vat_percent` fits | Low | Simple but repetitive | Good if stored per charge | Needs edit/override permissions | Easy | No standard rule governance; duplicate percentages |
| B - Tax rule reference plus snapshot | Medium; needs FK/snapshot fields | Medium | Good defaults plus traceability | Strong | Needs rule and assignment permissions | Strong | More fields and admin workflow |
| C - Dynamic tax-rule resolution | Low for accounting history | Medium | Simple reports | Unsafe because old exports can change when rules change | Hard to audit | Weak | Historical records become non-reproducible |
| D - Shipping Note-level VAT | Low; current domain is charge-line based | Medium | Simple for uniform cases | Weak when lines differ | Coarse permissions | Template mismatch likely | Cannot handle per-charge tax differences cleanly |
| E - Hybrid default rule with per-charge override and immutable snapshot | Best target | Medium | Good defaults, controlled exceptions | Strong | Clear rule/manage/override split | Strong | Most test surface; requires decisions |

Recommendation: Model E.

## 12. Recommended Target Model

Use Model E:

- Maintain tax rules as managed defaults.
- Apply a tax rule to each charge when accounting assigns tax.
- Store immutable charge-level snapshots: rule ID, rule code/name, tax treatment, VAT percent, VAT amount.
- Permit accountant/admin override with reason.
- Never resolve current tax-rule values dynamically for historical export/reporting.
- Keep selling and buying VAT separate in summaries and exports.

Classification: RECOMMENDED DEFAULT. Product/accounting approval is required before implementation.

## 13. Proposed Calculation Formulas

### Base Amount

```text
amountOriginal = round_half_up(quantity * unitPrice, 4)
```

Current production behavior already computes raw original at scale 7 and stores rounded scale 4.

### Converted Amount

```text
if currency = VND:
  exchangeRate = 1.000000
  amountVnd = round_half_up(quantity * unitPrice, 2)

if currency = USD:
  amountVnd = round_half_up(quantity * unitPrice * exchangeRate, 2)
```

### VAT Amount

Recommended default:

```text
vatAmountVnd = round_half_up(amountVnd * vatPercent / 100, 2)
```

Reason: current reporting and export totals are VND-based, and `vat_amount` is `numeric(20,2)`.

Accounting decision required:

- Should VAT be calculated from VND-converted amount or original-currency amount?
- Should per-line rounding or summary-level rounding control?
- Are prices tax-exclusive by default?
- How should zero-rated and non-taxable be distinguished?

### Tax-Inclusive Totals

Recommended default:

```text
lineTotalIncludingVatVnd = amountVnd + vatAmountVnd
```

### Summary Semantics

Recommended fields:

- selling subtotal excluding VAT
- selling VAT
- selling total including VAT
- buying subtotal excluding VAT
- buying VAT
- buying total including VAT
- gross profit excluding VAT
- optional gross profit including VAT only if accountant approves meaning
- optional tax payable/recoverable only if accountant approves scope

Do not claim legal correctness without validation.

## 14. Proposed RBAC Matrix

| Capability | Sale | Accountant | Admin | Server read/mutation note |
| --- | --- | --- | --- | --- |
| View selling VAT | Own accessible notes if approved | Yes | Yes | Server projection must omit unauthorized fields |
| Edit selling VAT | No by default | Submitted/reviewing only | Submitted/reviewing only | Separate mutation |
| View buying VAT | No | Yes | Yes | Same boundary as buying charges |
| Edit buying VAT | No | Submitted/reviewing only | Submitted/reviewing only | Separate mutation |
| View tax rules | No | Yes | Yes | `TAX_RULES_READ` |
| Manage tax rules | No | Product decision | Yes | `TAX_RULES_MANAGE`, audited |
| Apply default rule | No | Yes | Yes | Needs eligible status |
| Override percentage | No | Product decision | Yes | Require reason |
| Enter override reason | No | Required if overriding | Required if overriding | Persist and audit |
| View override history | No | Yes | Yes | Requires audit read service |
| View net profit | No | Yes | Yes | Existing boundary |
| View tax summaries | No by default | Yes | Yes | Sale selling VAT visibility is decision |
| Export tax data | No | Checked only | Checked only | Existing export permission plus checked status |
| Modify checked tax data | No | No by default | Product decision | Future override/lock policy |
| Unlock/override locked data | No | No by default | Future decision | Out of current workflow |

## 15. Proposed Workflow

### Draft

Recommended default:

- Sale enters commercial selling charges only.
- Sale may see selling VAT only if product owner wants customer-facing tax awareness.
- VAT may be defaulted but not finalized.
- Sale can submit without final VAT approval.

### Submitted

Recommended default:

- Selling charges remain commercially immutable.
- Accountant can assign/review selling VAT without changing commercial values.
- Accountant/admin can add buying charges and assign buying VAT.

### Accounting Reviewing

Recommended default:

- Accountant can edit charge tax rule, VAT percent, and override reason.
- Any manual percentage differing from rule snapshot requires reason.
- Before/after tax snapshots are audited.

### Checked

Recommended default:

- VAT is immutable at checked.
- Checked is the tax snapshot boundary.
- Internal XLSX export uses stored checked data only.
- Admin checked-data override is a separate future decision.

Future statuses:

- `approved`, `exported`, `locked`, and `cancelled` should not be implemented in Phase 6B, but VAT design should preserve snapshots so those statuses can enforce stronger immutability later.

## 16. Proposed Audit Events

| Action | Entity type | Before | After | Reason required | Transaction boundary |
| --- | --- | --- | --- | --- | --- |
| `tax_rule.create` | `tax_rule` | null | rule | no | same tx as insert |
| `tax_rule.update` | `tax_rule` | rule | rule | recommended | same tx as update |
| `tax_rule.deactivate` | `tax_rule` | rule | rule | recommended | same tx as update |
| `shipping_note_charge.tax.assign` | `shipping_note_charge` | charge tax snapshot | charge tax snapshot | no if default | same tx as charge update |
| `shipping_note_charge.tax.change` | `shipping_note_charge` | charge tax snapshot | charge tax snapshot | no if rule-driven | same tx |
| `shipping_note_charge.tax.override` | `shipping_note_charge` | charge tax snapshot | charge tax snapshot | yes | same tx |
| `shipping_note_charge.tax.override_reason.change` | `shipping_note_charge` | reason snapshot | reason snapshot | yes | same tx |
| `shipping_note.accounting_review.checked` | `shipping_note` | note/status summary | note/status/tax summary | no | existing checked tx |
| `shipping_note.locked_override` | `shipping_note` | locked snapshot | changed snapshot | yes | future tx |

Audit JSON can safely serialize tax values if values remain strings.

## 17. Proposed Schema Delta

| Table | Column | PostgreSQL type | Drizzle type | Null/default | FK/index | Purpose | Backfill |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tax_rules` | `code` | `text` | `text("code")` | not null | unique index | Stable user-facing rule code | Product-approved generated codes for future rules only |
| `tax_rules` | `description` | `text` | `text("description")` | nullable | none | Operational explanation | null |
| `tax_rules` | `priority` | `integer` | `integer("priority")` | not null default 100 | lookup index | Deterministic pattern resolution | 100 |
| `tax_rules` | `tax_treatment` | `text` or enum | `text` or `pgEnum` | not null | index optional | Distinguish taxable/zero-rated/non-taxable | Decision required |
| `shipping_note_charges` | `tax_rule_id` | `text` | `text("tax_rule_id")` | nullable | FK to `tax_rules.id`, index | Rule used when assigned | null |
| `shipping_note_charges` | `tax_rule_code_snapshot` | `text` | `text` | nullable | none | Historical export/report label | null |
| `shipping_note_charges` | `tax_rule_name_snapshot` | `text` | `text` | nullable | none | Historical display label | null |
| `shipping_note_charges` | `tax_treatment_snapshot` | `text` | `text` | nullable | index optional | Historical taxable/zero/non-taxable state | null |
| `shipping_note_charges` | existing `vat_percent` | `numeric(6,2)` | existing | keep not null default 0 | none | Snapshot percentage | preserve |
| `shipping_note_charges` | existing `vat_amount` | `numeric(20,2)` | existing | keep not null default 0 | none | Snapshot VND VAT amount | preserve |
| `shipping_note_charges` | existing `is_override` | `boolean` | existing | keep default false | optional index | Tax override flag if scoped | preserve false |
| `shipping_note_charges` | existing `override_reason` | `text` | existing | nullable | none | Required for override | preserve null |
| `shipping_note_charges` | `tax_overridden_by_id` | `text` | `text` | nullable | FK to `users.id` | Actor for override | null |
| `shipping_note_charges` | `tax_overridden_at` | `timestamp(3)` | `timestamp(... mode date precision 3)` | nullable | none | Override timestamp | null |
| `shipping_note_charges` | `tax_assigned_by_id` | `text` | `text` | nullable | FK to `users.id` | Last tax assignment actor | null |
| `shipping_note_charges` | `tax_assigned_at` | `timestamp(3)` | `timestamp(... mode date precision 3)` | nullable | none | Last tax assignment time | null |
| `shipping_note_exports` | `calculation_version` | `integer` | `integer` | not null default 1 | none | Reproducibility marker | 1 |
| `shipping_note_exports` | `tax_snapshot_version` | `integer` | `integer` | not null default 1 | none | Reproducibility marker | 1 |

## 18. Backfill Strategy

Do not silently apply any VAT rate to existing charges.

Recommended safe backfill:

- Preserve existing `vat_percent = 0` and `vat_amount = 0`.
- Set new tax rule FK/snapshot columns to null.
- Treat existing zero VAT as legacy/unknown unless accountant explicitly confirms it is historical zero-rated/non-taxable data.
- Require accountant review before exporting historical checked notes with tax if tax becomes mandatory.
- Only backfill from a confirmed default rule after explicit accountant/product owner approval.

## 19. Proposed Service/Mutation Boundaries

### Tax Rule Query Service

- `listTaxRulesForAccounting(user)`
- Permission: `TAX_RULES_READ`
- Returns active/inactive rules for accountant/admin.
- No sale access.

### Tax Rule Admin Mutations

- `createTaxRule(input, user)`
- `updateTaxRule(id, input, user)`
- `deactivateTaxRule(id, user)`
- Permission: `TAX_RULES_MANAGE`
- Audit: `tax_rule.*`
- No deletion; deactivate only.

### Charge Tax Mutations

- `assignChargeTax(input, user)`
- `overrideChargeTax(input, user)`
- `clearChargeTaxOverride(input, user)` if approved.
- Permission: proposed explicit tax mutation permission, or `TAX_RULES_MANAGE` plus accounting status guard.
- Eligible statuses: submitted and accounting_reviewing by recommended default.
- Sale denied.
- Audit before/after tax snapshot.
- Transaction includes charge update and audit write.

### Calculation Helpers

- `calculateVatAmount({ amountVnd, vatPercent })`
- `calculateChargeTaxSnapshot({ chargeAmounts, taxRule, override })`
- `summarizeFinancialChargesWithTax(rows)`

### Export DTO

- Extend internal export DTO with stored tax snapshots only after XLSX template contract is approved.

## 20. Proposed UI Behavior

Desktop-first accounting workflow:

- Add tax controls inside existing Selling Charges and Buying Charges sections.
- Accountant/admin see VAT columns: rule, percent, VAT amount, total including VAT, override flag.
- Sale sees no buying VAT. Sale selling VAT visibility requires product decision.
- Use a selector for tax rule, read-only percent preview, and calculated VAT amount.
- Override action opens explicit reason field.
- Override reason is required before submit.
- Checked notes render tax read-only.
- Submitted/accounting_reviewing notes allow accountant/admin tax assignment.
- Validation errors appear inline in the charge section.
- Use stale-data checks by verifying current note status and charge update timestamp or current DB row inside mutation.

## 21. Proposed Export Behavior

Recommended:

- Export stored charge tax snapshots, not live tax-rule lookups.
- Preserve historical reproducibility through export metadata and audit snapshots.
- Checked status remains required.
- If the template is updated for VAT, pin a new template hash and version.
- Include selling VAT, buying VAT, tax-inclusive totals, and tax-exclusive profit only after accountant approval.
- Do not regenerate prior exports with new tax logic unless explicitly requested; create new export version.

## 22. Required Tests

### Unit Tests

- VAT amount calculation.
- Half-up rounding boundaries.
- Zero percent.
- Fractional percent.
- USD converted VAT.
- Large supported values.
- Tax-exclusive vs tax-inclusive behavior after decision.
- Tax summaries.
- Rule snapshot behavior.
- Status policy for tax mutation.
- Permission policy.
- Zod validators.

### Integration Tests

- Tax-rule create/update/deactivate.
- Rule effective dates and priority.
- Sale denial.
- Accountant tax assignment.
- Admin override.
- Eligible and invalid statuses.
- Checked immutability.
- Audit persistence and denied no-op behavior.
- Transaction rollback on tax assignment/audit failure if safe failure injection exists.
- Migration/backfill behavior.
- Internal XLSX export DTO tax values after template decision.
- Soft-deleted charge exclusion.

### Future Browser E2E

- Accountant assigns default tax.
- Accountant overrides with reason.
- Sale cannot see buying tax/profit.
- Checked note renders tax read-only.
- Export download includes tax values after template update.

## 23. Decision Register

| ID | Classification | Decision | Options | Recommended default | Engineering impact |
| --- | --- | --- | --- | --- | --- |
| D1 | ACCOUNTING DECISION REQUIRED | VAT basis | VND amount, original currency amount, template formula | VND amount | Controls calculation helper and DB snapshots |
| D2 | ACCOUNTING DECISION REQUIRED | Rounding point | Per-line, summary-level | Per-line half-up to 2 decimals | Affects tests, summaries, exports |
| D3 | ACCOUNTING DECISION REQUIRED | Tax-inclusive pricing | Unit price excludes VAT, includes VAT | Excludes VAT | Determines formulas and UI labels |
| D4 | ACCOUNTING DECISION REQUIRED | Zero vs non-taxable | Both as 0%, separate treatment, no distinction | Separate treatment field | Requires `tax_treatment` |
| D5 | PRODUCT DECISION REQUIRED | Sale visibility for selling VAT | Hidden, read-only, editable | Read-only only if business needs it | Affects DTOs and UI |
| D6 | PRODUCT DECISION REQUIRED | Accountant tax-rule management | Accountant can manage, admin only | Admin only for rules; accountant applies rules | Affects permission split |
| D7 | PRODUCT DECISION REQUIRED | Override authority | Accountant+admin, admin only | Accountant during review; admin for exceptional override | Affects mutation guards |
| D8 | PRODUCT DECISION REQUIRED | Checked tax immutability | Immutable, admin override, accountant correction | Immutable in Phase 6B | Avoids post-checked scope creep |
| D9 | REPOSITORY-PROVEN | Export eligibility | Checked only | Checked only | Existing policy remains |
| D10 | RECOMMENDED DEFAULT | Tax model | A, B, C, D, E | E hybrid snapshot | Requires schema/mutations/tests |
| D11 | LEGAL VALIDATION REQUIRED | VAT rates/rules | Provided by accountant, legal table, manual | Accountant-provided | Cannot infer from repo |
| D12 | OUT OF SCOPE | Tax filing | Implement, defer | Defer | No external filing integration |

Unresolved decision detail:

- D1 matters because calculating tax before or after currency conversion changes stored VAT.
- D2 matters because per-line and summary-level rounding can differ.
- D3 matters because existing schema lacks inclusive/exclusive distinction.
- D4 matters because 0% taxable and non-taxable are operationally different.
- D5 matters because tax settings are sensitive by existing security docs.
- D6/D7 matter because existing `TAX_RULES_MANAGE` is too broad for final policy.
- D8 matters because checked is the current export boundary.

## 24. Implementation Sequence

1. Product/accounting decision checkpoint for D1-D8 and approved VAT labels.
2. Add unit tests for tax calculation and status/RBAC policies.
3. Add schema migration for tax rule code/treatment/snapshots/FKs/metadata.
4. Add safe backfill preserving current zero values and null rule snapshots.
5. Add tax calculation helpers using existing decimal primitives.
6. Add tax-rule query/admin services with audit.
7. Add focused charge-tax assignment/override mutations with audit.
8. Extend accountant/admin DTOs with tax fields; keep sale projection minimal.
9. Extend financial summaries with tax-exclusive and tax-inclusive fields.
10. Add integration tests for rules, assignment, overrides, RBAC, audit, and checked immutability.
11. Add desktop-first accounting UI controls for tax assignment.
12. Decide and implement XLSX template changes as a separate export subtask with new template hash.
13. Run `npm test`, `npm run test:integration` twice, `npm run test:all`, typecheck, lint, and build.

## 25. Risks and Non-Goals

P1 risks:

- Implementing a VAT formula before accountant approval can produce incorrect financial records.
- Dynamic rule lookup would make historical exports non-reproducible.
- Broad tax-rule permissions could let users change sensitive accounting data without appropriate audit/reason.

P2 risks:

- Existing checked records with zero tax may be ambiguous.
- Current export template lacks formal VAT columns.
- Existing `is_override` naming may conflate tax and financial overrides.

P3 risks:

- Stale UI copy around buying-charge status could confuse accountants.
- Existing docs describe VAT/tax as a Phase 6 objective, but implementation is still absent.

Non-goals for Phase 6B:

- No legal tax advice.
- No e-invoice/tax filing.
- No PDF.
- No Google Drive.
- No post-checked statuses.
- No admin user-management UI.
- No browser E2E in the initial implementation unless explicitly added.

## 26. Final Confidence

- Existing schema inventory: high.
- Existing calculation behavior: high.
- Existing mutation/query/RBAC inventory: high.
- Hosted DB tax observations: high for current test/staging data, low as business policy evidence.
- XLSX template implications: medium; workbook hints at tax-exclusive values but does not define tax policy.
- Recommended target model: medium-high as an engineering design, pending product/accounting approval.
- Legal/accounting correctness: low until validated by product owner/accountant.
