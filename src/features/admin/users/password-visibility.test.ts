import { describe, expect, it } from "vitest";

import {
  getPasswordInputType,
  INITIAL_PASSWORD_VISIBILITY,
  togglePasswordVisibility,
} from "./password-visibility";

describe("password visibility", () => {
  it("defaults to hidden, reveals, then masks the same field again", () => {
    expect(getPasswordInputType(INITIAL_PASSWORD_VISIBILITY)).toBe("password");

    const visible = togglePasswordVisibility(INITIAL_PASSWORD_VISIBILITY);
    expect(getPasswordInputType(visible)).toBe("text");

    const hiddenAgain = togglePasswordVisibility(visible);
    expect(getPasswordInputType(hiddenAgain)).toBe("password");
  });
});
