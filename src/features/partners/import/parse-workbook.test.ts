import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  extractCellValueText,
  parseWorkbook,
} from "./parse-workbook";

describe("parseWorkbook", () => {
  it("extracts cell value text across strings, numbers, booleans, dates, and richText", () => {
    expect(extractCellValueText("  hello world  ")).toBe("hello world");
    expect(extractCellValueText(12345)).toBe("12345");
    expect(extractCellValueText(true)).toBe("true");
    expect(extractCellValueText(null)).toBe("");
    expect(extractCellValueText(undefined)).toBe("");
    expect(
      extractCellValueText({
        richText: [{ text: "Hello " }, { text: "World" }],
      }),
    ).toBe("Hello World");
    expect(
      extractCellValueText({
        text: "test@example.com",
        hyperlink: "mailto:test@example.com",
      }),
    ).toBe("test@example.com");
  });

  it("parses synthetic workbook with category header and data rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    // Row 1: table header
    sheet.addRow(["STT", "VENDOR CODE", "COMPANY NAME", "ADDRESS", "TAX ID", "EMAIL", "PHONE", "PIC"]);
    // Row 2: category header
    sheet.addRow([null, "FACTORY SEA", null, null, null, null, null, null]);
    // Row 3: partner 1 contact 1
    sheet.addRow(["1", "SYN-01", "Synthetic Shipper A", "123 Port St", "0102030405", "ops@shipper-a.test", "+84 901 000 001", "Ms. Alpha"]);
    // Row 4: partner 1 contact 2
    sheet.addRow(["1", "SYN-01", "Synthetic Shipper A", "123 Port St", "0102030405", "sales@shipper-a.test", "+84 901 000 002", "Mr. Beta"]);
    // Row 5: empty row
    sheet.addRow([null, null, null, null, null, null, null, null]);
    // Row 6: second category header
    sheet.addRow([null, "AIR FACTORY DATA", null, null, null, null, null, null]);
    // Row 7: partner 2
    sheet.addRow(["1", "SYN-02", "Synthetic Shipper B", "456 Air Ave", "0203040506", "air@shipper-b.test", "+84 902 000 001", "Ms. Gamma"]);

    const result = parseWorkbook(workbook);

    expect(result.categoryHeadersFound).toEqual(["FACTORY SEA", "AIR FACTORY DATA"]);
    expect(result.dataRows).toHaveLength(3);
    expect(result.dataRows[0].categoryCode).toBe("factory_sea");
    expect(result.dataRows[0].companyName).toBe("Synthetic Shipper A");
    expect(result.dataRows[1].companyName).toBe("Synthetic Shipper A");
    expect(result.dataRows[2].categoryCode).toBe("air_factory");
    expect(result.dataRows[2].companyName).toBe("Synthetic Shipper B");
  });

  it("fails closed on unrecognized category headers", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.addRow(["STT", "VENDOR CODE", "COMPANY NAME", "ADDRESS", "TAX ID", "EMAIL", "PHONE", "PIC"]);
    sheet.addRow([null, "UNRECOGNIZED MYSTERY CATEGORY", null, null, null, null, null, null]);

    expect(() => parseWorkbook(workbook)).toThrowError(
      /Unrecognized category header "UNRECOGNIZED MYSTERY CATEGORY"/,
    );
  });

  it("fails closed if data row occurs before any category header", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");

    sheet.addRow(["STT", "VENDOR CODE", "COMPANY NAME", "ADDRESS", "TAX ID", "EMAIL", "PHONE", "PIC"]);
    sheet.addRow(["1", "SYN-01", "Orphan Company", "Nowhere", "0000", "orphan@test.test", "123", "None"]);

    expect(() => parseWorkbook(workbook)).toThrowError(
      /Encountered data row at row 2 before any category header/,
    );
  });
});
