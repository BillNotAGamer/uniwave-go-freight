import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { logAuditEvent } from "@/lib/audit/log";
import { db } from "@/lib/db/client";
import {
  businessPartners,
  partnerCategories,
  partnerCategoryMembers,
  partnerContacts,
  type User as DbUser,
} from "@/lib/db/schema";

import type { PartnerCategoryCode } from "./constants";
import { assertCanMutatePartners } from "./permissions";
import type {
  BusinessPartnerDetail,
  PartnerCategoryDetail,
  PartnerContactDetail,
} from "./types";
import {
  createPartnerContactInputSchema,
  createPartnerInputSchema,
  restorePartnerInputSchema,
  setPartnerCategoriesInputSchema,
  softDeletePartnerContactInputSchema,
  softDeletePartnerInputSchema,
  updatePartnerContactInputSchema,
  updatePartnerInputSchema,
  type CreatePartnerInput,
  type PartnerContactInput,
  type UpdatePartnerInput,
} from "./validators";

export async function createPartner(
  input: CreatePartnerInput,
  actor: DbUser,
): Promise<BusinessPartnerDetail> {
  assertCanMutatePartners(actor);
  const parsedInput = createPartnerInputSchema.parse(input);

  return db.transaction(async (tx) => {
    const partnerId = randomUUID();
    const now = new Date();

    const [createdPartner] = await tx
      .insert(businessPartners)
      .values({
        id: partnerId,
        companyName: parsedInput.companyName,
        vendorCode: parsedInput.vendorCode ?? null,
        address: parsedInput.address ?? null,
        taxId: parsedInput.taxId ?? null,
        isActive: parsedInput.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .returning();

    if (!createdPartner) {
      throw new Error("Failed to create business partner.");
    }

    const createdContacts: PartnerContactDetail[] = [];
    if (parsedInput.contacts && parsedInput.contacts.length > 0) {
      for (const contact of parsedInput.contacts) {
        const contactId = randomUUID();
        const [createdContact] = await tx
          .insert(partnerContacts)
          .values({
            id: contactId,
            partnerId,
            picName: contact.picName ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          })
          .returning();

        if (createdContact) {
          createdContacts.push(createdContact);
        }
      }
    }

    const assignedCategories: PartnerCategoryDetail[] = [];
    if (parsedInput.categoryCodes && parsedInput.categoryCodes.length > 0) {
      const uniqueCodes = Array.from(new Set(parsedInput.categoryCodes));
      const categories = await tx
        .select({
          id: partnerCategories.id,
          code: partnerCategories.code,
          name: partnerCategories.name,
          description: partnerCategories.description,
          isActive: partnerCategories.isActive,
        })
        .from(partnerCategories)
        .where(inArray(partnerCategories.code, uniqueCodes));

      for (const category of categories) {
        await tx.insert(partnerCategoryMembers).values({
          id: randomUUID(),
          partnerId,
          categoryId: category.id,
          createdAt: now,
        });
        assignedCategories.push(category);
      }
    }

    const detail: BusinessPartnerDetail = {
      ...createdPartner,
      contacts: createdContacts,
      categories: assignedCategories,
    };

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.create",
      entityType: "partner",
      entityId: createdPartner.id,
      after: detail,
    });

    return detail;
  });
}

export async function updatePartner(
  id: string,
  input: UpdatePartnerInput,
  actor: DbUser,
): Promise<BusinessPartnerDetail> {
  assertCanMutatePartners(actor);
  const parsedInput = updatePartnerInputSchema.parse({ ...input, id });

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(businessPartners)
      .where(
        and(
          eq(businessPartners.id, id),
          isNull(businessPartners.deletedAt),
        ),
      )
      .limit(1);

    if (!current) {
      throw new Error("Business partner not found or has been deleted.");
    }

    const now = new Date();
    const [updated] = await tx
      .update(businessPartners)
      .set({
        companyName: parsedInput.companyName,
        vendorCode: parsedInput.vendorCode ?? null,
        address: parsedInput.address ?? null,
        taxId: parsedInput.taxId ?? null,
        isActive:
          parsedInput.isActive !== undefined
            ? parsedInput.isActive
            : current.isActive,
        updatedAt: now,
      })
      .where(eq(businessPartners.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update business partner.");
    }

    const contacts = await tx
      .select()
      .from(partnerContacts)
      .where(
        and(
          eq(partnerContacts.partnerId, id),
          isNull(partnerContacts.deletedAt),
        ),
      );

    const categories = await tx
      .select({
        id: partnerCategories.id,
        code: partnerCategories.code,
        name: partnerCategories.name,
        description: partnerCategories.description,
        isActive: partnerCategories.isActive,
      })
      .from(partnerCategoryMembers)
      .innerJoin(
        partnerCategories,
        eq(partnerCategoryMembers.categoryId, partnerCategories.id),
      )
      .where(eq(partnerCategoryMembers.partnerId, id));

    const detail: BusinessPartnerDetail = {
      ...updated,
      contacts,
      categories,
    };

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.update",
      entityType: "partner",
      entityId: id,
      before: current,
      after: detail,
    });

    return detail;
  });
}

