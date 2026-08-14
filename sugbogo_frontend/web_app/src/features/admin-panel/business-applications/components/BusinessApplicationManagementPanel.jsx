import { useNavigate } from "react-router-dom";
import { ChevronDown, Clock, FileText, Tag } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import getBusinessApplicationColumns from "../columns/businessApplicationColumns";
import useBusinessApplications from "../hooks/useBusinessApplications";
import useBusinessApplicationTableState from "../hooks/useBusinessApplicationTableState";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Pending Review" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
];

const QUEUE_STATUS_OPTIONS = [
  { value: "on_time", label: "On time" },
  { value: "approaching", label: "Approaching" },
  { value: "overdue", label: "Overdue" },
  { value: "resolved", label: "Resolved" },
];

/**
 * A pill-shaped filter select with active-state styling, used for the
 * toolbar-level filters above the table. Clearing an individual filter
 * happens by re-selecting the placeholder, or via the page-level
 * "Clear filters" action.
 */
function FilterPill({ icon: Icon, placeholder, options, value, onChange }) {
  const isActive = Boolean(value);

  return (
    <div className="relative flex items-center">
      <Icon
        className={`pointer-events-none absolute left-3.5 h-3.5 w-3.5 transition-colors ${
          isActive ? "text-text-primary" : "text-text-secondary"
        }`}
      />

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
        className={`h-9 cursor-pointer appearance-none rounded-full border py-2 pl-9 pr-8 text-sm font-medium outline-none transition-colors ${
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

      <ChevronDown
        className={`pointer-events-none absolute right-3 h-3.5 w-3.5 transition-colors ${
          isActive ? "text-text-primary" : "text-text-secondary"
        }`}
        strokeWidth={2}
      />
    </div>
  );
}

/**
 * Management panel for merchant business applications.
 *
 * Handles server-side search, status filtering, queue-status filtering,
 * sorting, pagination, and navigation to the dedicated application review page.
 */
export default function BusinessApplicationManagementPanel() {
  const navigate = useNavigate();

  const {
    globalFilter,
    setGlobalFilter,
    statusFilter,
    setStatusFilter,
    queueStatusFilter,
    setQueueStatusFilter,
    sorting,
    setSorting,
    pagination,
    setPagination,
    params,
    hasActiveFilters,
    handleResetFilters,
  } = useBusinessApplicationTableState();

  const {
    applications,
    totalItems,
    pageCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useBusinessApplications(params);

  function handleReviewApplication(application) {
    navigate(`/admin-panel/business/application/${application.id}`);
  }

  const columns = getBusinessApplicationColumns(handleReviewApplication);

  function renderFilters() {
    return (
      <>
        {/* Application status filter */}
        <FilterPill
          icon={Tag}
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />

        {/* Queue status filter */}
        <FilterPill
          icon={Clock}
          placeholder="All queue statuses"
          options={QUEUE_STATUS_OPTIONS}
          value={queueStatusFilter}
          onChange={setQueueStatusFilter}
        />
      </>
    );
  }

  return (
    <DataTable
      data={applications}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      onRetry={refetch}
      pagination={pagination}
      state={{
        globalFilter,
        sorting,
      }}
      pageCount={pageCount}
      totalItems={totalItems}
      onPaginationChange={setPagination}
      onGlobalFilterChange={setGlobalFilter}
      onSortingChange={setSorting}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      slots={{
        renderFilters,
      }}
      config={{
        searchPlaceholder: "Search merchant applications...",

        emptyState: {
          title: "No business applications yet",
          description:
            "New applications will appear here once merchants submit them.",
          icon: <FileText className="h-10 w-10 text-text-secondary" />,
        },

        noResultsState: {
          title: "No business applications found",
        },

        errorState: {
          title: "Unable to load business applications",
          message: "The requested business applications could not be loaded.",
        },
      }}
    />
  );
}
