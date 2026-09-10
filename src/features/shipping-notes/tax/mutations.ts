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
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/permissions/require-permission";

import type { TaxTreatment } from "../constants";
import type { ChargeTaxDetail, ChargeTaxSnapshot } from "./types";
import {
  calculateLineTotalIncludingVat,
  calculateVatAmount,
} from "./calculations";
import { isChargeTaxComplete } from "./completeness";
import type {
  AssignChargeTaxRuleInput,
  OverrideChargeVatPercentInput,
} from "./validators";
import {
  buildAccountingVatOverride,
  buildTaxRuleAccountingVat,
  getPersistedChargeAccountingVat,
} from "../accounting/vat";

const TAX_MUTABLE_STATUSES = ["submitted", "accounting_reviewing"] as const;

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

const joinedChargeColumns = {
  id: shippingNoteCharges.id,
  shippingNoteId: shippingNoteCharges.shippingNoteId,
  section: shippingNoteCharges.section,
  chargeName: shippingNoteCharges.chargeName,
  amountVnd: shippingNoteCharges.amountVnd,
  taxRuleId: shippingNoteCharges.taxRuleId,
  taxRuleCodeSnapshot: shippingNoteCharges.taxRuleCodeSnapshot,
  taxRuleNameSnapshot: shippingNoteCharges.taxRuleNameSnapshot,
  taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
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
  noteStatus: shippingNotes.status,
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
    vatPercent: charge.vatPercent,
    vatAmount: charge.vatAmount,
    isOverride: charge.isOverride,
    overrideReason: charge.overrideReason,
    vatOverrideRate: charge.vatOverrideRate,
  };
}

function toChargeTaxDetail(row: ChargeTaxReturnRow): ChargeTaxDetail {
  const accountingVat = getPersistedChargeAccountingVat(row);
  return {
    ...row,
    ...accountingVat,
    lineTotalIncludingVatVnd: calculateLineTotalIncludingVat(
      row.amountVnd,
      row.vatAmount,
    ),
    taxComplete: isChargeTaxComplete(row),
  };
}

async function loadActiveChargeForTax(
  tx: TaxMutationTransaction,
  chargeId: string,
): Promise<JoinedCharge> {
  const [charge] = await tx
    .select(joinedChargeColumns)
    .from(shippingNoteCharges)
    .innerJoin(shippingNotes, eq(shippingNotes.id, shippingNoteCharges.shippingNoteId))
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        isNull(shippingNoteCharges.deletedAt),
        isNull(shippingNotes.deletedAt),
      ),
    )
    .limit(1);

  if (!charge) {
    throw new AuthorizationError();
  }

  return charge as JoinedCharge;
}

export async function assignChargeTaxRule(
  input: AssignChargeTaxRuleInput,
  user: DbUser,
): Promise<ChargeTaxDetail> {
  requireActiveActor(user);
  requirePermission(user.role, PERMISSIONS.CHARGE_TAX_ASSIGN);

  return db.transaction(async (tx) => {
    const charge = await loadActiveChargeForTax(tx, input.chargeId);
    assertTaxMutableStatus(charge.noteStatus);

    const [rule] = await tx
      .select({
        id: taxRules.id,
        code: taxRules.code,
        name: taxRules.name,
        chargeSection: taxRules.chargeSection,
        taxTreatment: taxRules.taxTreatment,
        vatPercent: taxRules.vatPercent,
      })
      .from(taxRules)
      .where(and(eq(taxRules.id, input.taxRuleId), eq(taxRules.isActive, true)))
      .limit(1);

    if (!rule || rule.chargeSection !== charge.section) {
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
        taxRuleId: rule.id,
        taxRuleCodeSnapshot: rule.code,
        taxRuleNameSnapshot: rule.name,
        taxTreatmentSnapshot: rule.taxTreatment,
        ...accountingVat,
      })
      .where(eq(shippingNoteCharges.id, charge.id))
      .returning(chargeTaxReturnColumns);

    if (!updated) {
      throw new Error("Failed to assign charge tax rule.");
    }

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

export async function overrideChargeVatPercent(
  input: OverrideChargeVatPercentInput,
  user: DbUser,
): Promise<ChargeTaxDetail> {
  requireActiveActor(user);
  requirePermission(user.role, PERMISSIONS.CHARGE_TAX_OVERRIDE);

  return db.transaction(async (tx) => {
    const charge = await loadActiveChargeForTax(tx, input.chargeId);
    assertTaxMutableStatus(charge.noteStatus);

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
