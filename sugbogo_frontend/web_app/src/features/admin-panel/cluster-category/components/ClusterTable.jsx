import { useState } from "react";
import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import { FiLayers } from "react-icons/fi";
import { getClusterColumns } from "./columns/clusterColumns";
import useClusters from "../hooks/useClusters";

/**
 * Displays a searchable and sortable cluster table.
 *
 * Handles table state management and connects cluster actions.
 *
 * @param {Object} props
 * @param {Array} props.clusters - List of clusters.
 * @param {boolean} props.isLoading - Whether clusters are loading.
 * @param {Function} props.onEditCluster - Callback triggered when editing a cluster.
 * @param {Function} props.onDeleteCluster - Callback triggered when deleting a cluster.
 *
 * @returns {JSX.Element}
 */
export default function ClusterTable({
  clusters,
  isLoading,
  onEditCluster,
  onDeleteCluster,
}) {
  const columns = getClusterColumns(onEditCluster, onDeleteCluster);

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
    return <p className="text-sm text-text-secondary">Loading clusters...</p>;
  }

  return (
    <DataTable
      data={clusters}
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
