import type {
  CanonicalContactCandidate,
  CanonicalPartnerCandidate,
  ImportPlanStats,
} from "./types";

export const CANONICAL_C0_INVARIANTS: ImportPlanStats = {
  sourceCategoryPresenceEntities: 99,
  tbaPlaceholders: 2,
  namedCategoryPresences: 97,
  uniqueNamedBusinessPartners: 94,
  sourceContactRows: 349,
  unresolvedTbaContactRows: 2,
  exactDuplicateContactRows: 16,
  canonicalContactCandidates: 331,
  categories: 7,
  categoryMemberships: 97,
};

export class InvariantViolationError extends Error {
  readonly discrepancies: Array<{
    field: keyof ImportPlanStats;
    expected: number;
    actual: number;
  }>;

  constructor(
    discrepancies: Array<{
      field: keyof ImportPlanStats;
      expected: number;
      actual: number;
    }>,
  ) {
    const details = discrepancies
      .map((d) => `  - ${d.field}: expected ${d.expected}, received ${d.actual}`)
      .join("\n");
    super(`Canonical import invariants check failed:\n${details}`);
    this.name = "InvariantViolationError";
    this.discrepancies = discrepancies;
  }
}

export function assertCanonicalInvariants(
  actual: ImportPlanStats,
  expected: ImportPlanStats = CANONICAL_C0_INVARIANTS,
): void {
  const discrepancies: Array<{
    field: keyof ImportPlanStats;
    expected: number;
    actual: number;
  }> = [];

  for (const key of Object.keys(expected) as Array<keyof ImportPlanStats>) {
    if (actual[key] !== expected[key]) {
      discrepancies.push({
        field: key,
        expected: expected[key],
        actual: actual[key],
      });
    }
  }

  if (discrepancies.length > 0) {
    throw new InvariantViolationError(discrepancies);
  }
}

export function validateCandidateIntegrity(
  partners: CanonicalPartnerCandidate[],
  contacts: CanonicalContactCandidate[],
): void {
  for (const partner of partners) {
    if (!partner.companyName || partner.companyName.trim().length === 0) {
      throw new Error(`Partner candidate ${partner.id} has blank company name.`);
    }

    if (partner.categories.length === 0) {
      throw new Error(
        `Partner candidate "${partner.companyName}" has no assigned categories.`,
      );
    }
  }

  for (const contact of contacts) {
    if (!contact.picName && !contact.email && !contact.phone) {
      throw new Error(
        `Contact candidate ${contact.id} for "${contact.partnerCompanyName}" has no contact information.`,
      );
    }
  }
}
