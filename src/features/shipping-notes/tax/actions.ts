"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { readFormString } from "@/features/shipping-notes/form-data";

import {
  assignChargeTaxRule,
  classifyChargeTaxManually,
  overrideChargeVatPercent,
} from "./mutations";
import {
  decideMissingInvoiceException,
  requestMissingInvoiceException,
  revokeMissingInvoiceException,
} from "./missing-invoice-exceptions";
import {
  assignChargeTaxRuleInputSchema,
  decideMissingInvoiceExceptionInputSchema,
  manualChargeTaxDecisionInputSchema,
  overrideChargeVatPercentInputSchema,
  requestMissingInvoiceExceptionInputSchema,
  revokeMissingInvoiceExceptionInputSchema,
} from "./validators";

export type ChargeTaxActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseActionError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function readInputVatInvoiceStatus(formData: FormData) {
  const value = readFormString(formData, "inputVatInvoiceStatus");
  return value === "available" || value === "missing" ? value : null;
}

function readInputVatDeductible(formData: FormData): boolean | null {
  const value = readFormString(formData, "inputVatDeductible");
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export async function assignChargeTaxRuleAction(
  _state: ChargeTaxActionResult,
  formData: FormData,
): Promise<ChargeTaxActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = assignChargeTaxRuleInputSchema.safeParse({
    chargeId: readFormString(formData, "chargeId"),
    taxRuleId: readFormString(formData, "taxRuleId"),
    inputVatInvoiceStatus: readInputVatInvoiceStatus(formData),
    inputVatInvoiceReference: readFormString(
      formData,
      "inputVatInvoiceReference",
    ),
    inputVatDeductible: readInputVatDeductible(formData),
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

export async function classifyChargeTaxManuallyAction(
  _state: ChargeTaxActionResult,
  formData: FormData,
): Promise<ChargeTaxActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = manualChargeTaxDecisionInputSchema.safeParse({
    chargeId: readFormString(formData, "chargeId"),
    taxTreatment: readFormString(formData, "taxTreatment"),
    vatPercent: readFormString(formData, "vatPercent"),
    reason: readFormString(formData, "reason"),
    expectedFinancialRevision: readFormString(
      formData,
      "expectedFinancialRevision",
    ),
    inputVatInvoiceStatus: readInputVatInvoiceStatus(formData),
    inputVatInvoiceReference: readFormString(
      formData,
      "inputVatInvoiceReference",
    ),
    inputVatDeductible: readInputVatDeductible(formData),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid manual tax decision.",
    };
  }

  try {
    const updated = await classifyChargeTaxManually(parsed.data, user);
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

export async function requestMissingInvoiceExceptionAction(
  _state: ChargeTaxActionResult,
  formData: FormData,
): Promise<ChargeTaxActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = requestMissingInvoiceExceptionInputSchema.safeParse({
    chargeId: readFormString(formData, "chargeId"),
    reason: readFormString(formData, "reason"),
    expectedFinancialRevision: readFormString(
      formData,
      "expectedFinancialRevision",
    ),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid exception request.",
    };
  }

  try {
    const exception = await requestMissingInvoiceException(parsed.data, user);
    revalidatePath(`/shipping-notes/${exception.shippingNoteId}`);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  return { ok: true };
}

export async function decideMissingInvoiceExceptionAction(
  _state: ChargeTaxActionResult,
  formData: FormData,
): Promise<ChargeTaxActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = decideMissingInvoiceExceptionInputSchema.safeParse({
    exceptionId: readFormString(formData, "exceptionId"),
    decision: readFormString(formData, "decision"),
    reason: readFormString(formData, "reason"),
    expectedFinancialRevision: readFormString(
      formData,
      "expectedFinancialRevision",
    ),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid exception decision.",
    };
  }

  try {
    const exception = await decideMissingInvoiceException(parsed.data, user);
    revalidatePath(`/shipping-notes/${exception.shippingNoteId}`);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  return { ok: true };
}

export async function revokeMissingInvoiceExceptionAction(
  _state: ChargeTaxActionResult,
  formData: FormData,
): Promise<ChargeTaxActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = revokeMissingInvoiceExceptionInputSchema.safeParse({
    exceptionId: readFormString(formData, "exceptionId"),
    reason: readFormString(formData, "reason"),
    expectedFinancialRevision: readFormString(
      formData,
      "expectedFinancialRevision",
    ),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid exception revocation.",
    };
  }

  try {
    const exception = await revokeMissingInvoiceException(parsed.data, user);
    revalidatePath(`/shipping-notes/${exception.shippingNoteId}`);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  return { ok: true };
}
