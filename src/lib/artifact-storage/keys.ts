export type ArtifactExportType = "excel" | "pdf";

const ARTIFACT_EXTENSIONS = {
  excel: "xlsx",
  pdf: "pdf",
} as const satisfies Record<ArtifactExportType, string>;

function assertSafeExportId(exportId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(exportId)) {
    throw new Error("Export ID cannot be used as an artifact storage key.");
  }
}

export function getArtifactFileExtension(exportType: ArtifactExportType): string {
  return ARTIFACT_EXTENSIONS[exportType];
}

export function buildArtifactStorageKey(input: {
  exportId: string;
  exportType: ArtifactExportType;
}): string {
  assertSafeExportId(input.exportId);

  return `shipping-note-exports/${input.exportId}/artifact.${getArtifactFileExtension(
    input.exportType,
  )}`;
}
