"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { readFormString } from "@/features/shipping-notes/form-data";

import {
  addCustomsDeclaration,
  removeCustomsDeclaration,
} from "./mutations";
import {
  addCustomsDeclarationInputSchema,
  removeCustomsDeclarationInputSchema,
} from "./validators";

export type CustomsDeclarationActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

export async function addCustomsDeclarationAction(
  _state: CustomsDeclarationActionResult,
  formData: FormData,
): Promise<CustomsDeclarationActionResult> {
  const { user } = await requireAuthenticatedUser();
  const shippingNoteId = readFormString(formData, "shippingNoteId") ?? "";
  const declarationNo = readFormString(formData, "declarationNo") ?? "";

  const parsed = addCustomsDeclarationInputSchema.safeParse({
    shippingNoteId,
    declarationNo,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid Customs Declaration No.",
    };
  }

  try {
    const created = await addCustomsDeclaration(parsed.data, user);
    revalidatePath(`/shipping-notes/${created.shippingNoteId}`);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  return { ok: true };
}

export async function removeCustomsDeclarationAction(
  _state: CustomsDeclarationActionResult,
  formData: FormData,
): Promise<CustomsDeclarationActionResult> {
  const { user } = await requireAuthenticatedUser();
  const id = readFormString(formData, "id") ?? "";
  const shippingNoteId = readFormString(formData, "shippingNoteId") ?? "";

  const parsed = removeCustomsDeclarationInputSchema.safeParse({
    id,
    shippingNoteId,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid Customs Declaration removal.",
    };
  }

  try {
    await removeCustomsDeclaration(parsed.data, user);
    revalidatePath(`/shipping-notes/${parsed.data.shippingNoteId}`);
  } catch (error) {
    return { ok: false, error: parseActionError(error) };
  }

  return { ok: true };
}
