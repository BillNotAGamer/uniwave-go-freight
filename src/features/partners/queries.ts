import "server-only";

import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  businessPartners,
  partnerCategories,
  partnerCategoryMembers,
  partnerContacts,
  type User as DbUser,
} from "@/lib/db/schema";

import type { PartnerCategoryCode } from "./constants";
import { assertCanReadPartners } from "./permissions";
import type {
  BusinessPartnerDetail,
  BusinessPartnerListItem,
  ListPartnersFilter,
  PartnerCategoryDetail,
  PartnerContactDetail,
} from "./types";
import { listPartnersFilterSchema } from "./validators";

function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

export async function getPartnerById(
  id: string,
  actor: DbUser,
): Promise<BusinessPartnerDetail | null> {
  assertCanReadPartners(actor);

  const [partner] = await db
    .select({
      id: businessPartners.id,
      vendorCode: businessPartners.vendorCode,
      companyName: businessPartners.companyName,
      address: businessPartners.address,
      taxId: businessPartners.taxId,
      isActive: businessPartners.isActive,
      createdAt: businessPartners.createdAt,
      updatedAt: businessPartners.updatedAt,
      deletedAt: businessPartners.deletedAt,
    })
    .from(businessPartners)
    .where(
      and(
        eq(businessPartners.id, id),
        isNull(businessPartners.deletedAt),
      ),
    )
    .limit(1);

  if (!partner) {
    return null;
  }

  const contacts: PartnerContactDetail[] = await db
    .select({
      id: partnerContacts.id,
      partnerId: partnerContacts.partnerId,
      picName: partnerContacts.picName,
      email: partnerContacts.email,
      phone: partnerContacts.phone,
      createdAt: partnerContacts.createdAt,
      updatedAt: partnerContacts.updatedAt,
      deletedAt: partnerContacts.deletedAt,
    })
    .from(partnerContacts)
    .where(
      and(
        eq(partnerContacts.partnerId, id),
        isNull(partnerContacts.deletedAt),
      ),
    )
    .orderBy(asc(partnerContacts.createdAt), asc(partnerContacts.id));

  const categoryRows = await db
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
    .where(eq(partnerCategoryMembers.partnerId, id))
    .orderBy(asc(partnerCategories.name), asc(partnerCategories.code));

  return {
    ...partner,
    contacts,
    categories: categoryRows,
  };
}

export async function listPartners(
  filter: ListPartnersFilter,
  actor: DbUser,
): Promise<BusinessPartnerListItem[]> {
  assertCanReadPartners(actor);

  const parsedFilter = listPartnersFilterSchema.parse(filter);
  const conditions: SQL[] = [isNull(businessPartners.deletedAt)];

  if (parsedFilter.activeOnly) {
    conditions.push(eq(businessPartners.isActive, true));
  }

  if (parsedFilter.categoryCode) {
    const matchingPartnersSubquery = db
      .select({ partnerId: partnerCategoryMembers.partnerId })
      .from(partnerCategoryMembers)
      .innerJoin(
        partnerCategories,
        eq(partnerCategoryMembers.categoryId, partnerCategories.id),
      )
      .where(eq(partnerCategories.code, parsedFilter.categoryCode));

    conditions.push(inArray(businessPartners.id, matchingPartnersSubquery));
  }

  if (parsedFilter.search) {
    const escaped = `%${escapeLike(parsedFilter.search)}%`;
    const searchCondition = or(
      ilike(businessPartners.companyName, escaped),
      ilike(businessPartners.vendorCode, escaped),
      ilike(businessPartners.taxId, escaped),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const partners = await db
    .select({
      id: businessPartners.id,
      vendorCode: businessPartners.vendorCode,
      companyName: businessPartners.companyName,
      address: businessPartners.address,
      taxId: businessPartners.taxId,
      isActive: businessPartners.isActive,
      createdAt: businessPartners.createdAt,
      updatedAt: businessPartners.updatedAt,
    })
    .from(businessPartners)
    .where(and(...conditions))
    .orderBy(asc(businessPartners.companyName), asc(businessPartners.id))
    .limit(parsedFilter.limit)
    .offset(parsedFilter.offset);

  if (partners.length === 0) {
    return [];
  }

  const partnerIds = partners.map((p) => p.id);

  const categoryMemberships = await db
    .select({
      partnerId: partnerCategoryMembers.partnerId,
      category: {
        id: partnerCategories.id,
        code: partnerCategories.code,
        name: partnerCategories.name,
        description: partnerCategories.description,
        isActive: partnerCategories.isActive,
      },
    })
    .from(partnerCategoryMembers)
    .innerJoin(
      partnerCategories,
      eq(partnerCategoryMembers.categoryId, partnerCategories.id),
    )
    .where(inArray(partnerCategoryMembers.partnerId, partnerIds))
    .orderBy(asc(partnerCategories.name));

  const categoriesByPartnerId = new Map<string, PartnerCategoryDetail[]>();
  for (const row of categoryMemberships) {
    const list = categoriesByPartnerId.get(row.partnerId) ?? [];
    list.push(row.category);
    categoriesByPartnerId.set(row.partnerId, list);
  }

  return partners.map((partner) => ({
    ...partner,
    categories: categoriesByPartnerId.get(partner.id) ?? [],
  }));
}

export async function searchPartners(
  searchTerm: string,
  actor: DbUser,
  options: {
    limit?: number;
    activeOnly?: boolean;
    categoryCode?: PartnerCategoryCode;
  } = {},
): Promise<BusinessPartnerListItem[]> {
  return listPartners(
    {
      search: searchTerm,
      limit: options.limit ?? 20,
      activeOnly: options.activeOnly ?? true,
      categoryCode: options.categoryCode,
    },
    actor,
  );
}

export async function listPartnerCategories(
  actor: DbUser,
): Promise<PartnerCategoryDetail[]> {
  assertCanReadPartners(actor);

  return db
    .select({
      id: partnerCategories.id,
      code: partnerCategories.code,
      name: partnerCategories.name,
      description: partnerCategories.description,
      isActive: partnerCategories.isActive,
    })
    .from(partnerCategories)
    .where(eq(partnerCategories.isActive, true))
    .orderBy(asc(partnerCategories.name), asc(partnerCategories.code));
}
