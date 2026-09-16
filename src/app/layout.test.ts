import { runInNewContext } from "node:vm";
import React from "react";
import Script from "next/script";
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";

function themeScript() {
  const root = RootLayout({ children: "Page content" });
  const head = React.Children.toArray(root.props.children).find((child) => React.isValidElement(child) && child.type === "head");
  if (!React.isValidElement<{ children: React.ReactNode }>(head)) throw new Error("Missing head");
  const children = React.Children.toArray(head.props.children);
  expect(children.some((child) => React.isValidElement(child) && child.type === "script")).toBe(false);
  const script = children.find((child) => React.isValidElement(child) && child.type === Script);
  if (!React.isValidElement<{ id: string; strategy: string; dangerouslySetInnerHTML: { __html: string } }>(script)) throw new Error("Missing Next Script");
  expect(script.props.id).toBe("uniwave-theme-init");
  expect(script.props.strategy).toBe("beforeInteractive");
  return script.props.dangerouslySetInnerHTML.__html;
}

describe("RootLayout pre-hydration theme initialization", () => {
  it.each([
    ["dark", false, true], ["light", true, false], ["system", true, true], ["system", false, false],
    [null, true, true], ["invalid", false, false],
  ])("preserves stored %s / system dark %s", (stored, systemDark, expectedDark) => {
    const classes = new Set(["dark"]);
    runInNewContext(themeScript(), {
      localStorage: { getItem: (key: string) => { expect(key).toBe("uniwave-theme"); return stored; } },
      window: { matchMedia: () => ({ matches: systemDark }) },
      document: { documentElement: { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } } },
    });
    expect(classes.has("dark")).toBe(expectedDark);
  });

  it("fails safely when browser storage is unavailable", () => {
    expect(() => runInNewContext(themeScript(), { localStorage: { getItem: () => { throw new Error("blocked"); } } })).not.toThrow();
  });
});
