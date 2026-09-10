"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  searchShippingNotePartnersAction,
  type ShippingNotePartnerLookupResult,
} from "../actions";

type PartnerSelectorProps = {
  label: string;
  partnerFieldName: string;
  textFieldName: string;
};

const controlClassName =
  "mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function PartnerSelector({
  label,
  partnerFieldName,
  textFieldName,
}: PartnerSelectorProps) {
  const listboxId = useId();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ShippingNotePartnerLookupResult | null>(null);
  const [results, setResults] = useState<ShippingNotePartnerLookupResult[]>([]);
  const [manualEntry, setManualEntry] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (selected || manualEntry || trimmedQuery.length === 0) {
      return;
    }

    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const nextResults = await searchShippingNotePartnersAction(trimmedQuery);
          if (currentRequest === requestId.current) {
            setResults(nextResults);
            setOpen(true);
            setActiveIndex(-1);
            setError(null);
          }
        } catch {
          if (currentRequest === requestId.current) {
            setResults([]);
            setOpen(false);
            setError("Partner lookup is unavailable. You can enter the party manually.");
          }
        }
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [manualEntry, query, selected]);

  function choosePartner(partner: ShippingNotePartnerLookupResult) {
    requestId.current += 1;
    setSelected(partner);
    setQuery(partner.companyName);
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    setError(null);
  }

  function clearSelection() {
    requestId.current += 1;
    setSelected(null);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choosePartner(results[activeIndex]!);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (manualEntry) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-sm font-medium text-foreground" htmlFor={inputId}>
            {label}
          </label>
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              requestId.current += 1;
              setManualEntry(false);
              setQuery("");
            }}
            type="button"
          >
            Chọn Partner
          </button>
        </div>
        <input
          className={controlClassName}
          id={inputId}
          name={textFieldName}
          placeholder="Nhập tên đối tác"
          type="text"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {selected ? <input name={partnerFieldName} type="hidden" value={selected.id} /> : null}
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={inputId}>
          {label}
        </label>
        <button
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            clearSelection();
            setManualEntry(true);
          }}
          type="button"
        >
          Nhập thủ công
        </button>
      </div>
      <div className="relative mt-1">
        <input
          aria-autocomplete="list"
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          className={`${controlClassName} pr-20`}
          id={inputId}
          onChange={(event) => {
            requestId.current += 1;
            setSelected(null);
            setQuery(event.target.value);
            if (event.target.value.trim().length === 0) {
              setResults([]);
              setOpen(false);
            }
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tìm theo tên, mã hoặc MST"
          role="combobox"
          type="text"
          value={query}
        />
        {selected ? (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={clearSelection}
            type="button"
          >
            Clear
          </button>
        ) : isPending ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Searching…
          </span>
        ) : null}
      </div>
      {open ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No active Partners found.</li>
          ) : (
            results.map((partner, index) => (
              <li key={partner.id} role="option" aria-selected={activeIndex === index}>
                <button
                  className={`w-full rounded px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeIndex === index ? "bg-muted" : "hover:bg-muted"
                  }`}
                  id={`${listboxId}-${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choosePartner(partner)}
                  type="button"
                >
                  <span className="block truncate font-medium text-foreground">{partner.companyName}</span>
                  {partner.vendorCode || partner.categoryNames.length > 0 ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[partner.vendorCode, partner.categoryNames[0]].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
