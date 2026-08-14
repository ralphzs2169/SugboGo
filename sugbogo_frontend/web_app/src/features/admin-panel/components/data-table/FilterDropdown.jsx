import React from "react";
import { ChevronDown, Filter } from "lucide-react";

/**
 * A reusable, controlled dropdown component for table column filtering.
 *
 * Visually distinguishes an active filter from an unset one. Clearing
 * is handled elsewhere (e.g. a page-level "Clear filters" action).
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

  return (
    <div className="relative flex items-center">
      <Filter
        className={`pointer-events-none absolute left-3 h-3.5 w-3.5 transition-colors ${
          isActive ? "text-text-primary" : "text-text-secondary"
        }`}
      />

      <select
        value={value}
        onChange={(e) =>
          handleTableFilterChange(filterKey, e.target.value, setColumnFilters)
        }
        aria-label={placeholder}
        className={`h-9 w-full cursor-pointer appearance-none rounded-lg border py-2 pl-9 pr-9 text-xs font-medium outline-none transition-colors ${
          isActive
            ? "border-stroke-active bg-surface-muted text-text-primary hover:bg-interaction-hover"
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

      {/* Custom dropdown indicator */}
      <ChevronDown
        className={`pointer-events-none absolute right-3 h-4 w-4 transition-colors ${
          isActive ? "text-text-primary" : "text-text-secondary"
        }`}
        strokeWidth={2}
      />
    </div>
  );
}

export default FilterDropdown;
