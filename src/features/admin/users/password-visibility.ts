export type PasswordVisibility = "hidden" | "visible";

export const INITIAL_PASSWORD_VISIBILITY: PasswordVisibility = "hidden";

export function togglePasswordVisibility(
  current: PasswordVisibility,
): PasswordVisibility {
  return current === "hidden" ? "visible" : "hidden";
}

export function getPasswordInputType(
  visibility: PasswordVisibility,
): "password" | "text" {
  return visibility === "hidden" ? "password" : "text";
}
