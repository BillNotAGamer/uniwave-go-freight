import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/lib/permissions/require-permission";
import type { User } from "@/lib/db/schema";
import { getFinancialReviewRevisionForNote } from "@/features/shipping-notes/financial-review-revision";
import {
  createBuyingChargeForNote,
  createSellingChargeForNote,
  approveShippingNote,
  lockShippingNote,
  markShippingNoteChecked,
  startAccountingReview,
  submitShippingNote,
  updateBuyingCharge,
} from "@/features/shipping-notes/mutations";
import { getSellingChargesAndSummaryForNoteForUser } from "@/features/shipping-notes/queries";
import {
  createBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  updateBuyingChargeInputSchema,
} from "@/features/shipping-notes/validators";
import {
  assignChargeTaxRule,
  overrideChargeVatPercent,
} from "@/features/shipping-notes/tax/mutations";
import {
  assignChargeTaxRuleInputSchema,
  overrideChargeVatPercentInputSchema,
} from "@/features/shipping-notes/tax/validators";
import {
  getTaxCompletenessForNoteForUser,
  getTaxSummaryForNoteForUser,
  listChargeTaxDetailsForNoteForUser,
  listChargeTaxRuleOptionsForNoteForUser,
} from "@/features/shipping-notes/tax/queries";
import {
  createTaxRule,
  deactivateTaxRule,
} from "@/features/tax-rules/mutations";
import { listTaxRulesForUser } from "@/features/tax-rules/queries";
import { createTaxRuleInputSchema } from "@/features/tax-rules/validators";

import { createIntegrationActors, type IntegrationActors } from "./fixtures/users";
import { createDraftFor } from "./fixtures/shipping-notes";
import { createTaxRuleFixture } from "./fixtures/tax-rules";
import { listAuditLogsForEntity } from "./helpers/audit";
import { createIntegrationRunId } from "./helpers/run-id";
import { cleanupIntegrationRun } from "./setup/cleanup";
import { ensureDatabaseReady } from "./setup/database";

const runId = createIntegrationRunId("TAX");
let actors: IntegrationActors;
let sellingTaxRuleId: string;
let buyingTaxRuleId: string;
let buyingZeroRuleId: string;

async function markCurrentFinancialStateChecked(noteId: string, actor: User) {
  const expectedFinancialRevision = await getFinancialReviewRevisionForNote(noteId);
  if (!expectedFinancialRevision) {
    throw new Error("Financial review revision was unavailable for the integration fixture.");
  }

  return markShippingNoteChecked({
    id: noteId,
    expectedFinancialRevision,
    sellingVerified: true,
    buyingVerified: true,
    taxVerified: true,
  }, actor);
}

