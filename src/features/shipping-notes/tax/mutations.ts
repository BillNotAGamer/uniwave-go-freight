import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  shippingNoteCharges,
  shippingNotes,
  taxRules,
  type User as DbUser,
} from "@/lib/db/schema";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";

import type {
  InputVatInvoiceStatus,
  ShippingMode,
  ShippingNoteStatus,
  TaxDecisionSource,
  TaxTreatment,
} from "../constants";
import type { ChargeTaxDetail, ChargeTaxSnapshot } from "./types";
import {
  calculateLineTotalIncludingVat,
  calculateVatAmount,
} from "./calculations";
import {
  getChargeTaxIncompleteReason,
} from "./completeness";
import type {
  AssignChargeTaxRuleInput,
  ManualChargeTaxDecisionInput,
  OverrideChargeVatPercentInput,
} from "./validators";
import {
  buildAccountingVatOverride,
  buildTaxRuleAccountingVat,
  getPersistedChargeAccountingVat,
} from "../accounting/vat";
import {
  doesTaxRulePatternMatch,
  getChargeTaxRuleMatchValue,
} from "./default-resolution";
import { deriveFinancialReviewRevision } from "../financial-review-revision";
import { invalidateMissingInvoiceExceptionsForNote } from "./missing-invoice-exceptions";

const TAX_MUTABLE_STATUSES = ["submitted", "accounting_reviewing"] as const;

export const TAX_DECISION_STALE_ERROR =
  "The financial review changed. Refresh the shipping note and review the current charges before saving this tax decision.";

const chargeTaxReturnColumns = {
  chargeId: shippingNoteCharges.id,
  shippingNoteId: shippingNoteCharges.shippingNoteId,
  section: shippingNoteCharges.section,
  chargeName: shippingNoteCharges.chargeName,
  amountVnd: shippingNoteCharges.amountVnd,
  taxRuleId: shippingNoteCharges.taxRuleId,
  taxRuleCodeSnapshot: shippingNoteCharges.taxRuleCodeSnapshot,
  taxRuleNameSnapshot: shippingNoteCharges.taxRuleNameSnapshot,
  taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
  taxDecisionSource: shippingNoteCharges.taxDecisionSource,
  taxDecisionReason: shippingNoteCharges.taxDecisionReason,
  taxDecisionById: shippingNoteCharges.taxDecisionById,
  taxDecisionAt: shippingNoteCharges.taxDecisionAt,
  inputVatInvoiceStatus: shippingNoteCharges.inputVatInvoiceStatus,
  inputVatInvoiceReference: shippingNoteCharges.inputVatInvoiceReference,
  inputVatDeductible: shippingNoteCharges.inputVatDeductible,
  vatPercent: shippingNoteCharges.vatPercent,
  vatAmount: shippingNoteCharges.vatAmount,
  isOverride: shippingNoteCharges.isOverride,
  overrideReason: shippingNoteCharges.overrideReason,
  vatOverrideRate: shippingNoteCharges.vatOverrideRate,
  serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
  catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
  catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
  catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
  catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
} as const;

const activeChargeColumns = {
  id: shippingNoteCharges.id,
  shippingNoteId: shippingNoteCharges.shippingNoteId,
  section: shippingNoteCharges.section,
  chargeName: shippingNoteCharges.chargeName,
  amountVnd: shippingNoteCharges.amountVnd,
  taxRuleId: shippingNoteCharges.taxRuleId,
  taxRuleCodeSnapshot: shippingNoteCharges.taxRuleCodeSnapshot,
  taxRuleNameSnapshot: shippingNoteCharges.taxRuleNameSnapshot,
  taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
  taxDecisionSource: shippingNoteCharges.taxDecisionSource,
  taxDecisionReason: shippingNoteCharges.taxDecisionReason,
  taxDecisionById: shippingNoteCharges.taxDecisionById,
  taxDecisionAt: shippingNoteCharges.taxDecisionAt,
  inputVatInvoiceStatus: shippingNoteCharges.inputVatInvoiceStatus,
  inputVatInvoiceReference: shippingNoteCharges.inputVatInvoiceReference,
  inputVatDeductible: shippingNoteCharges.inputVatDeductible,
  vatPercent: shippingNoteCharges.vatPercent,
  vatAmount: shippingNoteCharges.vatAmount,
  isOverride: shippingNoteCharges.isOverride,
  overrideReason: shippingNoteCharges.overrideReason,
  vatOverrideRate: shippingNoteCharges.vatOverrideRate,
  serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
  catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
  catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
  catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
  catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
} as const;

