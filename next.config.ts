import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
] as const;

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
      {
        source: "/",
        headers: [...noStoreHeaders],
      },
      {
        source: "/login",
        headers: [...noStoreHeaders],
      },
      {
        source: "/dashboard/:path*",
        headers: [...noStoreHeaders],
      },
      {
        source: "/shipping-notes/:path*",
        headers: [...noStoreHeaders],
      },
      {
        source: "/admin/:path*",
        headers: [...noStoreHeaders],
      },
      {
        source: "/tax-rules/:path*",
        headers: [...noStoreHeaders],
      },
      {
        source: "/api/auth/:path*",
        headers: [...noStoreHeaders],
      },
      {
        source: "/api/shipping-notes/:path*",
        headers: [...noStoreHeaders],
      },
      {
        source: "/api/shipping-note-exports/:path*",
        headers: [...noStoreHeaders],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/shipping-notes/[id]/exports/internal-xlsx": [
      "./assets/export-templates/shipping-note/internal-v2.xlsx",
    ],
    "/api/shipping-notes/[id]/exports/internal-pdf": [
      "./assets/fonts/noto-sans/NotoSans-Regular.ttf",
      "./assets/fonts/noto-sans/NotoSans-Bold.ttf",
    ],
  },
};

export default nextConfig;
