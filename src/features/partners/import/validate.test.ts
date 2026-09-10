import { describe, expect, it } from "vitest";

import {
  assertCanonicalInvariants,
  CANONICAL_C0_INVARIANTS,
  InvariantViolationError,
  validateCandidateIntegrity,
} from "./validate";

describe("Import Invariants and Integrity Validation", () => {
  it("passes when actual stats perfectly match expected canonical invariants", () => {
    expect(() =>
      assertCanonicalInvariants({ ...CANONICAL_C0_INVARIANTS }),
    ).not.toThrow();
  });

  it("throws InvariantViolationError listing exact discrepancies when stats differ", () => {
    const mismatched = {
      ...CANONICAL_C0_INVARIANTS,
      uniqueNamedBusinessPartners: 93, // expected 94
      exactDuplicateContactRows: 15, // expected 16
    };

    expect(() => assertCanonicalInvariants(mismatched)).toThrow(
      InvariantViolationError,
    );

    try {
      assertCanonicalInvariants(mismatched);
    } catch (err) {
      const error = err as InvariantViolationError;
      expect(error.discrepancies).toEqual([
        {
          field: "uniqueNamedBusinessPartners",
          expected: 94,
          actual: 93,
        },
        {
          field: "exactDuplicateContactRows",
          expected: 16,
          actual: 15,
        },
      ]);
      expect(error.message).toContain("uniqueNamedBusinessPartners: expected 94, received 93");
    }
  });

  it("validates candidate integrity rejecting invalid candidates", () => {
    // Blank company name
    expect(() =>
      validateCandidateIntegrity(
        [
          {
            id: "p-1",
            companyName: "   ",
            vendorCode: null,
            address: null,
            taxId: null,
            sourceRowNumbers: [1],
            categories: ["factory_sea"],
          },
        ],
        [],
      ),
    ).toThrowError(/blank company name/);

    // Partner without categories
    expect(() =>
      validateCandidateIntegrity(
        [
          {
            id: "p-1",
            companyName: "Valid Company",
            vendorCode: null,
            address: null,
            taxId: null,
            sourceRowNumbers: [1],
            categories: [],
          },
        ],
        [],
      ),
    ).toThrowError(/has no assigned categories/);

    // Contact without any contact info
    expect(() =>
      validateCandidateIntegrity(
        [],
        [
          {
            id: "c-1",
            partnerCompanyName: "Valid Company",
            picName: null,
            email: null,
            phone: null,
            sourceRowNumbers: [1],
          },
        ],
      ),
    ).toThrowError(/has no contact information/);
  });
});
