import { useState } from "react";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FiTag } from "react-icons/fi";

import { getCategoryColumns } from "./columns/categoryColumns";
import useCategories from "../hooks/useCategories";

/**
 * Displays categories belonging to the selected cluster.
 *
 * Handles table state management and connects category data
 * with the reusable DataTable component.
 *
 * @param {Object} props
 * @param {Object|null} props.selectedCluster - Currently selected cluster.
 *
 * @returns {JSX.Element} Category management table.
 */
export default function CategoryTable({ selectedCluster }) {
  const columns = getCategoryColumns();

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const { categories, isLoading } = useCategories(selectedCluster);

  const handleResetFilters = () => {
    setGlobalFilter("");
    setSorting([]);
    setColumnFilters([]);
  };

  const hasActiveFilters =
    globalFilter.trim() !== "" ||
    columnFilters.length > 0 ||
    sorting.length > 0;

  if (isLoading) {
    return <p className="text-sm text-text-secondary">Loading categories...</p>;
  }

  return (
    <DataTable
      data={categories}
      columns={columns}
      state={{
        globalFilter,
        sorting,
        columnFilters,
      }}
      onGlobalFilterChange={setGlobalFilter}
      onSortingChange={setSorting}
      onColumnFiltersChange={setColumnFilters}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      config={{
        searchPlaceholder: "Search categories...",
        footerMetaText: "Showing categories",
        emptyState: {
          title: selectedCluster ? "No categories found" : "Select a cluster",

          description: selectedCluster
            ? "This cluster has no categories yet."
            : "Choose a cluster to view its categories.",

          icon: <FiTag className="h-10 w-10 text-text-secondary" />,
        },
      }}
    />
  );
}
