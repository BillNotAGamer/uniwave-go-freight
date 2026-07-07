const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const GENERIC_MAX_INTEGER_DIGITS = 1000;

export type DecimalMinimum = "positive" | "nonNegative";

export type DecimalValidationOptions = {
  scale: number;
  maxIntegerDigits: number;
  allowNegative?: boolean;
  minimum?: DecimalMinimum;
};

function powerOfTen(exponent: number): bigint {
  return BigInt(10) ** BigInt(exponent);
}

function normalizeIntegerPart(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}

function isZeroValue(integerPart: string, fractionalPart: string): boolean {
  return integerPart === "0" && /^0*$/.test(fractionalPart);
}

export function validateDecimalString(
  value: string,
  options: DecimalValidationOptions,
): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error("Decimal value is required.");
  }

  if (!DECIMAL_PATTERN.test(trimmedValue)) {
    throw new Error(`Invalid decimal value: "${value}".`);
  }

  const isNegative = trimmedValue.startsWith("-");

  if (isNegative && !options.allowNegative) {
    throw new Error(`Negative decimal values are not allowed: "${value}".`);
  }

  const unsignedValue = isNegative ? trimmedValue.slice(1) : trimmedValue;
  const [rawIntegerPart, fractionalPart = ""] = unsignedValue.split(".");
  const integerPart = normalizeIntegerPart(rawIntegerPart) || "0";

  if (fractionalPart.length > options.scale) {
    throw new Error(
      `Invalid decimal precision for "${value}". Expected at most ${options.scale} decimal places.`,
    );
  }

  if (integerPart.length > options.maxIntegerDigits) {
    throw new Error(
      `Decimal value exceeds maximum supported digits: "${value}".`,
    );
  }

  const isZero = isZeroValue(integerPart, fractionalPart);

  if (options.minimum === "positive" && (isNegative || isZero)) {
    throw new Error(`Decimal value must be positive: "${value}".`);
  }

  if (options.minimum === "nonNegative" && isNegative) {
    throw new Error(`Decimal value must not be negative: "${value}".`);
  }

  const sign = isNegative ? "-" : "";
  return fractionalPart.length > 0
    ? `${sign}${integerPart}.${fractionalPart}`
    : `${sign}${integerPart}`;
}

export function parseDecimalToScaledInteger(
  value: string,
  scale: number,
): bigint {
  const normalizedValue = validateDecimalString(value, {
    scale,
    maxIntegerDigits: GENERIC_MAX_INTEGER_DIGITS,
    allowNegative: true,
  });
  const isNegative = normalizedValue.startsWith("-");
  const unsignedValue = isNegative ? normalizedValue.slice(1) : normalizedValue;
  const [integerPart, fractionalPart = ""] = unsignedValue.split(".");
  const paddedFractionalPart = fractionalPart.padEnd(scale, "0");
  const scaledValue = BigInt(`${integerPart}${paddedFractionalPart}`);

  return isNegative ? scaledValue * BigInt(-1) : scaledValue;
}

export function formatScaledInteger(value: bigint, scale: number): string {
  const isNegative = value < BigInt(0);
  const absoluteValue = isNegative ? value * BigInt(-1) : value;

  if (scale === 0) {
    return `${isNegative ? "-" : ""}${absoluteValue.toString()}`;
  }

  const rawValue = absoluteValue.toString().padStart(scale + 1, "0");
  const integerPart = rawValue.slice(0, -scale) || "0";
  const fractionalPart = rawValue.slice(-scale);

  return `${isNegative ? "-" : ""}${integerPart}.${fractionalPart}`;
}

export function roundScaledIntegerHalfUp(
  value: bigint,
  fromScale: number,
  toScale: number,
): bigint {
  if (fromScale === toScale) {
    return value;
  }

  if (fromScale < toScale) {
    return value * powerOfTen(toScale - fromScale);
  }

  const scaleDifference = fromScale - toScale;
  const factor = powerOfTen(scaleDifference);
  const quotient = value / factor;
  const remainder = value % factor;
  const absoluteRemainder =
    remainder < BigInt(0) ? remainder * BigInt(-1) : remainder;
  const threshold = factor / BigInt(2);

  if (absoluteRemainder >= threshold) {
    return quotient + (value < BigInt(0) ? BigInt(-1) : BigInt(1));
  }

  return quotient;
}

export function normalizeDecimalString(value: string, scale: number): string {
  return formatScaledInteger(parseDecimalToScaledInteger(value, scale), scale);
}

export function roundDecimalString(
  value: string,
  fromScale: number,
  toScale: number,
): string {
  return formatScaledInteger(
    roundScaledIntegerHalfUp(
      parseDecimalToScaledInteger(value, fromScale),
      fromScale,
      toScale,
    ),
    toScale,
  );
}

export function multiplyDecimalStrings(
  left: string,
  leftScale: number,
  right: string,
  rightScale: number,
  resultScale: number,
): string {
  const leftValue = parseDecimalToScaledInteger(left, leftScale);
  const rightValue = parseDecimalToScaledInteger(right, rightScale);
  const product = leftValue * rightValue;

  return formatScaledInteger(
    roundScaledIntegerHalfUp(
      product,
      leftScale + rightScale,
      resultScale,
    ),
    resultScale,
  );
}

export function addDecimalStrings(
  values: readonly string[],
  scale: number,
): string {
  let total = BigInt(0);

  for (const value of values) {
    total += parseDecimalToScaledInteger(value, scale);
  }

  return formatScaledInteger(total, scale);
}

export function subtractDecimalStrings(
  left: string,
  right: string,
  scale: number,
): string {
  const difference =
    parseDecimalToScaledInteger(left, scale) -
    parseDecimalToScaledInteger(right, scale);

  return formatScaledInteger(difference, scale);
}
