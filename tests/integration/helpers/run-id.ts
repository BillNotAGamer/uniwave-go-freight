import { randomBytes } from "node:crypto";

function formatUtcTimestamp(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const second = date.getUTCSeconds().toString().padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function createIntegrationRunId(label: string): string {
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `IT-${label}-${formatUtcTimestamp(new Date())}-${suffix}`;
}

export function toEmailToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
