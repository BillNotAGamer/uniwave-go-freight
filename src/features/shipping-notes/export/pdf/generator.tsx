import "server-only";

import { createHash } from "node:crypto";
import path from "node:path";

import { Font, renderToBuffer } from "@react-pdf/renderer";

import {
  INTERNAL_PDF_FONT_FAMILY,
  INTERNAL_PDF_LAYOUT_VERSION,
} from "../constants";
import { buildInternalPdfFileName } from "../filename";
import type { InternalShippingNoteExportDto } from "../types";
import { InternalShippingNotePdfDocument } from "./document";

export type GeneratedInternalShippingNotePdf = {
  buffer: Buffer;
  fileName: string;
  checksumSha256: string;
  layoutVersion: string;
};

let fontsRegistered = false;

const regularFontPath = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "noto-sans",
  "NotoSans-Regular.ttf",
);

const boldFontPath = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "noto-sans",
  "NotoSans-Bold.ttf",
);

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function registerPdfFonts(): void {
  if (fontsRegistered) {
    return;
  }

  Font.register({
    family: INTERNAL_PDF_FONT_FAMILY,
    fonts: [
      {
        src: regularFontPath,
        fontWeight: 400,
      },
      {
        src: boldFontPath,
        fontWeight: 700,
      },
    ],
  });

  fontsRegistered = true;
}

export async function generateInternalShippingNotePdf(
  exportData: InternalShippingNoteExportDto,
  generatedAt = new Date(),
): Promise<GeneratedInternalShippingNotePdf> {
  registerPdfFonts();

  const buffer = await renderToBuffer(
    <InternalShippingNotePdfDocument
      exportData={exportData}
      generatedAt={generatedAt}
    />,
  );

  return {
    buffer,
    fileName: buildInternalPdfFileName(exportData, generatedAt),
    checksumSha256: sha256(buffer),
    layoutVersion: INTERNAL_PDF_LAYOUT_VERSION,
  };
}
