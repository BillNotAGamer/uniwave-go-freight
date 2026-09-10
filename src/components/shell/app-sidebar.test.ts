import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Role } from "@/lib/permissions/roles";

import { AppSidebarView } from "./app-sidebar";

function findButton(node: unknown): ReactElement<{
  onClick: () => void;
  type: string;
}> | null {
  if (!isValidElement(node)) return null;

  if (node.type === "button") {
    return node as ReactElement<{ onClick: () => void; type: string }>;
  }

  const children = (node.props as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const button = findButton(child);
      if (button) return button;
    }
  } else {
    return findButton(children);
  }

  return null;
}

function renderSidebar({
  collapsed = false,
  pathname = "/shipping-notes",
  role = "sale",
}: {
  collapsed?: boolean;
  pathname?: string;
  role?: Role;
} = {}): string {
  return renderToStaticMarkup(
    createElement(AppSidebarView, {
      collapsed,
      onToggle: vi.fn(),
      pathname,
      role,
    }),
  );
}

describe("AppSidebar desktop presentation", () => {
  it("renders a valid expanded state by default", () => {
    const markup = renderSidebar();

    expect(markup).toContain('data-sidebar-state="expanded"');
    expect(markup).toContain("w-64");
    expect(markup).toContain('aria-label="Collapse sidebar"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Uniwave Go");
  });

  it("uses a non-submitting button to request collapse or expansion", () => {
    const onToggle = vi.fn();
    const view = AppSidebarView({
      collapsed: false,
      onToggle,
      pathname: "/shipping-notes",
      role: "sale",
    });
    const button = findButton(view);

    expect(button?.props.type).toBe("button");
    button?.props.onClick();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders a compact collapsed rail with accessible navigation names", () => {
    const markup = renderSidebar({ collapsed: true });

    expect(markup).toContain('data-sidebar-state="collapsed"');
    expect(markup).toContain("w-[72px]");
    expect(markup).toContain('aria-label="Expand sidebar"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Shipping Notes"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('title="Shipping Notes"');
  });

  it("keeps the desktop rail sticky with independent navigation overflow", () => {
    const markup = renderSidebar();

    expect(markup).toContain("sticky top-0");
    expect(markup).toContain("h-screen");
    expect(markup).toContain("hidden");
    expect(markup).toContain("md:flex");
    expect(markup).toContain("overflow-y-auto");
  });

  it("preserves role-filtered links in collapsed mode", () => {
    const saleMarkup = renderSidebar({ collapsed: true, role: "sale" });
    const adminMarkup = renderSidebar({ collapsed: true, role: "admin" });

    expect(saleMarkup).not.toContain('href="/admin/users"');
    expect(saleMarkup).not.toContain('href="/admin/audit"');
    expect(adminMarkup).toContain('href="/admin/users"');
    expect(adminMarkup).toContain('href="/admin/audit"');
  });

  it("keeps nested routes visibly active", () => {
    const markup = renderSidebar({
      collapsed: true,
      pathname: "/shipping-notes/note-1",
    });

    expect(markup).toMatch(
      /href="\/shipping-notes"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/shipping-notes"/,
    );
  });
});
