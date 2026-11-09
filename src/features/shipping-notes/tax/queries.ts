import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { shippingNoteCharges, shippingNotes, type User as DbUser } from "@/lib/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { AuthorizationError, requirePermission } from "@/lib/permissions/require-permission";
import { taxRules } from "@/lib/db/schema";
import { summarizeFinancialCharges } from "@/lib/calculations/shipping-note";

import { calculateLineTotalIncludingVat } from "./calculations";
import {
  getChargeTaxIncompleteReason,
  summarizeTaxCompleteness,
} from "./completeness";
import type { ChargeTaxDetail, ChargeTaxRuleOption, TaxCompletenessResult } from "./types";
import type { FinancialSummary, FinancialSummaryChargeRow } from "../types";
import { getPersistedChargeAccountingVat } from "../accounting/vat";
import { getShippingNoteForUser } from "../queries";
import {
  doesTaxRulePatternMatch,
  getChargeTaxRuleMatchValue,
} from "./default-resolution";
import { listLatestMissingInvoiceExceptionsByCharge } from "./missing-invoice-exceptions";

const chargeTaxColumns = {
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

export async function listChargeTaxDetailsForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<ChargeTaxDetail[]> {
  const canReadFullTax = hasPermission(user.role, PERMISSIONS.TAX_SUMMARY_READ);
  const canReadScopedTax = hasPermission(
    user.role,
    PERMISSIONS.CHARGE_TAX_CLASSIFY_SCOPED,
  );
  if (!canReadFullTax && !canReadScopedTax) {
    throw new AuthorizationError();
  }

  if (!await getShippingNoteForUser(noteId, user)) {
    throw new AuthorizationError();
  }

  const noteConditions = [eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)];

  const rows = await db
    .select(chargeTaxColumns)
    .from(shippingNoteCharges)
    .innerJoin(shippingNotes, eq(shippingNotes.id, shippingNoteCharges.shippingNoteId))
    .where(
      and(
        ...noteConditions,
        ...(canReadFullTax
          ? []
          : [eq(shippingNoteCharges.section, "buying" as const)]),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.createdAt), asc(shippingNoteCharges.id));

  const latestExceptions = canReadFullTax
    ? await listLatestMissingInvoiceExceptionsByCharge(db, noteId)
    : new Map();

  return rows.map((row) => {
    const rowWithException = {
      ...row,
      missingInvoiceException:
        latestExceptions.get(row.chargeId) ?? null,
    };
    const accountingVat = getPersistedChargeAccountingVat(row);
    const incompleteReason = getChargeTaxIncompleteReason(rowWithException);
    const visibleRow = canReadFullTax
      ? rowWithException
      : {
        ...rowWithException,
        taxDecisionReason: null,
        taxDecisionById: null,
        taxDecisionAt: null,
        inputVatInvoiceReference: null,
        inputVatDeductible: null,
        missingInvoiceException: null,
      };
    return {
      ...visibleRow,
      ...accountingVat,
      lineTotalIncludingVatVnd: calculateLineTotalIncludingVat(
        row.amountVnd,
        row.vatAmount,
      ),
      taxComplete: incompleteReason === null,
      incompleteReason,
    };
  });
}

export async function listChargeTaxRuleOptionsForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<ChargeTaxRuleOption[]> {
  const canReadFullTax = hasPermission(user.role, PERMISSIONS.TAX_SUMMARY_READ);
  const canReadScopedTax = hasPermission(
    user.role,
    PERMISSIONS.CHARGE_TAX_CLASSIFY_SCOPED,
  );
  if (!canReadFullTax && !canReadScopedTax) {
    throw new AuthorizationError();
  }

  const note = await getShippingNoteForUser(noteId, user);
  if (!note) {
    throw new AuthorizationError();
  }

  const now = new Date();
  const rows = await db
    .select({
      id: taxRules.id,
      code: taxRules.code,
      name: taxRules.name,
      chargeSection: taxRules.chargeSection,
      taxTreatment: taxRules.taxTreatment,
      vatPercent: taxRules.vatPercent,
      isActive: taxRules.isActive,
      chargeNamePattern: taxRules.chargeNamePattern,
      effectiveFrom: taxRules.effectiveFrom,
      effectiveTo: taxRules.effectiveTo,
    })
    .from(taxRules)
    .where(
      and(
        eq(taxRules.shippingMode, note.shippingMode),
        eq(taxRules.isActive, true),
        ...(canReadFullTax
          ? []
          : [eq(taxRules.chargeSection, "buying" as const)]),
      ),
    )
    .orderBy(asc(taxRules.chargeSection), asc(taxRules.code));

  const activeCharges = await db
    .select({
      id: shippingNoteCharges.id,
      section: shippingNoteCharges.section,
      chargeName: shippingNoteCharges.chargeName,
      catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, noteId),
        isNull(shippingNoteCharges.deletedAt),
        ...(canReadFullTax
          ? []
          : [eq(shippingNoteCharges.section, "buying" as const)]),
      ),
    );

  return rows
    .filter((rule) =>
      (!rule.effectiveFrom || rule.effectiveFrom <= now) &&
      (!rule.effectiveTo || rule.effectiveTo >= now),
    )
    .map((rule) => {
      const applicableChargeIds = activeCharges
        .filter(
          (charge) =>
            charge.section === rule.chargeSection &&
            doesTaxRulePatternMatch(
              rule.chargeNamePattern,
              getChargeTaxRuleMatchValue(charge),
            ),
        )
        .map((charge) => charge.id);

      return {
        id: rule.id,
        code: rule.code,
        name: rule.name,
        chargeSection: rule.chargeSection,
        taxTreatment: rule.taxTreatment,
        vatPercent: rule.vatPercent,
        isActive: rule.isActive,
        applicableChargeIds,
      };
    })
    .filter((rule) => rule.applicableChargeIds.length > 0);
}

export async function getTaxCompletenessForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<TaxCompletenessResult | null> {
  const details = await listChargeTaxDetailsForNoteForUser(noteId, user);

  if (details.length === 0) {
    const [note] = await db
      .select({ id: shippingNotes.id })
      .from(shippingNotes)
      .where(and(eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)))
      .limit(1);

    if (!note) {
      return null;
    }
  }

  return summarizeTaxCompleteness(details);
}

export async function getTaxSummaryForNoteForUser(
  noteId: string,
  user: DbUser,
): Promise<FinancialSummary | null> {
  requirePermission(user.role, PERMISSIONS.TAX_SUMMARY_READ);

  const [note] = await db
    .select({ id: shippingNotes.id })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, noteId), isNull(shippingNotes.deletedAt)))
    .limit(1);

  if (!note) {
    return null;
  }

  const rows = await db
    .select({
      section: shippingNoteCharges.section,
      currency: shippingNoteCharges.currency,
      amountOriginal: shippingNoteCharges.amountOriginal,
      amountVnd: shippingNoteCharges.amountVnd,
      vatAmount: shippingNoteCharges.vatAmount,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, noteId),
        inArray(shippingNoteCharges.section, ["selling", "buying"]),
        isNull(shippingNoteCharges.deletedAt),
      ),
    );

  return summarizeFinancialCharges(rows as FinancialSummaryChargeRow[]);
}
