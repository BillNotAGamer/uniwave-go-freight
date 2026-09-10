import { randomUUID } from "node:crypto";

import type { PartnerCategoryCode } from "../constants";
import type { RawParsedSourceRow } from "./parse-workbook";
import type {
  CanonicalCategoryMembershipCandidate,
  CanonicalContactCandidate,
  CanonicalPartnerCandidate,
  ImportPlanStats,
  QuarantinedSourceRow,
} from "./types";

export function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeContactKey(
  partnerKey: string,
  pic: string | null,
  email: string | null,
  phone: string | null,
): string {
  const normPic = (pic ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const normEmail = (email ?? "").trim().toLowerCase();
  const normPhone = (phone ?? "").trim();

  return `${partnerKey}|||${normPic}|||${normEmail}|||${normPhone}`;
}

export interface NormalizationResult {
  partners: CanonicalPartnerCandidate[];
  contacts: CanonicalContactCandidate[];
  categoryMemberships: CanonicalCategoryMembershipCandidate[];
  quarantinedRows: QuarantinedSourceRow[];
  stats: ImportPlanStats;
  warnings: string[];
}

export function normalizeSourceRows(
  rows: RawParsedSourceRow[],
): NormalizationResult {
  const quarantinedRows: QuarantinedSourceRow[] = [];
  const warnings: string[] = [];

  let tbaPlaceholdersCount = 0;
  let unresolvedTbaContactRowsCount = 0;
  let sourceCategoryPresenceEntitiesCount = 0;
  let namedCategoryPresencesCount = 0;
  let exactDuplicateContactRowsCount = 0;

  // Track category presences
  type CategoryPresence = {
    categoryCode: PartnerCategoryCode;
    categoryHeader: string;
    isTba: boolean;
    companyName: string;
    vendorCode: string | null;
    address: string | null;
    taxId: string | null;
    contactRows: RawParsedSourceRow[];
  };

  const presences: CategoryPresence[] = [];
  let currentPresence: CategoryPresence | null = null;

  for (const row of rows) {
    const isTba =
      row.companyName.trim().toUpperCase() === "TBA" ||
      (row.vendorCode !== null && row.vendorCode.trim().toUpperCase() === "TBA");

    const compKey = isTba
      ? `TBA_${row.rowNumber}`
      : normalizeCompanyName(row.companyName);

    if (
      !currentPresence ||
      currentPresence.categoryCode !== row.categoryCode ||
      (currentPresence.isTba
        ? true
        : normalizeCompanyName(currentPresence.companyName) !== compKey)
    ) {
      currentPresence = {
        categoryCode: row.categoryCode,
        categoryHeader: row.categoryHeader,
        isTba,
        companyName: row.companyName,
        vendorCode: row.vendorCode,
        address: row.address,
        taxId: row.taxId,
        contactRows: [],
      };
      presences.push(currentPresence);
    }

    currentPresence.contactRows.push(row);
  }

  sourceCategoryPresenceEntitiesCount = presences.length;

  // Process presences
  const partnerMap = new Map<string, CanonicalPartnerCandidate>();
  const categoryMemberships: CanonicalCategoryMembershipCandidate[] = [];
  const seenMemberships = new Set<string>();

  // Contacts deduplication
  const seenContacts = new Map<string, CanonicalContactCandidate>();
  const canonicalContacts: CanonicalContactCandidate[] = [];

  for (const presence of presences) {
    if (presence.isTba) {
      tbaPlaceholdersCount++;
      for (const row of presence.contactRows) {
        unresolvedTbaContactRowsCount++;
        quarantinedRows.push({
          rowNumber: row.rowNumber,
          categoryCode: row.categoryCode,
          categoryHeader: row.categoryHeader,
          reason: "UNRESOLVED_SOURCE_PLACEHOLDER",
          rawValues: {
            stt: row.stt,
            vendorCode: row.vendorCode,
            companyName: row.companyName,
            address: row.address,
            taxId: row.taxId,
            email: row.email,
            phone: row.phone,
            pic: row.pic,
          },
        });
      }
      continue;
    }

    namedCategoryPresencesCount++;
    const partnerKey = normalizeCompanyName(presence.companyName);

    let partner = partnerMap.get(partnerKey);
    if (!partner) {
      partner = {
        id: randomUUID(),
        companyName: presence.companyName.trim(),
        vendorCode: presence.vendorCode?.trim() || null,
        address: presence.address?.trim() || null,
        taxId: presence.taxId?.trim() || null,
        sourceRowNumbers: [],
        categories: [],
      };
      partnerMap.set(partnerKey, partner);
    } else {
      // Fill in vendorCode, address, taxId if earlier presence lacked them
      if (!partner.vendorCode && presence.vendorCode) {
        partner.vendorCode = presence.vendorCode.trim();
      }
      if (!partner.address && presence.address) {
        partner.address = presence.address.trim();
      }
      if (!partner.taxId && presence.taxId) {
        partner.taxId = presence.taxId.trim();
      }
    }

    // Category membership
    if (!partner.categories.includes(presence.categoryCode)) {
      partner.categories.push(presence.categoryCode);
    }

    const membershipKey = `${partnerKey}|||${presence.categoryCode}`;
    if (!seenMemberships.has(membershipKey)) {
      seenMemberships.add(membershipKey);
      categoryMemberships.push({
        partnerCompanyName: partner.companyName,
        categoryCode: presence.categoryCode,
        sourceRowNumbers: presence.contactRows.map((r) => r.rowNumber),
      });
    }

    // Process contacts for this presence
    for (const row of presence.contactRows) {
      partner.sourceRowNumbers.push(row.rowNumber);

      const contactKey = normalizeContactKey(
        partnerKey,
        row.pic,
        row.email,
        row.phone,
      );

      const existingContact = seenContacts.get(contactKey);
      if (existingContact) {
        exactDuplicateContactRowsCount++;
        existingContact.sourceRowNumbers.push(row.rowNumber);
      } else {
        const newContact: CanonicalContactCandidate = {
          id: randomUUID(),
          partnerCompanyName: partner.companyName,
          picName: row.pic?.trim() || null,
          email: row.email?.trim().toLowerCase() || null,
          phone: row.phone?.trim() || null,
          sourceRowNumbers: [row.rowNumber],
        };
        seenContacts.set(contactKey, newContact);
        canonicalContacts.push(newContact);
      }
    }
  }

  const partners = Array.from(partnerMap.values());
  const categoriesSet = new Set(categoryMemberships.map((m) => m.categoryCode));

  const stats: ImportPlanStats = {
    sourceCategoryPresenceEntities: sourceCategoryPresenceEntitiesCount,
    tbaPlaceholders: tbaPlaceholdersCount,
    namedCategoryPresences: namedCategoryPresencesCount,
    uniqueNamedBusinessPartners: partners.length,
    sourceContactRows: rows.length,
    unresolvedTbaContactRows: unresolvedTbaContactRowsCount,
    exactDuplicateContactRows: exactDuplicateContactRowsCount,
    canonicalContactCandidates: canonicalContacts.length,
    categories: categoriesSet.size,
    categoryMemberships: categoryMemberships.length,
  };

  return {
    partners,
    contacts: canonicalContacts,
    categoryMemberships,
    quarantinedRows,
    stats,
    warnings,
  };
}
