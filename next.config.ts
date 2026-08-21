import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
