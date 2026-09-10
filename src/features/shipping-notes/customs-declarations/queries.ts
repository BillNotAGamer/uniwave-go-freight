import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  shippingNoteCustomsDeclarations,
  type User as DbUser,
} from "@/lib/db/schema";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireAnyPermission } from "@/lib/permissions/require-permission";

import { getShippingNoteForUser } from "../queries";
import type { CustomsDeclarationDetail } from "./types";

const declarationColumns = {
  id: shippingNoteCustomsDeclarations.id,
  shippingNoteId: shippingNoteCustomsDeclarations.shippingNoteId,
  declarationNo: shippingNoteCustomsDeclarations.declarationNo,
  createdAt: shippingNoteCustomsDeclarations.createdAt,
  updatedAt: shippingNoteCustomsDeclarations.updatedAt,
} as const;

export async function listCustomsDeclarationsForNoteForUser(
  shippingNoteId: string,
  user: DbUser,
): Promise<CustomsDeclarationDetail[]> {
  requireAnyPermission(user.role, PERMISSIONS.ACCOUNTING_READ);

  if (!await getShippingNoteForUser(shippingNoteId, user)) {
    return [];
  }

  return db
    .select(declarationColumns)
    .from(shippingNoteCustomsDeclarations)
    .where(
      and(
        eq(shippingNoteCustomsDeclarations.shippingNoteId, shippingNoteId),
        isNull(shippingNoteCustomsDeclarations.deletedAt),
      ),
    )
    .orderBy(asc(shippingNoteCustomsDeclarations.createdAt));
}

