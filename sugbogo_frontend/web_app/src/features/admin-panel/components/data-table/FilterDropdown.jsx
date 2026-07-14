import React from "react";
import { Filter } from "lucide-react";

/**
 * A reusable, controlled dropdown component for table column filtering.
 *
 * @param {string} filterKey - The key/ID of the column being filtered.
 * @param {string} placeholder - Default text for the empty option.
 * @param {Array} options - List of options with value and label.
 * @param {string} value - The active selected value from table state.
 * @param {Function} setColumnFilters - State setter for table filters.
 * @param {Function} handleTableFilterChange - Helper function to update the filter value.
 */
function FilterDropdown({
  filterKey,
  placeholder,
  options = [],
  value,
  setColumnFilters,
  handleTableFilterChange,
}) {
  return (
    <div className="relative flex items-center">
      <Filter className="absolute left-3 h-3.5 w-3.5 text-text-primary pointer-events-none" />

      <select
        value={value}
        onChange={(e) =>
          handleTableFilterChange(filterKey, e.target.value, setColumnFilters)
        }
        className="h-9 appearance-none rounded-md border border-stroke-strong bg-background-primary hover:bg-interaction-hover py-2 pl-9 pr-8 text-xs text-text-primary outline-none cursor-pointer focus:border-stroke-active focus:ring- focus:ring-stroke-active/10"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default FilterDropdown;