export async function setPartnerCategories(
  partnerId: string,
  categoryCodes: PartnerCategoryCode[],
  actor: DbUser,
): Promise<PartnerCategoryDetail[]> {
  assertCanMutatePartners(actor);
  const parsedInput = setPartnerCategoriesInputSchema.parse({
    partnerId,
    categoryCodes,
  });

  return db.transaction(async (tx) => {
    const [partner] = await tx
      .select({ id: businessPartners.id })
      .from(businessPartners)
      .where(
        and(
          eq(businessPartners.id, partnerId),
          isNull(businessPartners.deletedAt),
        ),
      )
      .limit(1);

    if (!partner) {
      throw new Error("Business partner not found or has been deleted.");
    }

    const previousCategories = await tx
      .select({
        id: partnerCategories.id,
        code: partnerCategories.code,
        name: partnerCategories.name,
        description: partnerCategories.description,
        isActive: partnerCategories.isActive,
      })
      .from(partnerCategoryMembers)
      .innerJoin(
        partnerCategories,
        eq(partnerCategoryMembers.categoryId, partnerCategories.id),
      )
      .where(eq(partnerCategoryMembers.partnerId, partnerId));

    // Remove existing memberships
    await tx
      .delete(partnerCategoryMembers)
      .where(eq(partnerCategoryMembers.partnerId, partnerId));

    const newCategories: PartnerCategoryDetail[] = [];
    if (parsedInput.categoryCodes.length > 0) {
      const categories = await tx
        .select({
          id: partnerCategories.id,
          code: partnerCategories.code,
          name: partnerCategories.name,
          description: partnerCategories.description,
          isActive: partnerCategories.isActive,
        })
        .from(partnerCategories)
        .where(inArray(partnerCategories.code, parsedInput.categoryCodes));

      const now = new Date();
      for (const category of categories) {
        await tx.insert(partnerCategoryMembers).values({
          id: randomUUID(),
          partnerId,
          categoryId: category.id,
          createdAt: now,
        });
        newCategories.push(category);
      }
    }

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.category.update",
      entityType: "partner",
      entityId: partnerId,
      before: previousCategories,
      after: newCategories,
    });

    return newCategories;
  });
}

export async function addPartnerContact(
  partnerId: string,
  input: PartnerContactInput,
  actor: DbUser,
): Promise<PartnerContactDetail> {
  assertCanMutatePartners(actor);
  const parsedInput = createPartnerContactInputSchema.parse({
    partnerId,
    ...input,
  });

  return db.transaction(async (tx) => {
    const [partner] = await tx
      .select({ id: businessPartners.id })
      .from(businessPartners)
      .where(
        and(
          eq(businessPartners.id, partnerId),
          isNull(businessPartners.deletedAt),
        ),
      )
      .limit(1);

    if (!partner) {
      throw new Error("Business partner not found or has been deleted.");
    }

    const now = new Date();
    const contactId = randomUUID();
    const [created] = await tx
      .insert(partnerContacts)
      .values({
        id: contactId,
        partnerId,
        picName: parsedInput.picName ?? null,
        email: parsedInput.email ?? null,
        phone: parsedInput.phone ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create partner contact.");
    }

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.contact.create",
      entityType: "partner_contact",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}

export async function updatePartnerContact(
  id: string,
  input: PartnerContactInput,
  actor: DbUser,
): Promise<PartnerContactDetail> {
  assertCanMutatePartners(actor);
  const parsedInput = updatePartnerContactInputSchema.parse({ id, ...input });

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(partnerContacts)
      .where(
        and(
          eq(partnerContacts.id, id),
          isNull(partnerContacts.deletedAt),
        ),
      )
      .limit(1);

    if (!current) {
      throw new Error("Partner contact not found or has been deleted.");
    }

    const now = new Date();
    const [updated] = await tx
      .update(partnerContacts)
      .set({
        picName: parsedInput.picName ?? null,
        email: parsedInput.email ?? null,
        phone: parsedInput.phone ?? null,
        updatedAt: now,
      })
      .where(eq(partnerContacts.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update partner contact.");
    }

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.contact.update",
      entityType: "partner_contact",
      entityId: id,
      before: current,
      after: updated,
    });

    return updated;
  });
}