type JoinedCharge = {
  id: string;
  shippingNoteId: string;
  section: "selling" | "buying";
  chargeName: string;
  amountVnd: string;
  taxRuleId: string | null;
  taxRuleCodeSnapshot: string | null;
  taxRuleNameSnapshot: string | null;
  taxTreatmentSnapshot: TaxTreatment | null;
  taxDecisionSource: TaxDecisionSource | null;
  taxDecisionReason: string | null;
  taxDecisionById: string | null;
  taxDecisionAt: Date | null;
  inputVatInvoiceStatus: InputVatInvoiceStatus | null;
  inputVatInvoiceReference: string | null;
  inputVatDeductible: boolean | null;
  vatPercent: string;
  vatAmount: string;
  isOverride: boolean;
  overrideReason: string | null;
  vatOverrideRate: string | null;
  serviceCatalogItemId: string | null;
  catalogCodeSnapshot: string | null;
  catalogNameSnapshot: string | null;
  catalogUnitSnapshot: string | null;
  catalogVatRateSnapshot: string | null;
  noteStatus: string;
  noteShippingMode: ShippingMode;
  noteExchangeRate: string;
  noteUpdatedAt: Date;
};

type TaxMutationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

type ChargeTaxReturnRow = {
  chargeId: string;
  shippingNoteId: string;
  section: "selling" | "buying";
  chargeName: string;
  amountVnd: string;
  taxRuleId: string | null;
  taxRuleCodeSnapshot: string | null;
  taxRuleNameSnapshot: string | null;
  taxTreatmentSnapshot: TaxTreatment | null;
  taxDecisionSource: TaxDecisionSource | null;
  taxDecisionReason: string | null;
  taxDecisionById: string | null;
  taxDecisionAt: Date | null;
  inputVatInvoiceStatus: InputVatInvoiceStatus | null;
  inputVatInvoiceReference: string | null;
  inputVatDeductible: boolean | null;
  vatPercent: string;
  vatAmount: string;
  isOverride: boolean;
  overrideReason: string | null;
  vatOverrideRate: string | null;
  serviceCatalogItemId: string | null;
  catalogCodeSnapshot: string | null;
  catalogNameSnapshot: string | null;
  catalogUnitSnapshot: string | null;
  catalogVatRateSnapshot: string | null;
};

function requireActiveActor(user: DbUser): void {
  if (!rejectInactiveOrSoftDeletedUsers(user)) {
    throw new AuthorizationError();
  }
}

function assertTaxMutableStatus(status: string): void {
  if (!TAX_MUTABLE_STATUSES.some((mutableStatus) => mutableStatus === status)) {
    throw new AuthorizationError();
  }
}

function toAuditTaxSnapshot(charge: JoinedCharge): ChargeTaxSnapshot {
  return {
    taxRuleId: charge.taxRuleId,
    taxRuleCodeSnapshot: charge.taxRuleCodeSnapshot,
    taxRuleNameSnapshot: charge.taxRuleNameSnapshot,
    taxTreatmentSnapshot: charge.taxTreatmentSnapshot,
    taxDecisionSource: charge.taxDecisionSource,
    taxDecisionReason: charge.taxDecisionReason,
    taxDecisionById: charge.taxDecisionById,
    taxDecisionAt: charge.taxDecisionAt,
    inputVatInvoiceStatus: charge.inputVatInvoiceStatus,
    inputVatInvoiceReference: charge.inputVatInvoiceReference,
    inputVatDeductible: charge.inputVatDeductible,
    vatPercent: charge.vatPercent,
    vatAmount: charge.vatAmount,
    isOverride: charge.isOverride,
    overrideReason: charge.overrideReason,
    vatOverrideRate: charge.vatOverrideRate,
  };
}

function toChargeTaxDetail(row: ChargeTaxReturnRow): ChargeTaxDetail {
  const accountingVat = getPersistedChargeAccountingVat(row);
  const incompleteReason = getChargeTaxIncompleteReason(row);
  return {
    ...row,
    ...accountingVat,
    lineTotalIncludingVatVnd: calculateLineTotalIncludingVat(
      row.amountVnd,
      row.vatAmount,
    ),
    taxComplete: incompleteReason === null,
    incompleteReason,
  };
}

