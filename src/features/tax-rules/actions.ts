"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { readFormString } from "@/features/shipping-notes/form-data";

import {
  createTaxRule,
  deactivateTaxRule,
  updateTaxRule,
} from "./mutations";
import {
  createTaxRuleInputSchema,
  deactivateTaxRuleInputSchema,
  updateTaxRuleInputSchema,
} from "./validators";

export type TaxRuleActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseActionError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function readTaxRuleForm(formData: FormData) {
  return {
    id: readFormString(formData, "id"),
    code: readFormString(formData, "code"),
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    shippingMode: readFormString(formData, "shippingMode"),
    chargeSection: readFormString(formData, "chargeSection"),
    chargeNamePattern: readFormString(formData, "chargeNamePattern"),
    taxTreatment: readFormString(formData, "taxTreatment"),
    vatPercent: readFormString(formData, "vatPercent"),
    effectiveFrom: readFormString(formData, "effectiveFrom"),
    effectiveTo: readFormString(formData, "effectiveTo"),
  };
}

export async function createTaxRuleAction(
  _state: TaxRuleActionResult,
  formData: FormData,
): Promise<TaxRuleActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = createTaxRuleInputSchema.safeParse(readTaxRuleForm(formData));

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tax rule data.",
    };
  }

  try {
    await createTaxRule(parsed.data, user);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  revalidatePath("/tax-rules");
  return { ok: true };
}

export async function updateTaxRuleAction(
  _state: TaxRuleActionResult,
  formData: FormData,
): Promise<TaxRuleActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = updateTaxRuleInputSchema.safeParse(readTaxRuleForm(formData));

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tax rule data.",
    };
  }

  try {
    await updateTaxRule(parsed.data.id, parsed.data, user);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  revalidatePath("/tax-rules");
  return { ok: true };
}

export async function deactivateTaxRuleAction(
  _state: TaxRuleActionResult,
  formData: FormData,
): Promise<TaxRuleActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = deactivateTaxRuleInputSchema.safeParse({
    id: readFormString(formData, "id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tax rule selection.",
    };
  }

  try {
    await deactivateTaxRule(parsed.data.id, user);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  revalidatePath("/tax-rules");
  return { ok: true };
}
