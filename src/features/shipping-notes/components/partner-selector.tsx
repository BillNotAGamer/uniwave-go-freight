"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  quickCreateShippingNotePartnerAction,
  searchShippingNotePartnersAction,
  type ShippingNotePartnerLookupResult,
} from "../actions";

type PartnerSelectorProps = {
  initialPartnerId?: string | null;
  initialText?: string | null;
  label: string;
  partnerFieldName: string;
  textFieldName: string;
};

const controlClassName =
  "mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

function PartnerSelectorOptions({
  activeIndex,
  listboxId,
  onAddMore,
  onChoose,
  results,
}: {
  activeIndex: number;
  listboxId: string;
  onAddMore: () => void;
  onChoose: (partner: ShippingNotePartnerLookupResult) => void;
  results: ShippingNotePartnerLookupResult[];
}) {
  return <>
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
            onClick={() => onChoose(partner)}
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
    <li className="mt-1 border-t border-border pt-1" role="presentation">
      <button
        className="w-full rounded px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onAddMore}
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        + Add more
      </button>
    </li>
  </>;
}

export function PartnerSelector({
  initialPartnerId = null,
  initialText = "",
  label,
  partnerFieldName,
  textFieldName,
}: PartnerSelectorProps) {
  const listboxId = useId();
  const inputId = useId();
  const quickAddTitleId = useId();
  const quickAddCompanyNameId = useId();
  const [query, setQuery] = useState(initialText ?? "");
  const [selected, setSelected] = useState<ShippingNotePartnerLookupResult | null>(
    initialPartnerId && initialText
      ? {
          id: initialPartnerId,
          companyName: initialText,
          vendorCode: null,
          categoryNames: [],
        }
      : null,
  );
  const [results, setResults] = useState<ShippingNotePartnerLookupResult[]>([]);
  const [manualEntry, setManualEntry] = useState(Boolean(initialText && !initialPartnerId));
  const [open, setOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddCompanyName, setQuickAddCompanyName] = useState("");
  const [quickAddVendorCode, setQuickAddVendorCode] = useState("");
  const [quickAddTaxId, setQuickAddTaxId] = useState("");
  const [quickAddAddress, setQuickAddAddress] = useState("");
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isQuickAdding, startQuickAddTransition] = useTransition();
  const requestId = useRef(0);
  const quickAddCompanyNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickAddOpen) quickAddCompanyNameRef.current?.focus();
  }, [quickAddOpen]);

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

  function openQuickAdd() {
    setQuickAddCompanyName(query.trim());
    setQuickAddVendorCode("");
    setQuickAddTaxId("");
    setQuickAddAddress("");
    setQuickAddError(null);
    setOpen(false);
    setQuickAddOpen(true);
  }

  function submitQuickAdd() {
    setQuickAddError(null);
    startQuickAddTransition(async () => {
      try {
        const result = await quickCreateShippingNotePartnerAction({
          companyName: quickAddCompanyName,
          vendorCode: quickAddVendorCode,
          taxId: quickAddTaxId,
          address: quickAddAddress,
        });
        if (!result.ok) {
          setQuickAddError(result.error);
          return;
        }

        choosePartner(result.partner);
        setQuickAddOpen(false);
      } catch {
        setQuickAddError("Partner could not be created.");
      }
    });
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập tên đối tác"
          type="text"
          value={query}
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
          <PartnerSelectorOptions activeIndex={activeIndex} listboxId={listboxId} onAddMore={openQuickAdd} onChoose={choosePartner} results={results} />
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p> : null}
      {quickAddOpen ? (
        <div
          aria-labelledby={quickAddTitleId}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !isQuickAdding) setQuickAddOpen(false);
            if (
              event.key === "Enter" &&
              !(event.target instanceof HTMLTextAreaElement)
            ) {
              event.preventDefault();
              if (!isQuickAdding && quickAddCompanyName.trim().length > 0) submitQuickAdd();
            }
          }}
          role="dialog"
        >
          <div className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-card p-5 shadow-xl">
            <div>
              <h2 className="text-base font-semibold text-foreground" id={quickAddTitleId}>Add Partner</h2>
              <p className="mt-1 text-sm text-muted-foreground">Create a reusable Partner Master record and select it here.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-foreground" htmlFor={quickAddCompanyNameId}>
              Company Name
              <input ref={quickAddCompanyNameRef} className={controlClassName} id={quickAddCompanyNameId} maxLength={255} onChange={(event) => setQuickAddCompanyName(event.target.value)} required type="text" value={quickAddCompanyName} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Vendor Code
              <input className={controlClassName} maxLength={100} onChange={(event) => setQuickAddVendorCode(event.target.value)} type="text" value={quickAddVendorCode} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Tax ID / MST
              <input className={controlClassName} maxLength={100} onChange={(event) => setQuickAddTaxId(event.target.value)} type="text" value={quickAddTaxId} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-foreground">
              Address
              <textarea className="min-h-20 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={500} onChange={(event) => setQuickAddAddress(event.target.value)} value={quickAddAddress} />
            </label>
            {quickAddError ? <p className="text-sm text-red-700 dark:text-red-400" role="alert">{quickAddError}</p> : null}
            <div className="flex justify-end gap-2">
              <button className="rounded-md border border-border px-3 py-2 text-sm" disabled={isQuickAdding} onClick={() => setQuickAddOpen(false)} type="button">Cancel</button>
              <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={isQuickAdding || quickAddCompanyName.trim().length === 0} onClick={submitQuickAdd} type="button">
                {isQuickAdding ? "Creating..." : "Create and select"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
