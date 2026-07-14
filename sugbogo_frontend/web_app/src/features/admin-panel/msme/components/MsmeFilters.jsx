import React from "react";
import FilterDropdown from "@/features/admin-panel/components/data-table/FilterDropdown";

/**
 * Filter dropdowns for the MSME table view.
 *
 * @param {Array} columnFilters - Current table filters state.
 * @param {Function} setColumnFilters - State setter for table filters.
 * @param {Function} handleTableFilterChange - Helper function to update filter values.
 */
function MsmeFilters({
  columnFilters,
  setColumnFilters,
  handleTableFilterChange,
}) {
  const filterConfigs = [
    {
      filterKey: "cluster",
      placeholder: "All Clusters",
      options: [
        { value: "CULINARY", label: "Culinary" },
        { value: "LEISURE", label: "Leisure" },
      ],
    },
    {
      filterKey: "status",
      placeholder: "All Statuses",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "SUSPENDED", label: "Suspended" },
      ],
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {filterConfigs.map((config) => {
        // Find if TanStack currently has an active filter value for this key
        const currentFilterValue =
          columnFilters?.find((f) => f.id === config.filterKey)?.value ?? "";

        return (
          <FilterDropdown
            key={config.filterKey}
            value={currentFilterValue}
            setColumnFilters={setColumnFilters}
            handleTableFilterChange={handleTableFilterChange}
            {...config}
          />
        );
      })}
    </div>
  );
}

export default MsmeFilters;
