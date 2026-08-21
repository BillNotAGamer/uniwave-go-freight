"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { readFormString } from "@/features/shipping-notes/form-data";

import {
  assignChargeTaxRule,
  overrideChargeVatPercent,
} from "./mutations";
import {
  assignChargeTaxRuleInputSchema,
  overrideChargeVatPercentInputSchema,
} from "./validators";

export type ChargeTaxActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseActionError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function assignChargeTaxRuleAction(
  _state: ChargeTaxActionResult,
  formData: FormData,
): Promise<ChargeTaxActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = assignChargeTaxRuleInputSchema.safeParse({
    chargeId: readFormString(formData, "chargeId"),
    taxRuleId: readFormString(formData, "taxRuleId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tax assignment.",
    };
  }

  try {
    const updated = await assignChargeTaxRule(parsed.data, user);
    revalidatePath(`/shipping-notes/${updated.shippingNoteId}`);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  return { ok: true };
}

export async function overrideChargeVatPercentAction(
  _state: ChargeTaxActionResult,
  formData: FormData,
): Promise<ChargeTaxActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = overrideChargeVatPercentInputSchema.safeParse({
    chargeId: readFormString(formData, "chargeId"),
    vatPercent: readFormString(formData, "vatPercent"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid VAT override.",
    };
  }

  try {
    const updated = await overrideChargeVatPercent(parsed.data, user);
    revalidatePath(`/shipping-notes/${updated.shippingNoteId}`);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  return { ok: true };
}
