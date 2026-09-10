export type ExportRequestOriginMetadata = {
  requestOrigin: string;
  originHeader: string | null;
  secFetchSite: string | null;
};

export function isSameOriginRequestMetadata(
  metadata: ExportRequestOriginMetadata,
): boolean {
  if (metadata.originHeader) {
    try {
      return new URL(metadata.originHeader).origin === metadata.requestOrigin;
    } catch {
      return false;
    }
  }

  return (
    metadata.secFetchSite === "same-origin" ||
    metadata.secFetchSite === "none"
  );
}

export function buildContentDisposition(fileName: string): string {
  const fallbackName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_");
  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
