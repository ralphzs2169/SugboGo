import React from "react";
import { ChevronDown, Filter, X } from "lucide-react";

/**
 * A reusable, controlled dropdown component for table column filtering.
 *
 * Visually distinguishes an active filter from an unset one, and offers
 * a one-click way to clear the filter without reopening the dropdown.
 */
function FilterDropdown({
  filterKey,
  placeholder,
  options = [],
  value,
  setColumnFilters,
  handleTableFilterChange,
}) {
  const isActive = Boolean(value);

  function handleClear(event) {
    // Prevent the click from also opening the native select.
    event.stopPropagation();

    handleTableFilterChange(filterKey, "", setColumnFilters);
  }

  return (
    <div className="relative flex items-center">
      <Filter
        className={`pointer-events-none absolute left-3 h-3.5 w-3.5 transition-colors ${
          isActive ? "text-primary" : "text-text-secondary"
        }`}
      />

      <select
        value={value}
        onChange={(e) =>
          handleTableFilterChange(filterKey, e.target.value, setColumnFilters)
        }
        aria-label={placeholder}
        className={`h-9 w-full cursor-pointer appearance-none rounded-lg border py-2 pl-9 text-xs font-medium outline-none transition-colors ${
          isActive ? "pr-16" : "pr-9"
        } ${
          isActive
            ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-stroke-strong bg-background text-text-primary hover:bg-interaction-hover"
        } focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10`}
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Quick clear — only shown once a filter is applied */}
      {isActive && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={`Clear ${placeholder} filter`}
          className="absolute right-8 flex h-5 w-5 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      )}

      {/* Custom dropdown indicator */}
      <ChevronDown
        className={`pointer-events-none absolute right-3 h-4 w-4 transition-colors ${
          isActive ? "text-primary" : "text-text-secondary"
        }`}
        strokeWidth={2}
      />
    </div>
  );
}

export default FilterDropdown;
