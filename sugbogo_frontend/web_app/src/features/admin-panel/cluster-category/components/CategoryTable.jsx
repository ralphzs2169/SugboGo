import { useState } from "react";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FiTag } from "react-icons/fi";
import { getCategoryColumns } from "./columns/categoryColumns";

/**
 * Displays the category management table.
 *
 * Handles table state management and connects category actions.
 *
 * @param {Object} props
 * @param {Array} props.categories - List of categories.
 * @param {boolean} props.isLoading - Whether categories are loading.
 * @param {Function} props.onEditCategory - Callback triggered when editing a category.
 * @param {Function} props.onDeleteCategory - Callback triggered when deleting a category.
 *
 * @returns {JSX.Element}
 */
export default function CategoryTable({
  categories,
  isLoading,
  onEditCategory,
  onDeleteCategory,
}) {
  const columns = getCategoryColumns(onEditCategory, onDeleteCategory);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

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
          title: "No categories found",
          description: "Create a category to organize MSMEs.",
          icon: <FiTag className="h-10 w-10 text-text-secondary" />,
        },
      }}
    />
  );
}