async function loadActiveChargeForTax(
  tx: TaxMutationTransaction,
  chargeId: string,
): Promise<JoinedCharge> {
  const [identity] = await tx
    .select({ shippingNoteId: shippingNoteCharges.shippingNoteId })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!identity) {
    throw new AuthorizationError();
  }

  const [note] = await tx
    .select({
      status: shippingNotes.status,
      shippingMode: shippingNotes.shippingMode,
      exchangeRate: shippingNotes.exchangeRate,
      updatedAt: shippingNotes.updatedAt,
    })
    .from(shippingNotes)
    .where(
      and(
        eq(shippingNotes.id, identity.shippingNoteId),
        isNull(shippingNotes.deletedAt),
      ),
    )
    .limit(1)
    .for("update");

  if (!note) {
    throw new AuthorizationError();
  }

  const [charge] = await tx
    .select(activeChargeColumns)
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.shippingNoteId, identity.shippingNoteId),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1)
    .for("update");

  if (!charge) {
    throw new AuthorizationError();
  }

  return {
    ...charge,
    noteStatus: note.status,
    noteShippingMode: note.shippingMode,
    noteExchangeRate: note.exchangeRate,
    noteUpdatedAt: note.updatedAt,
  } as JoinedCharge;
}

function assertScopedTaxMutationAccess(charge: JoinedCharge, user: DbUser): void {
  if (
    hasPermission(user.role, PERMISSIONS.CHARGE_TAX_CLASSIFY_SCOPED) &&
    !hasPermission(user.role, PERMISSIONS.CHARGE_TAX_ASSIGN) &&
    charge.section !== "buying"
  ) {
    throw new AuthorizationError();
  }
}

type InputVatEvidenceInput = {
  inputVatInvoiceStatus?: InputVatInvoiceStatus | null;
  inputVatInvoiceReference?: string | null;
  inputVatDeductible?: boolean | null;
};

function buildInputVatEvidence(input: {
  charge: JoinedCharge;
  evidence: InputVatEvidenceInput;
  user: DbUser;
  taxTreatment: TaxTreatment;
  vatPercent: string;
}) {
  const status = input.evidence.inputVatInvoiceStatus ?? null;
  const deductible = input.evidence.inputVatDeductible ?? null;
  const reference = input.evidence.inputVatInvoiceReference?.trim() || null;

  if (input.charge.section === "selling") {
    if (
      status !== null ||
      reference !== null ||
      deductible !== null
    ) {
      throw new AuthorizationError();
    }

    return {
      inputVatInvoiceStatus: null,
      inputVatInvoiceReference: null,
      inputVatDeductible: null,
    } as const;
  }

  const canFinalizeEvidence = hasPermission(
    input.user.role,
    PERMISSIONS.CHARGE_TAX_ASSIGN,
  );
  if (status === null) {
    if (reference || deductible !== null) {
      throw new Error("Input VAT invoice status is required for the supplied evidence.");
    }

    return {
      inputVatInvoiceStatus: null,
      inputVatInvoiceReference: null,
      inputVatDeductible: null,
    } as const;
  }

  if (status === "missing") {
    if (reference || deductible === true) {
      throw new Error("A missing input VAT invoice cannot have a reference or deductible VAT.");
    }

    return {
      inputVatInvoiceStatus: "missing" as const,
      inputVatInvoiceReference: null,
      inputVatDeductible: false,
    };
  }

  if (!reference) {
    throw new Error("Input VAT invoice reference is required when an invoice is available.");
  }

  if (!canFinalizeEvidence) {
    if (deductible !== null) {
      throw new AuthorizationError();
    }

    return {
      inputVatInvoiceStatus: "available" as const,
      inputVatInvoiceReference: reference,
      inputVatDeductible: null,
    };
  }

  if (deductible === null) {
    throw new Error("Accounting must explicitly confirm input VAT deduction eligibility.");
  }

  if (
    deductible &&
    (input.taxTreatment !== "taxable" || Number(input.vatPercent) <= 0)
  ) {
    throw new Error("Input VAT is deductible only for a positive taxable VAT amount with invoice evidence.");
  }

  return {
    inputVatInvoiceStatus: "available" as const,
    inputVatInvoiceReference: reference,
    inputVatDeductible: deductible,
  };
}

