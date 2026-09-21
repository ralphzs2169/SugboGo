import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";

import Button from "@/shared/components/Button";

/**
 * Provides a keyboard-accessible name search for existing managed Transit Points.
 *
 * The selector can behave as a normal field or remain open while the route
 * editor is waiting for a map-or-search Transit Point selection.
 */
export default function TransitPointSearchSelect({
  id,
  label,
  transitPoints,
  value = "",
  excludedIds = [],
  error,
  placeholder = "Search Transit Points",
  emptyMessage = "No Transit Points available.",
  alwaysOpen = false,
  autoFocus = false,
  onChange,
  onCreateNew,
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(alwaysOpen);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const excludedIdSet = useMemo(
    () => new Set(excludedIds.map(String)),
    [excludedIds],
  );
  const selectedPoint = transitPoints.find(
    (point) => String(point.id) === String(value),
  );
  const availablePoints = useMemo(
    () =>
      transitPoints.filter(
        (point) => !excludedIdSet.has(String(point.id)),
      ),
    [excludedIdSet, transitPoints],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredPoints = availablePoints.filter((point) =>
    point.name.toLocaleLowerCase().includes(normalizedQuery),
  );
  const showOptions = alwaysOpen || isOpen;

  useEffect(() => {
    if (!showOptions) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape" || alwaysOpen) {
        return;
      }

      setIsOpen(false);
      inputRef.current?.blur();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [alwaysOpen, showOptions]);

  function handleSelect(point) {
    onChange(String(point.id));
    setQuery("");

    if (!alwaysOpen) {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          value={query}
          autoFocus={autoFocus}
          placeholder={selectedPoint?.name ?? placeholder}
          aria-expanded={showOptions}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          className={`w-full rounded-lg border-2 bg-background py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary focus:border-stroke-active ${
            error ? "border-danger" : "border-stroke"
          }`}
        />
      </div>

      {/* Search results */}
      {showOptions && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-label={label ?? "Transit Points"}
          className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-stroke bg-background p-1 shadow-sm"
        >
          {filteredPoints.length ? (
            filteredPoints.map((point) => {
              const isSelected = String(point.id) === String(value);

              return (
                <button
                  key={point.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(point)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-stroke-active/20 ${
                    isSelected
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-text-primary hover:bg-surface"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{point.name}</span>
                  {isSelected && (
                    <Check
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-5 text-center text-xs text-text-secondary">
              {normalizedQuery
                ? "No Transit Points match your search."
                : emptyMessage}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      )}

      {showOptions && onCreateNew && (
        <div className="mt-2 rounded-lg border border-dashed border-stroke-strong bg-surface p-3">
          <p className="text-xs text-text-secondary">
            Can&apos;t find the required stop?
          </p>
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            className="mt-1 -ml-3"
            onClick={onCreateNew}
          >
            Create new Transit Point
          </Button>
        </div>
      )}
    </div>
  );
}
