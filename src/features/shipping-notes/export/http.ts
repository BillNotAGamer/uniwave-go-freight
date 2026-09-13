export type ExportRequestOriginMetadata = {
  requestOrigin: string;
  originHeader: string | null;
  secFetchSite: string | null;
  trustedOrigin?: string | null;
  nodeEnv?: string | undefined;
};

function parseHttpOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getTrustedOrigin(metadata: ExportRequestOriginMetadata): string | null {
  // AUTH_URL is deployment-controlled configuration. Request headers and the
  // reverse proxy's internal URL must never establish the trusted origin.
  return parseHttpOrigin(metadata.trustedOrigin ?? process.env.AUTH_URL);
}

export function isSameOriginRequestMetadata(
  metadata: ExportRequestOriginMetadata,
): boolean {
  const trustedOrigin = getTrustedOrigin(metadata);
  const isProduction = (metadata.nodeEnv ?? process.env.NODE_ENV) === "production";

  if (metadata.originHeader) {
    const browserOrigin = parseHttpOrigin(metadata.originHeader);

    if (!browserOrigin) {
      return false;
    }

    if (trustedOrigin) {
      return browserOrigin === trustedOrigin;
    }

    if (isProduction) {
      return false;
    }

    return browserOrigin === parseHttpOrigin(metadata.requestOrigin);
  }

  if (isProduction && !trustedOrigin) {
    return false;
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
