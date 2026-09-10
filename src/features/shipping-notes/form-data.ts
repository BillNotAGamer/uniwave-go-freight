export function readFormString(
  formData: Pick<FormData, "get">,
  key: string,
): string | undefined {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim().length > 0 ? value : undefined;
}
