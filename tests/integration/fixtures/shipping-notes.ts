import { eq } from "drizzle-orm";

import { shippingNotes, type User } from "@/lib/db/schema";
import { createShippingNoteDraft } from "@/features/shipping-notes/mutations";
import { shippingNoteDraftInputSchema } from "@/features/shipping-notes/validators";
import type { ShippingNoteDetail } from "@/features/shipping-notes/types";

import { db } from "../setup/database";

export function draftInput(runId: string, label: string) {
  return shippingNoteDraftInputSchema.parse({
    jobsheetNo: `${runId}-${label}`,
    shippingMode: "sea_export",
    mawbHawbNo: `${runId}-MAWB-${label}`,
    shipperText: `Shipper ${runId} ${label}`,
    consigneeText: `Consignee ${runId} ${label}`,
    customerText: `Customer ${runId} ${label}`,
    agentText: `Agent ${runId} ${label}`,
    aol: "SGN",
    aod: "LAX",
    finalDestination: "Los Angeles",
    volumeValue: "2.5",
    volumeUnit: "cbm",
    exchangeRate: "25000",
  });
}

export async function createDraftFor(
  user: User,
  runId: string,
  label: string,
): Promise<ShippingNoteDetail> {
  return createShippingNoteDraft(draftInput(runId, label), user);
}

export async function softDeleteNote(noteId: string): Promise<void> {
  await db
    .update(shippingNotes)
    .set({ deletedAt: new Date() })
    .where(eq(shippingNotes.id, noteId));
}