export async function assignChargeTaxRule(
  input: AssignChargeTaxRuleInput,
  user: DbUser,
): Promise<ChargeTaxDetail> {
  requireActiveActor(user);
  requireAnyPermission(user.role, [
    PERMISSIONS.CHARGE_TAX_ASSIGN,
    PERMISSIONS.CHARGE_TAX_CLASSIFY_SCOPED,
  ]);

  return db.transaction(async (tx) => {
    const charge = await loadActiveChargeForTax(tx, input.chargeId);
    assertTaxMutableStatus(charge.noteStatus);
    assertScopedTaxMutationAccess(charge, user);

    const [rule] = await tx
      .select({
        id: taxRules.id,
        code: taxRules.code,
        name: taxRules.name,
        chargeSection: taxRules.chargeSection,
        shippingMode: taxRules.shippingMode,
        chargeNamePattern: taxRules.chargeNamePattern,
        taxTreatment: taxRules.taxTreatment,
        vatPercent: taxRules.vatPercent,
        effectiveFrom: taxRules.effectiveFrom,
        effectiveTo: taxRules.effectiveTo,
      })
      .from(taxRules)
      .where(and(eq(taxRules.id, input.taxRuleId), eq(taxRules.isActive, true)))
      .limit(1);

    const now = new Date();
    if (
      !rule ||
      rule.chargeSection !== charge.section ||
      rule.shippingMode !== charge.noteShippingMode ||
      (rule.effectiveFrom && rule.effectiveFrom > now) ||
      (rule.effectiveTo && rule.effectiveTo < now) ||
      !doesTaxRulePatternMatch(
        rule.chargeNamePattern,
        getChargeTaxRuleMatchValue(charge),
      )
    ) {
      throw new AuthorizationError();
    }

    const accountingVat = buildTaxRuleAccountingVat({
      amountVnd: charge.amountVnd,
      taxTreatment: rule.taxTreatment,
      taxRuleVatRate: rule.vatPercent,
    });
    const decisionAt = new Date();
    const inputVatEvidence = buildInputVatEvidence({
      charge,
      evidence: input,
      user,
      taxTreatment: rule.taxTreatment,
      vatPercent: accountingVat.vatPercent,
    });

    const [updated] = await tx
      .update(shippingNoteCharges)
      .set({
        taxRuleId: rule.id,
        taxRuleCodeSnapshot: rule.code,
        taxRuleNameSnapshot: rule.name,
        taxTreatmentSnapshot: rule.taxTreatment,
        taxDecisionSource: "tax_rule",
        taxDecisionReason: null,
        taxDecisionById: user.id,
        taxDecisionAt: decisionAt,
        ...inputVatEvidence,
        ...accountingVat,
      })
      .where(eq(shippingNoteCharges.id, charge.id))
      .returning(chargeTaxReturnColumns);

    if (!updated) {
      throw new Error("Failed to assign charge tax rule.");
    }

    await invalidateMissingInvoiceExceptionsForNote(tx, {
      shippingNoteId: charge.shippingNoteId,
      actorUserId: user.id,
      reason: "Tax classification or input VAT invoice evidence changed.",
    });

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note_charge.tax_assign",
      entityType: "shipping_note_charge",
      entityId: updated.chargeId,
      before: toAuditTaxSnapshot(charge),
      after: {
        taxRuleId: updated.taxRuleId,
        taxRuleCodeSnapshot: updated.taxRuleCodeSnapshot,
        taxRuleNameSnapshot: updated.taxRuleNameSnapshot,
        taxTreatmentSnapshot: updated.taxTreatmentSnapshot,
        taxDecisionSource: updated.taxDecisionSource,
        taxDecisionReason: updated.taxDecisionReason,
        taxDecisionById: updated.taxDecisionById,
        taxDecisionAt: updated.taxDecisionAt,
        inputVatInvoiceStatus: updated.inputVatInvoiceStatus,
        inputVatInvoiceReference: updated.inputVatInvoiceReference,
        inputVatDeductible: updated.inputVatDeductible,
        vatPercent: updated.vatPercent,
        vatAmount: updated.vatAmount,
        isOverride: updated.isOverride,
        overrideReason: updated.overrideReason,
        vatOverrideRate: updated.vatOverrideRate,
      },
    });

    return toChargeTaxDetail(updated);
  });
}

