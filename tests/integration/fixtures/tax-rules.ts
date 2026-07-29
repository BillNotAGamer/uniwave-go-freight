import { and, asc, eq, isNull } from "drizzle-orm";

import { shippingNoteCharges, type User } from "@/lib/db/schema";
import { createTaxRule } from "@/features/tax-rules/mutations";
import type { TaxRuleDetail } from "@/features/tax-rules/types";
import { createTaxRuleInputSchema } from "@/features/tax-rules/validators";
import { assignChargeTaxRule } from "@/features/shipping-notes/tax/mutations";
import { assignChargeTaxRuleInputSchema } from "@/features/shipping-notes/tax/validators";
import type { ChargeSection, TaxTreatment } from "@/features/shipping-notes/constants";

import { db } from "../setup/database";

export async function createTaxRuleFixture(input: {
  runId: string;
  label: string;
  actor: User;
  chargeSection: ChargeSection;
  taxTreatment?: TaxTreatment;
  vatPercent?: string;
}): Promise<TaxRuleDetail> {
  return createTaxRule(
    createTaxRuleInputSchema.parse({
      code: `${input.runId}-${input.label}`,
      name: `${input.runId} ${input.label}`,
      description: `${input.runId} tax rule fixture ${input.label}`,
      shippingMode: "sea_export",
      chargeSection: input.chargeSection,
      chargeNamePattern: "*",
      taxTreatment: input.taxTreatment ?? "taxable",
      vatPercent: input.vatPercent ?? "10.00",
    }),
    input.actor,
  );
}

export async function classifyNoteCharges(input: {
  noteId: string;
  actor: User;
  sellingTaxRuleId?: string;
  buyingTaxRuleId?: string;
}): Promise<void> {
  const charges = await db
    .select({
      id: shippingNoteCharges.id,
      section: shippingNoteCharges.section,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.shippingNoteId, input.noteId),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCharges.createdAt));

  for (const charge of charges) {
    const taxRuleId =
      charge.section === "selling"
        ? input.sellingTaxRuleId
        : input.buyingTaxRuleId;

    if (!taxRuleId) {
      continue;
    }

    await assignChargeTaxRule(
      assignChargeTaxRuleInputSchema.parse({
        chargeId: charge.id,
        taxRuleId,
      }),
      input.actor,
    );
  }
}
