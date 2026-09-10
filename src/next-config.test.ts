import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

function headerMap(headers: Array<{ key: string; value: string }>) {
  return new Map(headers.map((header) => [header.key, header.value]));
}

describe("Next.js production asset tracing", () => {
  it("includes only required internal export runtime assets for each export route", () => {
    expect(nextConfig.outputFileTracingIncludes).toEqual({
      "/api/shipping-notes/[id]/exports/internal-xlsx": [
        "./assets/export-templates/shipping-note/internal-v2.xlsx",
      ],
      "/api/shipping-notes/[id]/exports/internal-pdf": [
        "./assets/fonts/noto-sans/NotoSans-Regular.ttf",
        "./assets/fonts/noto-sans/NotoSans-Bold.ttf",
      ],
    });
  });
});

describe("Next.js production security policy", () => {
  it("suppresses the framework powered-by response header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("applies a DB-free baseline security header policy to all routes", async () => {
    const headers = await nextConfig.headers?.();
    const globalHeaders = headers?.find((entry) => entry.source === "/:path*");

    expect(globalHeaders).toBeDefined();

    const values = headerMap(globalHeaders?.headers ?? []);
    expect(values.get("X-Content-Type-Options")).toBe("nosniff");
    expect(values.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(values.get("Permissions-Policy")).toContain("camera=()");
    expect(values.get("Permissions-Policy")).toContain("microphone=()");
    expect(values.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(values.get("Content-Security-Policy")).toContain("base-uri 'self'");
    expect(values.get("Content-Security-Policy")).toContain("form-action 'self'");
    expect(values.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(values.get("X-Frame-Options")).toBe("DENY");
    expect(values.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(values.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(values.has("Strict-Transport-Security")).toBe(false);
  });

  it("marks sensitive app and API route families as no-store without covering static assets", async () => {
    const headers = await nextConfig.headers?.();
    const sources = new Map(headers?.map((entry) => [entry.source, entry.headers]) ?? []);
    const noStoreSources = [
      "/",
      "/login",
      "/dashboard/:path*",
      "/shipping-notes/:path*",
      "/admin/:path*",
      "/tax-rules/:path*",
      "/api/auth/:path*",
      "/api/shipping-notes/:path*",
      "/api/shipping-note-exports/:path*",
    ];

    for (const source of noStoreSources) {
      const values = headerMap(sources.get(source) ?? []);
      expect(values.get("Cache-Control")).toBe("private, no-store, max-age=0");
      expect(values.get("Pragma")).toBe("no-cache");
    }

    expect(sources.has("/_next/:path*")).toBe(false);
    expect(sources.has("/assets/:path*")).toBe(false);
  });
});
