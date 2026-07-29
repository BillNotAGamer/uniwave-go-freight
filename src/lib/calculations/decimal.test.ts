import { describe, expect, it } from "vitest";

import {
  addDecimalStrings,
  formatScaledInteger,
  multiplyDecimalStrings,
  normalizeDecimalString,
  parseDecimalToScaledInteger,
  roundDecimalString,
  roundScaledIntegerHalfUp,
  subtractDecimalStrings,
  validateDecimalString,
} from "./decimal";

describe("decimal primitives", () => {
  it("normalizes valid decimal strings without padding during validation", () => {
    expect(validateDecimalString(" 001.230 ", {
      scale: 3,
      maxIntegerDigits: 3,
    })).toBe("1.230");
  });

  it("rejects invalid precision, negative values, and non-positive minimums", () => {
    expect(() => validateDecimalString("1.234", {
      scale: 2,
      maxIntegerDigits: 3,
    })).toThrow(/Expected at most 2 decimal places/);
    expect(() => validateDecimalString("-1.00", {
      scale: 2,
      maxIntegerDigits: 3,
    })).toThrow(/Negative decimal values are not allowed/);
    expect(() => validateDecimalString("0.00", {
      scale: 2,
      maxIntegerDigits: 3,
      minimum: "positive",
    })).toThrow(/must be positive/);
  });

  it("parses and formats scaled integers deterministically", () => {
    expect(parseDecimalToScaledInteger("12.34", 2)).toBe(BigInt(1234));
    expect(parseDecimalToScaledInteger("-0.05", 2)).toBe(BigInt(-5));
    expect(formatScaledInteger(BigInt(5), 2)).toBe("0.05");
    expect(formatScaledInteger(BigInt(-123), 2)).toBe("-1.23");
    expect(normalizeDecimalString("1.2", 4)).toBe("1.2000");
  });

  it("rounds half up for positive and negative scaled integers", () => {
    expect(roundScaledIntegerHalfUp(BigInt(1004), 3, 2)).toBe(BigInt(100));
    expect(roundScaledIntegerHalfUp(BigInt(1005), 3, 2)).toBe(BigInt(101));
    expect(roundScaledIntegerHalfUp(BigInt(-1005), 3, 2)).toBe(BigInt(-101));
    expect(roundDecimalString("1.004", 3, 2)).toBe("1.00");
    expect(roundDecimalString("1.005", 3, 2)).toBe("1.01");
    expect(roundDecimalString("-1.005", 3, 2)).toBe("-1.01");
  });

  it("multiplies decimal strings with explicit scales", () => {
    expect(multiplyDecimalStrings("1.234", 3, "2.5000", 4, 4)).toBe("3.0850");
    expect(multiplyDecimalStrings("1.005", 3, "1.0000", 4, 2)).toBe("1.01");
  });

  it("adds and subtracts decimal strings at a fixed scale", () => {
    expect(addDecimalStrings(["1.10", "2.35", "0.05"], 2)).toBe("3.50");
    expect(addDecimalStrings([], 2)).toBe("0.00");
    expect(subtractDecimalStrings("1.00", "2.50", 2)).toBe("-1.50");
  });
});