export async function classifyChargeTaxManually(
  input: ManualChargeTaxDecisionInput,
  user: DbUser,
): Promise<ChargeTaxDetail> {
  requireActiveActor(user);
  requireAnyPermission(user.role, [PERMISSIONS.CHARGE_TAX_ASSIGN]);

  return db.transaction(async (tx) => {
    const charge = await loadActiveChargeForTax(tx, input.chargeId);
    assertTaxMutableStatus(charge.noteStatus);

    const currentFinancialRevision = await deriveFinancialReviewRevision(tx, {
      id: charge.shippingNoteId,
      status: charge.noteStatus as ShippingNoteStatus,
      shippingMode: charge.noteShippingMode,
      exchangeRate: charge.noteExchangeRate,
      updatedAt: charge.noteUpdatedAt,
    });
    if (currentFinancialRevision !== input.expectedFinancialRevision) {
      throw new Error(TAX_DECISION_STALE_ERROR);
    }

    const accountingVat = buildTaxRuleAccountingVat({
      amountVnd: charge.amountVnd,
      taxTreatment: input.taxTreatment,
      taxRuleVatRate: input.vatPercent,
    });
    const inputVatEvidence = buildInputVatEvidence({
      charge,
      evidence: input,
      user,
      taxTreatment: input.taxTreatment,
      vatPercent: accountingVat.vatPercent,
    });
    const decisionAt = new Date();

    const [updated] = await tx
      .update(shippingNoteCharges)
      .set({
        taxRuleId: null,
        taxRuleCodeSnapshot: null,
        taxRuleNameSnapshot: null,
        taxTreatmentSnapshot: input.taxTreatment,
        taxDecisionSource: "manual",
        taxDecisionReason: input.reason,
        taxDecisionById: user.id,
        taxDecisionAt: decisionAt,
        ...inputVatEvidence,
        ...accountingVat,
      })
      .where(
        and(
          eq(shippingNoteCharges.id, charge.id),
          eq(shippingNoteCharges.shippingNoteId, charge.shippingNoteId),
          isNull(shippingNoteCharges.deletedAt),
        ),
      )
      .returning(chargeTaxReturnColumns);

    if (!updated) {
      throw new Error("Failed to save the manual tax decision.");
    }

    await invalidateMissingInvoiceExceptionsForNote(tx, {
      shippingNoteId: charge.shippingNoteId,
      actorUserId: user.id,
      reason: "Manual tax classification or input VAT invoice evidence changed.",
    });

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note_charge.tax_manual_decision",
      entityType: "shipping_note_charge",
      entityId: updated.chargeId,
      before: toAuditTaxSnapshot(charge),
      after: {
        taxRuleId: updated.taxRuleId,
        taxRuleCodeSnapshot: updated.taxRuleCodeSnapshot,
        taxRuleNameSnapshot: updated.taxRuleNameSnapshot,
        taxTreatmentSnapshot: updated.taxTreatmentSnapshot,
        taxDecisionSource: updated.taxDecisionSource,
        taxDecisionReason: updated.taxDecisionReason,
        taxDecisionById: updated.taxDecisionById,
        taxDecisionAt: updated.taxDecisionAt,
        inputVatInvoiceStatus: updated.inputVatInvoiceStatus,
        inputVatInvoiceReference: updated.inputVatInvoiceReference,
        inputVatDeductible: updated.inputVatDeductible,
        vatPercent: updated.vatPercent,
        vatAmount: updated.vatAmount,
        isOverride: updated.isOverride,
        overrideReason: updated.overrideReason,
        vatOverrideRate: updated.vatOverrideRate,
      },
      reason: input.reason,
    });

    return toChargeTaxDetail(updated);
  });
}

