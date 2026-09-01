import { useEffect, useRef, useState } from "react";
import { Filter as FilterIcon, ChevronLeft, Check, Search } from "lucide-react";

/**
 * Generic multi-dimension filter menu for data tables.
 *
 * Renders a single "Filter" trigger button that opens a popover for
 * picking a filter dimension and then a value for it (single-select
 * per dimension). Selected filters render as removable chips next to
 * the trigger. Dimensions with more options than `searchThreshold`
 * (default 8) get an inline search box to narrow the option list.
 *
 * Usage:
 *   <FilterMenu
 *     filters={[
 *       {
 *         key: "status",
 *         label: "Status",
 *         icon: Tag, // optional
 *         options: [{ value: "active", label: "Active" }, ...],
 *         value: statusFilter,
 *         onChange: setStatusFilter,
 *       },
 *     ]}
 *     searchThreshold={8} // optional, defaults to 8
 *   />
 */
export default function FilterMenu({ filters = [], searchThreshold = 8 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDimension, setActiveDimension] = useState(null);
  const [optionSearch, setOptionSearch] = useState("");

  const containerRef = useRef(null);
  const optionSearchInputRef = useRef(null);

  const activeFilters = filters.filter((filter) => filter.value);
  const currentDimension = filters.find((f) => f.key === activeDimension);

  const filteredOptions = currentDimension
    ? currentDimension.options.filter((option) =>
        option.label.toLowerCase().includes(optionSearch.toLowerCase()),
      )
    : [];

  const showOptionSearch =
    currentDimension && currentDimension.options.length > searchThreshold;

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveDimension(null);
        setOptionSearch("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (showOptionSearch) {
      optionSearchInputRef.current?.focus();
    }
  }, [activeDimension, showOptionSearch]);

  function handleToggleOpen() {
    setIsOpen((previous) => !previous);
    setActiveDimension(null);
    setOptionSearch("");
  }

  function handleSelectDimension(key) {
    setActiveDimension(key);
    setOptionSearch("");
  }

  function handleBackToDimensions() {
    setActiveDimension(null);
    setOptionSearch("");
  }

  function handleSelectOption(filter, optionValue) {
    const nextValue = filter.value === optionValue ? "" : optionValue;
    filter.onChange(nextValue);
    setIsOpen(false);
    setActiveDimension(null);
    setOptionSearch("");
  }

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2" ref={containerRef}>
      {/* Active filter chips */}
      {activeFilters.map((filter) => {
        const selectedOption = filter.options.find(
          (option) => option.value === filter.value,
        );

        return (
          <span
            key={filter.key}
            className="inline-flex items-center gap-1.5 rounded-md border border-stroke-strong bg-surface px-3 py-2 text-xs font-medium text-text-primary"
          >
            {filter.label}: {selectedOption?.label ?? filter.value}
            <button
              type="button"
              onClick={() => filter.onChange("")}
              className="cursor-pointer text-text-secondary hover:text-text-primary"
              aria-label={`Remove ${filter.label} filter`}
            >
              ✕
            </button>
          </span>
        );
      })}

      {/* Filter trigger + popover */}
      <div className="relative">
        <button
          type="button"
          onClick={handleToggleOpen}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
            activeFilters.length > 0
              ? "border-stroke-active text-text-primary"
              : "border-stroke-strong text-text-primary hover:bg-interaction-hover"
          }`}
        >
          <FilterIcon className="h-3.5 w-3.5" />
          <span>Filter</span>
          {activeFilters.length > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-stroke-strong bg-background shadow-lg">
            {!currentDimension ? (
              <ul className="py-1">
                {filters.map((filter) => (
                  <li key={filter.key}>
                    <button
                      type="button"
                      onClick={() => handleSelectDimension(filter.key)}
                      className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-text-primary hover:bg-interaction-hover"
                    >
                      <span className="flex items-center gap-2">
                        {filter.icon && (
                          <filter.icon className="h-4 w-4 text-text-secondary" />
                        )}
                        {filter.label}
                      </span>
                      <span className="text-text-secondary">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={handleBackToDimensions}
                  className="flex w-full cursor-pointer items-center gap-1.5 border-b border-stroke px-3 py-2 text-left text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {currentDimension.label}
                </button>

                {showOptionSearch && (
                  <div className="relative border-b border-stroke px-2 py-2">
                    <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
                    <input
                      ref={optionSearchInputRef}
                      type="text"
                      value={optionSearch}
                      onChange={(e) => setOptionSearch(e.target.value)}
                      placeholder={`Search ${currentDimension.label.toLowerCase()}...`}
                      className="w-full rounded-md border border-stroke-strong bg-background py-1.5 pl-8 pr-2 text-xs text-text-primary outline-none placeholder:text-slate-400 focus:border-stroke-active"
                    />
                  </div>
                )}

                <ul className="max-h-64 overflow-y-auto py-1">
                  {filteredOptions.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-text-secondary">
                      No matches found.
                    </li>
                  ) : (
                    filteredOptions.map((option) => {
                      const isSelected =
                        currentDimension.value === option.value;

                      return (
                        <li key={option.value}>
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectOption(currentDimension, option.value)
                            }
                            className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-text-primary hover:bg-interaction-hover"
                          >
                            {option.label}
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
