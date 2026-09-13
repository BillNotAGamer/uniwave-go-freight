"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";

import { removeShippingNoteDocument } from "./service";
import { removeShippingNoteDocumentInputSchema } from "./validators";

export type RemoveDocumentActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function removeShippingNoteDocumentAction(
  formData: FormData,
): Promise<RemoveDocumentActionResult> {
  const { user } = await requireAuthenticatedUser();

  const id = formData.get("id")?.toString();
  const shippingNoteId = formData.get("shippingNoteId")?.toString();
  const reason = formData.get("reason")?.toString();

  const parsed = removeShippingNoteDocumentInputSchema.safeParse({
    id,
    shippingNoteId,
    reason,
  });

  if (!parsed.success) {
    return { ok: false, error: "Invalid document removal payload." };
  }

  try {
    await removeShippingNoteDocument(
      {
        documentId: parsed.data.id,
        shippingNoteId: parsed.data.shippingNoteId,
        reason: parsed.data.reason,
      },
      user,
    );
    revalidatePath(`/shipping-notes/${parsed.data.shippingNoteId}`);
    revalidatePath("/documents");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error &&
        error.message === "Document metadata was deleted, but private artifact cleanup failed. An audit event was recorded."
        ? error.message
        : "Document deletion failed.",
    };
  }
}
