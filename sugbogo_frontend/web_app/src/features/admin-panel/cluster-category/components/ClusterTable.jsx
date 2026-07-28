import { useState } from "react";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FiLayers } from "react-icons/fi";
import { getClusterColumns } from "./columns/clusterColumns";
import useClusters from "../hooks/useClusters";

/**
 * Displays a searchable and sortable cluster table.
 *
 * Handles table state management and connects cluster selection
 * events to the parent management screen.
 *
 * @param {Object} props
 * @param {Object|null} props.selectedCluster - Currently selected cluster.
 * @param {Function} props.onSelectCluster - Callback triggered when a row is selected.
 *
 * @returns {JSX.Element} Cluster management table.
 */
export default function ClusterTable({ selectedCluster, onSelectCluster }) {
  const columns = getClusterColumns(selectedCluster);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const { clusters, isLoading } = useClusters();

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
    return <p className="text-sm text-text-secondary">Loading clusters...</p>;
  }

  return (
    <DataTable
      data={clusters}
      columns={columns}
      onRowClick={onSelectCluster}
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
        searchPlaceholder: "Search clusters...",
        footerMetaText: "Showing clusters",
        emptyState: {
          title: "No clusters found",
          description: "Create a cluster to organize MSMEs.",
          icon: <FiLayers className="h-10 w-10 text-text-secondary" />,
        },
      }}
    />
  );
}