function sellingInput(noteId: string, label: string, unitPrice = "100.0000") {
  return createSellingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-TAX-SELL-${label}`,
    description: `${runId} tax selling ${label}`,
    quantity: "1.000",
    unit: "shipment",
    unitPrice,
    currency: "VND",
  });
}

function buyingInput(noteId: string, label: string, unitPrice = "50.0000") {
  return createBuyingChargeInputSchema.parse({
    shippingNoteId: noteId,
    chargeName: `${runId}-TAX-BUY-${label}`,
    description: `${runId} tax buying ${label}`,
    quantity: "1.000",
    unit: "shipment",
    unitPrice,
    currency: "VND",
    vendorOrAgentText: `${runId} tax vendor ${label}`,
  });
}

async function createSubmittedSellingNote(label: string) {
  const note = await createDraftFor(actors.saleA, runId, label);
  const charge = await createSellingChargeForNote(
    sellingInput(note.id, label),
    actors.saleA,
  );
  const submitted = await submitShippingNote({ id: note.id }, actors.saleA);

  return { note: submitted, charge };
}

describe("hosted tax domain services", () => {
  beforeAll(async () => {
    await ensureDatabaseReady();
    actors = await createIntegrationActors(runId);
    const [sellingTaxRule, buyingTaxRule, buyingZeroRule] = await Promise.all([
      createTaxRuleFixture({
        runId,
        label: "SELL-VAT10",
        actor: actors.admin,
        chargeSection: "selling",
      }),
      createTaxRuleFixture({
        runId,
        label: "BUY-VAT10",
        actor: actors.admin,
        chargeSection: "buying",
      }),
      createTaxRuleFixture({
        runId,
        label: "BUY-ZERO",
        actor: actors.admin,
        chargeSection: "buying",
        taxTreatment: "zero_rated",
        vatPercent: "0",
      }),
    ]);
    sellingTaxRuleId = sellingTaxRule.id;
    buyingTaxRuleId = buyingTaxRule.id;
    buyingZeroRuleId = buyingZeroRule.id;
  });

  afterAll(async () => {
    await cleanupIntegrationRun(runId);
  });

  it("restricts tax rule management to admin while allowing accountant read-only access", async () => {
    const rule = await createTaxRule(
      createTaxRuleInputSchema.parse({
        code: `${runId}-ADMIN-ONLY`,
        name: `${runId} admin managed tax rule`,
        description: `${runId} admin managed tax rule`,
        shippingMode: "sea_export",
        chargeSection: "selling",
        chargeNamePattern: "*",
        taxTreatment: "taxable",
        vatPercent: "8.50",
      }),
      actors.admin,
    );

    await expect(listTaxRulesForUser(actors.saleA)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(
      createTaxRule(
        createTaxRuleInputSchema.parse({
          code: `${runId}-ACCT`,
          name: `${runId} accountant create denied`,
          shippingMode: "sea_export",
          chargeSection: "selling",
          chargeNamePattern: "*",
          taxTreatment: "taxable",
          vatPercent: "10",
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect((await listTaxRulesForUser(actors.accountant)).some(
      (taxRule) => taxRule.id === rule.id,
    )).toBe(true);

    const deactivated = await deactivateTaxRule(rule.id, actors.admin);
    expect(deactivated.isActive).toBe(false);
    expect((await listTaxRulesForUser(actors.accountant)).some(
      (taxRule) => taxRule.id === rule.id,
    )).toBe(false);
    expect((await listTaxRulesForUser(
      actors.admin,
      { activeOnly: false },
    )).some((taxRule) => taxRule.id === rule.id)).toBe(true);

    const activeRules = await listTaxRulesForUser(actors.accountant);
    const sectionOrder = { selling: 0, buying: 1 };
    const sortedRuleKeys = [...activeRules]
      .sort((left, right) => {
        const sectionDifference =
          sectionOrder[left.chargeSection] - sectionOrder[right.chargeSection];

        if (sectionDifference !== 0) {
          return sectionDifference;
        }

        const modeDifference = left.shippingMode.localeCompare(right.shippingMode);

        if (modeDifference !== 0) {
          return modeDifference;
        }

        return left.code.localeCompare(right.code);
      })
      .map((taxRule) => `${taxRule.chargeSection}:${taxRule.shippingMode}:${taxRule.code}`);
    expect(activeRules.map(
      (taxRule) => `${taxRule.chargeSection}:${taxRule.shippingMode}:${taxRule.code}`,
    )).toStrictEqual(sortedRuleKeys);

    const auditRows = await listAuditLogsForEntity("tax_rule", rule.id);
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining(["tax_rule.create", "tax_rule.deactivate"]),
    );
  });

  it("assigns tax rules to submitted charges and hides tax data from sale users", async () => {
    const { note, charge } = await createSubmittedSellingNote("ASSIGN");

    await expect(
      assignChargeTaxRule(
        assignChargeTaxRuleInputSchema.parse({
          chargeId: charge.id,
          taxRuleId: sellingTaxRuleId,
        }),
        actors.saleA,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const detail = await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: charge.id,
        taxRuleId: sellingTaxRuleId,
      }),
      actors.accountant,
    );

    expect(detail).toMatchObject({
      vatPercent: "10.00",
      vatAmount: "10.00",
      lineTotalIncludingVatVnd: "110.00",
      taxComplete: true,
    });
    const saleSelling = await getSellingChargesAndSummaryForNoteForUser(
      note.id,
      actors.saleA,
    );
    expect(saleSelling.charges[0]).not.toHaveProperty("vatPercent");
    expect(saleSelling.charges[0]).not.toHaveProperty("vatAmount");
    expect(saleSelling.charges[0]).not.toHaveProperty("taxRuleId");
    expect(saleSelling.charges[0]).not.toHaveProperty("taxTreatmentSnapshot");
    expect(saleSelling.charges[0]).not.toHaveProperty("overrideReason");
    await expect(
      listChargeTaxDetailsForNoteForUser(note.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getTaxCompletenessForNoteForUser(
      note.id,
      actors.accountant,
    )).toStrictEqual({
      taxComplete: true,
      unclassifiedChargeCount: 0,
    });
  });

  it("offers and applies eligible 0%, 8%, and 10% rules per charge pattern", async () => {
    const { note, charge: zeroCharge } = await createSubmittedSellingNote("RATE-ZERO");
    const eightCharge = await createSellingChargeForNote(
      sellingInput(note.id, "RATE-EIGHT"),
      actors.accountant,
    );
    const tenCharge = await createSellingChargeForNote(
      sellingInput(note.id, "RATE-TEN"),
      actors.accountant,
    );
    const [zeroRule, eightRule, tenRule, mismatchedRule] = await Promise.all([
      createTaxRuleFixture({
        runId,
        label: "RATE-0",
        actor: actors.admin,
        chargeSection: "selling",
        chargeNamePattern: "*RATE-ZERO",
        taxTreatment: "zero_rated",
        vatPercent: "0",
      }),
      createTaxRuleFixture({
        runId,
        label: "RATE-8",
        actor: actors.admin,
        chargeSection: "selling",
        chargeNamePattern: "*RATE-EIGHT",
        vatPercent: "8",
      }),
      createTaxRuleFixture({
        runId,
        label: "RATE-10",
        actor: actors.admin,
        chargeSection: "selling",
        chargeNamePattern: "*RATE-TEN",
        vatPercent: "10",
      }),
      createTaxRuleFixture({
        runId,
        label: "RATE-X",
        actor: actors.admin,
        chargeSection: "selling",
        chargeNamePattern: "NEVER-MATCH-*",
        vatPercent: "10",
      }),
    ]);

    const options = await listChargeTaxRuleOptionsForNoteForUser(
      note.id,
      actors.accountant,
    );
    expect(options.find((option) => option.id === zeroRule.id))
      .toMatchObject({ vatPercent: "0.00", applicableChargeIds: [zeroCharge.id] });
    expect(options.find((option) => option.id === eightRule.id))
      .toMatchObject({ vatPercent: "8.00", applicableChargeIds: [eightCharge.id] });
    expect(options.find((option) => option.id === tenRule.id))
      .toMatchObject({ vatPercent: "10.00", applicableChargeIds: [tenCharge.id] });
    expect(options.some((option) => option.id === mismatchedRule.id)).toBe(false);

    await expect(assignChargeTaxRule({
      chargeId: zeroCharge.id,
      taxRuleId: mismatchedRule.id,
    }, actors.accountant)).rejects.toBeInstanceOf(AuthorizationError);

    const assigned = await Promise.all([
      assignChargeTaxRule({ chargeId: zeroCharge.id, taxRuleId: zeroRule.id }, actors.accountant),
      assignChargeTaxRule({ chargeId: eightCharge.id, taxRuleId: eightRule.id }, actors.accountant),
      assignChargeTaxRule({ chargeId: tenCharge.id, taxRuleId: tenRule.id }, actors.accountant),
    ]);
    expect(assigned.map((charge) => charge.vatPercent)).toStrictEqual([
      "0.00",
      "8.00",
      "10.00",
    ]);
    expect(assigned.every((charge) => charge.taxComplete)).toBe(true);
  });

  it("denies assigning mismatched charge-section tax rules", async () => {
    const { charge } = await createSubmittedSellingNote("MISMATCH");

    await expect(
      assignChargeTaxRule(
        assignChargeTaxRuleInputSchema.parse({
          chargeId: charge.id,
          taxRuleId: buyingTaxRuleId,
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("returns legacy unclassified accounting DTOs with null snapshots", async () => {
    const { note } = await createSubmittedSellingNote("UNCLASSIFIED-DTO");

    const [detail] = await listChargeTaxDetailsForNoteForUser(
      note.id,
      actors.accountant,
    );

    expect(detail).toMatchObject({
      taxRuleId: null,
      taxRuleCodeSnapshot: null,
      taxRuleNameSnapshot: null,
      taxTreatmentSnapshot: null,
      vatPercent: "0.00",
      vatAmount: "0.00",
      taxComplete: false,
    });
  });

  it("supports accountant/admin taxable VAT overrides with a required reason", async () => {
    const { charge } = await createSubmittedSellingNote("OVERRIDE");
    await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: charge.id,
        taxRuleId: sellingTaxRuleId,
      }),
      actors.accountant,
    );

    await expect(
      overrideChargeVatPercent(
        overrideChargeVatPercentInputSchema.parse({
          chargeId: charge.id,
          vatPercent: "5",
          reason: "Contract-specific VAT percentage",
        }),
        actors.saleA,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const overridden = await overrideChargeVatPercent(
      overrideChargeVatPercentInputSchema.parse({
        chargeId: charge.id,
        vatPercent: "5",
        reason: "Contract-specific VAT percentage",
      }),
      actors.accountant,
    );

    expect(overridden).toMatchObject({
      vatPercent: "5.00",
      vatAmount: "5.00",
      vatOverrideRate: "5.00",
      effectiveAccountingVatRate: "5.00",
      isOverride: true,
      overrideReason: "Contract-specific VAT percentage",
      taxComplete: true,
    });
    expect((await listChargeTaxDetailsForNoteForUser(
      overridden.shippingNoteId,
      actors.admin,
    )).find((row) => row.chargeId === charge.id)).toMatchObject({
      isOverride: true,
      overrideReason: "Contract-specific VAT percentage",
    });

    const auditRows = await listAuditLogsForEntity(
      "shipping_note_charge",
      charge.id,
    );
    expect(auditRows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "shipping_note_charge.tax_assign",
        "shipping_note_charge.tax_override",
      ]),
    );
  });

  it("enforces tax mutability statuses and checked immutability", async () => {
    const draft = await createDraftFor(actors.saleA, runId, "DRAFT-TAX-DENIED");
    const draftCharge = await createSellingChargeForNote(
      sellingInput(draft.id, "DRAFT-TAX-DENIED"),
      actors.saleA,
    );

    await expect(
      assignChargeTaxRule(
        assignChargeTaxRuleInputSchema.parse({
          chargeId: draftCharge.id,
          taxRuleId: sellingTaxRuleId,
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const { note, charge } = await createSubmittedSellingNote("CHECKED-IMMUTABLE");
    await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: charge.id,
        taxRuleId: sellingTaxRuleId,
      }),
      actors.accountant,
    );
    await startAccountingReview({ id: note.id }, actors.accountant);
    await markCurrentFinancialStateChecked(note.id, actors.accountant);

    await expect(
      overrideChargeVatPercent(
        overrideChargeVatPercentInputSchema.parse({
          chargeId: charge.id,
          vatPercent: "10.00",
          reason: "Too late",
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("denies assigning inactive tax rules", async () => {
    const inactiveRule = await createTaxRuleFixture({
      runId,
      label: "INACTIVE",
      actor: actors.admin,
      chargeSection: "selling",
    });
    await deactivateTaxRule(inactiveRule.id, actors.admin);
    const { charge } = await createSubmittedSellingNote("INACTIVE-ASSIGN");

    await expect(
      assignChargeTaxRule(
        assignChargeTaxRuleInputSchema.parse({
          chargeId: charge.id,
          taxRuleId: inactiveRule.id,
        }),
        actors.accountant,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("blocks checked transition until every active charge is tax-complete", async () => {
    const { note, charge } = await createSubmittedSellingNote("CHECK-REQUIRES-TAX");
    await startAccountingReview({ id: note.id }, actors.accountant);

    await expect(
      markCurrentFinancialStateChecked(note.id, actors.accountant),
    ).rejects.toThrow(/tax classification/);

    await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: charge.id,
        taxRuleId: sellingTaxRuleId,
      }),
      actors.accountant,
    );

    expect((await markCurrentFinancialStateChecked(
      note.id,
      actors.accountant,
    )).status).toBe("checked");
  });

  it("completes Accounting Reviewing through Checked, Approved, and Locked with Selling and Buying tax evidence", async () => {
    const { note, charge: sellingCharge } = await createSubmittedSellingNote("FULL-CLOSE");
    const buyingCharge = await createBuyingChargeForNote(
      note.id,
      buyingInput(note.id, "FULL-CLOSE"),
      actors.accountant,
    );
    const [sellingEightRule, buyingTenRule] = await Promise.all([
      createTaxRuleFixture({
        runId,
        label: "CLOSE-S8",
        actor: actors.admin,
        chargeSection: "selling",
        vatPercent: "8",
      }),
      createTaxRuleFixture({
        runId,
        label: "CLOSE-B10",
        actor: actors.admin,
        chargeSection: "buying",
        vatPercent: "10",
      }),
    ]);

    await assignChargeTaxRule(
      { chargeId: sellingCharge.id, taxRuleId: sellingEightRule.id },
      actors.accountant,
    );
    await assignChargeTaxRule(
      { chargeId: buyingCharge.id, taxRuleId: buyingTenRule.id },
      actors.accountant,
    );
    expect(await getTaxCompletenessForNoteForUser(note.id, actors.accountant))
      .toStrictEqual({ taxComplete: true, unclassifiedChargeCount: 0 });

    expect((await startAccountingReview({ id: note.id }, actors.accountant)).status)
      .toBe("accounting_reviewing");
    expect((await markCurrentFinancialStateChecked(note.id, actors.accountant)).status)
      .toBe("checked");
    expect((await approveShippingNote({ id: note.id }, actors.admin)).status)
      .toBe("approved");
    expect((await lockShippingNote({ id: note.id }, actors.admin)).status)
      .toBe("locked");

    const auditActions = (await listAuditLogsForEntity("shipping_note", note.id))
      .map((row) => row.action);
    expect(auditActions).toEqual(expect.arrayContaining([
      "shipping_note.accounting_review.start",
      "shipping_note.accounting_review.checked",
      "shipping_note.approve",
      "shipping_note.lock",
    ]));
  });

  it("recomputes VAT after buying charge commercial edits while preserving tax snapshots", async () => {
    const { note } = await createSubmittedSellingNote("BUY-RECOMPUTE");
    const buyingCharge = await createBuyingChargeForNote(
      note.id,
      buyingInput(note.id, "BUY-RECOMPUTE", "50.0000"),
      actors.accountant,
    );
    await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: buyingCharge.id,
        taxRuleId: buyingTaxRuleId,
      }),
      actors.accountant,
    );

    await updateBuyingCharge(
      buyingCharge.id,
      updateBuyingChargeInputSchema.parse({
        id: buyingCharge.id,
        chargeName: `${runId}-TAX-BUY-RECOMPUTED`,
        description: `${runId} recomputed buying charge`,
        quantity: "2.000",
        unit: "shipment",
        unitPrice: "100.0000",
        currency: "VND",
        vendorOrAgentText: `${runId} recomputed vendor`,
      }),
      actors.accountant,
    );

    const [detail] = (await listChargeTaxDetailsForNoteForUser(
      note.id,
      actors.accountant,
    )).filter((row) => row.chargeId === buyingCharge.id);

    expect(detail).toMatchObject({
      taxRuleId: buyingTaxRuleId,
      vatPercent: "10.00",
      vatAmount: "20.00",
      lineTotalIncludingVatVnd: "220.00",
      taxComplete: true,
    });
  });

  it("summarizes VAT separately from tax-exclusive gross profit", async () => {
    const { note, charge } = await createSubmittedSellingNote("SUMMARY");
    const buyingCharge = await createBuyingChargeForNote(
      note.id,
      buyingInput(note.id, "SUMMARY", "25.0000"),
      actors.accountant,
    );
    await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: charge.id,
        taxRuleId: sellingTaxRuleId,
      }),
      actors.admin,
    );
    await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: buyingCharge.id,
        taxRuleId: buyingZeroRuleId,
      }),
      actors.admin,
    );

    const summary = await getTaxSummaryForNoteForUser(note.id, actors.accountant);

    expect(summary).toMatchObject({
      sellingSubtotalExcludingVatVnd: "100.00",
      sellingVatVnd: "10.00",
      sellingTotalIncludingVatVnd: "110.00",
      buyingSubtotalExcludingVatVnd: "25.00",
      buyingVatVnd: "0.00",
      buyingTotalIncludingVatVnd: "25.00",
      grossProfitVnd: "75.00",
      grossProfitExcludingVatVnd: "75.00",
    });
    await expect(
      getTaxSummaryForNoteForUser(note.id, actors.saleA),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
