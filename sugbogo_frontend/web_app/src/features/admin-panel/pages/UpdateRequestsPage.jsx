import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import PageHeader from "@/features/admin-panel/components/PageHeader";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import businessUpdateRequestColumns from "../business-update-requests/columns/businessUpdateRequestColumns";
import {
  UPDATE_REQUEST_STATUS_TABS,
  UPDATE_REQUEST_TYPE_OPTIONS,
} from "../business-update-requests/constants/businessUpdateRequestStatus";
import useBusinessUpdateRequests from "../business-update-requests/hooks/useBusinessUpdateRequests";
import useClassificationUpdateRequests from "../business-update-requests/hooks/useClassificationUpdateRequests";
import useLocationUpdateRequests from "../business-update-requests/hooks/useLocationUpdateRequests";

const VALID_STATUSES = new Set(UPDATE_REQUEST_STATUS_TABS.map((tab) => tab.id));
const VALID_TYPES = new Set(UPDATE_REQUEST_TYPE_OPTIONS.map((type) => type.id));

/** Shows a server-filtered, paginated Admin queue for sensitive update requests. */
export default function UpdateRequestsPage() {
  useDocumentTitle("Update Requests | SugboGo Admin");

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedType = searchParams.get("type") || "business_name";
  const requestType = VALID_TYPES.has(selectedType)
    ? selectedType
    : "business_name";
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
    enabled: requestType === "business_name",
  });
  const classificationQuery = useClassificationUpdateRequests(filters, {
    enabled: requestType === "classification",
  });
  const locationQuery = useLocationUpdateRequests(filters, {
    enabled: requestType === "location",
  });
  const query = {
    business_name: nameQuery,
    classification: classificationQuery,
    location: locationQuery,
  }[requestType];

  useApiErrorNotification(query.error, {
    toastId: `admin-update-requests-${requestType}-load-error`,
    fallbackMessage: "Unable to load update requests. Please try again.",
  });

  function selectStatus(nextStatus) {
    setSearchParams({ type: requestType, status: nextStatus });
  }

  function selectRequestType(nextType) {
    setSearchParams({ type: nextType, status });
  }

  function changePagination(nextPagination) {
    setSearchParams({
      type: requestType,
      status,
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

      {/* Status queue */}
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
        state={{ globalFilter: "", sorting: [] }}
        pagination={pagination}
        pageCount={query.pageCount}
        totalItems={query.totalItems}
        onPaginationChange={changePagination}
        slots={{
          renderFilters: () => (
            <fieldset className="flex flex-wrap items-center gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Request Type
              </legend>
              <div className="flex flex-wrap rounded-lg border border-stroke bg-surface p-1">
                {UPDATE_REQUEST_TYPE_OPTIONS.map((option) => {
                  const isActive = option.id === requestType;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => selectRequestType(option.id)}
                      className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-stroke-active/20 ${
                        isActive
                          ? "bg-background text-text-primary shadow-sm"
                          : "text-text-secondary hover:bg-interaction-hover hover:text-text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ),
        }}
        config={{
          tabs: UPDATE_REQUEST_STATUS_TABS,
          activeTab: status,
          onTabChange: selectStatus,
          showSearch: false,
          emptyState: {
            title: emptyLabel,
            description: "Requests in this state will appear here.",
            icon: <FileText className="h-10 w-10 text-text-secondary" />,
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
