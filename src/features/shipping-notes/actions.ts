"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";

import {
  createShippingNoteDraft,
  submitShippingNote,
  updateShippingNoteDraft,
  createSellingChargeForNote,
  updateSellingCharge,
  softDeleteSellingCharge,
} from "./mutations";
import {
  createShippingNoteDraftInputSchema,
  submitShippingNoteInputSchema,
  updateShippingNoteDraftInputSchema,
  createSellingChargeInputSchema,
  updateSellingChargeInputSchema,
  deleteSellingChargeInputSchema,
} from "./validators";

export type ShippingNoteActionResult =
  | { ok: true }
  | { ok: false; error: string };

function readString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function parseBooleanishError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

export async function createShippingNoteDraftAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = createShippingNoteDraftInputSchema.safeParse({
    jobsheetNo: readString(formData, "jobsheetNo"),
    shippingMode: readString(formData, "shippingMode"),
    mawbHawbNo: readString(formData, "mawbHawbNo"),
    shipperText: readString(formData, "shipperText"),
    consigneeText: readString(formData, "consigneeText"),
    customerText: readString(formData, "customerText"),
    agentText: readString(formData, "agentText"),
    aol: readString(formData, "aol"),
    aod: readString(formData, "aod"),
    finalDestination: readString(formData, "finalDestination"),
    etd: readString(formData, "etd"),
    eta: readString(formData, "eta"),
    volumeValue: readString(formData, "volumeValue"),
    volumeUnit: readString(formData, "volumeUnit"),
    exchangeRate: readString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shipping note draft data.",
    };
  }

  let noteId = "";

  try {
    const note = await createShippingNoteDraft(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  redirect(`/shipping-notes/${noteId}`);
}

export async function updateShippingNoteDraftAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = updateShippingNoteDraftInputSchema.safeParse({
    id: readString(formData, "id"),
    jobsheetNo: readString(formData, "jobsheetNo"),
    shippingMode: readString(formData, "shippingMode"),
    mawbHawbNo: readString(formData, "mawbHawbNo"),
    shipperText: readString(formData, "shipperText"),
    consigneeText: readString(formData, "consigneeText"),
    customerText: readString(formData, "customerText"),
    agentText: readString(formData, "agentText"),
    aol: readString(formData, "aol"),
    aod: readString(formData, "aod"),
    finalDestination: readString(formData, "finalDestination"),
    etd: readString(formData, "etd"),
    eta: readString(formData, "eta"),
    volumeValue: readString(formData, "volumeValue"),
    volumeUnit: readString(formData, "volumeUnit"),
    exchangeRate: readString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shipping note draft data.",
    };
  }

  let noteId = "";

  try {
    const note = await updateShippingNoteDraft(parsed.data.id, parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  redirect(`/shipping-notes/${noteId}`);
}

export async function submitShippingNoteAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = submitShippingNoteInputSchema.safeParse({
    id: readString(formData, "id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shipping note selection.",
    };
  }

  let noteId = "";

  try {
    const note = await submitShippingNote(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  redirect(`/shipping-notes/${noteId}`);
}

// ---------------------------------------------------------------------------
// Selling charge actions
// ---------------------------------------------------------------------------

export async function createSellingChargeAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = createSellingChargeInputSchema.safeParse({
    shippingNoteId: readString(formData, "shippingNoteId"),
    chargeName: readString(formData, "chargeName"),
    description: readString(formData, "description"),
    quantity: readString(formData, "quantity"),
    unit: readString(formData, "unit"),
    unitPrice: readString(formData, "unitPrice"),
    currency: readString(formData, "currency"),
    exchangeRate: readString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid charge data.",
    };
  }

  try {
    await createSellingChargeForNote(parsed.data, session.user);
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${parsed.data.shippingNoteId}`);
  return { ok: true };
}

export async function updateSellingChargeAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = updateSellingChargeInputSchema.safeParse({
    id: readString(formData, "id"),
    chargeName: readString(formData, "chargeName"),
    description: readString(formData, "description"),
    quantity: readString(formData, "quantity"),
    unit: readString(formData, "unit"),
    unitPrice: readString(formData, "unitPrice"),
    currency: readString(formData, "currency"),
    exchangeRate: readString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid charge data.",
    };
  }

  const shippingNoteId = readString(formData, "shippingNoteId") ?? "";

  try {
    await updateSellingCharge(parsed.data, session.user);
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${shippingNoteId}`);
  return { ok: true };
}

export async function softDeleteSellingChargeAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = deleteSellingChargeInputSchema.safeParse({
    id: readString(formData, "id"),
    shippingNoteId: readString(formData, "shippingNoteId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid charge selection.",
    };
  }

  try {
    await softDeleteSellingCharge(parsed.data.id, parsed.data.shippingNoteId, session.user);
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${parsed.data.shippingNoteId}`);
  return { ok: true };
}
