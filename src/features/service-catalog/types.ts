import type {
  ConversionOperation,
  ServiceCatalogNature,
} from "./constants";

export interface SourceTrace {
  worksheet: string;
  rowNumber: number;
  sourceCode: string;
}

export interface ParsedServiceCatalogRow {
  worksheet: string;
  rowNumber: number;
  sourceCode: string;
  name: string;
  sourceNature: string;
  sourceStatus: string;
  primaryUnit: string | null;
  vatSourceValue: string | null;
  coreMetadataValues: readonly (string | null)[];
  convertedUnit: string | null;
  conversionFactorSource: string | null;
  conversionOperationSource: string | null;
  conversionDescription: string | null;
}

export interface CanonicalServiceCatalogItemCandidate {
  code: string;
  name: string;
  nature: ServiceCatalogNature;
  primaryUnit: string | null;
  vatRate: 8 | 10 | null;
  isActive: true;
  sourceRows: number[];
  sourceTrace: SourceTrace[];
}

export interface CanonicalUnitConversionCandidate {
  itemCode: string;
  convertedUnit: string;
  conversionFactor: string;
  operation: ConversionOperation;
  sourceDescription: string | null;
  sourceRows: number[];
  sourceTrace: SourceTrace[];
}

export interface DuplicateCodeGroup {
  code: string;
  sourceRowCount: number;
  sourceRows: number[];
  classification: "SAME_ITEM_CORE_METADATA_DIFFERENT_UNIT_CONVERSION";
}

export interface ServiceCatalogImportStats {
  sourceBusinessRows: number;
  nonblankCodeRows: number;
  uniqueCodes: number;
  duplicateCodeGroups: number;
  rowsInDuplicateCodeGroups: number;
  singletonCodeRows: number;
  natureServiceRows: number;
  natureToolSupplyRows: number;
  natureGoodsRows: number;
  vat8Rows: number;
  vat10Rows: number;
  vatNullRows: number;
  vat69Rows: number;
  unexpectedVatRows: number;
  sourceRepresentationRows: number;
  sourceRowsWithConversion: number;
  canonicalItems: number;
  canonicalUnitConversions: number;
  exactDuplicateConversionRows: number;
  conflictingCoreMetadataGroups: number;
  quarantinedRows: number;
}

export interface ServiceCatalogImportPlan {
  workbookFingerprint: string;
  workbookFingerprintPrefix: string;
  fileSizeBytes: number;
  worksheet: string;
  items: CanonicalServiceCatalogItemCandidate[];
  unitConversions: CanonicalUnitConversionCandidate[];
  duplicateGroups: DuplicateCodeGroup[];
  quarantines: readonly [];
  warnings: string[];
  stats: ServiceCatalogImportStats;
}

export type ServiceCatalogDatabaseState =
  | "EMPTY"
  | "ALREADY_IMPORTED_CANONICAL_DATASET"
  | "PARTIAL_IMPORT"
  | "CONFLICTING_EXISTING_DATA";

export interface ServiceCatalogStateDiagnostics {
  missingItems: string[];
  extraItems: string[];
  conflictingItems: string[];
  missingConversions: string[];
  extraConversions: string[];
  conflictingConversions: string[];
  provenanceMismatch: string[];
}

export interface ServiceCatalogStateClassification {
  state: ServiceCatalogDatabaseState;
  diagnostics: ServiceCatalogStateDiagnostics;
}

export interface ServiceCatalogImportExecuteOptions {
  dryRun: boolean;
  expectedHost?: string;
  expectedDatabase?: string;
  isProduction?: boolean;
}

export interface ServiceCatalogImportExecutionReport {
  stateBefore?: ServiceCatalogDatabaseState;
  status: "DRY_RUN_SUCCESS" | "IMPORTED" | "IDEMPOTENT";
  workbookFingerprintPrefix: string;
  itemsInserted: number;
  conversionsInserted: number;
  auditEventsWritten: number;
  updates: number;
  deletes: number;
  appliedDatabaseWrites: number;
  message: string;
}

export interface ServiceCatalogLookupItem {
  id: string;
  code: string;
  name: string;
  primaryUnit: string | null;
  vatRate: string | null;
}
