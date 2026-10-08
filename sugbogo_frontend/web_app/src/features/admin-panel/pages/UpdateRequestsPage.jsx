import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText, Tag } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import PageHeader from "@/features/admin-panel/components/PageHeader";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDebounce from "@/shared/hooks/useDebounce";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import businessUpdateRequestColumns from "../business-update-requests/columns/businessUpdateRequestColumns";
import {
  UPDATE_REQUEST_STATUS_TABS,
  UPDATE_REQUEST_TYPE_OPTIONS,
} from "../business-update-requests/constants/businessUpdateRequestStatus";
import useBusinessUpdateRequests from "../business-update-requests/hooks/useBusinessUpdateRequests";
import useCombinedUpdateRequests from "../business-update-requests/hooks/useCombinedUpdateRequests";
import useClassificationUpdateRequests from "../business-update-requests/hooks/useClassificationUpdateRequests";
import useLocationUpdateRequests from "../business-update-requests/hooks/useLocationUpdateRequests";

const VALID_STATUSES = new Set(UPDATE_REQUEST_STATUS_TABS.map((tab) => tab.id));
const VALID_TYPES = new Set([
  "all",
  ...UPDATE_REQUEST_TYPE_OPTIONS.map((type) => type.id),
]);

/** Shows the Admin update-request queue with shared filters and pagination. */
export default function UpdateRequestsPage() {
  useDocumentTitle("Update Requests | SugboGo Admin");

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [globalFilter, setGlobalFilter] = useState(
    () => searchParams.get("search") || "",
  );
  const debouncedGlobalFilter = useDebounce(globalFilter, 400);
  const selectedType = searchParams.get("type") || "all";
  const requestType = VALID_TYPES.has(selectedType) ? selectedType : "all";
  const selectedStatus = searchParams.get("status") || "pending";
  const status = VALID_STATUSES.has(selectedStatus)
    ? selectedStatus
    : "pending";
  const requestedPage = Number(searchParams.get("page"));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pagination = { pageIndex: page - 1, pageSize: 10 };

  const filters = {
    status: status === "all" ? undefined : status,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  };
  const nameQuery = useBusinessUpdateRequests(filters, {
    enabled: requestType === "business_name" && !debouncedGlobalFilter,
  });
  const classificationQuery = useClassificationUpdateRequests(filters, {
    enabled: requestType === "classification" && !debouncedGlobalFilter,
  });
  const locationQuery = useLocationUpdateRequests(filters, {
    enabled: requestType === "location" && !debouncedGlobalFilter,
  });
  const useCombinedQueue =
    requestType === "all" || Boolean(debouncedGlobalFilter);
  const combinedQuery = useCombinedUpdateRequests(
    {
      status,
      requestType,
      page,
      pageSize: pagination.pageSize,
      search: debouncedGlobalFilter,
    },
    { enabled: useCombinedQueue },
  );
  const query = useCombinedQueue
    ? combinedQuery
    : {
        business_name: nameQuery,
        classification: classificationQuery,
        location: locationQuery,
      }[requestType];

  useApiErrorNotification(query.error, {
    toastId: `admin-update-requests-${requestType}-load-error`,
    fallbackMessage: "Unable to load update requests. Please try again.",
  });

  function selectStatus(nextStatus) {
    setSearchParams({
      type: requestType,
      status: nextStatus || "all",
      search: globalFilter,
    });
  }

  function selectRequestType(nextType) {
    setSearchParams({
      type: nextType || "all",
      status,
      search: globalFilter,
    });
  }

  function changeSearch(value) {
    setGlobalFilter(value);
    setSearchParams({ type: requestType, status, search: value });
  }

  function resetFilters() {
    setGlobalFilter("");
    setSearchParams({ type: "all", status: "all" });
  }

  function changePagination(nextPagination) {
    setSearchParams({
      type: requestType,
      status,
      search: globalFilter,
      page: String(nextPagination.pageIndex + 1),
    });
  }

  const emptyLabel =
    status === "all"
      ? "No update requests yet"
      : `No ${status} update requests`;

  return (
    <>
      {/* Queue heading */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Management" },
          { label: "Update Requests" },
        ]}
        title="Update Requests"
      />

      {/* Request queue */}
      {query.error && query.hasData && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          The latest request queue could not be loaded.
          <button
            type="button"
            className="ml-2 cursor-pointer font-semibold underline"
            onClick={() => query.refetch()}
          >
            Retry
          </button>
        </div>
      )}
      <DataTable
        data={query.requests}
        columns={businessUpdateRequestColumns((request) =>
          navigate(
            request.request_type === "business_name"
              ? `/admin-panel/businesses/update-requests/${request.id}`
              : `/admin-panel/businesses/update-requests/${request.request_type}/${request.id}`,
          ),
        )}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.hasData ? null : query.error}
        onRetry={query.refetch}
        state={{ globalFilter, sorting: [] }}
        pagination={pagination}
        pageCount={query.pageCount}
        totalItems={query.totalItems}
        onPaginationChange={changePagination}
        onGlobalFilterChange={changeSearch}
        hasActiveFilters={
          status !== "all" || requestType !== "all" || Boolean(globalFilter)
        }
        onResetFilters={resetFilters}
        isSearching={globalFilter !== debouncedGlobalFilter}
        slots={{
          renderFilters: () => (
            <FilterMenu
              filters={[
                {
                  key: "status",
                  label: "Status",
                  icon: Tag,
                  options: [
                    { value: "", label: "All statuses" },
                    ...UPDATE_REQUEST_STATUS_TABS.filter(
                      (option) => option.id !== "all",
                    ).map((option) => ({
                      value: option.id,
                      label: option.label,
                    })),
                  ],
                  value: status === "all" ? "" : status,
                  onChange: selectStatus,
                },
                {
                  key: "type",
                  label: "Request Type",
                  icon: FileText,
                  options: [
                    { value: "", label: "All request types" },
                    ...UPDATE_REQUEST_TYPE_OPTIONS.map((option) => ({
                      value: option.id,
                      label: option.label,
                    })),
                  ],
                  value: requestType === "all" ? "" : requestType,
                  onChange: selectRequestType,
                },
              ]}
            />
          ),
        }}
        config={{
          searchPlaceholder: "Search update requests...",
          emptyState: {
            title: emptyLabel,
            description: "Requests in this state will appear here.",
            icon: <FileText className="h-10 w-10 text-text-secondary" />,
          },
          noResultsState: {
            title: "No update requests found",
          },
          errorState: {
            title: "Unable to load update requests",
            message: "The request queue could not be loaded.",
          },
        }}
      />
    </>
  );
}