export async function overrideChargeVatPercent(
  input: OverrideChargeVatPercentInput,
  user: DbUser,
): Promise<ChargeTaxDetail> {
  requireActiveActor(user);
  requireAnyPermission(user.role, [
    PERMISSIONS.CHARGE_TAX_OVERRIDE,
    PERMISSIONS.CHARGE_TAX_CLASSIFY_SCOPED,
  ]);

  return db.transaction(async (tx) => {
    const charge = await loadActiveChargeForTax(tx, input.chargeId);
    assertTaxMutableStatus(charge.noteStatus);
    assertScopedTaxMutationAccess(charge, user);

    if (
      !charge.taxRuleId ||
      !charge.taxRuleCodeSnapshot ||
      !charge.taxRuleNameSnapshot ||
      charge.taxTreatmentSnapshot !== "taxable"
    ) {
      throw new AuthorizationError();
    }

    if (input.vatPercent === null) {
      const [rule] = await tx
        .select({
          vatPercent: taxRules.vatPercent,
          taxTreatment: taxRules.taxTreatment,
        })
        .from(taxRules)
        .where(eq(taxRules.id, charge.taxRuleId))
        .limit(1);

      if (!rule) {
        throw new AuthorizationError();
      }

      const accountingVat = buildTaxRuleAccountingVat({
        amountVnd: charge.amountVnd,
        taxTreatment: rule.taxTreatment,
        taxRuleVatRate: rule.vatPercent,
      });

      const [updated] = await tx
        .update(shippingNoteCharges)
        .set({
          ...accountingVat,
        })
        .where(eq(shippingNoteCharges.id, charge.id))
        .returning(chargeTaxReturnColumns);

      if (!updated) {
        throw new Error("Failed to clear charge VAT override.");
      }

      await invalidateMissingInvoiceExceptionsForNote(tx, {
        shippingNoteId: charge.shippingNoteId,
        actorUserId: user.id,
        reason: "VAT override evidence changed.",
      });

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.tax_override_clear",
        entityType: "shipping_note_charge",
        entityId: updated.chargeId,
        before: toAuditTaxSnapshot(charge),
        after: {
          taxRuleId: updated.taxRuleId,
          taxRuleCodeSnapshot: updated.taxRuleCodeSnapshot,
          taxRuleNameSnapshot: updated.taxRuleNameSnapshot,
          taxTreatmentSnapshot: updated.taxTreatmentSnapshot,
          vatPercent: updated.vatPercent,
          vatAmount: updated.vatAmount,
          isOverride: updated.isOverride,
          overrideReason: updated.overrideReason,
          vatOverrideRate: updated.vatOverrideRate,
        },
        reason: input.reason ?? "Revert to Tax Rule baseline",
      });

      return toChargeTaxDetail(updated);
    }

    const reason = input.reason?.trim();
    if (!reason) {
      throw new Error("Reason is required when overriding VAT percentage.");
    }

    const accountingVat = buildAccountingVatOverride({
      amountVnd: charge.amountVnd,
      vatOverrideRate: input.vatPercent,
      reason,
    });

    const [updated] = await tx
      .update(shippingNoteCharges)
      .set({
        ...accountingVat,
      })
      .where(eq(shippingNoteCharges.id, charge.id))
      .returning(chargeTaxReturnColumns);

    if (!updated) {
      throw new Error("Failed to override charge VAT percentage.");
    }

    await invalidateMissingInvoiceExceptionsForNote(tx, {
      shippingNoteId: charge.shippingNoteId,
      actorUserId: user.id,
      reason: "VAT override evidence changed.",
    });

    await logAuditEvent(tx, {
      actorUserId: user.id,
      action: "shipping_note_charge.tax_override",
      entityType: "shipping_note_charge",
      entityId: updated.chargeId,
      before: toAuditTaxSnapshot(charge),
      after: {
        taxRuleId: updated.taxRuleId,
        taxRuleCodeSnapshot: updated.taxRuleCodeSnapshot,
        taxRuleNameSnapshot: updated.taxRuleNameSnapshot,
        taxTreatmentSnapshot: updated.taxTreatmentSnapshot,
        vatPercent: updated.vatPercent,
        vatAmount: updated.vatAmount,
        isOverride: updated.isOverride,
        overrideReason: updated.overrideReason,
        vatOverrideRate: updated.vatOverrideRate,
      },
      reason,
    });

    return toChargeTaxDetail(updated);
  });
}

export function recomputeVatForCommercialChange(input: {
  amountVnd: string;
  vatPercent: string;
  taxTreatmentSnapshot: TaxTreatment | null;
}): string {
  if (!input.taxTreatmentSnapshot) {
    return "0.00";
  }

  return calculateVatAmount({
    amountVnd: input.amountVnd,
    vatPercent: input.vatPercent,
    treatment: input.taxTreatmentSnapshot,
  });
}
