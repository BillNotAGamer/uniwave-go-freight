import type { PartnerCategoryCode } from "../constants";

export interface SourceContactRow {
  rowNumber: number;
  categoryCode: PartnerCategoryCode;
  categoryHeader: string;
  stt: string | null;
  vendorCode: string | null;
  companyName: string;
  address: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  pic: string | null;
}

export interface QuarantinedSourceRow {
  rowNumber: number;
  categoryCode: PartnerCategoryCode;
  categoryHeader: string;
  reason: "UNRESOLVED_SOURCE_PLACEHOLDER" | "INVALID_SOURCE_DATA";
  rawValues: {
    stt?: string | null;
    vendorCode?: string | null;
    companyName?: string | null;
    address?: string | null;
    taxId?: string | null;
    email?: string | null;
    phone?: string | null;
    pic?: string | null;
  };
}

export interface CanonicalPartnerCandidate {
  id: string;
  companyName: string;
  vendorCode: string | null;
  address: string | null;
  taxId: string | null;
  sourceRowNumbers: number[];
  categories: PartnerCategoryCode[];
}

export interface CanonicalContactCandidate {
  id: string;
  partnerCompanyName: string;
  picName: string | null;
  email: string | null;
  phone: string | null;
  sourceRowNumbers: number[];
}

export interface CanonicalCategoryMembershipCandidate {
  partnerCompanyName: string;
  categoryCode: PartnerCategoryCode;
  sourceRowNumbers: number[];
}

export interface ImportPlanStats {
  sourceCategoryPresenceEntities: number;
  tbaPlaceholders: number;
  namedCategoryPresences: number;
  uniqueNamedBusinessPartners: number;
  sourceContactRows: number;
  unresolvedTbaContactRows: number;
  exactDuplicateContactRows: number;
  canonicalContactCandidates: number;
  categories: number;
  categoryMemberships: number;
}

export interface PartnerImportPlan {
  workbookFingerprint: string;
  workbookFingerprintPrefix: string;
  fileSizeBytes: number;
  categories: readonly PartnerCategoryCode[];
  partners: CanonicalPartnerCandidate[];
  contacts: CanonicalContactCandidate[];
  categoryMemberships: CanonicalCategoryMembershipCandidate[];
  quarantinedRows: QuarantinedSourceRow[];
  stats: ImportPlanStats;
  warnings: string[];
}

export interface ImportExecuteOptions {
  dryRun: boolean;
  expectedHost?: string;
  expectedDatabase?: string;
  isProduction?: boolean;
}

export interface PartnerImportStateDiagnostics {
  missingPartners: string[];
  extraPartners: string[];
  missingContacts: string[];
  extraContacts: string[];
  missingMemberships: string[];
  extraMemberships: string[];
  categoryMismatch: string[];
  provenanceMismatch: string[];
}

export type DatabaseImportState =
  | "EMPTY"
  | "ALREADY_IMPORTED_CANONICAL_DATASET"
  | "CONFLICTING_EXISTING_DATA"
  | "PARTIAL_IMPORT";
