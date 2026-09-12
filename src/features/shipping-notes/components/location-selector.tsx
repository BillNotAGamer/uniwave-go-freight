"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import type { RoutingLocationApplicability } from "@/features/locations/constants";

import {
  searchShippingNoteLocationsAction,
  type ShippingNoteLocationLookupResult,
} from "../actions";

export type LocationSelectorMode = "ocean" | "air" | "domestic" | "custom";

const applicabilityByModeAndField: Record<
  LocationSelectorMode,
  Record<string, RoutingLocationApplicability>
> = {
  ocean: {
    portOfLoading: "sea_pol",
    portOfDischarge: "sea_pod",
    finalDestination: "sea_final_destination",
  },
  air: {
    aol: "air_aol",
    aod: "air_aod",
    finalDestination: "air_final_destination",
  },
  domestic: {
    domesticOrigin: "domestic_origin",
    domesticDestination: "domestic_destination",
  },
  custom: {
    customOrigin: "custom_origin",
    customDestination: "custom_destination",
  },
};

const controlClassName =
  "mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

function formatLocationType(type: string): string {
  return type.length > 0 ? `${type[0]?.toUpperCase()}${type.slice(1)}` : "Location";
}

/** Maps routing field and active mode to the sole authoritative applicability. */
export function getShippingNoteLocationApplicability(
  mode: LocationSelectorMode,
  fieldName: string,
): RoutingLocationApplicability {
  const applicability = applicabilityByModeAndField[mode][fieldName];
  if (!applicability) {
    throw new Error(`No Location applicability is defined for ${mode}:${fieldName}.`);
  }
  return applicability;
}

/** Selection intentionally persists only the canonical Location code. */
export function getSelectedLocationFormValue(
  location: Pick<ShippingNoteLocationLookupResult, "code">,
): string {
  return location.code;
}

type LocationSelectorProps = {
  applicability: RoutingLocationApplicability;
  initialValue?: string | null;
  label: string;
  name: string;
  required?: boolean;
};

export function LocationSelector({
  applicability,
  initialValue = "",
  label,
  name,
  required = false,
}: LocationSelectorProps) {
  const inputId = useId();
  const listboxId = useId();
  const initialText = initialValue ?? "";
  const [displayValue, setDisplayValue] = useState(initialText);
  const [formValue, setFormValue] = useState(initialText);
  const [selected, setSelected] = useState<ShippingNoteLocationLookupResult | null>(null);
  const [results, setResults] = useState<ShippingNoteLocationLookupResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    const query = displayValue.trim();
    if (selected || query.length === 0) return;

    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const nextResults = await searchShippingNoteLocationsAction(query, applicability);
          if (currentRequest !== requestId.current) return;
          setResults(nextResults);
          setOpen(true);
          setActiveIndex(-1);
          setError(null);
        } catch {
          if (currentRequest !== requestId.current) return;
          setResults([]);
          setOpen(false);
          setError("Location lookup is unavailable. You can enter the routing text manually.");
        }
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [applicability, displayValue, selected]);

  function chooseLocation(location: ShippingNoteLocationLookupResult) {
    requestId.current += 1;
    setSelected(location);
    setDisplayValue(`${location.code} - ${location.name}`);
    setFormValue(getSelectedLocationFormValue(location));
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    setError(null);
  }

  function beginManualEntry() {
    requestId.current += 1;
    setSelected(null);
    setDisplayValue(formValue);
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseLocation(results[activeIndex]!);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={formValue} />
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={inputId}>
          {label}
        </label>
        {selected ? (
          <button
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={beginManualEntry}
            type="button"
          >
            Nhập thủ công
          </button>
        ) : null}
      </div>
      <div className="relative mt-1">
        <input
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          aria-required={required}
          className={`${controlClassName} pr-20`}
          id={inputId}
          onChange={(event) => {
            requestId.current += 1;
            setSelected(null);
            setDisplayValue(event.target.value);
            setFormValue(event.target.value);
            if (event.target.value.trim().length === 0) {
              setResults([]);
              setOpen(false);
            }
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search code or Location name"
          required={required}
          role="combobox"
          type="text"
          value={displayValue}
        />
        {isPending ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            Searching...
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Search Master Data or enter routing text manually.</p>
      {open ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matching master locations.</li>
          ) : (
            results.map((location, index) => (
              <li aria-selected={activeIndex === index} key={`${location.code}-${location.name}`} role="option">
                <button
                  className={`w-full rounded px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    activeIndex === index ? "bg-muted" : "hover:bg-muted"
                  }`}
                  id={`${listboxId}-${index}`}
                  onClick={() => chooseLocation(location)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <span className="block truncate font-medium text-foreground">{location.code} - {location.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {[formatLocationType(location.type), location.countryCode].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-700 dark:text-red-400" role="alert">{error}</p> : null}
    </div>
  );
}