export async function softDeletePartnerContact(
  id: string,
  actor: DbUser,
): Promise<PartnerContactDetail> {
  assertCanMutatePartners(actor);
  softDeletePartnerContactInputSchema.parse({ id });

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(partnerContacts)
      .where(
        and(
          eq(partnerContacts.id, id),
          isNull(partnerContacts.deletedAt),
        ),
      )
      .limit(1);

    if (!current) {
      throw new Error("Partner contact not found or already deleted.");
    }

    const now = new Date();
    const [updated] = await tx
      .update(partnerContacts)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(partnerContacts.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to soft-delete partner contact.");
    }

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.contact.soft_delete",
      entityType: "partner_contact",
      entityId: id,
      before: current,
      after: updated,
    });

    return updated;
  });
}

export async function softDeletePartner(
  id: string,
  actor: DbUser,
): Promise<BusinessPartnerDetail> {
  assertCanMutatePartners(actor);
  softDeletePartnerInputSchema.parse({ id });

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(businessPartners)
      .where(
        and(
          eq(businessPartners.id, id),
          isNull(businessPartners.deletedAt),
        ),
      )
      .limit(1);

    if (!current) {
      throw new Error("Business partner not found or already deleted.");
    }

    const now = new Date();
    const [updated] = await tx
      .update(businessPartners)
      .set({
        deletedAt: now,
        isActive: false,
        updatedAt: now,
      })
      .where(eq(businessPartners.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to soft-delete business partner.");
    }

    const contacts = await tx
      .select()
      .from(partnerContacts)
      .where(
        and(
          eq(partnerContacts.partnerId, id),
          isNull(partnerContacts.deletedAt),
        ),
      );

    const categories = await tx
      .select({
        id: partnerCategories.id,
        code: partnerCategories.code,
        name: partnerCategories.name,
        description: partnerCategories.description,
        isActive: partnerCategories.isActive,
      })
      .from(partnerCategoryMembers)
      .innerJoin(
        partnerCategories,
        eq(partnerCategoryMembers.categoryId, partnerCategories.id),
      )
      .where(eq(partnerCategoryMembers.partnerId, id));

    const detail: BusinessPartnerDetail = {
      ...updated,
      contacts,
      categories,
    };

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.soft_delete",
      entityType: "partner",
      entityId: id,
      before: current,
      after: detail,
    });

    return detail;
  });
}

export async function restorePartner(
  id: string,
  actor: DbUser,
): Promise<BusinessPartnerDetail> {
  assertCanMutatePartners(actor);
  restorePartnerInputSchema.parse({ id });

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(businessPartners)
      .where(eq(businessPartners.id, id))
      .limit(1);

    if (!current) {
      throw new Error("Business partner not found.");
    }

    const now = new Date();
    const [updated] = await tx
      .update(businessPartners)
      .set({
        deletedAt: null,
        isActive: true,
        updatedAt: now,
      })
      .where(eq(businessPartners.id, id))
      .returning();

    if (!updated) {
      throw new Error("Failed to restore business partner.");
    }

    const contacts = await tx
      .select()
      .from(partnerContacts)
      .where(
        and(
          eq(partnerContacts.partnerId, id),
          isNull(partnerContacts.deletedAt),
        ),
      );

    const categories = await tx
      .select({
        id: partnerCategories.id,
        code: partnerCategories.code,
        name: partnerCategories.name,
        description: partnerCategories.description,
        isActive: partnerCategories.isActive,
      })
      .from(partnerCategoryMembers)
      .innerJoin(
        partnerCategories,
        eq(partnerCategoryMembers.categoryId, partnerCategories.id),
      )
      .where(eq(partnerCategoryMembers.partnerId, id));

    const detail: BusinessPartnerDetail = {
      ...updated,
      contacts,
      categories,
    };

    await logAuditEvent(tx, {
      actorUserId: actor.id,
      action: "partner.restore",
      entityType: "partner",
      entityId: id,
      before: current,
      after: detail,
    });

    return detail;
  });
}
