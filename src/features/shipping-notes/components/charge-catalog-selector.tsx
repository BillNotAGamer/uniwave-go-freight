"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  searchShippingNoteServiceCatalogAction,
  type ShippingNoteServiceCatalogLookupResult,
} from "../actions";

export type InitialCatalogSelection = {
  id: string;
  code: string | null;
  name: string;
  primaryUnit: string | null;
  vatRate: string | null;
};

type ChargeCatalogSelectorProps = {
  initialItem?: InitialCatalogSelection | null;
  initialChargeName?: string;
  onUnitSelect?: (unit: string) => void;
};

const controlClassName =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20";

function formatCatalogVat(vatRate: string | null | undefined): string {
  if (vatRate === null || vatRate === undefined || vatRate === "") {
    return "Chưa xác định";
  }
  const numeric = Number(vatRate);
  return Number.isNaN(numeric) ? vatRate : `${numeric}%`;
}

export function ChargeCatalogSelector({
  initialItem,
  initialChargeName = "",
  onUnitSelect,
}: ChargeCatalogSelectorProps) {
  const listboxId = useId();
  const inputId = useId();
  const [manualMode, setManualMode] = useState(!initialItem?.id);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ShippingNoteServiceCatalogLookupResult | null>(
    initialItem && initialItem.id
      ? {
          id: initialItem.id,
          code: initialItem.code ?? "",
          name: initialItem.name,
          primaryUnit: initialItem.primaryUnit,
          vatRate: initialItem.vatRate,
        }
      : null,
  );
  const [manualChargeName, setManualChargeName] = useState(
    initialChargeName || (initialItem ? initialItem.name : ""),
  );
  const [results, setResults] = useState<ShippingNoteServiceCatalogLookupResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (manualMode || selected || trimmed.length === 0) {
      return;
    }

    const currentReq = ++requestId.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const items = await searchShippingNoteServiceCatalogAction(trimmed);
          if (currentReq === requestId.current) {
            setResults(items);
            setOpen(true);
            setActiveIndex(-1);
            setError(null);
          }
        } catch {
          if (currentReq === requestId.current) {
            setResults([]);
            setOpen(false);
            setError("Không thể tải danh mục dịch vụ. Bạn có thể chuyển sang nhập thủ công.");
          }
        }
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [manualMode, query, selected]);

  function handleSelectItem(item: ShippingNoteServiceCatalogLookupResult) {
    requestId.current += 1;
    setSelected(item);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    setError(null);
    if (item.primaryUnit && onUnitSelect) {
      onUnitSelect(item.primaryUnit);
    }
  }

  function handleClearSelection() {
    requestId.current += 1;
    setSelected(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleSwitchToManual() {
    requestId.current += 1;
    setSelected(null);
    setQuery("");
    setResults([]);
    setOpen(false);
    setManualMode(true);
  }

  function handleSwitchToCatalog() {
    requestId.current += 1;
    setManualMode(false);
    setSelected(null);
    setQuery("");
    setResults([]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelectItem(results[activeIndex]!);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (manualMode) {
    return (
      <div className="grid gap-1">
        {/* Explicitly clear any stale catalog FK in manual mode */}
        <input type="hidden" name="serviceCatalogItemId" value="" />
        <div className="flex items-baseline justify-between gap-2">
          <label
            className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            htmlFor={inputId}
          >
            Tên chi phí (Thủ công)
          </label>
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={handleSwitchToCatalog}
          >
            Chọn từ danh mục
          </button>
        </div>
        <input
          className={controlClassName}
          id={inputId}
          name="chargeName"
          type="text"
          value={manualChargeName}
          onChange={(e) => setManualChargeName(e.target.value)}
          placeholder="Nhập tên chi phí tự do..."
          required
        />
      </div>
    );
  }

  return (
    <div className="relative grid gap-1">
      {/* Hidden inputs submit authoritative catalog item ID and chargeName */}
      <input
        type="hidden"
        name="serviceCatalogItemId"
        value={selected ? selected.id : ""}
      />
      <input
        type="hidden"
        name="chargeName"
        value={selected ? selected.name : ""}
      />

      <div className="flex items-baseline justify-between gap-2">
        <label
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
          htmlFor={inputId}
        >
          Danh mục dịch vụ
        </label>
        <button
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          onClick={handleSwitchToManual}
        >
          Nhập thủ công
        </button>
      </div>

      {selected ? (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-2.5 text-sm shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-semibold text-foreground">
                [{selected.code}] {selected.name}
              </span>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Đơn vị: {selected.primaryUnit ?? "-"}</span>
                <span>VAT danh mục: {formatCatalogVat(selected.vatRate)}</span>
              </div>
            </div>
            <button
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              onClick={handleClearSelection}
            >
              Thay đổi
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-expanded={open}
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
            }
            className={`${controlClassName} pr-20`}
            id={inputId}
            onChange={(event) => {
              requestId.current += 1;
              setQuery(event.target.value);
              if (event.target.value.trim().length === 0) {
                setResults([]);
                setOpen(false);
              }
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm theo mã hoặc tên dịch vụ..."
            role="combobox"
            type="text"
            value={query}
            required
          />
          {isPending ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              Đang tìm…
            </span>
          ) : null}

          {open ? (
            <ul
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
              id={listboxId}
              role="listbox"
            >
              {results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Không tìm thấy dịch vụ phù hợp.
                </li>
              ) : (
                results.map((item, index) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={activeIndex === index}
                  >
                    <button
                      className={`w-full rounded px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        activeIndex === index ? "bg-muted" : "hover:bg-muted"
                      }`}
                      id={`${listboxId}-${index}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectItem(item)}
                      type="button"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">
                          [{item.code}] {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          VAT: {formatCatalogVat(item.vatRate)}
                        </span>
                      </div>
                      {item.primaryUnit ? (
                        <span className="block text-xs text-muted-foreground">
                          Đơn vị: {item.primaryUnit}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      )}

      {error ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
