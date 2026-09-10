import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildPartnerImportPlanFromBuffer } from "./plan";

describe("buildPartnerImportPlan", () => {
  it("generates deterministic fingerprint and plan from in-memory synthetic buffer", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.addRow(["STT", "VENDOR CODE", "COMPANY NAME", "ADDRESS", "TAX ID", "EMAIL", "PHONE", "PIC"]);
    sheet.addRow([null, "FACTORY SEA", null, null, null, null, null, null]);
    sheet.addRow(["1", "S1", "Synthetic Partner 1", "Addr 1", "T1", "info@syn1.test", "+84 901", "Alice"]);
    sheet.addRow(["2", "S2", "Synthetic Partner 2", "Addr 2", "T2", "info@syn2.test", "+84 902", "Bob"]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const plan = await buildPartnerImportPlanFromBuffer(buffer, {
      enforceCanonicalInvariants: false,
    });

    expect(plan.workbookFingerprint).toBeDefined();
    expect(plan.workbookFingerprint.length).toBe(64);
    expect(plan.workbookFingerprintPrefix.length).toBe(16);
    expect(plan.partners).toHaveLength(2);
    expect(plan.contacts).toHaveLength(2);
    expect(plan.categoryMemberships).toHaveLength(2);
    expect(plan.stats.uniqueNamedBusinessPartners).toBe(2);
    expect(plan.stats.canonicalContactCandidates).toBe(2);
    expect(plan.stats.categories).toBe(1);
  });
});
