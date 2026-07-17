import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/shipping-notes/[id]/exports/internal-xlsx": [
      "./assets/export-templates/shipping-note/internal-v1.xlsx",
    ],
  },
};

export default nextConfig;
