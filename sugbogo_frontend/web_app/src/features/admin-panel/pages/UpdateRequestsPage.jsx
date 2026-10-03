import { useNavigate, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import PageHeader from "@/features/admin-panel/components/PageHeader";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import businessUpdateRequestColumns from "../business-update-requests/columns/businessUpdateRequestColumns";
import { UPDATE_REQUEST_STATUS_TABS } from "../business-update-requests/constants/businessUpdateRequestStatus";
import useBusinessUpdateRequests from "../business-update-requests/hooks/useBusinessUpdateRequests";

const VALID_STATUSES = new Set(UPDATE_REQUEST_STATUS_TABS.map((tab) => tab.id));

/** Shows a server-filtered, paginated Admin queue for sensitive update requests. */
export default function UpdateRequestsPage() {
  useDocumentTitle("Update Requests | SugboGo Admin");

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStatus = searchParams.get("status") || "pending";
  const status = VALID_STATUSES.has(selectedStatus)
    ? selectedStatus
    : "pending";
  const requestedPage = Number(searchParams.get("page"));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pagination = { pageIndex: page - 1, pageSize: 10 };

  const query = useBusinessUpdateRequests({
    status: status === "all" ? undefined : status,
    page: pagination.pageIndex + 1,
    page_size: pagination.pageSize,
  });

  useApiErrorNotification(query.error, {
    toastId: "admin-update-requests-load-error",
    fallbackMessage: "Unable to load update requests. Please try again.",
  });

  function selectStatus(nextStatus) {
    setSearchParams({ status: nextStatus });
  }

  function changePagination(nextPagination) {
    setSearchParams({
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
      <DataTable
        data={query.requests}
        columns={businessUpdateRequestColumns((request) =>
          navigate(`/admin-panel/businesses/update-requests/${request.id}`),
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
